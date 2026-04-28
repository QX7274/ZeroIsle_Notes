"""
Storage service abstraction for saving converted files and generating download URLs.
Falls back to Django's default_storage when object storage is not enabled.
"""
from __future__ import annotations

from typing import Optional

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage

try:  # optional dependency for object storage
    import boto3  # type: ignore
    from botocore.client import Config  # type: ignore
except Exception:  # pragma: no cover
    boto3 = None  # type: ignore
    Config = None  # type: ignore


class StorageService:
    def __init__(self) -> None:
        self.provider = getattr(settings, "OBJECT_STORAGE_PROVIDER", "none").lower()
        self.bucket = getattr(settings, "AWS_S3_BUCKET_NAME", None)
        self.endpoint = getattr(settings, "AWS_S3_ENDPOINT_URL", None)
        self.region = getattr(settings, "AWS_S3_REGION_NAME", None)
        self.access_key = getattr(settings, "AWS_ACCESS_KEY_ID", None)
        self.secret_key = getattr(settings, "AWS_SECRET_ACCESS_KEY", None)

        self._s3 = None
        if self.provider in ("aws", "s3", "minio") and boto3 and self.bucket:
            session = boto3.session.Session(
                aws_access_key_id=self.access_key,
                aws_secret_access_key=self.secret_key,
                region_name=self.region,
            )
            extra = {}
            if self.endpoint:
                extra["endpoint_url"] = self.endpoint
            if self.provider == "minio":
                extra["config"] = Config(signature_version="s3v4")
            self._s3 = session.client("s3", **extra)

    def save_pdf(self, content: bytes, filename: str) -> str:
        """
        Save PDF content and return the stored key/filename.
        S3/MinIO: store under converted/<filename>.
        Local: store under <filename> via default_storage.
        """
        key = f"converted/{filename}" if self._s3 else filename
        return self.save_bytes(content, key, content_type="application/pdf")

    def save_bytes(self, content: bytes, filename: str, content_type: str) -> str:
        """
        Save arbitrary bytes. When using object storage, 'filename' acts as the object key (supports prefixes).
        Returns the key/relative path used to store the object.
        """
        if self._s3:
            self._s3.put_object(Bucket=self.bucket, Key=filename, Body=content, ContentType=content_type)
            return filename
        # Fallback: Django storage
        if default_storage.exists(filename):
            default_storage.delete(filename)
        default_storage.save(filename, ContentFile(content))
        return filename

    def generate_presigned_url(self, key: str, expires_in: int = 600) -> Optional[str]:
        if self._s3:
            return self._s3.generate_presigned_url(
                ClientMethod="get_object",
                Params={"Bucket": self.bucket, "Key": key},
                ExpiresIn=int(expires_in),
            )
        return None


storage_service = StorageService()

