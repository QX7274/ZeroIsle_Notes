import os
import logging
import json
import re
from django.http import JsonResponse, FileResponse
from django.views import View
from django.conf import settings
from django.core.files.storage import default_storage
from django.core.cache import cache
from .tasks import convert_document_task
from notes.mongodb_models.note import Note
from notes.mongodb_models.note_attachment import NoteAttachment

from common.services.storage_service import storage_service
from common.services.virus_scan_service import scan_bytes, clamav_ping

# optional dependency: python-magic
try:
    import magic
except Exception:  # pragma: no cover
    magic = None

logger = logging.getLogger(__name__)
from . import metrics


# Constants
MAX_UPLOAD_BYTES = settings.MAX_UPLOAD_MB * 1024 * 1024
FILENAME_SAFE_RE = re.compile(r'^[A-Za-z0-9_.-]+\.pdf$')

# Simple per-user/IP rate limit helper
import time

def _client_identity(request):
    if getattr(request, 'user', None) and getattr(request.user, 'is_authenticated', False):
        return f"u:{getattr(request.user, 'id', '')}"
    # Fallback to IP
    return f"ip:{request.META.get('REMOTE_ADDR', '0.0.0.0')}"


def _rate_limited(request, key: str, limit: int, window_sec: int):
    ident = _client_identity(request)
    bucket = int(time.time() // max(1, window_sec))
    cache_key = f"ratelimit:{key}:{ident}:{bucket}"
    # init=1 with expiry
    added = cache.add(cache_key, 1, timeout=window_sec)
    if added:
        return False  # not limited
    try:
        current = cache.incr(cache_key)
    except Exception:
        current = cache.get(cache_key) or 1
    return current > limit



ALLOWED_CONVERT_EXT = {'.doc', '.docx', '.ppt', '.pptx'}

def _require_auth(request):
    if not getattr(request, 'user', None) or not request.user.is_authenticated:
        return JsonResponse({'success': False, 'error_code': 'UNAUTHORIZED', 'error': '未授权，请登录后重试'}, status=401)
    return None

class DocumentConverterView(View):
    """
    文档转换API视图，处理文件上传并触发异步转换。
    """

    def _validate_upload(self, uploaded_file):
        """验证上传的文件是否符合安全和格式要求。"""
        max_size = settings.MAX_UPLOAD_MB * 1024 * 1024
        if uploaded_file.size > max_size:
            return False, f'文件过大，最大允许 {settings.MAX_UPLOAD_MB} MB'

        file_ext = os.path.splitext(uploaded_file.name)[1].lower()
        if file_ext not in ALLOWED_CONVERT_EXT:
            return False, f'不支持的文件格式: {file_ext}'

        if magic:
            try:
                head = uploaded_file.read(2048)
                mime = magic.from_buffer(head, mime=True)
                uploaded_file.seek(0)
                # A more robust check could be implemented here based on a settings mapping
                if not mime.startswith(('application/', 'text/')):
                    return False, f'检测到不安全的MIME类型: {mime}'
            except Exception as e:
                logger.warning(f"MIME类型检测失败: {e}")
        else:
            logger.warning("python-magic 不可用，跳过MIME类型检测。")

        return True, "Validation successful"

    def post(self, request):
        """
        处理文档上传并触发异步转换。
        """
        try:
            auth_err = _require_auth(request)
            if auth_err:
                return auth_err

            if 'file' not in request.FILES:
                return JsonResponse({'success': False, 'error_code': 'NO_FILE', 'error': '没有上传文件'}, status=400)

            uploaded_file = request.FILES['file']
            note_id = request.POST.get('note_id')

            if not note_id:
                return JsonResponse({'success': False, 'error_code': 'MISSING_NOTE_ID', 'error': '缺少必需的 note_id'}, status=400)

            try:
                note = Note.objects.get(id=note_id, user=request.user)
            except Note.DoesNotExist:
                return JsonResponse({'success': False, 'error_code': 'NOTE_NOT_FOUND', 'error': '笔记不存在或无权访问'}, status=404)

            is_valid, error_message = self._validate_upload(uploaded_file)
            if not is_valid:
                status_code = 413 if uploaded_file.size > MAX_UPLOAD_BYTES else 400
                err_code = 'PAYLOAD_TOO_LARGE' if status_code == 413 else 'INVALID_FILE'
                return JsonResponse({'success': False, 'error_code': err_code, 'error': error_message}, status=status_code)

            # Optional virus scan
            if getattr(settings, 'DOC_CONVERTER_VIRUS_SCAN', False):
                try:
                    content_bytes = uploaded_file.read()
                    uploaded_file.seek(0)
                    scan_result = scan_bytes(content_bytes)
                    if scan_result.infected:
                        if getattr(settings, 'VIRUS_SCAN_AUDIT_LOG_ENABLED', False):
                            try:
                                audit_logger = logging.getLogger('virus_scan_audit')
                                user_id = getattr(request.user, 'id', 'anonymous')
                                client_ip = request.META.get('REMOTE_ADDR', '')
                                user_agent = request.META.get('HTTP_USER_AGENT', '')
                                audit_logger.info(f"Malware detected | user_id={user_id} | client_ip={client_ip} | filename={uploaded_file.name} | signature={scan_result.signature} | user_agent='{user_agent}'")
                            except Exception:
                                pass # Do not fail request if audit logging fails
                        return JsonResponse({'success': False, 'error_code': 'MALWARE_DETECTED', 'error': '检测到恶意内容', 'signature': scan_result.signature}, status=422)
                except Exception as _:
                    # Be permissive on scanner failure but log warning
                    logger.warning('Virus scan failed, continue permissively')

            attachment = NoteAttachment(
                note=note,
                user=request.user,
                file_name=uploaded_file.name,
                file_type=uploaded_file.content_type,
                file_size=uploaded_file.size
            )
            attachment.file.put(uploaded_file, content_type=uploaded_file.content_type)
            attachment.save()

            # Instrument metrics
            metrics.conversion_started.labels(source='upload').inc()
            file_ext = os.path.splitext(uploaded_file.name)[1].lower().strip('.')
            metrics.conversion_input_bytes.labels(extension=file_ext).observe(uploaded_file.size)

            task_async = convert_document_task.delay(attachment_id=str(attachment.id))
            cache.set(
                f"docconv:{task_async.id}",
                {
                    'status': 'queued',
                    'progress': 0,
                    'user_id': str(getattr(request.user, 'id', '')),
                    'attachment_id': str(attachment.id)
                },
                timeout=3600
            )

            return JsonResponse({
                'success': True,
                'attachment_id': str(attachment.id),
                'task_id': task_async.id,
                'status_url': f"/api/v1/document-converter/status/{task_async.id}/",
                'message': '文件上传成功，转换任务已开始'
            }, status=202)

        except Exception as e:
            logger.error(f"文档转换API异常: {e}", exc_info=True)
            return JsonResponse({'success': False, 'error_code': 'INTERNAL_ERROR', 'error': '服务器内部错误'}, status=500)

# ---- Health check ----
import shutil
from datetime import datetime, timezone

def health_check(request):
    virus_enabled = getattr(settings, 'DOC_CONVERTER_VIRUS_SCAN', False)
    clam_ok = False
    try:
        clam_ok = clamav_ping(getattr(settings, 'CLAMAV_HOST', '127.0.0.1'), int(getattr(settings, 'CLAMAV_PORT', 3310))) if virus_enabled else False
    except Exception:
        clam_ok = False
    data = {
        'success': True,
        'time': datetime.now(timezone.utc).isoformat(),
        'converter_mode': getattr(settings, 'DOC_CONVERTER_MODE', 'lite'),
        'dependencies': {
            'libreoffice_path': settings.LIBREOFFICE_PATH,
            'libreoffice_available': bool(shutil.which(settings.LIBREOFFICE_PATH)),
            'soffice_available': bool(shutil.which('soffice')),
            'unoconv_available': bool(shutil.which('unoconv')),
            'pandoc_path': settings.PANDOC_PATH,
            'pandoc_available': bool(shutil.which(settings.PANDOC_PATH)),
            'python_magic_available': magic is not None,
            'virus_scan_enabled': virus_enabled,
            'clamav_reachable': clam_ok,
        }
    }
    return JsonResponse(data, status=200)


# ---- Status by task id ----

def conversion_status_by_id(request, task_id: str):
    auth_err = _require_auth(request)
    if auth_err:
        return auth_err

    cache_key = f"docconv:{task_id}"
    task = cache.get(cache_key)
    if not task:
        return JsonResponse({'success': False, 'error_code': 'TASK_NOT_FOUND', 'error': '任务不存在或已过期'}, status=404)

    owner_id = task.get('user_id')
    if str(getattr(request.user, 'id', '')) != str(owner_id) and not getattr(request.user, 'is_staff', False):
        return JsonResponse({'success': False, 'error_code': 'FORBIDDEN', 'error': '无权访问该任务'}, status=403)

    # Enrich with presigned url when possible
    try:
        ttl_seconds = int(getattr(settings, 'DOWNLOAD_TOKEN_TTL_SECONDS', 600))
        storage_key = task.get('storage_key')
        if storage_key:
            presigned_url = storage_service.generate_presigned_url(storage_key, expires_in=ttl_seconds)
            if presigned_url:
                task = {**task, 'download_mode': 'presigned', 'pdf_url': presigned_url}
    except Exception:
        pass

    return JsonResponse({'success': True, 'data': task}, status=200)


# ---- Token generation & secure download ----
import secrets

def generate_download_token(request):
    auth_err = _require_auth(request)
    if auth_err:
        return auth_err
    # simple rate limit: 10 req/min per user/IP
    if _rate_limited(request, 'docconv:gen_token', limit=10, window_sec=60):
        return JsonResponse({'success': False, 'error_code': 'RATE_LIMITED', 'error': '请求过于频繁'}, status=429)

    try:
        body = json.loads(request.body or '{}')
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error_code': 'INVALID_JSON', 'error': '无效的JSON'}, status=400)

    filename = body.get('filename')
    if not filename or not FILENAME_SAFE_RE.match(filename):
        return JsonResponse({'success': False, 'error_code': 'INVALID_FILENAME', 'error': '非法文件名'}, status=400)

    # Owner verification via cache (fallback to allow staff)
    owner_key = f"docconv:file_owner:{filename}"
    owner_id = cache.get(owner_key)
    if owner_id is not None and str(owner_id) != str(getattr(request.user, 'id', '')) and not getattr(request.user, 'is_staff', False):
        return JsonResponse({'success': False, 'error_code': 'FORBIDDEN', 'error': '无权为该文件生成下载令牌'}, status=403)

    ttl_seconds = int(getattr(settings, 'DOWNLOAD_TOKEN_TTL_SECONDS', 600))

    # If object storage is enabled and we have a storage key, prefer presigned URL
    presigned_url = None
    try:
        storage_key = cache.get(f"docconv:key_map:{filename}")
        if storage_key:
            presigned_url = storage_service.generate_presigned_url(storage_key, expires_in=ttl_seconds)
    except Exception:
        presigned_url = None

    # Fallback to local protected download with short-lived token
    token = secrets.token_urlsafe(16)
    cache.set(
        f"docconv:download_token:{token}",
        {'filename': filename, 'user_id': str(getattr(request.user, 'id', ''))},
        ttl_seconds
    )

    download_url = f"/api/v1/document-converter/download/{filename}?token={token}"
    resp = {
        'success': True,
        'expires_in': ttl_seconds,
        'mode': 'presigned' if presigned_url else 'local',
        'download_url': presigned_url or download_url,
    }
    # Include token for backward compatibility
    if not presigned_url:
        resp['token'] = token
    else:
        resp['presigned_url'] = presigned_url
        resp['token'] = token  # optional, kept for compatibility
    return JsonResponse(resp, status=200)


def download_converted_pdf(request, filename: str):
    auth_err = _require_auth(request)
    if auth_err:
        return auth_err
    # simple rate limit: 60 req/min per user/IP
    if _rate_limited(request, 'docconv:download', limit=60, window_sec=60):
        return JsonResponse({'success': False, 'error_code': 'RATE_LIMITED', 'error': '请求过于频繁'}, status=429)

    if not FILENAME_SAFE_RE.match(filename):
        return JsonResponse({'success': False, 'error_code': 'INVALID_FILENAME', 'error': '非法文件名'}, status=400)

    token = request.GET.get('token')
    if token:
        token_data = cache.get(f"docconv:download_token:{token}")
        if not token_data or token_data.get('filename') != filename:
            return JsonResponse({'success': False, 'error_code': 'INVALID_TOKEN', 'error': '无效或已过期的令牌'}, status=403)
    else:
        # Without token, require ownership or staff
        owner_id = cache.get(f"docconv:file_owner:{filename}")
        if owner_id is not None and str(owner_id) != str(getattr(request.user, 'id', '')) and not getattr(request.user, 'is_staff', False):
            return JsonResponse({'success': False, 'error_code': 'FORBIDDEN', 'error': '无权下载该文件'}, status=403)

    if not default_storage.exists(filename):
        return JsonResponse({'success': False, 'error_code': 'FILE_NOT_FOUND', 'error': '文件不存在'}, status=404)

    f = default_storage.open(filename, 'rb')
    return FileResponse(f, content_type='application/pdf')


# ---- Base64 conversion ----
import base64

class Base64ConvertView(View):
    def post(self, request):
        auth_err = _require_auth(request)
        if auth_err:
            return auth_err

        try:
            payload = json.loads(request.body or '{}')
        except json.JSONDecodeError:
            return JsonResponse({'success': False, 'error': '无效的JSON'}, status=400)

        file_data = payload.get('file_data')  # base64 string
        file_extension = str(payload.get('file_extension') or '').lower().strip()
        note_id = payload.get('note_id')
        filename = payload.get('filename') or f"upload{file_extension or ''}"

        if not file_data or not file_extension or not note_id:
            return JsonResponse({'success': False, 'error_code': 'MISSING_PARAMS', 'error': '缺少必需参数 file_data/file_extension/note_id'}, status=400)

        if file_extension not in ALLOWED_CONVERT_EXT:
            return JsonResponse({'success': False, 'error': f'不支持的文件扩展名: {file_extension}'}, status=400)

        # Verify note ownership
        try:
            note = Note.objects.get(id=note_id, user=request.user)
        except Note.DoesNotExist:
            return JsonResponse({'success': False, 'error': '笔记不存在或无权访问'}, status=404)

        # Decode base64 and virus scan, size check
        try:
            raw_bytes = base64.b64decode(file_data, validate=True)
        except Exception:
            return JsonResponse({'success': False, 'error': '无效的Base64数据'}, status=400)

        if getattr(settings, 'DOC_CONVERTER_VIRUS_SCAN', False):
            try:
                scan_result = scan_bytes(raw_bytes)
                if scan_result.infected:
                    if getattr(settings, 'VIRUS_SCAN_AUDIT_LOG_ENABLED', False):
                        try:
                            audit_logger = logging.getLogger('virus_scan_audit')
                            user_id = getattr(request.user, 'id', 'anonymous')
                            client_ip = request.META.get('REMOTE_ADDR', '')
                            user_agent = request.META.get('HTTP_USER_AGENT', '')
                            audit_logger.info(f"Malware detected | user_id={user_id} | client_ip={client_ip} | filename={filename} | signature={scan_result.signature} | user_agent='{user_agent}'")
                        except Exception:
                            pass # Do not fail request if audit logging fails
                    return JsonResponse({'success': False, 'error_code': 'MALWARE_DETECTED', 'error': '检测到恶意内容', 'signature': scan_result.signature}, status=422)
            except Exception:
                logger.warning('Virus scan failed on base64, continue permissively')

        if len(raw_bytes) > MAX_UPLOAD_BYTES:
            return JsonResponse({'success': False, 'error': f'文件过大，最大允许 {settings.MAX_UPLOAD_MB} MB'}, status=413)

        # Create attachment and queue conversion
        attachment = NoteAttachment(
            note=note,
            user=request.user,
            file_name=filename,
            file_type='application/octet-stream',
            file_size=len(raw_bytes)
        )
        attachment.file.put(raw_bytes, content_type='application/octet-stream')
        attachment.save()

        # Instrument metrics
        metrics.conversion_started.labels(source='base64').inc()
        metrics.conversion_input_bytes.labels(extension=file_extension.strip('.')).observe(len(raw_bytes))

        task_async = convert_document_task.delay(attachment_id=str(attachment.id))
        cache.set(
            f"docconv:{task_async.id}",
            {
                'status': 'queued',
                'progress': 0,
                'user_id': str(getattr(request.user, 'id', '')),
                'attachment_id': str(attachment.id)
            },
            timeout=3600
        )

        return JsonResponse({
            'success': True,
            'attachment_id': str(attachment.id),
            'task_id': task_async.id,
            'status_url': f"/api/v1/document-converter/status/{task_async.id}/",
            'message': '文件上传成功，转换任务已开始'
        }, status=202)
