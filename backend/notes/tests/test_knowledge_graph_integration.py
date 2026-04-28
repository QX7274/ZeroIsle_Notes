
from django.test import SimpleTestCase
from unittest.mock import patch, MagicMock
from notes.mongodb_models.note import Note
from users.mongodb_models import User
from notes.signals import trigger_auto_extraction
from notes.apps import NotesConfig
from django.apps import apps

class KnowledgeGraphIntegrationTest(SimpleTestCase):
    """
    Test the integration between Note events and Knowledge Graph tasks.
    """

    @patch('notes.signals.auto_extract_entities_task.delay')
    def test_trigger_extraction_logic(self, mock_delay):
        """
        Verify that the signal handler calls the Celery task with correct arguments.
        """
        # Setup mock objects
        user = MagicMock(spec=User)
        user.id = 'user_123'
        
        note = MagicMock(spec=Note)
        note.id = 'note_456'
        note.user = user
        
        # Execute the handler directly
        trigger_auto_extraction(sender=Note, document=note, created=True)
        
        # Assert task was queued
        mock_delay.assert_called_once_with('note_456', 'user_123')

    @patch('notes.signals.signals.post_save.connect')
    def test_signal_connection(self, mock_connect):
        """
        Verify that the ready() method connects the post_save signal.
        """
        # We need to simulate the app ready process or just call the connect function directly
        from notes import signals
        signals.connect_signals()
        
        # Verify connection
        mock_connect.assert_called_with(trigger_auto_extraction, sender=Note)
