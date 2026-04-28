from celery import shared_task
import logging

logger = logging.getLogger(__name__)

@shared_task
def index_note_task(note_id_str):
    """
    Asynchronously index a note.
    """
    try:
        from notes.mongodb_models.note import Note
        from search.services.indexer_service import IndexerService
        # Get the note
        note = Note.objects.filter(id=note_id_str).first()
        if not note:
            logger.warning(f"Note {note_id_str} not found for indexing")
            return

        indexer = IndexerService()
        indexer.index_object(note)
        logger.info(f"Indexed Note {note_id_str}")
    except Exception as e:
        logger.error(f"Error indexing Note {note_id_str}: {e}")
