from django.test import TestCase
from unittest.mock import patch, MagicMock
import numpy as np

from ..services.search_service import SearchService
from ..services.vector_service import VectorService
from ..mongodb_models import SearchIndex, SearchQuery, SearchResult
from users.mongodb_models import User

class SearchServiceTests(TestCase):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        # Create a single user for all tests in this class
        cls.user = User.objects.create(username='testuser', email='test@example.com')
        
        # Create mock search index entries
        SearchIndex.objects.create(
            object_id="note1",
            content="A note about the Django web framework.",
            index_type="note",
            user=cls.user,
            vector=np.array([0.1, 0.8, 0.1])
        )
        SearchIndex.objects.create(
            object_id="note2",
            content="A note about Python programming.",
            index_type="note",
            user=cls.user,
            vector=np.array([0.8, 0.1, 0.1])
        )
        SearchIndex.objects.create(
            object_id="task1",
            content="A task related to the Django admin.",
            index_type="task",
            user=cls.user,
            vector=np.array([0.1, 0.9, 0.2])
        )

    @classmethod
    def tearDownClass(cls):
        SearchIndex.objects.all().delete()
        User.objects.all().delete()
        super().tearDownClass()

    def setUp(self):
        self.vector_service = VectorService()
        self.search_service = SearchService(vector_service=self.vector_service)
        SearchQuery.objects.all().delete()
        SearchResult.objects.all().delete()

    def test_search_by_keyword(self):
        """Test keyword search functionality."""
        query = "Django"
        results, _ = self.search_service.search_by_keyword(query, self.user)

        self.assertEqual(len(results), 2)
        self.assertIn('note1', [r.object_id for r in results])
        self.assertIn('task1', [r.object_id for r in results])

        # Test with a filter
        results, _ = self.search_service.search_by_keyword(query, self.user, filters={'index_type': 'task'})
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0].object_id, 'task1')

    @patch.object(VectorService, 'vectorize_text')
    def test_search_by_vector(self, mock_vectorize_text):
        """Test vector search functionality."""
        query_text = "web framework stuff"
        # Mock the vector for the query text to be close to 'note1' and 'task1'
        mock_vectorize_text.return_value = np.array([[0.1, 0.7, 0.15]])

        results, _ = self.search_service.search_by_vector(query_text, self.user)

        # The top result should be 'task1' because its vector is closest, followed by 'note1'
        self.assertGreater(len(results), 0)
        self.assertEqual(results[0].object_id, 'task1')
        self.assertEqual(results[1].object_id, 'note1')

        # Verify that a SearchQuery and SearchResult were created
        self.assertEqual(SearchQuery.objects.count(), 1)
        self.assertEqual(SearchResult.objects.count(), 2) # Assuming top_k=10 default

    def test_search_by_keyword_no_results(self):
        """Test keyword search with no matching results."""
        query = "nonexistent"
        results, _ = self.search_service.search_by_keyword(query, self.user)
        self.assertEqual(len(results), 0)

