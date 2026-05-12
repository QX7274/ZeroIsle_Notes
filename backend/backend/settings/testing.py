"""
测试环境特定设置
"""

from .base import *
import os
import logging
from functools import partial
import mongoengine
import mongomock
from pymongo import MongoClient

# 调试模式
DEBUG = True

# 允许的主机
ALLOWED_HOSTS = ['localhost', '127.0.0.1', 'testserver']
# 在测试环境中移除不可用的可选依赖（如未安装 django_prometheus）
try:
    INSTALLED_APPS = [app for app in INSTALLED_APPS if app not in ['django_prometheus', 'rest_framework_simplejwt.token_blacklist']]
    MIDDLEWARE = [mw for mw in MIDDLEWARE if not mw.startswith('django_prometheus.')]
except Exception:
    pass

# 在测试环境中禁用 common.middleware.* 中间件以避免可选依赖和循环导入
try:
    MIDDLEWARE = [mw for mw in MIDDLEWARE if not mw.startswith('common.middleware.')]
except Exception:
    pass

# 覆盖测试环境的中间件列表，避免导入有冲突/可选依赖的中间件
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'users.middleware.CustomAuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]


# 使用SQLite作为Django测试数据库，但主要数据存储在MongoDB
# 使用SQLite作为Django测试数据库
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': ':memory:',
    }
}

logger = logging.getLogger(__name__)

# 断开所有现有连接
mongoengine.disconnect_all()

# 测试数据库名称
test_db_name = os.environ.get('MONGO_TEST_DB', 'ZeroIsle_Notes_Test')
MONGO_DB_NAME = test_db_name
MONGO_URI = os.environ.get('MONGO_URI', '')
MONGO_HOST = os.environ.get('MONGO_HOST', '127.0.0.1')
MONGO_PORT = int(os.environ.get('MONGO_PORT', 27017))

# 设置MongoDB连接标志
MONGODB_AVAILABLE = False

try:
    use_real_mongo = os.environ.get('USE_REAL_MONGO_FOR_TESTS', '').lower() in ('1', 'true', 'yes')

    if use_real_mongo and MONGO_URI:
        # 显式要求真实 Mongo 且已提供 URI 时，才允许连接真实实例
        mongoengine.connect(
            db=test_db_name,
            host=MONGO_URI,
            alias='default',
            serverSelectionTimeoutMS=30000,
            connectTimeoutMS=30000,
            socketTimeoutMS=30000,
            connect=False  # 延迟连接，直到第一次使用
        )

        # 创建 PyMongo 客户端用于原生操作
        MONGO_CLIENT = MongoClient(
            MONGO_URI,
            serverSelectionTimeoutMS=30000,
            connectTimeoutMS=30000,
            socketTimeoutMS=30000,
            connect=False  # 延迟连接，直到第一次使用
        )
    elif use_real_mongo:
        # 显式要求真实 Mongo 但未提供 URI 时，退回到本地/容器配置
        mongo_user = os.environ.get('MONGO_USER', '')
        mongo_password = os.environ.get('MONGO_PASSWORD', '')

        mongoengine.connect(
            db=test_db_name,
            host=MONGO_HOST,
            port=MONGO_PORT,
            username=mongo_user,
            password=mongo_password,
            authentication_source='admin',
            alias='default',
            serverSelectionTimeoutMS=30000,
            connectTimeoutMS=30000,
            socketTimeoutMS=30000,
            connect=False  # 延迟连接，直到第一次使用
        )

        # 创建 PyMongo 客户端用于原生操作
        if mongo_user and mongo_password:
            MONGO_CLIENT = MongoClient(
                host=MONGO_HOST,
                port=MONGO_PORT,
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
                host=MONGO_HOST,
                port=MONGO_PORT,
                serverSelectionTimeoutMS=30000,
                connectTimeoutMS=30000,
                socketTimeoutMS=30000,
                connect=False  # 延迟连接，直到第一次使用
            )
    else:
        # 默认测试模式：使用 mongomock，避免在 check / pytest / smoke 阶段强依赖真实 Mongo
        mongoengine.connect(
            db=test_db_name,
            host='mongodb://localhost',
            alias='default',
            mongo_client_class=partial(mongomock.MongoClient, uuidRepresentation='standard'),
            uuidRepresentation='standard',
        )
        MONGO_CLIENT = mongomock.MongoClient(uuidRepresentation='standard')
        logger.info("测试环境默认使用 mongomock 作为 MongoDB 后端")

    # 获取数据库引用
    MONGO_DB = MONGO_CLIENT[test_db_name]

    # 设置 MongoDB 可用标志
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

# Use InMemoryChannelLayer for testing
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels.layers.InMemoryChannelLayer",
    },
}
