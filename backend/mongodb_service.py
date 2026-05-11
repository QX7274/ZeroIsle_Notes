import asyncio
import json
import logging
import os
import time
from datetime import datetime

from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure

logger = logging.getLogger(__name__)


class MongoDBService:
    def __init__(self):
        self.client = None
        self.db = None
        self.async_client = None
        self.is_atlas = False
        self._initialized = False
        self._load_config()

    def _load_config(self):
        mongo_uri = os.environ.get('MONGO_URI')
        mongo_db = os.environ.get('MONGO_DB', 'ZeroIsle_Notes')

        if not mongo_uri:
            mongo_host = os.environ.get('MONGO_HOST', 'localhost')
            mongo_port = int(os.environ.get('MONGO_PORT', 27017))
            mongo_user = os.environ.get('MONGO_USER', '')
            mongo_password = os.environ.get('MONGO_PASSWORD', '')

            if mongo_user and mongo_password:
                mongo_uri = (
                    f"mongodb://{mongo_user}:{mongo_password}"
                    f"@{mongo_host}:{mongo_port}/{mongo_db}?authSource=admin"
                )
            else:
                mongo_uri = f"mongodb://{mongo_host}:{mongo_port}/{mongo_db}"
        self.mongo_uri = mongo_uri
        self.mongo_db = mongo_db
        self.allow_insecure = os.environ.get('ALLOW_INSECURE_TLS', '0') in ('1', 'true', 'True')
        self.max_retries = 3
        self.retry_delay = 1

    def _build_client(self):
        if 'mongodb+srv' in self.mongo_uri:
            return MongoClient(
                self.mongo_uri,
                ssl=True,
                tlsAllowInvalidCertificates=self.allow_insecure,
                connectTimeoutMS=30000,
                socketTimeoutMS=30000,
                serverSelectionTimeoutMS=30000,
                retryWrites=True,
                w='majority',
            )
        return MongoClient(
            self.mongo_uri,
            connectTimeoutMS=30000,
            socketTimeoutMS=30000,
            serverSelectionTimeoutMS=30000,
        )

    def _ensure_initialized(self):
        if self._initialized:
            return

        self.client = self._build_client()
        self.db = self.client[self.mongo_db]

        self.client.admin.command('ping')
        server_info = self.client.server_info()
        self.is_atlas = bool('version' in server_info and 'atlas' in self.mongo_uri.lower())
        self._initialized = True
        logger.info("MongoDB 连接初始化完成: %s", self.mongo_db)

    @property
    def initialized(self):
        return self._initialized

    def initialize(self):
        self._ensure_initialized()
        return self.db

    async def init_async_client(self):
        self._ensure_initialized()
        if self.async_client:
            return

        if 'mongodb+srv' in self.mongo_uri:
            self.async_client = AsyncIOMotorClient(
                self.mongo_uri,
                ssl=True,
                tlsAllowInvalidCertificates=self.allow_insecure,
                connectTimeoutMS=30000,
                socketTimeoutMS=30000,
                serverSelectionTimeoutMS=30000,
                retryWrites=True,
                w='majority',
            )
        else:
            self.async_client = AsyncIOMotorClient(
                self.mongo_uri,
                connectTimeoutMS=30000,
                socketTimeoutMS=30000,
                serverSelectionTimeoutMS=30000,
            )

        try:
            await self.async_client.admin.command('ping')
            logger.info("MongoDB 异步连接初始化完成")
        except ConnectionFailure as exc:
            logger.error("MongoDB 异步连接失败: %s", exc)
            raise

    def get_connection_status(self):
        try:
            self._ensure_initialized()
            return self.client.server_info()
        except Exception as exc:
            logger.error("MongoDB 连接状态检查失败: %s", exc)
            return {"status": "error", "message": str(exc)}

    async def insert_user(self, user_data):
        if not self.async_client:
            await self.init_async_client()

        for attempt in range(self.max_retries):
            try:
                result = await self.async_client[self.mongo_db].users.insert_one(user_data)
                return str(result.inserted_id)
            except Exception as exc:
                if attempt == self.max_retries - 1:
                    logger.error("插入用户失败: %s", exc)
                    raise
                await asyncio.sleep(self.retry_delay)

    def insert_user_sync(self, user_data):
        self._ensure_initialized()
        for attempt in range(self.max_retries):
            try:
                result = self.db.users.insert_one(user_data)
                return str(result.inserted_id)
            except Exception as exc:
                if attempt == self.max_retries - 1:
                    logger.error("同步插入用户失败: %s", exc)
                    raise
                time.sleep(self.retry_delay)

    async def get_user(self, username):
        if not self.async_client:
            await self.init_async_client()

        try:
            return await self.async_client[self.mongo_db].users.find_one({'username': username})
        except Exception as exc:
            logger.error("异步查询用户失败: %s", exc)
            return None

    def get_user_sync(self, username):
        try:
            self._ensure_initialized()
            return self.db.users.find_one({'username': username})
        except Exception as exc:
            logger.error("同步查询用户失败: %s", exc)
            return None

    async def backup_database(self):
        self._ensure_initialized()
        try:
            from bson import json_util

            backup_dir = f"backups/mongodb/{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            os.makedirs(backup_dir, exist_ok=True)

            for collection in self.db.list_collection_names():
                file_path = os.path.join(backup_dir, f"{collection}.jsonl")
                with open(file_path, 'w', encoding='utf-8') as file_obj:
                    cursor = self.db[collection].find()
                    for document in cursor:
                        file_obj.write(json_util.dumps(document, ensure_ascii=False) + '\n')

            logger.info("MongoDB 备份完成: %s", backup_dir)
            return backup_dir
        except Exception as exc:
            logger.error("MongoDB 备份失败: %s", exc)
            return None

    async def restore_database(self, backup_dir):
        self._ensure_initialized()
        try:
            from bson import json_util

            if not os.path.exists(backup_dir):
                raise FileNotFoundError(f"备份目录不存在: {backup_dir}")

            for collection in self.db.list_collection_names():
                self.db[collection].delete_many({})

            for collection_file in os.listdir(backup_dir):
                if not collection_file.endswith('.jsonl'):
                    continue
                collection_name = collection_file[:-6]
                file_path = os.path.join(backup_dir, collection_file)
                with open(file_path, 'r', encoding='utf-8') as file_obj:
                    for line in file_obj:
                        document = json_util.loads(line.strip())
                        self.db[collection_name].insert_one(document)

            logger.info("MongoDB 恢复完成: %s", backup_dir)
            return True
        except Exception as exc:
            logger.error("MongoDB 恢复失败: %s", exc)
            return False


mongodb_service = MongoDBService()


def get_mongodb_connection():
    mongodb_service.initialize()
    return mongodb_service.db


async def test_connection():
    print("测试 MongoDB 连接...")
    status = mongodb_service.get_connection_status()
    print(f"连接状态: {status}")

    print("\n测试异步连接...")
    try:
        await mongodb_service.init_async_client()
        print("异步连接成功")

        test_user = {
            'username': 'test_user',
            'email': 'test@example.com',
            'created_at': datetime.now(),
        }

        user_id = await mongodb_service.insert_user(test_user)
        print(f"插入用户 ID: {user_id}")
        user = await mongodb_service.get_user('test_user')
        print(f"查询结果: {user}")
    except Exception as exc:
        print(f"测试失败: {exc}")


if __name__ == "__main__":
    asyncio.run(test_connection())
