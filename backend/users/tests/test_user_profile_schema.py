"""RISK-BE-012：user_profiles 集合只能由一个 Document 定义，且 profile / gdpr 路径不丢字段。"""

import pytest
from django.contrib.auth import get_user_model
from mongoengine import Document

from users.mongodb_models import User as MongoUser
from users.mongodb_models import UserProfile as CanonicalUserProfile

User = get_user_model()

USER_PROFILES_COLLECTION = 'user_profiles'

# 两个历史 schema 的字段并集：统一后的模型必须全部覆盖，防「字段对不上但共写同一集合」回归
HISTORICAL_FIELD_UNION = {
    'user', 'django_user_id', 'nickname', 'gender', 'birthday', 'location',
    'website', 'social_links', 'education', 'work', 'skills', 'interests',
    'company', 'position', 'bio_extended', 'created_at', 'updated_at',
}

STRONG_FIXTURE_PASSWORD = 'Str0ng!Fixture#2026'


def _all_document_subclasses():
    """枚举所有 mongoengine Document 子类。

    不依赖 _document_registry：注册表按「类名」索引，同名类会互相覆盖，
    用它做唯一性断言会漏掉同名冲突。
    """
    found = set()
    stack = list(Document.__subclasses__())
    while stack:
        model = stack.pop()
        if model in found:
            continue
        found.add(model)
        stack.extend(model.__subclasses__())
    return found


def _cleanup_mongo(username):
    """清理测试写入的 MongoDB 用户/资料（mongomock 不参与 Django 事务回滚）。"""
    for mongo_user in list(MongoUser.objects(username=username)):
        CanonicalUserProfile.objects(user=mongo_user).delete()
    MongoUser.objects(username=username).delete()


class TestUserProfileSchemaUnification:
    def test_only_one_document_maps_user_profiles_collection(self):
        mapping = {
            model
            for model in _all_document_subclasses()
            if model._meta.get('collection') == USER_PROFILES_COLLECTION
        }
        assert mapping == {CanonicalUserProfile}, (
            'user_profiles 集合只能由一个 Document 定义，实际: %s'
            % sorted('%s.%s' % (model.__module__, model.__name__) for model in mapping)
        )

    def test_users_models_reexports_the_canonical_document(self):
        from users.models import MongoUserProfile, UserProfile

        assert UserProfile is CanonicalUserProfile
        assert MongoUserProfile is CanonicalUserProfile

    def test_canonical_schema_covers_both_historical_schemas(self):
        assert HISTORICAL_FIELD_UNION <= set(CanonicalUserProfile._fields)


@pytest.mark.django_db
class TestProfileReadWritePath:
    def test_view_resolves_mongo_user_and_write_keeps_mapping_fields(self):
        from users.views.profile import UserProfileViewSet, _resolve_mongo_user

        django_user = User.objects.create_user(
            username='profile-schema-user',
            email='profile-schema@example.com',
            password=STRONG_FIXTURE_PASSWORD,
        )
        try:
            mongo_user = _resolve_mongo_user(django_user)
            assert mongo_user is not None

            profile = CanonicalUserProfile.objects.get(user=mongo_user)
            assert profile.django_user_id == str(django_user.id)

            class _Request:
                pass

            request = _Request()
            request.user = django_user
            view = UserProfileViewSet()
            view.request = request

            # 读取路径：普通用户只能看到自己的资料，且按 MongoUser 过滤
            # （旧实现把 Django User 塞进 ReferenceField，查询必然失败）
            assert [item.id for item in view.get_queryset()] == [profile.id]

            # 写入路径：perform_create 必须注入 MongoUser 而不是 Django User
            captured = {}

            class _StubSerializer:
                def save(self, **kwargs):
                    captured.update(kwargs)
                    return None

            view.perform_create(_StubSerializer())
            assert captured['user'].id == mongo_user.id

            # 通过 users.models 的历史导入路径写入：映射字段不得丢失
            from users.models import UserProfile as ModelsUserProfile

            alias_profile = ModelsUserProfile.objects.get(user=mongo_user)
            alias_profile.nickname = '昵称-更新'
            alias_profile.company = 'ZeroIsle'
            alias_profile.position = '工程师'
            alias_profile.bio_extended = '扩展简介'
            alias_profile.save()

            reloaded = CanonicalUserProfile.objects.get(user=mongo_user)
            assert reloaded.django_user_id == str(django_user.id)
            assert reloaded.nickname == '昵称-更新'
            assert reloaded.company == 'ZeroIsle'
            assert reloaded.position == '工程师'
            assert reloaded.bio_extended == '扩展简介'
        finally:
            CanonicalUserProfile.objects(django_user_id=str(django_user.id)).delete()
            _cleanup_mongo('profile-schema-user')
            django_user.delete()


@pytest.mark.django_db
class TestGdprServiceProfileLookup:
    def test_export_user_data_finds_profile_without_invalid_query(self):
        from users.services.gdpr_service import GDPRService

        django_user = User.objects.create_user(
            username='gdpr-schema-user',
            email='gdpr-schema@example.com',
            password=STRONG_FIXTURE_PASSWORD,
        )
        try:
            profile = GDPRService._get_mongo_profile(django_user)
            assert profile is not None
            assert profile.django_user_id == str(django_user.id)

            data = GDPRService.export_user_data(django_user)

            assert data['account']['username'] == 'gdpr-schema-user'
            # 旧实现用不存在的 user_id 字段查询 → 必抛 InvalidQueryError，profile 永远为空
            assert data['profile'], '导出必须能拿到 MongoDB 资料'
            assert data['profile']['django_user_id'] == str(django_user.id)
        finally:
            CanonicalUserProfile.objects(django_user_id=str(django_user.id)).delete()
            _cleanup_mongo('gdpr-schema-user')
            django_user.delete()

    def test_delete_path_resolves_profile_and_does_not_raise(self):
        from users.services.gdpr_service import GDPRService

        django_user = User.objects.create_user(
            username='gdpr-delete-user',
            email='gdpr-delete@example.com',
            password=STRONG_FIXTURE_PASSWORD,
        )
        try:
            assert GDPRService._get_mongo_profile(django_user) is not None
            assert GDPRService.delete_user_account(django_user, reason='unit-test') is True
        finally:
            CanonicalUserProfile.objects(django_user_id=str(django_user.id)).delete()
            _cleanup_mongo('gdpr-delete-user')
            django_user.delete()

    def test_lookup_returns_none_for_unknown_user(self):
        from users.services.gdpr_service import GDPRService

        assert GDPRService._get_mongo_profile(None) is None

        class _Ghost:
            id = '00000000-0000-0000-0000-000000000000'
            username = 'ghost-not-exists'

        assert GDPRService._get_mongo_profile(_Ghost()) is None
