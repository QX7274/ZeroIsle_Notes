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
    MongoDB服务类
    提供与MongoDB Atlas的连接和操作
    """

    def __init__(self):
        """
        初始化MongoDB服务
        """
        self.client = None
        self.db = None
        self.initialized = False
        self.initialize()

    def initialize(self):
        """
        初始化MongoDB连接
        """
        try:
            # 获取MongoDB连接URI
            mongo_uri = os.environ.get('MONGO_URI', 'mongodb+srv://qianxin7274:zxcvbnm%40%40081325@cluster0.lo5ybvq.mongodb.net/')
            db_name = os.environ.get('MONGO_DB_NAME', 'ZeroIsle_Notes')

            # 创建MongoDB客户端
            self.client = MongoClient(mongo_uri, serverSelectionTimeoutMS=5000)

            # 测试连接
            self.client.admin.command('ping')

            # 获取数据库
            self.db = self.client[db_name]

            # 创建索引
            self._create_indexes()

            self.initialized = True
            logger.info(f"MongoDB连接成功: {db_name}")
        except (ConnectionFailure, ServerSelectionTimeoutError) as e:
            logger.error(f"MongoDB连接失败: {str(e)}")
            self.initialized = False
        except Exception as e:
            logger.error(f"MongoDB初始化失败: {str(e)}")
            self.initialized = False

    def _create_indexes(self):
        """
        创建索引
        """
        try:
            # 笔记集合索引
            self.db.notes.create_index([('user_id', 1)])
            self.db.notes.create_index([('user_id', 1), ('updated_at', -1)])

            # 提醒集合索引
            self.db.reminders.create_index([('user_id', 1)])
            self.db.reminders.create_index([('user_id', 1), ('updated_at', -1)])

            # 用户设置集合索引
            self.db.user_settings.create_index([('user_id', 1)], unique=True)

            logger.info("MongoDB索引创建成功")
        except Exception as e:
            logger.error(f"MongoDB索引创建失败: {str(e)}")

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
