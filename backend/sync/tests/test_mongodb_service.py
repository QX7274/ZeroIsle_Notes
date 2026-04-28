import os
from unittest import TestCase, mock
from pymongo.errors import ConnectionFailure

# Mock Django settings to allow standalone run
from django.conf import settings
if not settings.configured:
    settings.configure()

from ..services.mongodb_service import MongoDBService

class MongoDBServiceTests(TestCase):

    def setUp(self):
        # Reset the singleton instance before each test to ensure isolation
        if hasattr(MongoDBService, '_instance'):
            del MongoDBService._instance

    @mock.patch.dict(os.environ, {"MONGO_URI": "mongodb://test_host:27017/", "MONGO_DB": "test_db"})
    @mock.patch('pymongo.MongoClient')
    def test_singleton_instance(self, mock_mongo_client):
        """Test that MongoDBService correctly implements the singleton pattern."""
        service1 = MongoDBService()
        service2 = MongoDBService()
        self.assertIs(service1, service2, "Service instances should be the same")
        # MongoClient should only be instantiated once for the singleton
        mock_mongo_client.assert_called_once()

    @mock.patch.dict(os.environ, {"MONGO_URI": "mongodb://user:pass@host:27017/test_db?authSource=admin"})
    @mock.patch('pymongo.MongoClient')
    def test_initialization_with_full_uri(self, mock_mongo_client):
        """Test initialization with a full MongoDB URI from environment variables."""
        service = MongoDBService()
        mock_mongo_client.assert_called_with(
            "mongodb://user:pass@host:27017/test_db?authSource=admin",
            connectTimeoutMS=10000,
            serverSelectionTimeoutMS=10000,
            socketTimeoutMS=10000,
            retryWrites=True,
            tls=True,
            tlsAllowInvalidCertificates=True
        )
        self.assertIsNotNone(service.client, "Client should be initialized")
        self.assertIsNotNone(service.db, "Database object should be initialized")

    @mock.patch.dict(os.environ, {"MONGO_URI": "", "MONGO_HOST": "localhost", "MONGO_PORT": "27018", "MONGO_DB": "fallback_db"})
    @mock.patch('pymongo.MongoClient')
    def test_initialization_with_separate_env_vars(self, mock_mongo_client):
        """Test that initialization falls back to separate env vars if MONGO_URI is not set."""
        service = MongoDBService()
        # We don't check user/pass here as they might not be in the env
        mock_mongo_client.assert_called_with(
            host='localhost',
            port=27018,
            username=mock.ANY,
            password=mock.ANY,
            authSource='admin',
            connectTimeoutMS=10000,
            serverSelectionTimeoutMS=10000,
            socketTimeoutMS=10000,
            retryWrites=True,
            tls=False  # Default for non-URI connection
        )
        self.assertEqual(service.db.name, "fallback_db", "Database name should match fallback env var")

    @mock.patch('pymongo.MongoClient')
    def test_connection_failure_handling(self, mock_mongo_client):
        """Test that the service handles connection failures gracefully during initialization."""
        # Configure the mock to raise a ConnectionFailure on the first interaction
        mock_instance = mock_mongo_client.return_value
        mock_instance.admin.command.side_effect = ConnectionFailure("Test connection error")

        # Instantiating the service should raise the connection failure
        with self.assertRaises(ConnectionFailure):
            MongoDBService()

