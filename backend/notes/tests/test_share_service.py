"""ShareService 契约测试

当前契约（notes/services/share_service.py + notes/mongodb_models/note_share.py）：
- create_share(note, user, share_type, share_to=None, password=None, expires_at=None, max_view_count=None)
  share_type ∈ {'link', 'email', 'user'}（不存在 create_share_link / access_type）
- get_share_by_code(share_code) -> NoteShare | None（只查 is_active=True，不校验过期/次数/密码）
- verify_share_access(share, password=None) -> {accessible, reason, requires_password}
  失败语义：'分享已失效' / '分享已过期' / '已达到最大访问次数' / '需要密码' / '密码错误'
- record_share_access(share, request_meta=None) -> bool（达到 max_view_count 后返回 False）
- revoke_share(share) -> NoteShare（置 is_active=False）
- get_user_shares(user, note=None, active_only=True) -> QuerySet

原用例意图（公开分享可创建、密码校验、按 code 取回并计数、过期/超次数不可访问、可撤销）全部保留，
仅对齐上述当前 API 与错误语义。
"""

from datetime import timedelta

from django.test import TestCase
from django.utils import timezone

from ..services.share_service import ShareService
from ..mongodb_models.note import Note
from ..mongodb_models.note_share import NoteShare
from users.mongodb_models import User

from .helpers import reset_mongo_test_data


class ShareServiceTests(TestCase):

    def setUp(self):
        reset_mongo_test_data()
        # password 是 MongoUser 的 required 字段，必须补齐
        self.user = User.objects.create(
            username='testuser',
            email='test@example.com',
            password='hashed-test-password',
        )
        self.note = Note.objects.create(title='Test Note', content='Some content', user=self.user)
        self.share_service = ShareService()

    def tearDown(self):
        Note.objects.all().delete()
        NoteShare.objects.all().delete()
        User.objects.all().delete()

    def test_create_share_link_public(self):
        """公开链接分享：create_share(..., share_type='link') 生成无密码、可访问的分享码"""
        share = self.share_service.create_share(self.note, self.user, 'link')

        self.assertIsNotNone(share)
        self.assertEqual(share.note, self.note)
        self.assertEqual(share.user, self.user)
        self.assertEqual(share.share_type, 'link')
        self.assertFalse(share.is_password_protected)
        self.assertIsNone(share.password_hash)
        self.assertIsNotNone(share.share_code)
        self.assertTrue(share.is_active)
        # 新契约：可访问性由 verify_share_access 返回 dict 表达
        access = self.share_service.verify_share_access(share)
        self.assertTrue(access['accessible'])
        self.assertEqual(access['reason'], '')
        self.assertFalse(access['requires_password'])

    def test_create_share_link_with_password(self):
        """密码分享：密码哈希存储，verify_share_access 区分无密码/错密码/对密码"""
        password = 'strongpassword123'
        share = self.share_service.create_share(self.note, self.user, 'link', password=password)

        self.assertTrue(share.is_password_protected, 'Password protection flag should be set')
        self.assertIsNotNone(share.password_hash, 'Password hash should be set')
        self.assertNotEqual(share.password_hash, password, 'Password should be hashed, not stored in plaintext')
        self.assertTrue(share.verify_password(password), 'Password verification should succeed')
        self.assertFalse(share.verify_password('wrongpassword'), 'Password verification should fail for wrong password')

        # 三种访问语义（原 verify_password 用例意图的完整表达）
        no_password = self.share_service.verify_share_access(share)
        self.assertFalse(no_password['accessible'])
        self.assertTrue(no_password['requires_password'])
        self.assertEqual(no_password['reason'], '需要密码')

        wrong = self.share_service.verify_share_access(share, password='wrongpassword')
        self.assertFalse(wrong['accessible'])
        self.assertTrue(wrong['requires_password'])
        self.assertEqual(wrong['reason'], '密码错误')

        right = self.share_service.verify_share_access(share, password=password)
        self.assertTrue(right['accessible'])
        self.assertFalse(right['requires_password'])
        self.assertEqual(right['reason'], '')

    def test_get_note_by_share_code_public(self):
        """公开分享：按 share_code 取回分享/笔记，并记录一次访问（计数落库）"""
        share = self.share_service.create_share(self.note, self.user, 'link')

        found = self.share_service.get_share_by_code(share.share_code)
        self.assertIsNotNone(found)
        self.assertTrue(self.share_service.verify_share_access(found)['accessible'])

        # 原用例断言「访问后 view_count 递增」：当前契约由 record_share_access 承担
        self.assertTrue(self.share_service.record_share_access(found))

        # 当前契约：分享对象持有 note 引用，取回笔记即经由此引用
        self.assertEqual(found.note.id, self.note.id)
        self.assertEqual(found.note.title, self.note.title)

        refreshed = NoteShare.objects.get(id=share.id)
        self.assertEqual(refreshed.view_count, 1)
        self.assertEqual(found.view_count, 1)

    def test_get_note_by_share_code_expired(self):
        """过期分享：记录仍可按 code 查到，但 verify_share_access 判定不可访问

        本用例同时是该缺陷的回归：get_share_by_code 从库读回的 expires_at 是 naive
        （tz_aware=False），修复前 is_expired() 与 aware 的 timezone.now() 比较会抛 TypeError。
        修复方式：NoteShare._to_aware_utc() 在比较处把 naive 视为 UTC 归一化（见 note_share.py）。
        """
        share = self.share_service.create_share(
            self.note,
            self.user,
            'link',
            expires_at=timezone.now() - timedelta(days=1),  # Expired yesterday
        )

        found = self.share_service.get_share_by_code(share.share_code)
        self.assertIsNotNone(found, '分享记录仍在（get_share_by_code 只按 is_active 过滤）')

        access = self.share_service.verify_share_access(found)
        self.assertFalse(access['accessible'])
        self.assertEqual(access['reason'], '分享已过期')
        self.assertFalse(access['requires_password'])

    def test_is_expired_handles_naive_expires_at(self):
        """回归：库中读回的 naive expires_at（tz_aware=False）不得在比较时抛 TypeError

        缺陷背景：mongoengine.connect 未传 tz_aware=True ⇒ 从库读回的 datetime 是 naive，
        而 USE_TZ=True 下 timezone.now() 是 aware；is_expired() 直接比较会抛
        TypeError: can't compare offset-naive and offset-aware datetimes，
        导致 views/share.py::by_code 对任何带 expires_at 的分享返回 500。
        修复后 naive 按 UTC 归一化，过期/未过期两种语义都必须正常。
        """
        share = self.share_service.create_share(self.note, self.user, 'link')

        # 模拟从库读回（naive）且已过期
        share.expires_at = (timezone.now() - timedelta(minutes=1)).replace(tzinfo=None)
        self.assertTrue(share.is_expired())
        expired = self.share_service.verify_share_access(share)
        self.assertFalse(expired['accessible'])
        self.assertEqual(expired['reason'], '分享已过期')

        # naive 但尚未过期
        share.expires_at = (timezone.now() + timedelta(minutes=1)).replace(tzinfo=None)
        self.assertFalse(share.is_expired())
        self.assertTrue(self.share_service.verify_share_access(share)['accessible'])

        # aware 值继续正常工作（不因归一化引入回归）
        share.expires_at = timezone.now() - timedelta(minutes=1)
        self.assertTrue(share.is_expired())

        share.expires_at = timezone.now() + timedelta(minutes=1)
        self.assertFalse(share.is_expired())

    def test_get_note_by_share_code_max_views_reached(self):
        """达到最大访问次数后不可访问：首次可访问并计数，第二次被拒绝"""
        share = self.share_service.create_share(self.note, self.user, 'link', max_view_count=1)

        found = self.share_service.get_share_by_code(share.share_code)
        # First access should succeed
        self.assertTrue(self.share_service.verify_share_access(found)['accessible'])
        self.assertTrue(self.share_service.record_share_access(found))

        # Second access should fail
        access = self.share_service.verify_share_access(found)
        self.assertFalse(access['accessible'])
        self.assertEqual(access['reason'], '已达到最大访问次数')
        self.assertFalse(access['requires_password'])

    def test_disable_share_link(self):
        """撤销分享：is_active=False，且 get_share_by_code 不再返回该分享"""
        share = self.share_service.create_share(self.note, self.user, 'link')

        self.share_service.revoke_share(share)

        share.reload()
        self.assertFalse(share.is_active, 'Share link should be inactive')
        self.assertIsNone(self.share_service.get_share_by_code(share.share_code))
