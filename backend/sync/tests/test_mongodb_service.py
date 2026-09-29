"""
MongoDBService 单元测试（不连接真实 Mongo）

覆盖：
1. 单例语义、显式 initialize、超时/TLS 透传、连接失败可重试、close
2. RISK-BE-008：旧变量名（MONGO_DB / MONGO_HOST / MONGO_PORT / MONGO_USER / MONGO_PASSWORD）
   在缺少对应新变量名时不得静默 —— 生产直接失败并给出变量对照表，开发大声 WARNING
3. MONGO_DB_NAME 默认库名兜底必须打印「正在使用默认库名」显式日志
"""

import os
from contextlib import contextmanager
from unittest import TestCase, mock

from django.conf import settings
from django.test import override_settings
from pymongo.errors import ConnectionFailure

# Mock Django settings to allow standalone run
if not settings.configured:
    settings.configure()

from ..services.mongodb_service import (
    DEFAULT_DB_NAME,
    MongoConfigError,
    MongoDBService,
    detect_legacy_mongo_env,
)

FULL_URI = 'mongodb://user:pass@host:27017/test_db?authSource=admin'
LOGGER_NAME = 'sync.services.mongodb_service'

# 与本服务配置相关的环境变量：用例执行前先清空，避免开发机/CI 的残留变量造成误判
MONGO_ENV_KEYS = (
    'MONGO_URI',
    'MONGO_DB_NAME',
    'MONGO_DB',
    'MONGO_HOST',
    'MONGO_PORT',
    'MONGO_USER',
    'MONGO_PASSWORD',
    'MONGO_TLS',
    'MONGO_TLS_CA_FILE',
    'MONGO_SERVER_SELECTION_TIMEOUT_MS',
    'MONGO_CONNECT_TIMEOUT_MS',
    'MONGO_SOCKET_TIMEOUT_MS',
    'MONGO_CONFIG_STRICT',
    'DEBUG',
)


@contextmanager
def mongo_env(**values):
    """隔离 Mongo/DEBUG 环境变量（其余环境保持不动），保证用例确定性。"""
    saved = {key: os.environ.pop(key, None) for key in MONGO_ENV_KEYS}
    os.environ.update({key: str(value) for key, value in values.items()})
    try:
        yield
    finally:
        for key in MONGO_ENV_KEYS:
            os.environ.pop(key, None)
        for key, value in saved.items():
            if value is not None:
                os.environ[key] = value


class MongoDBServiceTests(TestCase):

    def setUp(self):
        # 当前契约：MongoDBService 通过 __new__ + 类属性 _instance 实现单例，构造时不自动 initialize()。
        # 重置必须「赋值」而不是「删除」：del 会把类属性删掉，导致 __new__ 里的 cls._instance 抛 AttributeError。
        MongoDBService._instance = None

    # ---------- 基础契约 ----------

    @mock.patch('sync.services.mongodb_service.MongoClient')
    def test_singleton_instance(self, mock_mongo_client):
        """Test that MongoDBService correctly implements the singleton pattern."""
        with mongo_env(MONGO_URI='mongodb://test_host:27017/', MONGO_DB_NAME='test_db'):
            service1 = MongoDBService()
            service1.initialize()

            service2 = MongoDBService()
            service2.initialize()

        self.assertIs(service1, service2, "Service instances should be the same")
        # 单例 + initialize 幂等：MongoClient 只应被创建一次
        mock_mongo_client.assert_called_once()

    @mock.patch('sync.services.mongodb_service.MongoClient')
    def test_initialization_with_full_uri(self, mock_mongo_client):
        """Test initialization with a full MongoDB URI from environment variables."""
        with mongo_env(MONGO_URI=FULL_URI, MONGO_DB_NAME='test_db'):
            service = MongoDBService()
            service.initialize()

        mock_mongo_client.assert_called_once_with(
            FULL_URI,
            serverSelectionTimeoutMS=5000,
            connectTimeoutMS=5000,
            socketTimeoutMS=10000,
        )

        mock_client = mock_mongo_client.return_value
        self.assertIs(service.client, mock_client, "Client should be initialized")
        # 数据库名来自 MONGO_DB_NAME（当前契约；历史用例使用的是 MONGO_DB）
        mock_client.__getitem__.assert_called_once_with('test_db')
        self.assertIs(service.db, mock_client.__getitem__.return_value, "Database object should be initialized")
        self.assertTrue(service.initialized)

    @mock.patch('sync.services.mongodb_service.MongoClient')
    def test_initialization_honours_timeout_and_tls_env(self, mock_mongo_client):
        """初始化应透传超时与 TLS 环境变量。"""
        with mongo_env(
            MONGO_URI=FULL_URI,
            MONGO_DB_NAME='test_db',
            MONGO_SERVER_SELECTION_TIMEOUT_MS=1234,
            MONGO_CONNECT_TIMEOUT_MS=2345,
            MONGO_SOCKET_TIMEOUT_MS=3456,
            MONGO_TLS='true',
        ):
            service = MongoDBService()
            service.initialize()

        mock_mongo_client.assert_called_once_with(
            FULL_URI,
            serverSelectionTimeoutMS=1234,
            connectTimeoutMS=2345,
            socketTimeoutMS=3456,
            tls=True,
        )
        self.assertTrue(service.initialized)

    @mock.patch('sync.services.mongodb_service.MongoClient')
    def test_initialization_with_separate_env_vars(self, mock_mongo_client):
        """缺 MONGO_URI 时仍按既有契约显式失败（不做 MONGO_HOST/PORT 拼接回退）。"""
        with mongo_env(MONGO_URI=''):
            service = MongoDBService()

            with self.assertRaises(ValueError) as caught:
                service.initialize()

        self.assertIn('MONGO_URI', str(caught.exception))
        mock_mongo_client.assert_not_called()
        self.assertFalse(service.initialized)

    @mock.patch('sync.services.mongodb_service.MongoClient')
    def test_connection_failure_handling(self, mock_mongo_client):
        """Test that the service handles connection failures gracefully during initialization."""
        # Configure the mock to raise a ConnectionFailure on the first interaction
        mock_instance = mock_mongo_client.return_value
        mock_instance.admin.command.side_effect = ConnectionFailure("Test connection error")

        with mongo_env(MONGO_URI='mongodb://test_host:27017/', MONGO_DB_NAME='test_db'):
            service = MongoDBService()

            # 初始化失败应向上抛出（不吞错），且不把服务标记为已初始化
            with self.assertRaises(ConnectionFailure):
                service.initialize()

            self.assertFalse(service.initialized)

            # 失败后可重试：恢复连接后再次 initialize 应成功
            mock_instance.admin.command.side_effect = None
            service.initialize()

        self.assertTrue(service.initialized)
        self.assertEqual(mock_mongo_client.call_count, 2)

    @mock.patch('sync.services.mongodb_service.MongoClient')
    def test_close_releases_client(self, mock_mongo_client):
        """close() 应关闭已创建的 MongoClient 连接。"""
        with mongo_env(MONGO_URI='mongodb://test_host:27017/', MONGO_DB_NAME='test_db'):
            service = MongoDBService()
            service.initialize()

            service.close()

        mock_mongo_client.return_value.close.assert_called_once()

    # ---------- RISK-BE-008：旧变量名必须显式暴露 ----------

    def test_detect_legacy_mongo_env_mapping(self):
        """纯函数：只报告「旧名已设置且对应新名未设置」的组合。"""
        self.assertEqual(detect_legacy_mongo_env({}), [])
        # 旧名 + 缺新名 -> 命中
        self.assertEqual(
            detect_legacy_mongo_env({'MONGO_DB': 'LegacyDb', 'MONGO_URI': FULL_URI}),
            [('MONGO_DB', 'MONGO_DB_NAME')],
        )
        self.assertEqual(
            detect_legacy_mongo_env({'MONGO_HOST': 'h', 'MONGO_PORT': '27018'}),
            [('MONGO_HOST', 'MONGO_URI'), ('MONGO_PORT', 'MONGO_URI')],
        )
        # 新名已设置 -> 不报告
        self.assertEqual(
            detect_legacy_mongo_env({'MONGO_DB': 'LegacyDb', 'MONGO_DB_NAME': 'NewDb'}),
            [],
        )
        self.assertEqual(
            detect_legacy_mongo_env({'MONGO_HOST': 'h', 'MONGO_PORT': '1', 'MONGO_URI': FULL_URI}),
            [],
        )
        # 空白值视为未设置
        self.assertEqual(detect_legacy_mongo_env({'MONGO_DB': '   '}), [])

    @mock.patch('sync.services.mongodb_service.MongoClient')
    def test_legacy_db_name_fails_fast_in_strict_mode(self, mock_mongo_client):
        """旧名 MONGO_DB 且缺 MONGO_DB_NAME：生产/严格模式必须直接失败并给出变量对照表。"""
        with mongo_env(MONGO_CONFIG_STRICT='true', MONGO_URI=FULL_URI, MONGO_DB='LegacyDb'):
            service = MongoDBService()

            with self.assertRaises(MongoConfigError) as caught:
                service.initialize()

        message = str(caught.exception)
        self.assertIn('MONGO_DB', message)
        self.assertIn('MONGO_DB_NAME', message)
        self.assertIn('MONGO_URI', message)
        self.assertIn('变量对照表', message)
        # 兼容既有调用方对 ValueError 的处理
        self.assertIsInstance(caught.exception, ValueError)
        # 显式失败，绝不静默连到默认库
        mock_mongo_client.assert_not_called()
        self.assertFalse(service.initialized)

    @mock.patch('sync.services.mongodb_service.MongoClient')
    def test_legacy_host_port_without_uri_fail_fast_in_strict_mode(self, mock_mongo_client):
        """旧名 MONGO_HOST/MONGO_PORT 且缺 MONGO_URI：失败信息应包含可执行的修复对照。"""
        with mongo_env(MONGO_CONFIG_STRICT='true', MONGO_HOST='legacy-host', MONGO_PORT='27018'):
            service = MongoDBService()

            with self.assertRaises(MongoConfigError) as caught:
                service.initialize()

        message = str(caught.exception)
        self.assertIn('MONGO_HOST -> MONGO_URI', message)
        self.assertIn('MONGO_PORT -> MONGO_URI', message)
        mock_mongo_client.assert_not_called()

    @mock.patch('sync.services.mongodb_service.MongoClient')
    def test_legacy_env_warns_loudly_and_continues_in_lenient_mode(self, mock_mongo_client):
        """开发/宽松模式：大声 WARNING（含对照表）后继续，并把默认库名显式打印出来。"""
        with mongo_env(MONGO_CONFIG_STRICT='false', MONGO_URI=FULL_URI, MONGO_DB='LegacyDb'):
            service = MongoDBService()

            with self.assertLogs(LOGGER_NAME, level='INFO') as logs:
                service.initialize()

        output = '\n'.join(logs.output)
        self.assertIn('MONGO_DB -> MONGO_DB_NAME', output)
        self.assertIn('变量对照表', output)
        self.assertIn('正在使用默认库名', output)
        self.assertIn(DEFAULT_DB_NAME, output)
        # 宽松模式下确实继续初始化，但库名用的是默认值（不是静默使用 LegacyDb）
        mock_mongo_client.return_value.__getitem__.assert_called_once_with(DEFAULT_DB_NAME)
        self.assertTrue(service.initialized)

    @mock.patch('sync.services.mongodb_service.MongoClient')
    def test_strict_mode_default_follows_debug_flag(self, mock_mongo_client):
        """未显式设置 MONGO_CONFIG_STRICT 时：DEBUG=False 直接失败，DEBUG=True 仅告警。"""
        with mongo_env(MONGO_URI=FULL_URI, MONGO_DB='LegacyDb'):
            with override_settings(DEBUG=False):
                with self.assertRaises(MongoConfigError):
                    MongoDBService().initialize()

            with override_settings(DEBUG=True):
                service = MongoDBService()
                with self.assertLogs(LOGGER_NAME, level='WARNING') as logs:
                    service.initialize()

        self.assertIn('MONGO_DB -> MONGO_DB_NAME', '\n'.join(logs.output))
        self.assertTrue(service.initialized)

    @mock.patch('sync.services.mongodb_service.MongoClient')
    def test_new_env_names_do_not_report_legacy(self, mock_mongo_client):
        """新名已设置时不误报：即使旧名仍在环境里，也不应有 WARNING/异常，库名取新名。"""
        with mongo_env(
            MONGO_URI=FULL_URI,
            MONGO_DB_NAME='new_db',
            MONGO_DB='old_db',
            MONGO_HOST='old-host',
            MONGO_PORT='27018',
            MONGO_USER='old-user',
            MONGO_PASSWORD='old-pass',
        ):
            service = MongoDBService()

            with self.assertNoLogs(LOGGER_NAME, level='WARNING'):
                service.initialize()

        mock_mongo_client.return_value.__getitem__.assert_called_once_with('new_db')
        self.assertTrue(service.initialized)

    @mock.patch('sync.services.mongodb_service.MongoClient')
    def test_only_uri_logs_default_db_name_explicitly(self, mock_mongo_client):
        """只设 MONGO_URI：不触发旧名告警，但必须显式打印正在使用默认库名。"""
        with mongo_env(MONGO_URI=FULL_URI):
            service = MongoDBService()

            with self.assertLogs(LOGGER_NAME, level='INFO') as logs:
                service.initialize()

        output = '\n'.join(logs.output)
        self.assertIn('正在使用默认库名', output)
        self.assertIn(DEFAULT_DB_NAME, output)
        mock_mongo_client.return_value.__getitem__.assert_called_once_with(DEFAULT_DB_NAME)
        self.assertTrue(service.initialized)
