"""RISK-BE-014：profile 序列化器（DocumentSerializer）与 /profiles 端到端回归。"""

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APIClient

from users.mongodb_models import User as MongoUser
from users.mongodb_models import UserProfile
from users.serializers.profile import UserProfileSerializer

User = get_user_model()

STRONG_FIXTURE_PASSWORD = 'Str0ng!Fixture#2026'


def _cleanup_mongo(username):
    """清理测试写入的 MongoDB 用户/资料（mongomock 不参与 Django 事务回滚）。"""
    for mongo_user in list(MongoUser.objects(username=username)):
        UserProfile.objects(user=mongo_user).delete()
    MongoUser.objects(username=username).delete()


class TestUserProfileSerializerContract:
    """序列化器不得声明模型上不存在的字段（历史幽灵字段 avatar/bio）。"""

    def test_declared_fields_are_real_model_fields(self):
        declared = set(UserProfileSerializer().fields)
        model_fields = set(UserProfile._fields)
        unknown = declared - model_fields
        assert not unknown, '序列化器声明了模型不存在的字段: %s' % sorted(unknown)

    def test_exposes_mapping_and_profile_fields(self):
        declared = set(UserProfileSerializer().fields)
        assert {'id', 'user', 'django_user_id'} <= declared
        assert {
            'nickname', 'gender', 'birthday', 'location', 'website',
            'company', 'position', 'bio_extended', 'social_links',
            'education', 'work', 'skills', 'interests',
            'created_at', 'updated_at',
        } <= declared

    def test_serializes_and_partially_updates_document(self):
        mongo_user = MongoUser(
            username='serializer-contract-user', password='hashed', is_active=True,
        ).save()
        try:
            profile = UserProfile(
                user=mongo_user,
                django_user_id='11111111-1111-1111-1111-111111111111',
                nickname='昵称',
                company='公司',
                position='职位',
                bio_extended='简介',
                skills=['python'],
            ).save()

            data = UserProfileSerializer(profile).data
            assert data['django_user_id'] == '11111111-1111-1111-1111-111111111111'
            assert str(data['user']) == str(mongo_user.id)
            assert data['company'] == '公司'
            assert data['bio_extended'] == '简介'
            assert list(data['skills']) == ['python']

            serializer = UserProfileSerializer(
                profile, data={'nickname': '新昵称', 'position': '架构师'}, partial=True,
            )
            assert serializer.is_valid(), serializer.errors
            serializer.save()
            profile.reload()
            assert profile.nickname == '新昵称'
            assert profile.position == '架构师'
            assert profile.django_user_id == '11111111-1111-1111-1111-111111111111'
        finally:
            _cleanup_mongo('serializer-contract-user')


@pytest.mark.django_db
class TestProfileEndpoints:
    """APIClient + force_authenticate 走 views/profile.py 的 GET/PATCH。"""

    username = 'profile-http-user'

    def _client(self, django_user):
        client = APIClient()
        client.force_authenticate(user=django_user)
        return client

    def _create_user(self):
        return User.objects.create_user(
            username=self.username,
            email='profile-http@example.com',
            password=STRONG_FIXTURE_PASSWORD,
        )

    def _cleanup(self, django_user):
        UserProfile.objects(django_user_id=str(django_user.id)).delete()
        _cleanup_mongo(self.username)
        django_user.delete()

    def test_get_my_profile_returns_200_with_mapping_fields(self):
        django_user = self._create_user()
        try:
            response = self._client(django_user).get(reverse('profile-my-profile'))

            assert response.status_code == 200, response.content
            payload = response.json()
            assert payload['django_user_id'] == str(django_user.id)
            assert payload['nickname'] in (None, '')
            # 返回字段必须都是模型真实字段（RISK-BE-014）
            assert set(payload) <= set(UserProfile._fields)
        finally:
            self._cleanup(django_user)

    def test_patch_my_profile_keeps_mapping_fields_after_update(self):
        django_user = self._create_user()
        try:
            client = self._client(django_user)
            response = client.patch(
                reverse('profile-update-my-profile'),
                {'nickname': '新昵称', 'company': 'ZeroIsle', 'position': '工程师'},
                format='json',
            )

            assert response.status_code == 200, response.content
            assert response.json()['nickname'] == '新昵称'

            profile = UserProfile.objects(django_user_id=str(django_user.id)).first()
            assert profile is not None
            assert profile.django_user_id == str(django_user.id)
            assert profile.company == 'ZeroIsle'
            assert profile.position == '工程师'

            # 再读一次：映射字段与更新内容都不丢
            again = client.get(reverse('profile-my-profile'))
            assert again.status_code == 200
            payload = again.json()
            assert payload['django_user_id'] == str(django_user.id)
            assert payload['nickname'] == '新昵称'
            assert payload['company'] == 'ZeroIsle'
        finally:
            self._cleanup(django_user)
