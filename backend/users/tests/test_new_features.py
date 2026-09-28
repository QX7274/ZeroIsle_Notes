"""
密码验证器和登录限制测试
测试 password_validator.py 和 login_attempt.py 的功能
"""

import pytest
from datetime import timedelta
from django.utils import timezone
from unittest.mock import patch, MagicMock


def _load_enhanced_vector_service():
    """按环境依赖类问题处理：依赖不兼容则跳过，而不是改依赖版本。

    enhanced_vector_service 模块导入时吞掉了 sentence-transformers 的 ImportError，
    真正抛错发生在首次加载模型（SentenceTransformerEmbedding._load_model）。
    因此这里直接探测 sentence_transformers 是否可导入：
    实测 sentence-transformers 2.2.2 仍 import huggingface_hub.cached_download，
    而当前环境 huggingface-hub 0.36.2 已移除该 API（ImportError）——
    属环境依赖不兼容，与 search 业务逻辑无关。
    """
    pytest.importorskip(
        'sentence_transformers',
        reason=(
            'sentence-transformers 2.2.2 仍 import huggingface_hub.cached_download，'
            '当前环境 huggingface-hub 0.36.2 已移除该 API（ImportError）；'
            '属环境依赖不兼容，测试侧跳过，不改依赖版本'
        ),
    )
    import importlib

    return importlib.import_module('search.services.enhanced_vector_service')


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
    
    @pytest.mark.xfail(
        strict=True,
        reason=(
            '产品缺陷候选：COMMON_WEAK_PASSWORDS 只做整串精确匹配'
            '(password.lower() in COMMON_WEAK_PASSWORDS)，Password123! 这类'
            '「常见密码 + 特殊字符」的变体不会被识别；最小复现：'
            'validate_password("Password123!") 返回 (True, [])。交回 Lead 定级；'
            '若判定为契约设计，请把用例改为断言精确名单内的密码。'
        ),
    )
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
        # 当前真实文案为「密码不能包含3个或更多连续相同的字符」
        assert any("重复" in e or "repeat" in e.lower() or "连续相同" in e for e in errors)
    
    def test_get_strength_score(self):
        """测试密码强度评分"""
        from users.services.password_validator import PasswordValidator
        
        validator = PasswordValidator()
        
        # 弱密码
        weak_score = validator.get_strength_score("password")
        assert weak_score < 40
        
        # 中等密码（注意：Password1 命中 COMMON_WEAK_PASSWORDS 会被扣 30 分至 20 分，
        # 属于「弱」，不能当中等强度样本）
        medium_score = validator.get_strength_score("Str0ngPass")
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
            mock_objects.return_value.count.return_value = 3

            # 当前契约：返回 (is_locked, remaining_seconds, failed_count)
            is_locked, remaining_seconds, failed_count = LoginAttempt.is_account_locked(
                username="testuser"
            )
            # 3次失败 < 5次限制，不应锁定
            assert is_locked is False
            assert failed_count == 3
            assert remaining_seconds == 0
    
    def test_is_account_locked_true(self):
        """测试账户已锁定"""
        from users.models.login_attempt import LoginAttempt
        
        with patch.object(LoginAttempt, 'objects') as mock_objects:
            mock_objects.return_value.count.return_value = 6
            mock_objects.return_value.order_by.return_value.first.return_value = MagicMock(
                timestamp=timezone.now()
            )

            is_locked, remaining_seconds, failed_count = LoginAttempt.is_account_locked(
                username="testuser"
            )
            # 6次失败 >= 5次限制，应该锁定
            assert is_locked is True
            assert failed_count == 6
            assert remaining_seconds > 0
    
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
            mock_objects.return_value.count.return_value = 5
            mock_objects.return_value.order_by.return_value.first.return_value = MagicMock(
                timestamp=timezone.now()
            )

            info = LoginAttempt.get_lockout_info(username="testuser")

            assert info['locked'] is True
            assert isinstance(info['message'], str) and info['message']
            assert info['failed_attempts'] == 5
            assert info['max_attempts'] == 5
    
    @pytest.mark.xfail(
        strict=True,
        reason=(
            '产品缺陷候选：reset_failed_attempts 是 no-op（只写日志、不删记录、返回 None），'
            '而 is_account_locked 仅按 1 小时时间窗统计失败次数——成功登录不会清空窗口，'
            '「失败4次→成功登录→再失败1次」仍会被锁定 30 分钟。最小复现：'
            'LoginAttempt.reset_failed_attempts(username="u") is None。交回 Lead 定级；'
            '若确认为设计意图，请把断言改为「不删除历史记录」。'
        ),
    )
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
        EnhancedVectorService = _load_enhanced_vector_service().EnhancedVectorService
        
        service1 = EnhancedVectorService()
        service2 = EnhancedVectorService()
        
        assert service1 is service2
    
    def test_index_documents(self):
        """测试文档索引"""
        get_vector_service = _load_enhanced_vector_service().get_vector_service
        
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
        get_vector_service = _load_enhanced_vector_service().get_vector_service
        
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
        get_vector_service = _load_enhanced_vector_service().get_vector_service
        
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
