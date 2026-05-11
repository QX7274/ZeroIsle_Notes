"""
MongoDB Realm服务
提供MongoDB Realm/Atlas数据库操作功能
"""

import os
import sys
import logging
import asyncio
from datetime import datetime
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError
from motor.motor_asyncio import AsyncIOMotorClient
import uuid

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class MongoDBRealmService:
    """MongoDB Realm服务类"""

    def __init__(self):
        """初始化MongoDB Realm服务"""
        # 从环境变量获取MongoDB连接信息
        self.mongo_uri = os.environ.get('MONGO_URI')
        self.db_name = os.environ.get('MONGO_DB', 'ZeroIsle_Notes')
        self.realm_app_id = os.environ.get('REALM_APP_ID', '')
        self.allow_insecure_tls = os.environ.get('ALLOW_INSECURE_TLS', '0').lower() in ('1', 'true', 'yes')

        # 初始化连接状态
        self.initialized = False
        self.sync_client = None
        self.async_client = None
        self.db = None
        self.async_db = None

        # 重试配置
        self.max_retries = 3
        self.retry_delay = 1

        # 延迟初始化，同步客户端仅在首次真正使用时建立

    def _init_sync_client(self):
        """初始化同步MongoDB客户端"""
        if not self.mongo_uri:
            logger.warning("MONGO_URI 未配置，MongoDB Realm 同步客户端未启动")
            self.initialized = False
            self.sync_client = None
            self.db = None
            return
        try:
            # 创建MongoDB客户端
            self.sync_client = MongoClient(
                self.mongo_uri,
                serverSelectionTimeoutMS=30000,
                connectTimeoutMS=30000,
                socketTimeoutMS=30000,
                ssl=True,
                tlsAllowInvalidCertificates=self.allow_insecure_tls,
                retryWrites=True,
                w='majority'
            )

            # 测试连接
            self.sync_client.admin.command('ping')

            # 获取数据库
            self.db = self.sync_client[self.db_name]

            self.initialized = True
            logger.info(f"MongoDB Realm同步客户端连接成功: {self.db_name}")
        except (ConnectionFailure, ServerSelectionTimeoutError) as e:
            logger.error(f"MongoDB Realm同步客户端连接失败: {str(e)}")
            self.initialized = False
            self.sync_client = None
            self.db = None
        except Exception as e:
            logger.error(f"MongoDB Realm同步客户端初始化失败: {str(e)}")
            self.initialized = False
            self.sync_client = None
            self.db = None

    def _ensure_sync_client(self):
        if self.initialized and self.sync_client is not None and self.db is not None:
            return
        self._init_sync_client()

    async def init_async_client(self):
        """初始化异步MongoDB客户端"""
        if not self.mongo_uri:
            logger.warning("MONGO_URI 未配置，MongoDB Realm 异步客户端未启动")
            self.async_client = None
            self.async_db = None
            return False
        try:
            # 创建异步MongoDB客户端
            self.async_client = AsyncIOMotorClient(
                self.mongo_uri,
                serverSelectionTimeoutMS=30000,
                connectTimeoutMS=30000,
                socketTimeoutMS=30000,
                ssl=True,
                tlsAllowInvalidCertificates=self.allow_insecure_tls,
                retryWrites=True,
                w='majority'
            )

            # 获取数据库
            self.async_db = self.async_client[self.db_name]

            # 测试连接
            await self.async_client.admin.command('ping')

            logger.info(f"MongoDB Realm异步客户端连接成功: {self.db_name}")
            return True
        except Exception as e:
            logger.error(f"MongoDB Realm异步客户端初始化失败: {str(e)}")
            self.async_client = None
            self.async_db = None
            return False

    def get_connection_status(self):
        """获取连接状态"""
        if not self.initialized:
            self._ensure_sync_client()
        if not self.initialized:
            return "未初始化"

        try:
            # 测试连接
            self.sync_client.admin.command('ping')
            return "已连接"
        except Exception:
            return "连接失败"

    # 同步操作方法
    def insert_document_sync(self, collection_name, document):
        """同步插入文档"""
        self._ensure_sync_client()
        if not self.initialized or self.db is None:
            logger.error("MongoDB Realm服务未初始化")
            return None

        try:
            # 确保文档有ID
            if 'id' not in document:
                document['id'] = str(uuid.uuid4())

            # 插入文档
            result = self.db[collection_name].insert_one(document)
            return str(result.inserted_id)
        except Exception as e:
            logger.error(f"同步插入文档失败: {str(e)}")
            return None

    def find_document_sync(self, collection_name, query):
        """同步查询文档"""
        self._ensure_sync_client()
        if not self.initialized or self.db is None:
            logger.error("MongoDB Realm服务未初始化")
            return None

        try:
            # 查询文档
            document = self.db[collection_name].find_one(query)
            return document
        except Exception as e:
            logger.error(f"同步查询文档失败: {str(e)}")
            return None

    def update_document_sync(self, collection_name, query, update):
        """同步更新文档"""
        self._ensure_sync_client()
        if not self.initialized or self.db is None:
            logger.error("MongoDB Realm服务未初始化")
            return 0

        try:
            # 更新文档
            result = self.db[collection_name].update_one(query, {'$set': update})
            return result.modified_count
        except Exception as e:
            logger.error(f"同步更新文档失败: {str(e)}")
            return 0

    def delete_document_sync(self, collection_name, query):
        """同步删除文档"""
        self._ensure_sync_client()
        if not self.initialized or self.db is None:
            logger.error("MongoDB Realm服务未初始化")
            return 0

        try:
            # 删除文档
            result = self.db[collection_name].delete_one(query)
            return result.deleted_count
        except Exception as e:
            logger.error(f"同步删除文档失败: {str(e)}")
            return 0

    # 异步操作方法
    async def insert_document(self, collection_name, document):
        """异步插入文档"""
        if self.async_db is None:
            logger.error("MongoDB Realm异步客户端未初始化")
            return None

        try:
            # 确保文档有ID
            if 'id' not in document:
                document['id'] = str(uuid.uuid4())

            # 插入文档
            result = await self.async_db[collection_name].insert_one(document)
            return str(result.inserted_id)
        except Exception as e:
            logger.error(f"异步插入文档失败: {str(e)}")
            return None

    async def find_document(self, collection_name, query):
        """异步查询文档"""
        if self.async_db is None:
            logger.error("MongoDB Realm异步客户端未初始化")
            return None

        try:
            # 查询文档
            document = await self.async_db[collection_name].find_one(query)
            return document
        except Exception as e:
            logger.error(f"异步查询文档失败: {str(e)}")
            return None

    async def update_document(self, collection_name, query, update):
        """异步更新文档"""
        if self.async_db is None:
            logger.error("MongoDB Realm异步客户端未初始化")
            return 0

        try:
            # 更新文档
            result = await self.async_db[collection_name].update_one(query, {'$set': update})
            return result.modified_count
        except Exception as e:
            logger.error(f"异步更新文档失败: {str(e)}")
            return 0

    async def delete_document(self, collection_name, query):
        """异步删除文档"""
        if self.async_db is None:
            logger.error("MongoDB Realm异步客户端未初始化")
            return 0

        try:
            # 删除文档
            result = await self.async_db[collection_name].delete_one(query)
            return result.deleted_count
        except Exception as e:
            logger.error(f"异步删除文档失败: {str(e)}")
            return 0

# 创建单例实例
mongodb_realm_service = MongoDBRealmService()
