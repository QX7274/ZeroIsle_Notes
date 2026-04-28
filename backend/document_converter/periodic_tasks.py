"""
Periodic Celery tasks for the document_converter app.
"""
from __future__ import annotations

import logging

from django.core.cache import cache

from backend.celery import app

logger = logging.getLogger(__name__)


@app.task(name="document_converter.cleanup_stale_caches")
def cleanup_stale_caches():
    """
    Periodically cleans up stale cache keys related to document conversion
    to prevent cache bloat from failed or very old tasks.

    Note: cache.keys() can be slow on large Redis instances. A SCAN-based
    iterator would be better for production at scale. This is sufficient for now.
    """
    patterns = ["docconv:task_for_attachment:*", "ratelimit:docconv:*"]
    deleted_count = 0

    for pattern in patterns:
        try:
            # Using scan_iter for better performance on large Redis dbs
            for key in cache.iter_keys(pattern):
                cache.delete(key)
                deleted_count += 1
        except Exception as e:
            logger.warning(f"Failed to clean up cache with pattern '{pattern}': {e}")

    if deleted_count > 0:
        logger.info(f"Cleaned up {deleted_count} stale document converter cache keys.")

    return f"Cleaned up {deleted_count} keys."

