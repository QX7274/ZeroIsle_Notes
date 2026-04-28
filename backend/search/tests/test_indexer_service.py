from django.test import TestCase
from unittest.mock import patch, MagicMock

from ..services.indexer_service import IndexerService
from ..services.vector_service import VectorService
from ..mongodb_models import SearchIndex
from users.mongodb_models import User

class IndexerServiceTests(TestCase):

    def setUp(self):
        """Set up a clean environment for each test."""
        # Create a dummy user
        self.user = User.objects.create(username='testuser', email='test@example.com')
        self.vector_service = VectorService()
        self.indexer_service = IndexerService(vector_service=self.vector_service)

    def tearDown(self):
        """Clean up the database."""
        SearchIndex.objects.all().delete()
        User.objects.all().delete()

    @patch.object(VectorService, 'vectorize_text')
    def test_index_document_creates_new_index(self, mock_vectorize_text):
        """Test that a new document is indexed correctly."""
        mock_vectorize_text.return_value = [0.1, 0.2, 0.3]  # Mock vector

        content = "This is the content of the note."
        obj_id = "some_note_id"
        index_type = "note"

        self.indexer_service.index_document(obj_id, content, index_type, self.user)

        self.assertEqual(SearchIndex.objects.count(), 1)
        index = SearchIndex.objects.first()
        self.assertEqual(index.object_id, obj_id)
        self.assertEqual(index.content, content)
        self.assertEqual(index.index_type, index_type)
        self.assertEqual(index.user, self.user)
        self.assertIsNotNone(index.vector)
        mock_vectorize_text.assert_called_once_with(content)

    @patch.object(VectorService, 'vectorize_text')
    def test_index_document_updates_existing_index(self, mock_vectorize_text):
        """Test that an existing document is updated correctly."""
        obj_id = "some_note_id"
        index_type = "note"
        
        # Create an initial index
        SearchIndex.objects.create(
            object_id=obj_id,
            content="Initial content",
            index_type=index_type,
            user=self.user,
            vector=[0.1, 0.1, 0.1]
        )
        self.assertEqual(SearchIndex.objects.count(), 1)

        # Now, update it
        new_content = "Updated content"
        mock_vectorize_text.return_value = [0.9, 0.8, 0.7]
        self.indexer_service.index_document(obj_id, new_content, index_type, self.user)

        self.assertEqual(SearchIndex.objects.count(), 1)
        updated_index = SearchIndex.objects.get(object_id=obj_id)
        self.assertEqual(updated_index.content, new_content)
        self.assertEqual(list(updated_index.vector), [0.9, 0.8, 0.7])
        mock_vectorize_text.assert_called_once_with(new_content)

    def test_remove_document(self):
        """Test removing a document from the index."""
        obj_id = "some_note_id"
        
        # Create an index to remove
        SearchIndex.objects.create(
            object_id=obj_id,
            content="Content to be removed",
            index_type="note",
            user=self.user
        )
        self.assertEqual(SearchIndex.objects.count(), 1)

        self.indexer_service.remove_document(obj_id)
        self.assertEqual(SearchIndex.objects.count(), 0)

