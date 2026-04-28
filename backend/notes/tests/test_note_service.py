
from django.test import TestCase
from django.contrib.auth import get_user_model
from notes.models import Note, NoteVersion
from notes.services.note_service import NoteService

User = get_user_model()

class NoteServiceTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='testuser', password='password')
        self.note = Note.objects.create(
            title="Original Title",
            content="Original Content",
            user=self.user,
            type="text"
        )

    def test_create_note_version(self):
        """Test creating a version snapshot"""
        version = NoteService.create_note_version(self.note)
        
        self.assertEqual(version.note, self.note)
        self.assertEqual(version.version_number, 1)
        self.assertEqual(version.content, "Original Content")
        
        # Modify note and create another version
        self.note.content = "Modified Content"
        self.note.save()
        
        version2 = NoteService.create_note_version(self.note)
        self.assertEqual(version2.version_number, 2)
        self.assertEqual(version2.content, "Modified Content")

    def test_restore_version(self):
        """Test restoring from a version"""
        # Create version 1
        NoteService.create_note_version(self.note)
        
        # Modify note
        self.note.title = "New Title"
        self.note.content = "New Content"
        self.note.save()
        
        # Verify current state
        self.assertEqual(self.note.content, "New Content")
        
        # Restore to version 1
        version1 = NoteVersion.objects.get(version_number=1, note=self.note)
        restored_note = NoteService.restore_version(version1.id)
        
        self.assertEqual(restored_note.content, "Original Content")
        self.assertEqual(restored_note.title, "Original Title")
        
        # Check if restore action created a backup of the state before restore?
        # Service logic: NoteService.create_note_version(note) called inside restore_version
        # So we should have version 2 (which is the "New Content" state backed up before restore)
        
        versions = NoteVersion.objects.filter(note=self.note).count()
        self.assertEqual(versions, 2)
        
        latest_version = NoteVersion.objects.order_by('-version_number').first()
        self.assertEqual(latest_version.content, "New Content") # The active state before restore

