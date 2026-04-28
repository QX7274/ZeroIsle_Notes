"""
MongoDB服务
提供与MongoDB Atlas的连接和操作
"""

import os
import logging
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError

# 设置日志
logger = logging.getLogger(__name__)

class MongoDBService:
    """
    MongoDB服务类（单例模式）
    提供与MongoDB Atlas的连接和操作
    """

    _instance = None
    client = None
    db = None
    initialized = False

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(MongoDBService, cls).__new__(cls)
            # 防止在模块导入时立即初始化，改为首次调用时初始化
        return cls._instance

    def initialize(self):
        """
        初始化MongoDB连接
        """
        if self.initialized:
            return

        try:
            # 获取MongoDB连接URI
            mongo_uri = os.environ.get('MONGO_URI')
            if not mongo_uri:
                raise ValueError("MONGO_URI environment variable not set.")
            db_name = os.environ.get('MONGO_DB_NAME', 'ZeroIsle_Notes')

            # 获取连接参数
            server_selection_timeout_ms = int(os.environ.get('MONGO_SERVER_SELECTION_TIMEOUT_MS', 5000))
            connect_timeout_ms = int(os.environ.get('MONGO_CONNECT_TIMEOUT_MS', 5000))
            socket_timeout_ms = int(os.environ.get('MONGO_SOCKET_TIMEOUT_MS', 10000))

            # TLS/SSL 配置
            tls_enabled = os.environ.get('MONGO_TLS', 'False').lower() in ('true', '1', 't')
            tls_ca_file = os.environ.get('MONGO_TLS_CA_FILE')

            kwargs = {
                'serverSelectionTimeoutMS': server_selection_timeout_ms,
                'connectTimeoutMS': connect_timeout_ms,
                'socketTimeoutMS': socket_timeout_ms,
            }

            if tls_enabled:
                kwargs['tls'] = True
                if tls_ca_file and os.path.exists(tls_ca_file):
                    kwargs['tlsCAFile'] = tls_ca_file
                else:
                    logger.warning("MONGO_TLS is enabled but MONGO_TLS_CA_FILE is not set or does not exist.")

            # 创建MongoDB客户端
            self.client = MongoClient(mongo_uri, **kwargs)

            # 测试连接
            self.client.admin.command('ping')

            # 获取数据库
            self.db = self.client[db_name]

            self.initialized = True
            logger.info(f"MongoDB连接成功: {db_name}")
        except (ConnectionFailure, ServerSelectionTimeoutError) as e:
            logger.error(f"MongoDB连接失败: {str(e)}")
            self.initialized = False
            raise  # 抛出异常，让调用方处理
        except Exception as e:
            logger.error(f"MongoDB初始化失败: {str(e)}")
            self.initialized = False
            raise  # 抛出异常，让调用方处理



    def close(self):
        """
        关闭MongoDB连接
        """
        if self.client:
            self.client.close()
            logger.info("MongoDB连接已关闭")

# 创建单例实例
mongodb_service = MongoDBService()

# 导出单例实例
__all__ = ['mongodb_service']
