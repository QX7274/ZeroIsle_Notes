"""
密码验证器和登录限制测试
测试 password_validator.py 和 login_attempt.py 的功能
"""

import pytest
from datetime import timedelta
from django.utils import timezone
from unittest.mock import patch, MagicMock


class TestPasswordValidator:
    """密码验证器测试"""
    
    def test_validate_strong_password(self):
        """测试强密码验证通过"""
        from users.services.password_validator import validate_password
        
        is_valid, errors = validate_password("MyStr0ng!Pass#2026")
        assert is_valid is True
        assert len(errors) == 0
    
    def test_validate_weak_password_too_short(self):
        """测试密码过短"""
        from users.services.password_validator import validate_password
        
        is_valid, errors = validate_password("Ab1!")
        assert is_valid is False
        assert any("长度" in e or "length" in e.lower() for e in errors)
    
    def test_validate_password_no_uppercase(self):
        """测试密码缺少大写字母"""
        from users.services.password_validator import validate_password
        
        is_valid, errors = validate_password("mypassword123!")
        assert is_valid is False
        assert any("大写" in e or "uppercase" in e.lower() for e in errors)
    
    def test_validate_password_no_lowercase(self):
        """测试密码缺少小写字母"""
        from users.services.password_validator import validate_password
        
        is_valid, errors = validate_password("MYPASSWORD123!")
        assert is_valid is False
        assert any("小写" in e or "lowercase" in e.lower() for e in errors)
    
    def test_validate_password_no_digit(self):
        """测试密码缺少数字"""
        from users.services.password_validator import validate_password
        
        is_valid, errors = validate_password("MyPassword!@#")
        assert is_valid is False
        assert any("数字" in e or "digit" in e.lower() for e in errors)
    
    def test_validate_password_no_special(self):
        """测试密码缺少特殊字符"""
        from users.services.password_validator import validate_password
        
        is_valid, errors = validate_password("MyPassword123")
        assert is_valid is False
        assert any("特殊" in e or "special" in e.lower() for e in errors)
    
    def test_validate_common_password(self):
        """测试常见弱密码"""
        from users.services.password_validator import validate_password
        
        is_valid, errors = validate_password("Password123!")
        assert is_valid is False
        assert any("常见" in e or "common" in e.lower() for e in errors)
    
    def test_validate_password_contains_username(self):
        """测试密码包含用户名"""
        from users.services.password_validator import validate_password
        
        is_valid, errors = validate_password("JohnDoe123!", username="johndoe")
        assert is_valid is False
        assert any("用户名" in e or "username" in e.lower() for e in errors)
    
    def test_validate_password_sequential_chars(self):
        """测试密码包含连续字符"""
        from users.services.password_validator import validate_password
        
        is_valid, errors = validate_password("Abc12345!")
        assert is_valid is False
        assert any("连续" in e or "sequential" in e.lower() for e in errors)
    
    def test_validate_password_repeated_chars(self):
        """测试密码包含重复字符"""
        from users.services.password_validator import validate_password
        
        is_valid, errors = validate_password("Aaaa1234!")
        assert is_valid is False
        assert any("重复" in e or "repeat" in e.lower() for e in errors)
    
    def test_get_strength_score(self):
        """测试密码强度评分"""
        from users.services.password_validator import PasswordValidator
        
        validator = PasswordValidator()
        
        # 弱密码
        weak_score = validator.get_strength_score("password")
        assert weak_score < 40
        
        # 中等密码
        medium_score = validator.get_strength_score("Password1")
        assert 40 <= medium_score < 70
        
        # 强密码
        strong_score = validator.get_strength_score("MyStr0ng!Pass#2026XyZ")
        assert strong_score >= 70
    
    def test_get_strength_info(self):
        """测试获取密码强度信息"""
        from users.services.password_validator import PasswordValidator
        
        validator = PasswordValidator()
        info = validator.get_strength_info("MyStr0ng!Pass")
        
        assert 'score' in info
        assert 'level' in info
        assert 'suggestions' in info
        assert isinstance(info['suggestions'], list)


class TestLoginAttempt:
    """登录尝试和账户锁定测试"""
    
    @pytest.fixture
    def mock_login_attempt(self):
        """Mock LoginAttempt model"""
        with patch('users.models.login_attempt.LoginAttempt') as mock:
            yield mock
    
    def test_is_account_locked_false(self):
        """测试账户未锁定"""
        from users.models.login_attempt import LoginAttempt
        
        with patch.object(LoginAttempt, 'objects') as mock_objects:
            mock_objects.return_value.filter.return_value.count.return_value = 3
            
            is_locked = LoginAttempt.is_account_locked(username="testuser")
            # 3次失败 < 5次限制，不应锁定
            assert is_locked is False
    
    def test_is_account_locked_true(self):
        """测试账户已锁定"""
        from users.models.login_attempt import LoginAttempt
        
        with patch.object(LoginAttempt, 'objects') as mock_objects:
            mock_objects.return_value.filter.return_value.count.return_value = 6
            
            is_locked = LoginAttempt.is_account_locked(username="testuser")
            # 6次失败 >= 5次限制，应该锁定
            assert is_locked is True
    
    def test_record_attempt_success(self):
        """测试记录成功登录"""
        from users.models.login_attempt import LoginAttempt
        
        with patch.object(LoginAttempt, 'objects') as mock_objects:
            mock_instance = MagicMock()
            mock_objects.return_value.create.return_value = mock_instance
            
            result = LoginAttempt.record_attempt(
                ip_address="192.168.1.1",
                success=True,
                username="testuser",
                user_id="123",
                user_agent="TestAgent"
            )
            
            assert result is not None
    
    def test_record_attempt_failure(self):
        """测试记录失败登录"""
        from users.models.login_attempt import LoginAttempt
        
        with patch.object(LoginAttempt, 'objects') as mock_objects:
            mock_instance = MagicMock()
            mock_objects.return_value.create.return_value = mock_instance
            
            result = LoginAttempt.record_attempt(
                ip_address="192.168.1.1",
                success=False,
                username="testuser",
                failure_reason="Invalid password"
            )
            
            assert result is not None
    
    def test_get_lockout_info(self):
        """测试获取锁定信息"""
        from users.models.login_attempt import LoginAttempt
        
        with patch.object(LoginAttempt, 'objects') as mock_objects:
            mock_objects.return_value.filter.return_value.count.return_value = 5
            mock_objects.return_value.filter.return_value.order_by.return_value.first.return_value = MagicMock(
                created_at=timezone.now()
            )
            
            info = LoginAttempt.get_lockout_info(username="testuser")
            
            assert 'locked' in info
            assert 'message' in info
            assert 'failed_attempts' in info
    
    def test_reset_failed_attempts(self):
        """测试重置失败计数"""
        from users.models.login_attempt import LoginAttempt
        
        with patch.object(LoginAttempt, 'objects') as mock_objects:
            mock_objects.return_value.filter.return_value.delete.return_value = 3
            
            count = LoginAttempt.reset_failed_attempts(username="testuser")
            
            assert count == 3


class TestEnhancedVectorService:
    """增强向量服务测试"""
    
    def test_singleton_pattern(self):
        """测试单例模式"""
        from search.services.enhanced_vector_service import EnhancedVectorService
        
        service1 = EnhancedVectorService()
        service2 = EnhancedVectorService()
        
        assert service1 is service2
    
    def test_index_documents(self):
        """测试文档索引"""
        from search.services.enhanced_vector_service import get_vector_service
        
        service = get_vector_service()
        
        documents = [
            {'id': 'test1', 'title': 'Test Document 1', 'content': 'This is test content'},
            {'id': 'test2', 'title': 'Test Document 2', 'content': 'Another test document'},
        ]
        
        # 不应抛出异常
        service.index_documents(documents)
        
        stats = service.get_stats()
        assert stats['total_documents'] >= 2
    
    def test_semantic_search(self):
        """测试语义搜索"""
        from search.services.enhanced_vector_service import get_vector_service
        
        service = get_vector_service()
        
        # 先索引一些文档
        documents = [
            {'id': 'note1', 'title': 'Python编程入门', 'content': 'Python是一门简单易学的编程语言'},
            {'id': 'note2', 'title': 'JavaScript前端开发', 'content': 'JavaScript用于网页交互'},
        ]
        service.index_documents(documents)
        
        # 执行搜索
        results = service.semantic_search('Python编程', top_k=5)
        
        assert isinstance(results, list)
    
    def test_hybrid_search(self):
        """测试混合搜索"""
        from search.services.enhanced_vector_service import get_vector_service
        
        service = get_vector_service()
        
        keyword_results = [
            {'id': 'doc1', 'score': 0.9, 'title': 'Test'},
        ]
        
        results = service.hybrid_search(
            query='test query',
            keyword_results=keyword_results,
            top_k=5
        )
        
        assert isinstance(results, list)


class TestNotificationPreferencesService:
    """通知偏好服务测试"""
    
    def test_should_send_notification_global_disabled(self):
        """测试全局禁用时不发送通知"""
        from notification.notification_preferences_service import NotificationPreferencesService
        
        service = NotificationPreferencesService()
        
        with patch.object(service, 'get_preferences') as mock_get:
            mock_prefs = MagicMock()
            mock_prefs.global_enabled = False
            mock_get.return_value = mock_prefs
            
            mock_user = MagicMock()
            result = service.should_send_notification(mock_user, 'comment', 'push')
            
            assert result is False
    
    def test_should_send_notification_muted(self):
        """测试静默期间不发送通知"""
        from notification.notification_preferences_service import NotificationPreferencesService
        
        service = NotificationPreferencesService()
        
        with patch.object(service, 'get_preferences') as mock_get:
            mock_prefs = MagicMock()
            mock_prefs.global_enabled = True
            mock_prefs.muted_until = timezone.now() + timedelta(hours=1)
            mock_get.return_value = mock_prefs
            
            mock_user = MagicMock()
            result = service.should_send_notification(mock_user, 'comment', 'push')
            
            assert result is False
