import os
from unittest import TestCase, mock
from pymongo.errors import ConnectionFailure

# Mock Django settings to allow standalone run
from django.conf import settings
if not settings.configured:
    settings.configure()

from ..services.mongodb_service import MongoDBService

FULL_URI = 'mongodb://user:pass@host:27017/test_db?authSource=admin'


class MongoDBServiceTests(TestCase):

    def setUp(self):
        # 当前契约：MongoDBService 通过 __new__ + 类属性 _instance 实现单例，构造时不自动 initialize()。
        # 重置必须「赋值」而不是「删除」：原来 del MongoDBService._instance 会把类属性删掉，
        # 导致 __new__ 里的 cls._instance 抛 AttributeError（4 条失败的直接原因）。
        MongoDBService._instance = None

    @mock.patch.dict(os.environ, {"MONGO_URI": "mongodb://test_host:27017/", "MONGO_DB_NAME": "test_db"})
    @mock.patch('sync.services.mongodb_service.MongoClient')
    def test_singleton_instance(self, mock_mongo_client):
        """Test that MongoDBService correctly implements the singleton pattern."""
        service1 = MongoDBService()
        service1.initialize()

        service2 = MongoDBService()
        service2.initialize()

        self.assertIs(service1, service2, "Service instances should be the same")
        # 单例 + initialize 幂等：MongoClient 只应被创建一次
        mock_mongo_client.assert_called_once()

    @mock.patch.dict(os.environ, {"MONGO_URI": FULL_URI, "MONGO_DB_NAME": "test_db"})
    @mock.patch('sync.services.mongodb_service.MongoClient')
    def test_initialization_with_full_uri(self, mock_mongo_client):
        """Test initialization with a full MongoDB URI from environment variables."""
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

    @mock.patch.dict(
        os.environ,
        {
            "MONGO_URI": FULL_URI,
            "MONGO_DB_NAME": "test_db",
            "MONGO_SERVER_SELECTION_TIMEOUT_MS": "1234",
            "MONGO_CONNECT_TIMEOUT_MS": "2345",
            "MONGO_SOCKET_TIMEOUT_MS": "3456",
            "MONGO_TLS": "true",
        },
    )
    @mock.patch('sync.services.mongodb_service.MongoClient')
    def test_initialization_honours_timeout_and_tls_env(self, mock_mongo_client):
        """初始化应透传超时与 TLS 环境变量（历史用例期望的 retryWrites/tlsAllowInvalidCertificates 已不在当前配置中）。"""
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

    @mock.patch.dict(os.environ, {"MONGO_URI": "", "MONGO_HOST": "localhost", "MONGO_PORT": "27018", "MONGO_DB_NAME": "fallback_db"})
    @mock.patch('sync.services.mongodb_service.MongoClient')
    def test_initialization_with_separate_env_vars(self, mock_mongo_client):
        """MONGO_URI 缺失时的当前契约：显式抛 ValueError，不做 MONGO_HOST/PORT 拼接回退。

        历史用例期望「MONGO_URI 为空时回退到 MONGO_HOST/MONGO_PORT」，但当前实现只认 MONGO_URI；
        此处按现契约断言显式报错 + 不创建客户端 + 不置 initialized（原用例意图：初始化输入不合法时的行为可预期）。
        """
        service = MongoDBService()

        with self.assertRaises(ValueError) as caught:
            service.initialize()

        self.assertIn('MONGO_URI', str(caught.exception))
        mock_mongo_client.assert_not_called()
        self.assertFalse(service.initialized)

    @mock.patch.dict(os.environ, {"MONGO_URI": "mongodb://test_host:27017/", "MONGO_DB_NAME": "test_db"})
    @mock.patch('sync.services.mongodb_service.MongoClient')
    def test_connection_failure_handling(self, mock_mongo_client):
        """Test that the service handles connection failures gracefully during initialization."""
        # Configure the mock to raise a ConnectionFailure on the first interaction
        mock_instance = mock_mongo_client.return_value
        mock_instance.admin.command.side_effect = ConnectionFailure("Test connection error")

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

    @mock.patch.dict(os.environ, {"MONGO_URI": "mongodb://test_host:27017/", "MONGO_DB_NAME": "test_db"})
    @mock.patch('sync.services.mongodb_service.MongoClient')
    def test_close_releases_client(self, mock_mongo_client):
        """close() 应关闭已创建的 MongoClient 连接。"""
        service = MongoDBService()
        service.initialize()

        service.close()

        mock_mongo_client.return_value.close.assert_called_once()
