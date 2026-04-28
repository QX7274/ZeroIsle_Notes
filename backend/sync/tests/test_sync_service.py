import unittest
from unittest.mock import MagicMock, patch
from datetime import datetime, timedelta
from bson import ObjectId

# Mock Django settings
from django.conf import settings
if not settings.configured:
    settings.configure()

from ..services.sync_service import SyncService

class SyncServiceTests(unittest.TestCase):

    def setUp(self):
        """Set up mocks for MongoDBService and its collection."""
        self.mock_mongodb_service = MagicMock()
        self.mock_collection = MagicMock()
        self.mock_mongodb_service.get_collection.return_value = self.mock_collection
        self.sync_service = SyncService(mongodb_service=self.mock_mongodb_service)

    def test_sync_documents_new_client_docs(self):
        """Test syncing new documents from the client."""
        client_docs = [
            {'_id': 'client_new_1', 'content': 'new doc 1', 'updated_at': datetime.now().isoformat()},
        ]
        server_docs = []

        self.mock_collection.find.return_value = server_docs

        result = self.sync_service.sync_documents('test_collection', client_docs, 'test_user')

        self.assertEqual(result['total_new'], 1)
        self.assertEqual(result['total_updated'], 0)
        self.mock_collection.bulk_write.assert_called_once()
        # Check that an InsertOne operation was part of the bulk write
        self.assertEqual(self.mock_collection.bulk_write.call_args[0][0][0].__class__.__name__, 'InsertOne')

    def test_sync_documents_conflict_resolution_server_wins(self):
        """Test conflict resolution with 'server' strategy (client changes are rejected)."""
        doc_id = ObjectId()
        server_time = datetime.now()
        client_time = server_time - timedelta(hours=1) # Client is older

        client_docs = [
            {'_id': str(doc_id), 'content': 'client version', 'updated_at': client_time.isoformat()}
        ]
        server_docs = [
            {'_id': doc_id, 'content': 'server version', 'updated_at': server_time}
        ]

        self.mock_collection.find.return_value = server_docs

        result = self.sync_service.sync_documents('test_collection', client_docs, 'test_user', conflict_strategy='server')

        self.assertEqual(result['total_conflicts'], 1)
        self.assertEqual(result['total_updated'], 0)
        # No bulk write should happen as the conflict is rejected
        self.mock_collection.bulk_write.assert_not_called()
        self.assertEqual(result['conflicts'][0]['reason'], 'server_wins')

    def test_sync_documents_conflict_resolution_client_wins(self):
        """Test conflict resolution with 'client' strategy (client changes are forced)."""
        doc_id = ObjectId()
        server_time = datetime.now()
        client_time = server_time - timedelta(hours=1)

        client_docs = [
            {'_id': str(doc_id), 'content': 'client version', 'updated_at': client_time.isoformat()}
        ]
        server_docs = [
            {'_id': doc_id, 'content': 'server version', 'updated_at': server_time}
        ]

        self.mock_collection.find.return_value = server_docs

        result = self.sync_service.sync_documents('test_collection', client_docs, 'test_user', conflict_strategy='client')

        self.assertEqual(result['total_conflicts'], 0)
        self.assertEqual(result['total_updated'], 1)
        self.mock_collection.bulk_write.assert_called_once()
        # Check that an UpdateOne operation was performed
        self.assertEqual(self.mock_collection.bulk_write.call_args[0][0][0].__class__.__name__, 'UpdateOne')

    def test_sync_documents_conflict_resolution_latest_wins(self):
        """Test conflict resolution where the latest timestamp wins."""
        doc_id = ObjectId()
        server_time = datetime.now()
        client_time = server_time + timedelta(hours=1) # Client is newer

        client_docs = [
            {'_id': str(doc_id), 'content': 'newer client version', 'updated_at': client_time.isoformat()}
        ]
        server_docs = [
            {'_id': doc_id, 'content': 'older server version', 'updated_at': server_time}
        ]

        self.mock_collection.find.return_value = server_docs

        result = self.sync_service.sync_documents('test_collection', client_docs, 'test_user', conflict_strategy='latest')

        self.assertEqual(result['total_conflicts'], 0)
        self.assertEqual(result['total_updated'], 1)
        self.mock_collection.bulk_write.assert_called_once()
        self.assertEqual(self.mock_collection.bulk_write.call_args[0][0][0].__class__.__name__, 'UpdateOne')

    def test_sync_deleted_docs(self):
        """Test that documents marked for deletion are removed."""
        doc_id_to_delete = ObjectId()
        deleted_docs = [{'id': str(doc_id_to_delete), 'status': 'deleted'}]

        result = self.sync_service.sync_deleted_documents('test_collection', deleted_docs, 'test_user')

        self.assertEqual(result['total_deleted'], 1)
        self.mock_collection.bulk_write.assert_called_once()
        self.assertEqual(self.mock_collection.bulk_write.call_args[0][0][0].__class__.__name__, 'DeleteOne')

if __name__ == '__main__':
    unittest.main()

