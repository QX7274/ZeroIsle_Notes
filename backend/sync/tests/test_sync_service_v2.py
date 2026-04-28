import unittest
from unittest.mock import MagicMock, patch
from datetime import datetime, timezone
from bson import ObjectId
import os

# 模拟环境变量
os.environ['MONGO_URI'] = 'mongodb://localhost:27017'

# 模拟 Django settings
from django.conf import settings
if not settings.configured:
    settings.configure(USE_TZ=True)

from sync.services.sync_service import SyncService

class SyncServiceTests(unittest.TestCase):

    def setUp(self):
        """设置 mock"""
        self.patcher = patch('sync.services.sync_service.mongodb_service')
        self.mock_mongodb_service = self.patcher.start()
        self.mock_db = MagicMock()
        self.mock_mongodb_service.db = self.mock_db
        self.mock_mongodb_service.initialized = True

    def tearDown(self):
        self.patcher.stop()

    def test_sync_notes_success(self):
        """测试笔记同步成功场景"""
        user_id = "test_user_id"
        notes_data = [
            {
                "id": str(ObjectId()),
                "title": "Test Note",
                "content": "Content",
                "client_updated_at": datetime.now(timezone.utc).isoformat()
            }
        ]
        
        self.mock_db.notes.find.return_value = []
        self.mock_db.notes.bulk_write.return_value = MagicMock(
            upserted_count=1, modified_count=0, deleted_count=0, matched_count=0
        )

        result = SyncService.sync_notes(user_id, notes_data)
        
        self.assertTrue(result['success'])
        self.assertEqual(result['data']['created'], 1)
        self.mock_db.notes.bulk_write.assert_called_once()

    def test_sync_user_settings_initialization(self):
        """测试设置同步时会自动初始化 MongoDB"""
        self.mock_mongodb_service.initialized = False
        user_id = "test_user_id"
        settings_data = {"theme": "dark"}
        
        self.mock_db.user_settings.find_one.return_value = None
        
        SyncService.sync_user_settings(user_id, settings_data)
        
        self.mock_mongodb_service.initialize.assert_called_once()

    def test_get_user_data(self):
        """测试获取用户数据"""
        user_id = "test_user_uuid"
        mock_user = {"_id": user_id, "username": "testuser"}
        self.mock_db.users.find_one.return_value = mock_user
        
        result = SyncService.get_user_data(user_id)
        
        self.assertTrue(result['success'])
        self.assertEqual(result['data']['username'], "testuser")
        self.mock_db.users.find_one.assert_called_with({'_id': user_id})

if __name__ == '__main__':
    unittest.main()

