"""
用户中间件测试
测试Django用户与MongoDB用户的映射功能

契约说明（本文件据此重写）：
1. 映射关系由 users.mongodb_models.UserProfile 承载（含 django_user_id 字段）；
   users.models.UserProfile 是另一套同名模型（只有 user 引用、没有 django_user_id），
   用它查询 django_user_id 会抛 InvalidQueryError。
2. users/signals.py 会在 Django 用户创建（created=True）时镜像出 MongoUser + UserProfile，
   因此「MongoDB 用户不存在」的场景必须在调用前显式清掉镜像数据。
3. 中间件的 process_request 按 session 里的用户 id 解析 request.user，不再沿用外部预设的 request.user。
"""

import pytest
from django.contrib import auth
from django.contrib.auth import get_user_model
from django.test import RequestFactory
from users.middleware import CustomAuthenticationMiddleware, get_mongo_user
from users.mongodb_models import User as MongoUser
from users.mongodb_models import UserProfile as MongoUserProfile

User = get_user_model()

# 本文件创建的非 Django 用户名（MongoDB 不参与 Django 事务回滚，teardown 需兜底清理）
MONGO_USERNAMES = ('testuser', 'mapped-user')


@pytest.mark.django_db
class TestCustomAuthenticationMiddleware:
    """测试自定义认证中间件"""

    def setup_method(self):
        """测试前准备"""
        self.factory = RequestFactory()
        self.middleware = CustomAuthenticationMiddleware(lambda r: None)

        # 创建测试用户（post_save 信号会同步镜像出 MongoUser + UserProfile）
        self.django_user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )

    def teardown_method(self):
        """测试后清理"""
        # 清理MongoDB用户与映射
        MongoUser.objects(django_user_id=str(self.django_user.id)).delete()
        for username in MONGO_USERNAMES:
            MongoUser.objects(username=username).delete()
        MongoUserProfile.objects(django_user_id=str(self.django_user.id)).delete()

    def test_get_mongo_user_creates_new_user(self):
        """测试：当MongoDB用户不存在时，自动创建"""
        # 先清掉信号镜像出来的文档，复现「MongoDB 侧不存在」的初始状态
        MongoUserProfile.objects(django_user_id=str(self.django_user.id)).delete()
        MongoUser.objects(username='testuser').delete()

        mongo_user = get_mongo_user(self.django_user)

        assert mongo_user is not None
        assert mongo_user.username == 'testuser'
        assert mongo_user.email == 'test@example.com'
        assert mongo_user.is_active is True
        assert mongo_user.django_user_id == str(self.django_user.id)

        # 验证UserProfile映射已创建
        profile = MongoUserProfile.objects.get(django_user_id=str(self.django_user.id))
        assert str(profile.user.id) == str(mongo_user.id)

    def test_get_mongo_user_uses_existing_user(self):
        """测试：当MongoDB用户已存在时，使用现有用户"""
        # 信号镜像出的 MongoUser 即「已存在」的 MongoDB 用户
        existing_mongo_user = MongoUser.objects(username='testuser').first()
        assert existing_mongo_user is not None

        # 获取MongoDB用户
        mongo_user = get_mongo_user(self.django_user)

        assert mongo_user is not None
        assert str(mongo_user.id) == str(existing_mongo_user.id)

        # 验证UserProfile映射指向同一个 MongoDB 用户
        profile = MongoUserProfile.objects.get(django_user_id=str(self.django_user.id))
        assert str(profile.user.id) == str(mongo_user.id)

    def test_get_mongo_user_uses_profile_mapping(self):
        """测试：优先使用UserProfile映射"""
        # 造一个「按 username 也能查到」的镜像用户，再把映射指向另一个 MongoDB 用户；
        # 若实现退化成按 username 查找，就会返回错误的对象。
        mapping_target = MongoUser(
            username='mapped-user',
            email='mapped@example.com',
            password='hashed-mapped',
            is_active=True
        )
        mapping_target.save()

        mapping = MongoUserProfile.objects.get(django_user_id=str(self.django_user.id))
        mapping.user = mapping_target
        mapping.save()

        # 获取MongoDB用户
        result = get_mongo_user(self.django_user)

        assert result is not None
        assert str(result.id) == str(mapping_target.id)

    def test_get_mongo_user_returns_none_for_anonymous(self):
        """测试：匿名用户返回None"""
        from django.contrib.auth.models import AnonymousUser

        result = get_mongo_user(AnonymousUser())
        assert result is None

    def test_middleware_injects_mongo_user(self):
        """测试：中间件正确注入mongo_user到request"""
        request = self.factory.get('/')
        # 中间件按 session 里的用户 id 解析 request.user
        request.session = {auth.SESSION_KEY: str(self.django_user.id)}

        # 处理请求
        self.middleware.process_request(request)

        # 验证mongo_user已注入
        assert hasattr(request, 'mongo_user')

        # 访问mongo_user（触发延迟加载）
        mongo_user = request.mongo_user
        assert mongo_user is not None
        assert mongo_user.username == 'testuser'
        assert mongo_user.django_user_id == str(self.django_user.id)


@pytest.mark.django_db
class TestUserProfileMapping:
    """测试UserProfile映射功能"""

    def test_mapping_consistency(self):
        """测试：映射关系的一致性"""
        # 创建Django用户（信号已建立 MongoUser + UserProfile 映射）
        django_user = User.objects.create_user(
            username='maptest',
            email='map@example.com',
            password='testpass123'
        )

        try:
            # 第一次获取（应复用信号镜像出的映射）
            mongo_user1 = get_mongo_user(django_user)

            # 第二次获取（应该返回同一个MongoDB用户）
            mongo_user2 = get_mongo_user(django_user)

            assert mongo_user1 is not None
            assert str(mongo_user1.id) == str(mongo_user2.id)

            # 验证只创建了一个UserProfile
            profiles = MongoUserProfile.objects.filter(django_user_id=str(django_user.id))
            assert profiles.count() == 1
            assert str(profiles.first().user.id) == str(mongo_user1.id)

        finally:
            # 清理
            MongoUser.objects(username='maptest').delete()
            MongoUser.objects(django_user_id=str(django_user.id)).delete()
            MongoUserProfile.objects(django_user_id=str(django_user.id)).delete()
            django_user.delete()
