"""
测试环境特定设置
"""

from .base import *

# 调试模式
DEBUG = True

# 允许的主机
ALLOWED_HOSTS = ['localhost', '127.0.0.1', 'testserver']

# 使用SQLite作为Django测试数据库，但主要数据存储在MongoDB
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': os.path.join(BASE_DIR, 'db_test.sqlite3'),
    }
}

# 连接到测试MongoDB数据库
import mongoengine
from pymongo import MongoClient
import logging

logger = logging.getLogger(__name__)

# 断开所有现有连接
mongoengine.disconnect_all()

# 测试数据库名称
test_db_name = 'ZeroIsle_Notes_Test'

# 设置MongoDB连接标志
MONGODB_AVAILABLE = False

try:
    mongo_uri = os.environ.get('MONGO_URI', 'mongodb+srv://qianxin7274:zxcvbnm%40%40081325@cluster0.lo5ybvq.mongodb.net/')

    if mongo_uri:
        # 使用MongoDB Atlas连接字符串
        mongoengine.connect(
            db=test_db_name,
            host=mongo_uri,
            alias='default',
            serverSelectionTimeoutMS=30000,
            connectTimeoutMS=30000,
            socketTimeoutMS=30000,
            connect=False  # 延迟连接，直到第一次使用
        )

        # 创建PyMongo客户端用于原生操作
        MONGO_CLIENT = MongoClient(
            mongo_uri,
            serverSelectionTimeoutMS=30000,
            connectTimeoutMS=30000,
            socketTimeoutMS=30000,
            connect=False  # 延迟连接，直到第一次使用
        )
    else:
        # 使用传统连接参数
        mongo_host = os.environ.get('MONGO_HOST', 'localhost')
        mongo_port = int(os.environ.get('MONGO_PORT', 27017))
        mongo_user = os.environ.get('MONGO_USER', '')
        mongo_password = os.environ.get('MONGO_PASSWORD', '')

        mongoengine.connect(
            db=test_db_name,
            host=mongo_host,
            port=mongo_port,
            username=mongo_user,
            password=mongo_password,
            authentication_source='admin',
            alias='default',
            serverSelectionTimeoutMS=30000,
            connectTimeoutMS=30000,
            socketTimeoutMS=30000,
            connect=False  # 延迟连接，直到第一次使用
        )

        # 创建PyMongo客户端用于原生操作
        if mongo_user and mongo_password:
            MONGO_CLIENT = MongoClient(
                host=mongo_host,
                port=mongo_port,
                username=mongo_user,
                password=mongo_password,
                authSource='admin',
                serverSelectionTimeoutMS=30000,
                connectTimeoutMS=30000,
                socketTimeoutMS=30000,
                connect=False  # 延迟连接，直到第一次使用
            )
        else:
            MONGO_CLIENT = MongoClient(
                host=mongo_host,
                port=mongo_port,
                serverSelectionTimeoutMS=30000,
                connectTimeoutMS=30000,
                socketTimeoutMS=30000,
                connect=False  # 延迟连接，直到第一次使用
            )

    # 获取数据库引用
    MONGO_DB = MONGO_CLIENT[test_db_name]

    # 设置MongoDB可用标志
    MONGODB_AVAILABLE = True
    logger.info(f"MongoDB测试配置成功: {test_db_name}")

except Exception as e:
    logger.error(f"MongoDB测试配置错误: {str(e)}")
    # 不抛出异常，让应用继续启动，但记录错误

# 禁用密码哈希以加速测试
PASSWORD_HASHERS = [
    'django.contrib.auth.hashers.MD5PasswordHasher',
]

# 邮件配置
EMAIL_BACKEND = 'django.core.mail.backends.locmem.EmailBackend'

# 禁用Celery任务
CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True
