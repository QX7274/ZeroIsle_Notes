"""Server-side resumable upload contract used by the Android client.

Each request carries at most one base64 encoded chunk. The session manifest is
durable in MongoDB, while individual chunks and the final object are streamed
through the configured storage provider.
"""

import base64
import binascii
import hashlib
import math
import os
import tempfile
import uuid
from datetime import timedelta

from django.conf import settings
from django.utils.text import get_valid_filename
from django.utils import timezone

from common.services.storage_service import storage_service
from notes.mongodb_models import Note, NoteAttachment, UploadSession


DEFAULT_CHUNK_SIZE = 1024 * 1024
MAX_CHUNKED_ATTACHMENT_SIZE = int(
    getattr(settings, 'MAX_CHUNKED_ATTACHMENT_MB', 500)
) * 1024 * 1024
DEFAULT_ALLOWED_MIME_TYPES = {
    'application/octet-stream',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/jpeg',
    'image/png',
    'image/gif',
    'audio/mpeg',
    'audio/wav',
    'video/mp4',
    'text/plain',
    'text/markdown',
}


class UploadSessionError(ValueError):
    """A client-correctable upload contract error."""

    status_code = 400


def _allowed_mime_types():
    configured = getattr(settings, 'ALLOWED_MIME_TYPES', None)
    return set(configured or DEFAULT_ALLOWED_MIME_TYPES)


def validate_upload_init(payload):
    """Validate and normalize an init request before any state is created."""
    if not isinstance(payload, dict):
        raise UploadSessionError('上传初始化参数无效')

    name = get_valid_filename(str(payload.get('name') or '').strip())
    if not name:
        raise UploadSessionError('文件名不能为空')

    try:
        size = int(payload.get('size'))
    except (TypeError, ValueError):
        raise UploadSessionError('文件大小必须是整数')

    if size < 1:
        raise UploadSessionError('文件大小必须大于0')
    if size > MAX_CHUNKED_ATTACHMENT_SIZE:
        raise UploadSessionError(
            f'文件大小超过分片上传限制 ({MAX_CHUNKED_ATTACHMENT_SIZE // 1024 // 1024}MB)'
        )

    file_type = str(payload.get('type') or 'application/octet-stream').strip().lower()
    if file_type not in _allowed_mime_types():
        raise UploadSessionError(f'不支持的文件类型: {file_type}')

    return {
        'name': name,
        'size': size,
        'type': file_type,
        'note_id': str(payload.get('noteId') or '').strip() or None,
        'device_id': str(payload.get('deviceId') or '')[:150] or None,
        'client_op_id': str(payload.get('clientOpId') or '')[:150] or None,
    }


def _user_key(user):
    return str(getattr(user, 'id', 'anonymous'))


def _session_for_user(session_id, user):
    try:
        return UploadSession.objects.get(id=str(session_id), user=user)
    except UploadSession.DoesNotExist as exc:
        raise UploadSessionError('上传会话不存在或无权访问') from exc


class ChunkedUploadService:
    """Create, advance, finalize, and cancel durable upload sessions."""

    @staticmethod
    def _response(session):
        response = {
            'sessionId': session.id,
            'fileId': session.id,
            'uploadedBytes': session.received_bytes,
            'totalSize': session.file_size,
            'chunkSize': session.chunk_size,
            'status': session.status,
        }
        note = getattr(session, 'note', None)
        if note is not None:
            response['noteId'] = str(note.id)
        if getattr(session, 'attachment_id', None):
            response['attachmentId'] = session.attachment_id
        if getattr(session, 'sha256', None):
            response['sha256'] = session.sha256
        return response

    @staticmethod
    def _chunk_key(session, chunk_index):
        return f'{session.storage_prefix}/{int(chunk_index):08d}.part'

    def init_upload(self, user, payload):
        data = validate_upload_init(payload)

        note = None
        if data['note_id']:
            try:
                note = Note.objects.get(id=data['note_id'], user=user)
            except Note.DoesNotExist as exc:
                raise UploadSessionError('笔记不存在或无权添加附件') from exc

        if data['client_op_id']:
            existing = UploadSession.objects(
                user=user,
                client_op_id=data['client_op_id'],
                status__in=('uploading', 'completed'),
            ).first()
            if existing:
                return self._response(existing)

        session_id = f'up_{uuid.uuid4().hex}'
        session = UploadSession(
            id=session_id,
            user=user,
            note=note,
            file_name=data['name'],
            file_type=data['type'],
            file_size=data['size'],
            chunk_size=DEFAULT_CHUNK_SIZE,
            storage_prefix=f'uploads/chunks/{_user_key(user)}/{session_id}',
            client_op_id=data['client_op_id'],
            device_id=data['device_id'],
            expires_at=timezone.now() + timedelta(hours=24),
        )
        session.save()
        return self._response(session)

    def upload_chunk(self, user, payload, raw_chunk=None):
        if not isinstance(payload, dict):
            raise UploadSessionError('分片上传参数无效')

        session = _session_for_user(payload.get('sessionId'), user)
        if session.status != 'uploading':
            if session.status == 'completed':
                return self._response(session)
            raise UploadSessionError('上传会话当前不可写入')

        try:
            offset = int(payload.get('offset'))
            chunk_index = int(payload.get('chunkIndex'))
            total_size = int(payload.get('totalSize'))
        except (TypeError, ValueError) as exc:
            raise UploadSessionError('分片位置或文件大小无效') from exc

        if total_size != session.file_size:
            raise UploadSessionError('文件总大小与上传会话不一致')
        if offset < 0 or chunk_index < 0:
            raise UploadSessionError('分片位置无效')

        if raw_chunk is not None:
            if not isinstance(raw_chunk, (bytes, bytearray)):
                raise UploadSessionError('二进制分片内容无效')
            chunk = bytes(raw_chunk)
        else:
            encoded = payload.get('data')
            if not encoded:
                raise UploadSessionError('分片内容不能为空')
            try:
                chunk = base64.b64decode(encoded, validate=True)
            except (binascii.Error, ValueError, TypeError) as exc:
                raise UploadSessionError('分片内容不是有效的Base64') from exc

        expected_length = min(session.chunk_size, session.file_size - offset)
        if offset >= session.file_size or len(chunk) != expected_length:
            raise UploadSessionError('分片大小或位置不正确')

        chunk_hash = hashlib.sha256(chunk).hexdigest()
        existing_hash = (session.chunk_hashes or {}).get(str(chunk_index))
        if existing_hash:
            if existing_hash != chunk_hash:
                raise UploadSessionError('重复分片内容不一致')
            return self._response(session)

        if offset != session.received_bytes:
            raise UploadSessionError('分片必须按顺序上传')

        storage_service.save_bytes(
            chunk,
            self._chunk_key(session, chunk_index),
            content_type='application/octet-stream',
        )
        session.received_chunks = sorted([*(session.received_chunks or []), chunk_index])
        session.chunk_hashes = {
            **(session.chunk_hashes or {}),
            str(chunk_index): chunk_hash,
        }
        session.received_bytes += len(chunk)
        session.save()
        return self._response(session)

    def complete_upload(self, user, payload):
        if not isinstance(payload, dict):
            raise UploadSessionError('上传完成参数无效')

        session = _session_for_user(payload.get('sessionId'), user)
        if session.status == 'completed':
            return self._response(session)
        if session.status != 'uploading':
            raise UploadSessionError('上传会话当前不可完成')

        total_chunks = math.ceil(session.file_size / session.chunk_size)
        if (
            session.received_bytes != session.file_size
            or len(session.received_chunks or []) != total_chunks
            or set(session.received_chunks or []) != set(range(total_chunks))
        ):
            raise UploadSessionError('所有分片上传完成后才能确认文件')

        final_key = f'uploads/files/{_user_key(user)}/{session.id}/{session.file_name}'
        digest = hashlib.sha256()
        temporary_path = None
        try:
            with tempfile.NamedTemporaryFile(delete=False) as temporary:
                temporary_path = temporary.name
                for index in range(total_chunks):
                    chunk_digest = hashlib.sha256()
                    with storage_service.open(self._chunk_key(session, index)) as chunk_stream:
                        while True:
                            block = chunk_stream.read(1024 * 1024)
                            if not block:
                                break
                            chunk_digest.update(block)
                            digest.update(block)
                            temporary.write(block)

                    expected_chunk_hash = (session.chunk_hashes or {}).get(str(index))
                    if (
                        not expected_chunk_hash
                        or chunk_digest.hexdigest() != expected_chunk_hash
                    ):
                        raise UploadSessionError('分片完整性校验失败')

            expected_hash = str(payload.get('sha256') or '').lower().strip()
            if not expected_hash:
                raise UploadSessionError('文件完整性校验值不能为空')
            if len(expected_hash) != 64 or any(
                character not in '0123456789abcdef' for character in expected_hash
            ):
                raise UploadSessionError('文件完整性校验值格式无效')
            if digest.hexdigest() != expected_hash:
                raise UploadSessionError('文件完整性校验失败')

            with open(temporary_path, 'rb') as complete_stream:
                storage_service.save_stream(
                    complete_stream,
                    final_key,
                    content_type=session.file_type,
                )
        finally:
            if temporary_path and os.path.exists(temporary_path):
                os.unlink(temporary_path)

        for index in session.received_chunks or []:
            storage_service.delete(self._chunk_key(session, index))

        attachment_id = self._reconcile_attachment(session, final_key)
        session.attachment_id = attachment_id
        session.final_storage_key = final_key
        session.sha256 = digest.hexdigest()
        session.status = 'completed'
        session.error = None
        session.save()
        return self._response(session)

    @staticmethod
    def _reconcile_attachment(session, final_key):
        """Create or update one domain attachment for note-bound uploads."""
        note = getattr(session, 'note', None)
        if note is None:
            return None

        attachment = None
        existing_id = getattr(session, 'attachment_id', None)
        if existing_id:
            try:
                attachment = NoteAttachment.objects.get(id=existing_id)
            except NoteAttachment.DoesNotExist:
                attachment = None

        if attachment is None:
            attachment = NoteAttachment.objects(
                note=note,
                user=session.user,
                storage_key=final_key,
                is_deleted=False,
            ).first()

        if attachment is None:
            attachment = NoteAttachment(
                note=note,
                user=session.user,
                file_name=session.file_name,
                file_type=session.file_type,
                file_size=session.file_size,
                storage_key=final_key,
            )
        else:
            attachment.file_name = session.file_name
            attachment.file_type = session.file_type
            attachment.file_size = session.file_size
            attachment.storage_key = final_key
        attachment.save()
        return str(attachment.id)

    def cancel_upload(self, user, payload):
        if not isinstance(payload, dict):
            raise UploadSessionError('上传取消参数无效')

        session = _session_for_user(payload.get('sessionId'), user)
        if session.status == 'completed':
            raise UploadSessionError('已完成的上传不能取消')

        for index in session.received_chunks or []:
            storage_service.delete(self._chunk_key(session, index))
        session.status = 'cancelled'
        session.error = str(payload.get('reason') or 'user_cancelled')[:255]
        session.save()
        return self._response(session)

    def get_download(self, user, session_id):
        session = _session_for_user(session_id, user)
        if session.status != 'completed' or not session.final_storage_key:
            raise UploadSessionError('文件尚未完成上传')
        return session

    def get_status(self, user, session_id):
        """Return the server-authoritative offset for restart/resume recovery."""
        return self._response(_session_for_user(session_id, user))


chunked_upload_service = ChunkedUploadService()
