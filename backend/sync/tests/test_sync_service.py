import unittest
from unittest.mock import MagicMock, patch
from datetime import timedelta

from bson import ObjectId
from django.utils import timezone

# Mock Django settings
from django.conf import settings
if not settings.configured:
    settings.configure()

# 当前实现 SyncService 全部为 staticmethod，依赖模块级 mongodb_service 单例；
# 原用例针对已不存在的实例化 API（SyncService(mongodb_service=...) / sync_documents / sync_deleted_documents /
# total_new 等结果键），这里按当前契约重写：patch 模块级 mongodb_service，调用 SyncService.sync_notes(...)，
# 保留每个用例的原场景意图（新增写入、server/client/latest 冲突策略、删除），断言强度不降低。
from ..services import sync_service as sync_service_module
from ..services.sync_service import SyncService


class SyncServiceTests(unittest.TestCase):

    def setUp(self):
        """Set up mocks for MongoDBService and its collection."""
        self.patcher = patch.object(sync_service_module, 'mongodb_service')
        self.mock_mongodb_service = self.patcher.start()
        self.addCleanup(self.patcher.stop)

        self.mock_db = MagicMock()
        self.mock_mongodb_service.db = self.mock_db
        self.mock_mongodb_service.initialized = True

        self.mock_collection = self.mock_db.notes
        self.mock_collection.find.return_value = []
        self._set_bulk_result()

    def _set_bulk_result(self, upserted=0, modified=0, deleted=0, matched=0):
        """配置 bulk_write 返回值（对应 upsert 插入 / 修改 / 删除 / 命中数量）。"""
        self.mock_collection.bulk_write.return_value = MagicMock(
            upserted_count=upserted,
            modified_count=modified,
            deleted_count=deleted,
            matched_count=matched,
        )

    def test_sync_documents_new_client_docs(self):
        """Test syncing new documents from the client."""
        client_docs = [
            {
                '_id': 'client_new_1',
                'title': 'new doc 1',
                'client_updated_at': timezone.now().isoformat(),
            },
        ]

        self.mock_collection.find.return_value = []
        self._set_bulk_result(upserted=1)

        result = SyncService.sync_notes('test_user', client_docs)

        self.assertTrue(result['success'])
        self.assertEqual(result['data']['created'], 1)
        self.assertEqual(result['data']['updated'], 0)
        self.mock_collection.bulk_write.assert_called_once()
        operations = self.mock_collection.bulk_write.call_args[0][0]
        self.assertEqual(len(operations), 1)
        # 当前实现统一走 UpdateOne(..., upsert=True)（新文档即 upsert 插入）
        self.assertEqual(operations[0].__class__.__name__, 'UpdateOne')
        self.assertTrue(getattr(operations[0], '_upsert', False), '新文档应通过 upsert 写入')
        self.assertEqual(operations[0]._filter['user_id'], 'test_user')
        self.assertEqual(result['data']['details'][0]['decision'], 'upsert')

    def test_sync_documents_conflict_resolution_server_wins(self):
        """Test conflict resolution with 'server' strategy (client changes are rejected)."""
        doc_id = ObjectId()
        server_time = timezone.now()
        client_time = server_time - timedelta(hours=1)  # Client is older

        client_docs = [
            {'_id': str(doc_id), 'title': 'client version', 'client_updated_at': client_time.isoformat()}
        ]
        server_docs = [
            {'_id': doc_id, 'title': 'server version', 'updated_at': server_time}
        ]

        self.mock_collection.find.return_value = server_docs

        result = SyncService.sync_notes('test_user', client_docs, conflict_strategy='server')

        self.assertTrue(result['success'])
        self.assertEqual(result['data']['conflicts'], 1)
        self.assertEqual(result['data']['updated'], 0)
        # No bulk write should happen as the conflict is rejected
        self.mock_collection.bulk_write.assert_not_called()
        details = result['data']['details']
        self.assertEqual(len(details), 1)
        self.assertEqual(details[0]['status'], 'conflict_ignored')
        self.assertEqual(details[0]['decision'], 'ignore_client')

    def test_sync_documents_conflict_resolution_client_wins(self):
        """Test conflict resolution with 'client' strategy (client changes are forced)."""
        doc_id = ObjectId()
        server_time = timezone.now()
        client_time = server_time - timedelta(hours=1)

        client_docs = [
            {'_id': str(doc_id), 'title': 'client version', 'client_updated_at': client_time.isoformat()}
        ]
        server_docs = [
            {'_id': doc_id, 'title': 'server version', 'updated_at': server_time}
        ]

        self.mock_collection.find.return_value = server_docs
        self._set_bulk_result(modified=1, matched=1)

        result = SyncService.sync_notes('test_user', client_docs, conflict_strategy='client')

        self.assertTrue(result['success'])
        # 当前实现会先统计「检测到时间差」的冲突，再按 client 策略强制覆盖
        self.assertEqual(result['data']['conflicts'], 1)
        self.assertEqual(result['data']['updated'], 1)
        self.assertEqual(result['data']['unchanged'], 0)
        self.mock_collection.bulk_write.assert_called_once()
        operations = self.mock_collection.bulk_write.call_args[0][0]
        self.assertEqual(operations[0].__class__.__name__, 'UpdateOne')
        self.assertEqual(operations[0]._filter['_id'], doc_id)

    def test_sync_documents_conflict_resolution_latest_wins(self):
        """Test conflict resolution where the latest timestamp wins."""
        doc_id = ObjectId()
        server_time = timezone.now()
        client_time = server_time + timedelta(hours=1)  # Client is newer

        client_docs = [
            {'_id': str(doc_id), 'title': 'newer client version', 'client_updated_at': client_time.isoformat()}
        ]
        server_docs = [
            {'_id': doc_id, 'title': 'older server version', 'updated_at': server_time}
        ]

        self.mock_collection.find.return_value = server_docs
        self._set_bulk_result(modified=1, matched=1)

        result = SyncService.sync_notes('test_user', client_docs, conflict_strategy='latest')

        self.assertTrue(result['success'])
        self.assertEqual(result['data']['conflicts'], 1)
        self.assertEqual(result['data']['updated'], 1)
        self.mock_collection.bulk_write.assert_called_once()
        operations = self.mock_collection.bulk_write.call_args[0][0]
        self.assertEqual(operations[0].__class__.__name__, 'UpdateOne')
        self.assertTrue(getattr(operations[0], '_upsert', False))
        self.assertEqual(result['data']['details'][0]['status'], 'processed')

    def test_sync_deleted_docs(self):
        """Test that documents marked for deletion are removed."""
        doc_id_to_delete = ObjectId()
        deleted_docs = [{'_id': str(doc_id_to_delete), '_operation': 'delete'}]

        self._set_bulk_result(deleted=1)

        result = SyncService.sync_notes('test_user', deleted_docs)

        self.assertTrue(result['success'])
        self.assertEqual(result['data']['deleted'], 1)
        self.mock_collection.bulk_write.assert_called_once()
        operations = self.mock_collection.bulk_write.call_args[0][0]
        self.assertEqual(len(operations), 1)
        self.assertEqual(operations[0].__class__.__name__, 'DeleteOne')
        self.assertEqual(operations[0]._filter, {'_id': doc_id_to_delete, 'user_id': 'test_user'})
        self.assertEqual(result['data']['details'][0]['status'], 'deleted')


if __name__ == '__main__':
    unittest.main()
