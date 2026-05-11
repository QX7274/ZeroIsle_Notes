import logging
from django.conf import settings
from mongoengine import signals
from .mongodb_models.note import Note

logger = logging.getLogger(__name__)


def handle_note_save(sender, document, created, **kwargs):
    """
    Trigger post-save actions when a Note is saved:
    1. Knowledge Graph Entity Extraction
    2. Vector Search Indexing

    开发联调模式下（DEBUG=True）跳过异步任务提交，
    避免因消息中间件不可达导致请求线程阻塞超时。
    """
    if getattr(settings, 'DEBUG', False):
        logger.debug(f"DEBUG模式：跳过Note异步任务提交 note_id={document.id}")
        return

    try:
        note_id = str(document.id)
        user_id = str(document.user.id) if document.user else None
        from knowledge_graph.tasks import auto_extract_entities_task
        from search.tasks import index_note_task

        auto_extract_entities_task.delay(note_id, user_id)
        index_note_task.delay(note_id)

        logger.info(f"Triggered background tasks for Note {note_id}")
    except Exception as e:
        logger.error(f"Failed to trigger background tasks for Note {document.id}: {e}")


trigger_auto_extraction = handle_note_save


def connect_signals():
    """Connect signals to models."""
    signals.post_save.connect(trigger_auto_extraction, sender=Note)
    logger.info("Connected Note signals for Knowledge Graph.")
