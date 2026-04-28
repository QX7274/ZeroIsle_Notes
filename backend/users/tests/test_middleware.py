"""
用户中间件测试
测试Django用户与MongoDB用户的映射功能
"""

import pytest
from django.contrib.auth import get_user_model
from django.test import RequestFactory
from users.middleware import CustomAuthenticationMiddleware, get_mongo_user
from users.models import UserProfile
from users.mongodb_models import User as MongoUser

User = get_user_model()


@pytest.mark.django_db
class TestCustomAuthenticationMiddleware:
    """测试自定义认证中间件"""
    
    def setup_method(self):
        """测试前准备"""
        self.factory = RequestFactory()
        self.middleware = CustomAuthenticationMiddleware(lambda r: None)
        
        # 创建测试用户
        self.django_user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
    
    def teardown_method(self):
        """测试后清理"""
        # 清理MongoDB用户
        MongoUser.objects(username='testuser').delete()
        # 清理UserProfile
        UserProfile.objects.filter(django_user_id=str(self.django_user.id)).delete()
    
    def test_get_mongo_user_creates_new_user(self):
        """测试：当MongoDB用户不存在时，自动创建"""
        mongo_user = get_mongo_user(self.django_user)
        
        assert mongo_user is not None
        assert mongo_user.username == 'testuser'
        assert mongo_user.email == 'test@example.com'
        assert mongo_user.is_active == True
        
        # 验证UserProfile映射已创建
        profile = UserProfile.objects.get(django_user_id=str(self.django_user.id))
        assert profile.mongo_user_id == str(mongo_user.id)
    
    def test_get_mongo_user_uses_existing_user(self):
        """测试：当MongoDB用户已存在时，使用现有用户"""
        # 先创建MongoDB用户
        existing_mongo_user = MongoUser(
            username='testuser',
            email='test@example.com',
            is_active=True
        )
        existing_mongo_user.save()
        
        # 获取MongoDB用户
        mongo_user = get_mongo_user(self.django_user)
        
        assert mongo_user is not None
        assert str(mongo_user.id) == str(existing_mongo_user.id)
        
        # 验证UserProfile映射已创建
        profile = UserProfile.objects.get(django_user_id=str(self.django_user.id))
        assert profile.mongo_user_id == str(mongo_user.id)
    
    def test_get_mongo_user_uses_profile_mapping(self):
        """测试：优先使用UserProfile映射"""
        # 创建MongoDB用户
        mongo_user = MongoUser(
            username='testuser',
            email='test@example.com',
            is_active=True
        )
        mongo_user.save()
        
        # 创建UserProfile映射
        UserProfile.objects.create(
            django_user_id=str(self.django_user.id),
            mongo_user_id=str(mongo_user.id)
        )
        
        # 获取MongoDB用户
        result = get_mongo_user(self.django_user)
        
        assert result is not None
        assert str(result.id) == str(mongo_user.id)
    
    def test_get_mongo_user_returns_none_for_anonymous(self):
        """测试：匿名用户返回None"""
        from django.contrib.auth.models import AnonymousUser
        
        result = get_mongo_user(AnonymousUser())
        assert result is None
    
    def test_middleware_injects_mongo_user(self):
        """测试：中间件正确注入mongo_user到request"""
        request = self.factory.get('/')
        request.user = self.django_user
        request.session = {}
        
        # 处理请求
        self.middleware.process_request(request)
        
        # 验证mongo_user已注入
        assert hasattr(request, 'mongo_user')
        
        # 访问mongo_user（触发延迟加载）
        mongo_user = request.mongo_user
        assert mongo_user is not None
        assert mongo_user.username == 'testuser'


@pytest.mark.django_db
class TestUserProfileMapping:
    """测试UserProfile映射功能"""
    
    def test_mapping_consistency(self):
        """测试：映射关系的一致性"""
        # 创建Django用户
        django_user = User.objects.create_user(
            username='maptest',
            email='map@example.com',
            password='testpass123'
        )
        
        try:
            # 第一次获取（创建MongoDB用户和映射）
            mongo_user1 = get_mongo_user(django_user)
            
            # 第二次获取（应该返回同一个MongoDB用户）
            mongo_user2 = get_mongo_user(django_user)
            
            assert str(mongo_user1.id) == str(mongo_user2.id)
            
            # 验证只创建了一个UserProfile
            profiles = UserProfile.objects.filter(django_user_id=str(django_user.id))
            assert profiles.count() == 1
            
        finally:
            # 清理
            MongoUser.objects(username='maptest').delete()
            UserProfile.objects.filter(django_user_id=str(django_user.id)).delete()
            django_user.delete()

