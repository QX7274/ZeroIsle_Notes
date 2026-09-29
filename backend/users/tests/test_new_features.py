"""
密码验证器和登录限制测试
测试 password_validator.py 和 login_attempt.py 的功能
"""

import pytest
from datetime import timedelta
from django.utils import timezone
from unittest.mock import patch, MagicMock


def _load_enhanced_vector_service():
    """导入 enhanced_vector_service —— 依赖已修好，这里不再跳过（task-33）。

    依赖现状（RISK-BE-013 已修）：backend/requirements.txt 已钉 huggingface_hub==0.25.2，
    sentence-transformers 2.2.2 可正常 import，因此本模块不再用 importorskip 掩盖问题
    （依赖一旦再坏，backend/search/tests/test_vector_dependency.py 会直接失败报警）。

    注意：TestEnhancedVectorService 的 autouse fixture 会把口径固定成
    VECTOR_MODEL_TYPE=tfidf + VECTOR_STORE_TYPE=memory，因此这些用例不需要下载
    ~470MB 的 paraphrase-multilingual-MiniLM-L12-v2，离线也能真跑；
    需要真实权重的场景由 _embedding_model_is_cached() 门控的用例覆盖。
    """
    import importlib

    return importlib.import_module('search.services.enhanced_vector_service')


def _embedding_model_is_cached():
    """检查默认嵌入模型是否已在本地 HF 缓存中（只查缓存，不触发下载）。"""
    try:
        from huggingface_hub import try_to_load_from_cache
    except ImportError:  # pragma: no cover - 无该 API 时按未缓存处理
        return False

    repo_id = 'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2'
    for filename in ('model.safetensors', 'pytorch_model.bin'):
        try:
            cached = try_to_load_from_cache(repo_id, filename)
        except Exception:  # noqa: BLE001 - 探测失败一律视为未缓存
            return False
        if isinstance(cached, str):
            return True
    return False


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

    def test_validate_password_with_common_root_is_rejected(self):
        """回归：'TestPassword123!'（普通词 + password 词根）必须被拒（RISK-BE-010）

        该口令原是 test_auth.py 的注册夹具；新规则生效后它会被判弱（产品预期），
        夹具已同步换成强口令 'Str0ng!Fixture#2026'。
        """
        from users.services.password_validator import validate_password

        is_valid, errors = validate_password("TestPassword123!")
        assert is_valid is False
        assert any("常见" in e or "common" in e.lower() for e in errors)

    def test_validate_common_password_variants_are_rejected(self):
        """正例（RISK-BE-010）：常见弱密码 + 后缀/大小写/leet 变形都必须被拒"""
        from users.services.password_validator import validate_password

        variants = [
            "Password123!",   # 弱密码 + 特殊字符后缀
            "PASSWORD123",    # 大小写变形（命中整串名单）
            "P@ssw0rd",       # leet 替换
            "Admin2026!",     # 弱词根 + 年份后缀
            "Qwerty!2345",    # 键盘序 + 后缀
            "Abc123456!",     # 弱词根 + 数字串
        ]
        for password in variants:
            is_valid, errors = validate_password(password)
            assert is_valid is False, f"{password} 应被判为弱口令"
            assert any("常见" in e or "common" in e.lower() for e in errors), password

    def test_validate_strong_passphrase_not_falsely_rejected(self):
        """负例（RISK-BE-010）：含 pass(word) 片段的长口令不得被弱词根误伤"""
        from users.services.password_validator import validate_password

        for password in ["Str0ngPassphrase!2026", "MyStr0ng!Pass#2026"]:
            is_valid, errors = validate_password(password)
            assert is_valid is True, f"{password} 不应被判弱口令: {errors}"
            assert errors == []

    def test_is_common_weak_password_normalization_rules(self):
        """归一化规则单测：整串 / 大小写 / leet / 词根包含"""
        from users.services.password_validator import is_common_weak_password

        assert is_common_weak_password("password") is True
        assert is_common_weak_password("PASSWORD123") is True
        assert is_common_weak_password("P@ssw0rd") is True
        assert is_common_weak_password("Iloveyou2026") is True
        assert is_common_weak_password("Str0ngPassphrase!2026") is False
        assert is_common_weak_password("Xk9#Qz!Vt7") is False

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
    
    def test_reset_failed_attempts(self):
        """测试重置失败计数（RISK-BE-011：真正清除失败记录并返回条数）"""
        from users.models.login_attempt import LoginAttempt

        with patch.object(LoginAttempt, 'objects') as mock_objects:
            mock_objects.return_value.update.return_value = 3

            count = LoginAttempt.reset_failed_attempts(username="testuser")

            assert count == 3
            mock_objects.return_value.update.assert_called_once_with(set__is_reset=True)

    def test_reset_failed_attempts_without_identity_is_noop(self):
        """负例：无 username/user_id 时不触碰数据库，返回 0"""
        from users.models.login_attempt import LoginAttempt

        with patch.object(LoginAttempt, 'objects') as mock_objects:
            assert LoginAttempt.reset_failed_attempts() == 0
            mock_objects.assert_not_called()

    def test_successful_login_clears_lockout_window(self):
        """端到端（RISK-BE-011）：失败 4 次 → 成功登录 → 窗口清零 → 再失败 1 次仍不锁"""
        from users.models.login_attempt import LoginAttempt

        username = 'reset-window-user'
        LoginAttempt.objects(username=username).delete()
        try:
            for _ in range(4):
                LoginAttempt.record_attempt(
                    ip_address='127.0.0.1', success=False, username=username,
                    failure_reason='bad password',
                )

            is_locked, _, failed_count = LoginAttempt.is_account_locked(username=username)
            assert is_locked is False
            assert failed_count == 4

            # 成功登录记录会同时清零失败窗口（record_attempt 内部调用 reset_failed_attempts）
            LoginAttempt.record_attempt(ip_address='127.0.0.1', success=True, username=username)

            is_locked, _, failed_count = LoginAttempt.is_account_locked(username=username)
            assert is_locked is False
            assert failed_count == 0

            # 窗口从 0 重新计数：再失败 1 次不会被锁
            LoginAttempt.record_attempt(
                ip_address='127.0.0.1', success=False, username=username,
                failure_reason='bad password again',
            )
            is_locked, _, failed_count = LoginAttempt.is_account_locked(username=username)
            assert is_locked is False
            assert failed_count == 1
        finally:
            LoginAttempt.objects(username=username).delete()

    def test_consecutive_failures_still_lock(self):
        """端到端正例：连续 5 次失败仍会被锁（新重置逻辑不削弱锁定）"""
        from users.models.login_attempt import LoginAttempt

        username = 'lock-window-user'
        LoginAttempt.objects(username=username).delete()
        try:
            for _ in range(5):
                LoginAttempt.record_attempt(
                    ip_address='127.0.0.1', success=False, username=username,
                    failure_reason='bad password',
                )

            is_locked, remaining_seconds, failed_count = LoginAttempt.is_account_locked(
                username=username
            )
            assert is_locked is True
            assert failed_count == 5
            assert remaining_seconds > 0

            info = LoginAttempt.get_lockout_info(username=username)
            assert info['locked'] is True
            assert info['failed_attempts'] == 5
        finally:
            LoginAttempt.objects(username=username).delete()

    def test_email_identifier_failures_cleared_by_success(self):
        """端到端：失败按邮箱标识记录、成功按 username+user_id 记录时也能清零（标识归一）"""
        from users.models.login_attempt import LoginAttempt
        from users.mongodb_models import User as MongoUser

        email = 'lockout-email@example.com'
        mongo_username = 'lockout-email-user'
        MongoUser.objects(username=mongo_username).delete()
        mongo_user = MongoUser(
            username=mongo_username, email=email, password='hashed-password', is_active=True,
        ).save()
        try:
            LoginAttempt.objects(username=email).delete()
            LoginAttempt.objects(user_id=str(mongo_user.id)).delete()
            LoginAttempt.record_attempt(
                ip_address='127.0.0.1', success=False, username=email, failure_reason='bad password',
            )
            _, _, failed_count = LoginAttempt.is_account_locked(username=email)
            assert failed_count == 1

            # 复刻 views/mongo_auth.py 成功分支：username=MongoUser.username + user_id=主键
            LoginAttempt.record_attempt(
                ip_address='127.0.0.1', success=True,
                username=mongo_user.username, user_id=str(mongo_user.id),
            )

            is_locked, _, failed_count = LoginAttempt.is_account_locked(username=email)
            assert is_locked is False
            assert failed_count == 0
        finally:
            LoginAttempt.objects(username=email).delete()
            LoginAttempt.objects(username=mongo_username).delete()
            LoginAttempt.objects(user_id=str(mongo_user.id)).delete()
            MongoUser.objects(username=mongo_username).delete()


class TestEnhancedVectorService:
    """增强向量服务测试（真实执行，不再 importorskip 跳过）。"""

    @pytest.fixture(autouse=True)
    def _offline_vector_config(self, settings):
        """测试口径固定为 TF-IDF + 内存存储：不依赖模型权重，离线可复现。

        生产默认是 sentence_transformer + faiss（需要下载权重）；这里只覆盖测试配置，
        真实模型路径由 backend/search/tests 里 env 门控的用例覆盖。
        """
        settings.VECTOR_MODEL_TYPE = 'tfidf'
        settings.VECTOR_STORE_TYPE = 'memory'

        EnhancedVectorService = _load_enhanced_vector_service().EnhancedVectorService
        saved_instance = EnhancedVectorService._instance
        EnhancedVectorService._instance = None
        try:
            yield
        finally:
            EnhancedVectorService._instance = saved_instance

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
