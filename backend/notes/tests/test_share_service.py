from django.test import TestCase
from unittest.mock import patch
from datetime import datetime, timedelta

from ..services.share_service import ShareService
from ..mongodb_models.note import Note
from ..mongodb_models.note_share import NoteShare
from users.mongodb_models import User

class ShareServiceTests(TestCase):

    def setUp(self):
        self.user = User.objects.create(username='testuser', email='test@example.com')
        self.note = Note.objects.create(title='Test Note', content='Some content', user=self.user)
        self.share_service = ShareService()

    def tearDown(self):
        Note.objects.all().delete()
        NoteShare.objects.all().delete()
        User.objects.all().delete()

    def test_create_share_link_public(self):
        """Test creating a public share link."""
        share = self.share_service.create_share_link(self.note, self.user, 'public')
        
        self.assertIsNotNone(share)
        self.assertEqual(share.note, self.note)
        self.assertEqual(share.access_type, 'public')
        self.assertIsNone(share.password_hash)
        self.assertIsNotNone(share.share_code)

    def test_create_share_link_with_password(self):
        """Test creating a password-protected share link."""
        password = "strongpassword123"
        share = self.share_service.create_share_link(self.note, self.user, 'password', password=password)

        self.assertIsNotNone(share.password_hash, "Password hash should be set")
        self.assertNotEqual(share.password_hash, password, "Password should be hashed, not stored in plaintext")
        self.assertTrue(self.share_service.verify_password(share.share_code, password), "Password verification should succeed")
        self.assertFalse(self.share_service.verify_password(share.share_code, "wrongpassword"), "Password verification should fail for wrong password")

    def test_get_note_by_share_code_public(self):
        """Test retrieving a note using a public share code."""
        share = self.share_service.create_share_link(self.note, self.user, 'public')
        retrieved_note, error = self.share_service.get_note_by_share_code(share.share_code)

        self.assertIsNone(error)
        self.assertEqual(retrieved_note.id, self.note.id)
        # Check that view count was incremented
        share.reload()
        self.assertEqual(share.view_count, 1)

    def test_get_note_by_share_code_expired(self):
        """Test that an expired share link cannot be accessed."""
        share = self.share_service.create_share_link(self.note, self.user, 'public', expires_in_days=-1) # Expired yesterday
        retrieved_note, error = self.share_service.get_note_by_share_code(share.share_code)

        self.assertIsNone(retrieved_note)
        self.assertEqual(error, "分享链接已过期")

    def test_get_note_by_share_code_max_views_reached(self):
        """Test that a share link with max views reached cannot be accessed."""
        share = self.share_service.create_share_link(self.note, self.user, 'public', max_views=1)
        # First access should succeed
        self.share_service.get_note_by_share_code(share.share_code)
        # Second access should fail
        retrieved_note, error = self.share_service.get_note_by_share_code(share.share_code)

        self.assertIsNone(retrieved_note)
        self.assertEqual(error, "分享链接已达最大访问次数")

    def test_disable_share_link(self):
        """Test disabling a share link."""
        share = self.share_service.create_share_link(self.note, self.user, 'public')
        self.share_service.disable_share_link(share.share_code)

        share.reload()
        self.assertFalse(share.is_active, "Share link should be inactive")

