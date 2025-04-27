from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, OperationFailure
from motor.motor_asyncio import AsyncIOMotorClient
from .backend.settings.development import MONGO_CLIENT, MONGO_DB
import asyncio
import logging
from datetime import datetime
import os
import shutil

logger = logging.getLogger(__name__)

class MongoDBService:
    def __init__(self):
        self.client = MONGO_CLIENT
        self.db = MONGO_DB
        self.max_retries = 3
        self.retry_delay = 1
        self.async_client = None

    async def init_async_client(self):
        """初始化异步客户端"""
        if not self.async_client:
            self.async_client = AsyncIOMotorClient(MONGO_CLIENT)
            try:
                await self.async_client.admin.command('ping')
                logger.info("MongoDB异步连接成功")
            except ConnectionFailure:
                logger.error("MongoDB异步连接失败")
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
                result = await self.async_client[MONGO_DB].users.insert_one(user_data)
                return str(result.inserted_id)
            except Exception as e:
                if attempt == self.max_retries - 1:
                    logger.error(f"插入用户数据失败: {str(e)}")
                    raise
                await asyncio.sleep(self.retry_delay)
                logger.warning(f"重试插入用户数据 (尝试 {attempt + 1}/{self.max_retries})")

    async def get_user(self, username):
        """异步查询用户信息"""
        if not self.async_client:
            await self.init_async_client()
        
        try:
            return await self.async_client[MONGO_DB].users.find_one({'username': username})
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