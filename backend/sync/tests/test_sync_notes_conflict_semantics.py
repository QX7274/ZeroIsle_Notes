"""
sync_notes 冲突计数语义（RISK-BE-009）单元测试

语义：
- diverged：服务端与客户端时间戳存在 >1s 分歧（只表示「检测到分歧」）
- conflict：本地改动最终未被采纳（服务端获胜 / 写入被丢弃）—— 只有这种情况计入 results['conflicts']
- 客户端最终覆盖成功属于「已解决的分歧」，conflicts 计 0

覆盖矩阵（mock db，不连真实 Mongo）：
| 场景 | conflict_strategy | 期望 conflicts |
| 客户端较新 & 客户端胜 | client / latest | 0 |
| 服务端较新 & 服务端胜 | server / latest | 1 |
| 时间差 <= 1s（无实际分歧） | 任意 | 0 |
| 删除类同步 | 任意 | 0（本地删除按既有契约直接采纳） |
"""

from datetime import timedelta
from unittest import TestCase
from unittest.mock import MagicMock, patch

from bson import ObjectId
from django.utils import timezone

from ..services import sync_service as sync_service_module
from ..services.sync_service import SyncService


class SyncNotesConflictSemanticsTests(TestCase):
    """sync_notes 的 diverged / conflict 语义矩阵。"""

    def setUp(self):
        self.patcher = patch.object(sync_service_module, 'mongodb_service')
        self.mock_mongodb_service = self.patcher.start()
        self.addCleanup(self.patcher.stop)

        self.mock_db = MagicMock()
        self.mock_mongodb_service.db = self.mock_db
        self.mock_mongodb_service.initialized = True

        self.collection = self.mock_db.notes
        self.collection.find.return_value = []
        self._set_bulk_result(modified=1, matched=1)

    def _set_bulk_result(self, upserted=0, modified=0, deleted=0, matched=0):
        self.collection.bulk_write.return_value = MagicMock(
            upserted_count=upserted,
            modified_count=modified,
            deleted_count=deleted,
            matched_count=matched,
        )

    def _sync(self, strategy, client_offset_seconds=0):
        """构造「服务端 updated_at = now、客户端 updated_at = now + offset」的单条同步。"""
        doc_id = ObjectId()
        server_time = timezone.now()
        client_time = server_time + timedelta(seconds=client_offset_seconds)

        client_docs = [
            {'_id': str(doc_id), 'title': 'client version', 'client_updated_at': client_time.isoformat()},
        ]
        server_docs = [
            {'_id': doc_id, 'title': 'server version', 'updated_at': server_time},
        ]
        self.collection.find.return_value = server_docs

        return SyncService.sync_notes('test_user', client_docs, conflict_strategy=strategy), doc_id

    # ---------- 矩阵：客户端较新 & 客户端胜 => 0 ----------

    def test_client_newer_with_client_strategy_counts_zero(self):
        result, _ = self._sync('client', client_offset_seconds=3600)

        data = result['data']
        self.assertEqual(data['conflicts'], 0)
        self.assertEqual(data['updated'], 1)
        self.assertEqual(data['unchanged'], 0)
        self.collection.bulk_write.assert_called_once()

        detail = data['details'][0]
        self.assertEqual(detail['status'], 'processed')
        self.assertFalse(detail['conflict'])
        self.assertTrue(detail['diverged'])
        self.assertEqual(detail['resolution'], 'client_wins')

    def test_client_newer_with_latest_strategy_counts_zero(self):
        result, _ = self._sync('latest', client_offset_seconds=3600)

        data = result['data']
        self.assertEqual(data['conflicts'], 0)
        self.assertEqual(data['updated'], 1)
        self.collection.bulk_write.assert_called_once()

        detail = data['details'][0]
        self.assertFalse(detail['conflict'])
        self.assertTrue(detail['diverged'])
        self.assertEqual(detail['resolution'], 'client_wins')

    # ---------- 矩阵：服务端较新 & 服务端胜 => 1 ----------

    def test_server_newer_with_latest_strategy_counts_one(self):
        result, _ = self._sync('latest', client_offset_seconds=-3600)

        data = result['data']
        self.assertEqual(data['conflicts'], 1)
        self.assertEqual(data['updated'], 0)
        self.assertEqual(data['unchanged'], 1)
        self.collection.bulk_write.assert_not_called()

        detail = data['details'][0]
        self.assertEqual(detail['status'], 'conflict_ignored')
        self.assertEqual(detail['decision'], 'ignore_client_latest')
        self.assertTrue(detail['conflict'])
        self.assertTrue(detail['diverged'])
        self.assertEqual(detail['reason'], 'client_change_not_applied')

    def test_server_newer_with_server_strategy_counts_one(self):
        result, _ = self._sync('server', client_offset_seconds=-3600)

        data = result['data']
        self.assertEqual(data['conflicts'], 1)
        self.assertEqual(data['updated'], 0)
        self.collection.bulk_write.assert_not_called()

        detail = data['details'][0]
        self.assertEqual(detail['decision'], 'ignore_client')
        self.assertTrue(detail['conflict'])

    def test_server_strategy_ignores_client_even_when_client_newer(self):
        """server 策略：只要存在分歧就服务端获胜 => 本地改动未被采纳 => 1（合并决策不变）。"""
        result, _ = self._sync('server', client_offset_seconds=3600)

        data = result['data']
        self.assertEqual(data['conflicts'], 1)
        self.assertEqual(data['updated'], 0)
        self.collection.bulk_write.assert_not_called()
        self.assertEqual(data['details'][0]['decision'], 'ignore_client')

    # ---------- 矩阵：时间差 <= 1s => 0 ----------

    def test_within_one_second_divergence_is_not_a_conflict_for_any_strategy(self):
        for strategy in ('server', 'client', 'latest'):
            with self.subTest(strategy=strategy):
                self.collection.reset_mock()
                self.collection.find.return_value = []
                self._set_bulk_result(modified=1, matched=1)

                result, _ = self._sync(strategy, client_offset_seconds=0.5)

                data = result['data']
                self.assertEqual(data['conflicts'], 0)
                self.assertEqual(data['updated'], 1)

                detail = data['details'][0]
                self.assertEqual(detail['status'], 'processed')
                self.assertFalse(detail['conflict'])
                self.assertFalse(detail['diverged'])
                self.assertNotIn('resolution', detail)

    # ---------- 矩阵：删除类同步 => 0 ----------

    def test_delete_operation_counts_no_conflict_and_marks_applied(self):
        doc_id = ObjectId()
        self.collection.find.return_value = [{'_id': doc_id, 'updated_at': timezone.now()}]
        self._set_bulk_result(deleted=1)

        result = SyncService.sync_notes(
            'test_user',
            [{'_id': str(doc_id), '_operation': 'delete'}],
            conflict_strategy='server',
        )

        data = result['data']
        self.assertEqual(data['conflicts'], 0)
        self.assertEqual(data['deleted'], 1)
        self.collection.bulk_write.assert_called_once()
        operations = self.collection.bulk_write.call_args[0][0]
        self.assertEqual(operations[0].__class__.__name__, 'DeleteOne')

        detail = data['details'][0]
        self.assertEqual(detail['status'], 'deleted')
        self.assertFalse(detail['conflict'])
        self.assertFalse(detail['diverged'])
        self.assertEqual(detail['reason'], 'client_delete_applied')

    # ---------- details 判别能力 ----------

    def test_details_distinguish_resolved_divergence_from_unapplied_change(self):
        resolved_id = ObjectId()
        ignored_id = ObjectId()
        server_time = timezone.now()

        client_docs = [
            {'_id': str(resolved_id), 'title': 'client newer', 'client_updated_at': (server_time + timedelta(hours=1)).isoformat()},
            {'_id': str(ignored_id), 'title': 'client older', 'client_updated_at': (server_time - timedelta(hours=1)).isoformat()},
        ]
        server_docs = [
            {'_id': resolved_id, 'updated_at': server_time},
            {'_id': ignored_id, 'updated_at': server_time},
        ]
        self.collection.find.return_value = server_docs

        result = SyncService.sync_notes('test_user', client_docs, conflict_strategy='latest')

        data = result['data']
        self.assertEqual(data['conflicts'], 1)

        by_id = {detail['id']: detail for detail in data['details']}
        resolved = by_id[str(resolved_id)]
        ignored = by_id[str(ignored_id)]

        # 已解决的分歧：本地改动被采纳，不计 conflict
        self.assertEqual(resolved['status'], 'processed')
        self.assertEqual(resolved['resolution'], 'client_wins')
        self.assertTrue(resolved['diverged'])
        self.assertFalse(resolved['conflict'])

        # 未被采纳的改动：计入 conflict，并给出原因
        self.assertEqual(ignored['status'], 'conflict_ignored')
        self.assertEqual(ignored['decision'], 'ignore_client_latest')
        self.assertTrue(ignored['diverged'])
        self.assertTrue(ignored['conflict'])
        self.assertEqual(ignored['reason'], 'client_change_not_applied')

    def test_every_detail_entry_exposes_conflict_and_diverged_flags(self):
        processed_id = ObjectId()
        ignored_id = ObjectId()
        delete_id = ObjectId()
        failed_id = ObjectId()
        server_time = timezone.now()

        client_docs = [
            {'_id': str(processed_id), 'client_updated_at': (server_time + timedelta(hours=1)).isoformat()},
            {'_id': str(ignored_id), 'client_updated_at': (server_time - timedelta(hours=1)).isoformat()},
            {'_id': str(delete_id), '_operation': 'delete'},
            {'_id': str(failed_id), 'client_updated_at': 'not-a-date'},
        ]
        server_docs = [
            {'_id': processed_id, 'updated_at': server_time},
            {'_id': ignored_id, 'updated_at': server_time},
            {'_id': failed_id, 'updated_at': server_time},
        ]
        self.collection.find.return_value = server_docs
        self._set_bulk_result(modified=1, matched=1, deleted=1)

        result = SyncService.sync_notes('test_user', client_docs, conflict_strategy='latest')

        data = result['data']
        self.assertEqual(len(data['details']), 4)
        self.assertEqual(data['conflicts'], 1)
        self.assertEqual(data['failed'], 1)

        for detail in data['details']:
            with self.subTest(detail=detail):
                self.assertIsInstance(detail['conflict'], bool)
                self.assertIsInstance(detail['diverged'], bool)

        by_id = {detail['id']: detail for detail in data['details']}
        self.assertEqual(by_id[str(processed_id)]['status'], 'processed')
        self.assertEqual(by_id[str(ignored_id)]['status'], 'conflict_ignored')
        self.assertEqual(by_id[str(delete_id)]['status'], 'deleted')
        self.assertEqual(by_id[str(failed_id)]['status'], 'failed')
