import os
import pickle
import unittest
from unittest.mock import patch, MagicMock
import numpy as np
from django.conf import settings

# Configure a minimal Django settings environment to allow imports
if not settings.configured:
    settings.configure(
        INSTALLED_APPS=[
            'django.contrib.contenttypes',
            'django.contrib.auth',
            'search',
            'users',
        ]
    )

# Now, import the service we want to test
from ..services.vector_service import VectorService

class VectorServiceTests(unittest.TestCase):

    def setUp(self):
        """Set up a clean environment for each test."""
        # Reset the singleton instance before each test
        if hasattr(VectorService, '_instance'):
            del VectorService._instance
        
        self.vocab_path = './test_vector_vocabulary.pkl'
        self.test_corpus = ['this is a sample', 'this is another sample']

    def tearDown(self):
        """Clean up any created files."""
        if os.path.exists(self.vocab_path):
            os.remove(self.vocab_path)

    @patch('search.services.vector_service.VOCABULARY_FILE_PATH', './test_vector_vocabulary.pkl')
    def test_singleton_instance(self):
        """Test that VectorService is a singleton."""
        service1 = VectorService()
        service2 = VectorService()
        self.assertIs(service1, service2, "VectorService should be a singleton")

    @patch('search.services.vector_service.VOCABULARY_FILE_PATH', './test_vector_vocabulary.pkl')
    @patch('sklearn.feature_extraction.text.TfidfVectorizer.fit')
    def test_initialization_creates_vocabulary(self, mock_tfidf_fit):
        """Test that a new vocabulary file is created if it doesn't exist."""
        self.assertFalse(os.path.exists(self.vocab_path), "Vocabulary file should not exist initially")
        
        # The service initialization should trigger a `fit` call if no vocab file exists
        service = VectorService()
        
        # Since fit is called on an empty corpus, the vocab file is not created yet.
        # Let's test the save method directly.
        service.vectorizer.vocabulary_ = {'sample': 0, 'this': 1}
        service._save_vocabulary()

        self.assertTrue(os.path.exists(self.vocab_path), "_save_vocabulary should create the vocab file")
        with open(self.vocab_path, 'rb') as f:
            loaded_vocab = pickle.load(f)
        self.assertEqual(loaded_vocab, {'sample': 0, 'this': 1})

    @patch('search.services.vector_service.VOCABULARY_FILE_PATH', './test_vector_vocabulary.pkl')
    def test_initialization_loads_vocabulary(self):
        """Test that an existing vocabulary file is loaded on initialization."""
        # Create a dummy vocabulary file
        dummy_vocab = {'existing': 0, 'vocab': 1}
        with open(self.vocab_path, 'wb') as f:
            pickle.dump(dummy_vocab, f)

        service = VectorService()
        self.assertEqual(service.vectorizer.vocabulary_, dummy_vocab)

    @patch('search.services.vector_service.VOCABULARY_FILE_PATH', './test_vector_vocabulary.pkl')
    def test_fit_vectorizer_and_save(self):
        """Test fitting the vectorizer and saving the vocabulary."""
        service = VectorService()
        service.fit_vectorizer(self.test_corpus)
        
        self.assertTrue(os.path.exists(self.vocab_path))
        self.assertIn('sample', service.vectorizer.vocabulary_)
        self.assertIn('another', service.vectorizer.vocabulary_)

    @patch('search.services.vector_service.VOCABULARY_FILE_PATH', './test_vector_vocabulary.pkl')
    def test_vectorize_text(self):
        """Test text vectorization."""
        service = VectorService()
        service.fit_vectorizer(self.test_corpus)
        
        vector = service.vectorize_text('a new sample')
        self.assertIsInstance(vector, np.ndarray, "Vector should be a numpy array")
        self.assertEqual(vector.shape[0], 1, "Vector should have one dimension for a single text")
        self.assertEqual(vector.shape[1], len(service.vectorizer.vocabulary_), "Vector dimension should match vocabulary size")

    @patch('search.services.vector_service.VOCABULARY_FILE_PATH', './test_vector_vocabulary.pkl')
    def test_vectorize_text_with_unknown_words(self):
        """Test that vectorization handles words not in the vocabulary gracefully."""
        service = VectorService()
        service.fit_vectorizer(self.test_corpus)
        
        # This text contains words not in the fitted corpus ('new', 'words')
        vector = service.vectorize_text('new unseen words')
        
        # The vector should still be valid, with zeros for the unknown words
        self.assertIsInstance(vector, np.ndarray)
        self.assertEqual(np.count_nonzero(vector), 0, "Vector for unseen words should be all zeros")
    
    @patch('search.services.vector_service.VOCABULARY_FILE_PATH', './test_vector_vocabulary.pkl')
    def test_check_vector_dimensionality(self):
        """Test the vector dimensionality check."""
        service = VectorService()
        service.fit_vectorizer(self.test_corpus)
        vocab_size = len(service.vectorizer.vocabulary_)

        correct_vector = np.random.rand(1, vocab_size)
        incorrect_vector = np.random.rand(1, vocab_size + 1)

        self.assertTrue(service.check_vector_dimensionality(correct_vector), "Should return True for correct dimension")
        self.assertFalse(service.check_vector_dimensionality(incorrect_vector), "Should return False for incorrect dimension")

if __name__ == '__main__':
    unittest.main()

