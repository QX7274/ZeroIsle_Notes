"""RISK-BE-015：profile 详情路由的对象级权限（owner / 非 owner / admin / 未认证）。"""

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APIClient

from users.mongodb_models import User as MongoUser
from users.mongodb_models import UserProfile

User = get_user_model()

STRONG_FIXTURE_PASSWORD = 'Str0ng!Fixture#2026'

TEST_USERNAMES = ['perm-owner', 'perm-other', 'perm-admin']


def _cleanup_mongo(*usernames):
    """清理测试写入的 MongoDB 用户/资料（mongomock 不参与 Django 事务回滚）。"""
    for username in usernames:
        for mongo_user in list(MongoUser.objects(username=username)):
            UserProfile.objects(user=mongo_user).delete()
        MongoUser.objects(username=username).delete()


@pytest.mark.django_db
class TestProfileDetailPermissions:
    def setup_method(self):
        self.owner = User.objects.create_user(
            username='perm-owner', email='perm-owner@example.com',
            password=STRONG_FIXTURE_PASSWORD,
        )
        self.other = User.objects.create_user(
            username='perm-other', email='perm-other@example.com',
            password=STRONG_FIXTURE_PASSWORD,
        )
        self.admin = User.objects.create_user(
            username='perm-admin', email='perm-admin@example.com',
            password=STRONG_FIXTURE_PASSWORD, is_staff=True,
        )
        self.owner_profile = UserProfile.objects(django_user_id=str(self.owner.id)).first()
        assert self.owner_profile is not None, 'signals 应已镜像出 MongoUser + UserProfile'
        self.detail_url = reverse('profile-detail', args=[str(self.owner_profile.id)])

    def teardown_method(self):
        for django_user in (self.owner, self.other, self.admin):
            UserProfile.objects(django_user_id=str(django_user.id)).delete()
        _cleanup_mongo(*TEST_USERNAMES)
        User.objects.filter(username__in=TEST_USERNAMES).delete()

    def _client(self, user=None):
        client = APIClient()
        if user is not None:
            client.force_authenticate(user=user)
        return client

    @staticmethod
    def _snapshot(profile_id):
        profile = UserProfile.objects.get(id=profile_id)
        return {
            'nickname': profile.nickname,
            'django_user_id': profile.django_user_id,
            'company': profile.company,
            'position': profile.position,
        }

    # --- owner：本人可读写（修复前恒 403） ---
    def test_owner_can_retrieve_own_profile(self):
        response = self._client(self.owner).get(self.detail_url)

        assert response.status_code == 200, response.content
        assert response.json()['django_user_id'] == str(self.owner.id)

    def test_owner_can_update_own_profile(self):
        response = self._client(self.owner).patch(
            self.detail_url, {'nickname': '本人更新'}, format='json',
        )

        assert response.status_code == 200, response.content
        self.owner_profile.reload()
        assert self.owner_profile.nickname == '本人更新'
        assert self.owner_profile.django_user_id == str(self.owner.id)

    def test_owner_can_destroy_own_profile(self):
        response = self._client(self.owner).delete(self.detail_url)

        assert response.status_code == 204, response.content
        assert UserProfile.objects(django_user_id=str(self.owner.id)).first() is None

    # --- 非 owner：404（get_queryset 过滤，不泄露对象是否存在）且数据不被改动 ---
    def test_non_owner_cannot_retrieve(self):
        response = self._client(self.other).get(self.detail_url)

        assert response.status_code == 404, response.content
        assert 'detail' in response.json()

    def test_non_owner_cannot_update_and_data_unchanged(self):
        before = self._snapshot(self.owner_profile.id)

        response = self._client(self.other).patch(
            self.detail_url, {'nickname': '越权改名'}, format='json',
        )

        assert response.status_code == 404, response.content
        assert self._snapshot(self.owner_profile.id) == before

    def test_non_owner_cannot_destroy_and_data_unchanged(self):
        response = self._client(self.other).delete(self.detail_url)

        assert response.status_code == 404, response.content
        assert UserProfile.objects(id=self.owner_profile.id).first() is not None

    # --- admin/staff：可操作他人资料 ---
    def test_admin_can_retrieve_any_profile(self):
        response = self._client(self.admin).get(self.detail_url)

        assert response.status_code == 200, response.content
        assert response.json()['django_user_id'] == str(self.owner.id)

    def test_admin_can_update_any_profile(self):
        response = self._client(self.admin).patch(
            self.detail_url, {'nickname': '管理员更新'}, format='json',
        )

        assert response.status_code == 200, response.content
        self.owner_profile.reload()
        assert self.owner_profile.nickname == '管理员更新'

    def test_admin_can_destroy_any_profile(self):
        response = self._client(self.admin).delete(self.detail_url)

        assert response.status_code == 204, response.content
        assert UserProfile.objects(django_user_id=str(self.owner.id)).first() is None

    # --- 未认证：401/403，且数据不被改动 ---
    def test_unauthenticated_is_rejected_and_data_unchanged(self):
        before = self._snapshot(self.owner_profile.id)
        client = self._client()

        assert client.get(self.detail_url).status_code in (401, 403)
        assert client.patch(
            self.detail_url, {'nickname': '匿名改写'}, format='json',
        ).status_code in (401, 403)
        assert client.delete(self.detail_url).status_code in (401, 403)

        assert self._snapshot(self.owner_profile.id) == before
