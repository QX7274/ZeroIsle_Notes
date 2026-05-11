import os
import tempfile
import logging
import time
from pathlib import Path
from typing import Optional
import io
from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.core.cache import cache
from celery.exceptions import SoftTimeLimitExceeded
from backend.celery import app
from .services import get_document_converter
from common.services.storage_service import storage_service
from common.mongodb_models import AsyncTask
from notes.mongodb_models.note_attachment import NoteAttachment
from .exceptions import ToolNotFoundError, ConversionTimeoutError, ConversionFailedError
from . import metrics
try:
    from pdf2image import convert_from_path
except ImportError:
    convert_from_path = None

try:
    from PyPDF2 import PdfReader  # type: ignore
except Exception:  # pragma: no cover
    PdfReader = None  # type: ignore

logger = logging.getLogger(__name__)


# helper: cache set with index for cleanup
INDEX_KEY = 'docconv:index'
MAX_INDEX_SIZE = 5000

def _cache_set(key: str, value, timeout: int = 3600):
    try:
        cache.set(key, value, timeout)
        idx = cache.get(INDEX_KEY) or []
        if key not in idx:
            idx.append(key)
            if len(idx) > MAX_INDEX_SIZE:
                idx = idx[-MAX_INDEX_SIZE:]
            cache.set(INDEX_KEY, idx, timeout)
    except Exception:
        cache.set(key, value, timeout)

@app.task(
    bind=True,
    autoretry_for=(ConversionTimeoutError, IOError),
    retry_backoff=True,
    retry_jitter=True,
    retry_kwargs={'max_retries': 3},
    soft_time_limit=getattr(settings, 'CONVERSION_SOFT_LIMIT', 240),
    time_limit=getattr(settings, 'CONVERSION_HARD_LIMIT', 300)
)
def convert_document_task(self, attachment_id: str):
    """
    Celery task to convert a document to PDF asynchronously.
    """
    start_time = time.monotonic()
    mode = getattr(settings, 'DOC_CONVERTER_MODE', 'lite')
    status = 'failed'  # Default status
    try:
        attachment = NoteAttachment.objects.get(id=attachment_id)
        try:
            cache.set(f"docconv:{self.request.id}", {'status': 'processing', 'progress': 10, 'user_id': str(getattr(attachment.user, 'id', '')), 'attachment_id': str(attachment.id)}, timeout=3600)
            cache.set(f"docconv:task_for_attachment:{attachment.id}", self.request.id, timeout=3600)
        except Exception: pass

        with tempfile.NamedTemporaryFile(delete=False, suffix=Path(attachment.file_name).suffix) as tmp_in:
            tmp_in.write(attachment.file.read())
            input_path = tmp_in.name

        with tempfile.TemporaryDirectory() as output_dir:
            pdf_path = get_document_converter().convert_to_pdf(input_path, output_dir)
            pages = 0
            if PdfReader is not None:
                try:
                    pages = len(PdfReader(pdf_path).pages)
                    metrics.conversion_pages.observe(pages)
                    max_pages = int(getattr(settings, 'DOC_CONVERTER_MAX_PAGES', 0))
                    if max_pages and pages > max_pages:
                        raise ConversionFailedError(f"Page limit exceeded: {pages}>{max_pages}")
                except Exception: pass

            with open(pdf_path, 'rb') as pdf_file:
                pdf_content = pdf_file.read()

            attachment.file.replace(pdf_content, content_type='application/pdf')
            attachment.file_name = f"{Path(attachment.file_name).stem}.pdf"
            attachment.file_type = 'application/pdf'
            attachment.file_size = len(pdf_content)
            attachment.save()

            filename = f"{attachment.id}.pdf"
            storage_key = storage_service.save_pdf(pdf_content, filename)

        try: os.unlink(input_path)
        except Exception: pass

        try:
            base_name = Path(storage_key).name
            ttl = int(getattr(settings, 'DOWNLOAD_TOKEN_TTL_SECONDS', 600))
            presigned_url = storage_service.generate_presigned_url(storage_key, expires_in=ttl)
            payload = {'status': 'completed', 'progress': 100, 'user_id': str(getattr(attachment.user, 'id', '')), 'attachment_id': str(attachment.id), 'filename': base_name, 'storage_key': storage_key, 'download_mode': 'presigned' if presigned_url else 'local', 'pdf_url': presigned_url or f"/api/v1/document-converter/download/{base_name}"}
            cache.set(f"docconv:{self.request.id}", payload, timeout=3600)
            cache.set(f"docconv:file_owner:{base_name}", str(getattr(attachment.user, 'id', '')), timeout=3600)
            cache.set(f"docconv:key_map:{base_name}", storage_key, timeout=3600)
        except Exception: pass

        generate_preview_task.delay(attachment_id)
        status = 'success'
        metrics.conversion_output_bytes.observe(len(pdf_content))
        return f"Successfully converted attachment {attachment_id}"

    except NoteAttachment.DoesNotExist:
        logger.error(f"NoteAttachment with ID {attachment_id} not found.")
        raise
    except SoftTimeLimitExceeded:
        status = 'timeout'
        try:
            cache.set(f"docconv:{self.request.id}", {'status': 'failed', 'progress': 100, 'error': 'Soft time limit exceeded', 'error_code': 'TIMEOUT', 'error_message': 'Soft time limit exceeded'}, timeout=3600)
        except Exception: pass
        logger.error(f"Conversion task soft time limit exceeded for {attachment_id}", exc_info=True)
        raise
    except Exception as e:
        try:
            cache.set(f"docconv:{self.request.id}", {'status': 'failed', 'progress': 100, 'error': str(e), 'error_code': 'ERROR', 'error_message': str(e)}, timeout=3600)
        except Exception: pass
        logger.error(f"Conversion task for attachment {attachment_id} failed: {e}", exc_info=True)
        raise
    finally:
        duration = time.monotonic() - start_time
        metrics.conversion_duration.labels(mode=mode).observe(duration)
        metrics.conversion_completed.labels(status=status, mode=mode).inc()

@app.task(bind=True)
def generate_preview_task(self, attachment_id: str):
    """
    Generates a preview image for a PDF attachment.
    """
    if not convert_from_path:
        logger.warning("pdf2image is not installed. Skipping preview generation.")
        return "Skipped: pdf2image not installed."

    try:
        attachment = NoteAttachment.objects.get(id=attachment_id)
        if not attachment.file or attachment.file.content_type != 'application/pdf':
            logger.warning(f"Attachment {attachment_id} is not a PDF. Skipping preview.")
            return "Skipped: Not a PDF."

        # Create a temporary file to read the PDF from GridFS
        with tempfile.NamedTemporaryFile(suffix=".pdf") as tmp_pdf:
            tmp_pdf.write(attachment.file.read())
            tmp_pdf.seek(0)

            # Generate preview from the first page
            images = convert_from_path(tmp_pdf.name, first_page=1, last_page=1, fmt='jpeg')

        if images:
            preview_image = images[0]
            # Save via storage_service (object storage or default storage under thumbnails/)
            buf = io.BytesIO()
            preview_image.save(buf, 'JPEG', quality=85)
            image_bytes = buf.getvalue()
            key = f"thumbnails/{attachment.id}.jpg"
            stored_key = storage_service.save_bytes(image_bytes, key, content_type='image/jpeg')

            # Persist path/key on model
            attachment.thumbnail_path = stored_key
            attachment.save()

            # Update status cache with thumbnail_url
            try:
                ttl = int(getattr(settings, 'DOWNLOAD_TOKEN_TTL_SECONDS', 600))
                presigned = storage_service.generate_presigned_url(stored_key, ttl)
                if presigned:

                    thumb_url = presigned
                    thumb_url = presigned
                else:
                    media_prefix = getattr(settings, 'MEDIA_URL', '/media/')
                    if not media_prefix.endswith('/'):
                        media_prefix += '/'
                    thumb_url = f"{media_prefix}{stored_key}"

                # find task id by attachment id
                map_key = f"docconv:task_for_attachment:{attachment.id}"
                task_id = cache.get(map_key)
                if task_id:
                    payload_key = f"docconv:{task_id}"
                    payload = cache.get(payload_key) or {}
                    payload = {**payload, 'thumbnail_url': thumb_url}
                    cache.set(payload_key, payload, timeout=3600)
            except Exception:
                pass

            return f"Successfully generated preview for {attachment_id}"
        else:
            logger.warning(f"pdf2image failed to generate images for {attachment_id}")
            return "Failed: No images generated."

    except NoteAttachment.DoesNotExist:
        logger.error(f"NoteAttachment with ID {attachment_id} not found for preview generation.")
        raise
    except Exception as e:
        logger.error(f"Preview generation for {attachment_id} failed: {e}", exc_info=True)
        raise
