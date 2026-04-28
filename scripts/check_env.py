"""
Environment self-check script for deployment and CI.
Runs lightweight checks for common dependencies and prints a summary report.
Usage:
  python scripts/check_env.py

Requires DJANGO_SETTINGS_MODULE to be set (e.g. backend.settings.development).
"""
from __future__ import annotations

import os
import json
import socket
import shutil

report = {"checks": [], "summary": {"ok": 0, "warn": 0, "fail": 0}}


def add_result(name: str, status: str, details: str | None = None):
    report["checks"].append({"name": name, "status": status, "details": details})
    key = {"ok": "ok", "warning": "warn", "fail": "fail"}.get(status, "warn")
    report["summary"][key] += 1


# Django settings
try:
    from django.conf import settings  # type: ignore
    django_loaded = True
    add_result("django_settings", "ok", f"module={os.environ.get('DJANGO_SETTINGS_MODULE')}")
except Exception as e:  # pragma: no cover
    django_loaded = False
    add_result("django_settings", "fail", f"{e}")

# Redis
redis_host = os.environ.get("REDIS_HOST", "127.0.0.1")
redis_port = int(os.environ.get("REDIS_PORT", 6379))
try:
    sock = socket.create_connection((redis_host, redis_port), timeout=1.5)
    sock.close()
    add_result("redis_tcp", "ok", f"{redis_host}:{redis_port}")
except Exception as e:
    add_result("redis_tcp", "warning", f"{redis_host}:{redis_port} not reachable: {e}")

# Celery broker/result env
broker = os.environ.get("CELERY_BROKER_URL")
backend = os.environ.get("CELERY_RESULT_BACKEND")
if broker and backend:
    add_result("celery_env", "ok", f"broker set, backend set")
else:
    add_result("celery_env", "warning", f"broker or backend missing")

# LibreOffice / Pandoc availability (path only)
if django_loaded:
    lo = shutil.which(getattr(settings, "LIBREOFFICE_PATH", "libreoffice"))
    pd = shutil.which(getattr(settings, "PANDOC_PATH", "pandoc"))
    add_result("libreoffice_path", "ok" if lo else "warning", str(lo))
    add_result("pandoc_path", "ok" if pd else "warning", str(pd))

# python-magic
try:
    import magic  # type: ignore

    add_result("python_magic", "ok")
except Exception:
    add_result("python_magic", "warning", "python-magic not available")

# pdf2image (optional for thumbnails)
try:
    import pdf2image  # type: ignore

    add_result("pdf2image", "ok")
except Exception:
    add_result("pdf2image", "warning", "pdf2image not available")

# Object storage config presence
provider = os.environ.get("OBJECT_STORAGE_PROVIDER", "none").lower()
if provider in ("s3", "minio"):
    missing = [k for k in ("AWS_S3_BUCKET_NAME", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY") if not os.environ.get(k)]
    if missing:
        add_result("object_storage", "warning", f"provider={provider}, missing={','.join(missing)}")
    else:
        add_result("object_storage", "ok", f"provider={provider}")
else:
    add_result("object_storage", "ok", "provider=none")

# Media directory writable
if django_loaded:
    media_root = getattr(settings, "MEDIA_ROOT", None)
    if media_root:
        ok = os.path.isdir(media_root) and os.access(media_root, os.W_OK)
        add_result("media_writable", "ok" if ok else "warning", media_root)
    else:
        add_result("media_writable", "warning", "MEDIA_ROOT not set")

print(json.dumps(report, ensure_ascii=False, indent=2))

