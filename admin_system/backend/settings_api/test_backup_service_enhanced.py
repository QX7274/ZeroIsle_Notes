import os
import json
import hashlib
import tempfile
import shutil
from unittest import TestCase, mock
from bson import ObjectId, json_util

from ..backup_service_enhanced import BackupServiceEnhanced

class BackupServiceEnhancedTests(TestCase):

    def setUp(self):
        self.service = BackupServiceEnhanced()
        self.test_dir = tempfile.mkdtemp()
        self.mock_collection = mock.MagicMock()
        self.mock_collection.name = 'test_collection'
        self.service.db = {'test_collection': self.mock_collection}

    def tearDown(self):
        shutil.rmtree(self.test_dir)

    def test_export_collection_batching_and_serialization(self):
        """Test that data is exported in batches and serialized correctly with bson.json_util."""
        object_id = ObjectId()
        docs = [{'id': 1, 'user_id': object_id, 'content': 'doc1'}, {'id': 2, 'content': 'doc2'}]
        self.mock_collection.find.return_value = docs

        manifest = self.service._export_collection(self.mock_collection, self.test_dir, batch_size=1)

        # Check that two batch files were created
        self.assertEqual(len(manifest['files']), 2)
        # Check that the data was serialized correctly
        with open(os.path.join(self.test_dir, manifest['files'][0]['filename']), 'r') as f:
            data = json.load(f, object_hook=json_util.object_hook)
            self.assertEqual(data[0]['user_id'], object_id)

    def test_import_collection_batching_and_deserialization(self):
        """Test that data is imported in batches and ObjectIds are restored."""
        object_id = ObjectId()
        docs = [{'id': 1, 'user_id': object_id, 'content': 'doc1'}]
        
        # Create a dummy backup file
        file_path = os.path.join(self.test_dir, 'test_collection_0.json')
        with open(file_path, 'w') as f:
            json.dump(docs, f, default=json_util.default)

        manifest_file = {'filename': 'test_collection_0.json', 'sha256': self.service._calculate_sha256(file_path)}

        stats = self.service._import_collection(self.mock_collection, self.test_dir, [manifest_file], batch_size=10)

        self.assertEqual(stats['total_docs'], 1)
        self.assertEqual(stats['successful'], 1)
        self.mock_collection.bulk_write.assert_called_once()
        # Check that the operation is an InsertOne with a correctly deserialized ObjectId
        inserted_doc = self.mock_collection.bulk_write.call_args[0][0][0]._doc
        self.assertEqual(inserted_doc['user_id'], object_id)

    def test_integrity_check_success_and_failure(self):
        """Test the SHA256 integrity check."""
        file_path = os.path.join(self.test_dir, 'data.json')
        with open(file_path, 'w') as f:
            f.write('some data')
        
        correct_hash = self.service._calculate_sha256(file_path)
        incorrect_hash = 'incorrecthash'

        # Test success
        self.service._verify_file_integrity(file_path, correct_hash)

        # Test failure
        with self.assertRaises(ValueError):
            self.service._verify_file_integrity(file_path, incorrect_hash)

    @mock.patch('admin_system.backend.settings_api.backup_service_enhanced.BackupServiceEnhanced._get_collection_lists_by_type')
    def test_create_backup_and_restore_workflow(self, mock_get_collections):
        """Test the end-to-end backup and restore workflow."""
        mock_get_collections.return_value = [self.mock_collection]
        docs = [{'id': 1, 'content': 'full workflow test'}]
        self.mock_collection.find.return_value = docs

        # 1. Create Backup
        backup_id, backup_path, manifest = self.service.create_backup(self.test_dir, 'full')
        self.assertTrue(os.path.exists(backup_path))
        self.assertIn('manifest.json', os.listdir(backup_path))

        # 2. Verify Backup
        is_valid = self.service.verify_backup_integrity(backup_path)
        self.assertTrue(is_valid)

        # 3. Restore Backup
        result = self.service.restore_backup(backup_path)
        self.assertTrue(result['success'])
        self.assertEqual(result['collections']['test_collection']['successful'], 1)

