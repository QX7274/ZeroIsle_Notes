from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, OperationFailure
from motor.motor_asyncio import AsyncIOMotorClient
import asyncio
import logging
import time
from datetime import datetime
import os
import shutil
import json

logger = logging.getLogger(__name__)

class MongoDBService:
    def __init__(self):
        # 从环境变量获取MongoDB连接信息
        mongo_uri = os.environ.get('MONGO_URI', '')
        mongo_db = os.environ.get('MONGO_DB', 'zeroislenotes')

        # 如果没有提供MONGO_URI，则尝试使用传统的连接参数
        if not mongo_uri:
            mongo_host = os.environ.get('MONGO_HOST', 'localhost')
            mongo_port = int(os.environ.get('MONGO_PORT', 27017))
            mongo_user = os.environ.get('MONGO_USER', '')
            mongo_password = os.environ.get('MONGO_PASSWORD', '')

            # 构建连接URI
            if mongo_user and mongo_password:
                mongo_uri = f"mongodb://{mongo_user}:{mongo_password}@{mongo_host}:{mongo_port}/{mongo_db}?authSource=admin"
            else:
                mongo_uri = f"mongodb://{mongo_host}:{mongo_port}/{mongo_db}"

            logger.info(f"使用传统连接参数初始化MongoDB: {mongo_host}:{mongo_port}/{mongo_db}")
        else:
            logger.info(f"使用MongoDB Atlas连接字符串初始化MongoDB")

        # 创建MongoDB连接
        # 添加SSL参数
        if 'mongodb+srv' in mongo_uri:
            # MongoDB Atlas连接需要SSL参数
            self.client = MongoClient(
                mongo_uri,
                ssl=True,
                tlsAllowInvalidCertificates=True,  # 允许无效证书
                connectTimeoutMS=30000,  # 连接超时时间
                socketTimeoutMS=30000,   # 套接字超时时间
                serverSelectionTimeoutMS=30000,  # 服务器选择超时时间
                retryWrites=True,        # 重试写入
                w='majority'             # 写入确认
            )
        else:
            self.client = MongoClient(mongo_uri)

        self.db = self.client[mongo_db]
        self.max_retries = 3
        self.retry_delay = 1
        self.async_client = None
        self.mongo_uri = mongo_uri
        self.mongo_db = mongo_db

        # 检查连接
        try:
            self.client.admin.command('ping')
            logger.info(f"MongoDB连接成功: {mongo_db}")
        except Exception as e:
            logger.error(f"MongoDB连接失败: {str(e)}")

        # 检查是否为MongoDB Atlas
        try:
            server_info = self.client.server_info()
            if 'version' in server_info and 'atlas' in self.mongo_uri.lower():
                logger.info(f"已连接到MongoDB Atlas: 版本 {server_info['version']}")
                self.is_atlas = True
            else:
                self.is_atlas = False
                logger.info(f"已连接到MongoDB: 版本 {server_info.get('version', '未知')}")
        except Exception as e:
            self.is_atlas = False
            logger.error(f"获取MongoDB服务器信息失败: {str(e)}")

    async def init_async_client(self):
        """初始化异步客户端"""
        if not self.async_client:
            # 添加SSL参数
            if 'mongodb+srv' in self.mongo_uri:
                # MongoDB Atlas连接需要SSL参数
                self.async_client = AsyncIOMotorClient(
                    self.mongo_uri,
                    ssl=True,
                    tlsAllowInvalidCertificates=True,  # 允许无效证书
                    connectTimeoutMS=30000,  # 连接超时时间
                    socketTimeoutMS=30000,   # 套接字超时时间
                    serverSelectionTimeoutMS=30000,  # 服务器选择超时时间
                    retryWrites=True,        # 重试写入
                    w='majority'             # 写入确认
                )
            else:
                self.async_client = AsyncIOMotorClient(self.mongo_uri)

            try:
                await self.async_client.admin.command('ping')
                logger.info("MongoDB异步连接成功")

                # 检查是否为MongoDB Atlas
                if self.is_atlas:
                    logger.info("已连接到MongoDB Atlas异步客户端")
            except ConnectionFailure as e:
                logger.error(f"MongoDB异步连接失败: {str(e)}")
                raise

    def get_connection_status(self):
        """检查数据库连接状态"""
        try:
            return self.client.server_info()
        except Exception as e:
            logger.error(f"数据库连接错误: {str(e)}")
            return {"status": "error", "message": str(e)}

    async def insert_user(self, user_data):
        """异步插入用户数据"""
        if not self.async_client:
            await self.init_async_client()

        for attempt in range(self.max_retries):
            try:
                result = await self.async_client[self.mongo_db].users.insert_one(user_data)
                return str(result.inserted_id)
            except Exception as e:
                if attempt == self.max_retries - 1:
                    logger.error(f"插入用户数据失败: {str(e)}")
                    raise
                await asyncio.sleep(self.retry_delay)
                logger.warning(f"重试插入用户数据 (尝试 {attempt + 1}/{self.max_retries})")

    def insert_user_sync(self, user_data):
        """同步插入用户数据"""
        for attempt in range(self.max_retries):
            try:
                result = self.db.users.insert_one(user_data)
                return str(result.inserted_id)
            except Exception as e:
                if attempt == self.max_retries - 1:
                    logger.error(f"插入用户数据失败: {str(e)}")
                    raise
                time.sleep(self.retry_delay)
                logger.warning(f"重试插入用户数据 (尝试 {attempt + 1}/{self.max_retries})")

    async def get_user(self, username):
        """异步查询用户信息"""
        if not self.async_client:
            await self.init_async_client()

        try:
            return await self.async_client[self.mongo_db].users.find_one({'username': username})
        except Exception as e:
            logger.error(f"查询用户数据失败: {str(e)}")
            return None

    def get_user_sync(self, username):
        """同步查询用户信息"""
        try:
            return self.db.users.find_one({'username': username})
        except Exception as e:
            logger.error(f"查询用户数据失败: {str(e)}")
            return None

    async def backup_database(self):
        """备份数据库"""
        try:
            backup_dir = f"backups/mongodb/{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            os.makedirs(backup_dir, exist_ok=True)

            # 导出数据
            for collection in self.db.list_collection_names():
                with open(f"{backup_dir}/{collection}.json", 'w') as f:
                    cursor = self.db[collection].find()
                    for document in cursor:
                        f.write(str(document) + '\n')

            logger.info(f"数据库备份成功: {backup_dir}")
            return backup_dir
        except Exception as e:
            logger.error(f"数据库备份失败: {str(e)}")
            return None

    async def restore_database(self, backup_dir):
        """恢复数据库"""
        try:
            if not os.path.exists(backup_dir):
                raise FileNotFoundError(f"备份目录不存在: {backup_dir}")

            # 清空现有数据
            for collection in self.db.list_collection_names():
                self.db[collection].delete_many({})

            # 恢复数据
            for collection_file in os.listdir(backup_dir):
                if collection_file.endswith('.json'):
                    collection_name = collection_file[:-5]
                    with open(f"{backup_dir}/{collection_file}", 'r') as f:
                        for line in f:
                            document = eval(line.strip())
                            self.db[collection_name].insert_one(document)

            logger.info(f"数据库恢复成功: {backup_dir}")
            return True
        except Exception as e:
            logger.error(f"数据库恢复失败: {str(e)}")
            return False

# 单例模式实例化
mongodb_service = MongoDBService()

# 测试函数
async def test_connection():
    """测试MongoDB连接"""
    print("测试MongoDB连接...")
    status = mongodb_service.get_connection_status()
    print(f"连接状态: {status}")

    print("\n测试异步连接...")
    try:
        await mongodb_service.init_async_client()
        print("异步连接成功!")

        # 测试插入数据
        test_user = {
            'username': 'test_user',
            'email': 'test@example.com',
            'created_at': datetime.now()
        }

        print("\n测试插入用户数据...")
        user_id = await mongodb_service.insert_user(test_user)
        print(f"插入用户ID: {user_id}")

        print("\n测试查询用户数据...")
        user = await mongodb_service.get_user('test_user')
        print(f"查询结果: {user}")

    except Exception as e:
        print(f"测试失败: {str(e)}")

# 如果直接运行此文件，则执行测试
if __name__ == "__main__":
    asyncio.run(test_connection())