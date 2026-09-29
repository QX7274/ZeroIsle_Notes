"""
开发环境特定设置
"""

from .base import *
from pymongo import MongoClient

# 调试模式
DEBUG = True
DEV_AUTH_ENABLED = True

# 允许的主机
ALLOWED_HOSTS = ['localhost', '127.0.0.1', '0.0.0.0', '10.138.116.105', '10.0.2.2', '*', '192.168.154.232']

# 允许所有网络接口访问
ALLOWED_HOSTS = ['*']

# 开发服务器配置
RUNSERVERPLUS_HOST = '0.0.0.0'
RUNSERVERPLUS_PORT = 8000

# 开发环境 CORS 设置
CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_CREDENTIALS = True

# 开发模式认证中间件仅在此环境启用
try:
    MIDDLEWARE  # from base.py
    _custom_auth_index = MIDDLEWARE.index('users.middleware.CustomAuthenticationMiddleware')
    MIDDLEWARE.insert(_custom_auth_index, 'common.middleware.dev_auth_middleware.DevAuthMiddleware')
except Exception:
    # 回退：若找不到，直接追加
    MIDDLEWARE = list(globals().get('MIDDLEWARE', []))
    MIDDLEWARE.append('common.middleware.dev_auth_middleware.DevAuthMiddleware')

# MongoDB Realm配置（RISK-BE-008：与 base.py 共用同一解析口径 —— 新名优先、旧名兜底并大声弃用告警）
# 直接复用 base.py 解析出的 MONGO_URI / MONGO_DB_NAME，避免 PyMongo / MongoEngine 分别落到不同库
mongo_uri = MONGO_URI
mongo_db_name = MONGO_DB_NAME

if mongo_uri:
    MONGO_CLIENT = MongoClient(
        mongo_uri,
        serverSelectionTimeoutMS=30000,
        connectTimeoutMS=30000,
        socketTimeoutMS=30000
    )
else:
    # 无 URI 且无旧连接参数：保持本地开发默认分支
    MONGO_CLIENT = MongoClient(
        host=DEFAULT_MONGO_HOST,
        port=DEFAULT_MONGO_PORT,
        username='',
        password='',
        authSource='admin'
    )

MONGO_DB = MONGO_CLIENT[mongo_db_name]

# 断开所有现有连接并重新连接
mongoengine.disconnect_all()
if mongo_uri:
    mongoengine.connect(
        db=mongo_db_name,
        host=mongo_uri,
        alias='default'
    )
else:
    mongoengine.connect(
        db=mongo_db_name,
        host=DEFAULT_MONGO_HOST,
        port=DEFAULT_MONGO_PORT,
        username='',
        password='',
        authentication_source='admin',
        alias='default'
    )

# 日志配置
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {process:d} {thread:d} {message}',
            'style': '{',
        },
        'simple': {
            'format': '{levelname} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'level': 'DEBUG',
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
        'file': {
            'level': 'INFO',
            'class': 'logging.FileHandler',
            'filename': os.path.join(BASE_DIR, 'logs/debug.log'),
            'formatter': 'verbose',
        },
    },
    'loggers': {
        'django': {
            'handlers': ['console', 'file'],
            'level': 'INFO',
            'propagate': True,
        },
        'backend': {
            'handlers': ['console', 'file'],
            'level': 'DEBUG',
            'propagate': True,
        },
    },
}

# 确保日志目录存在
os.makedirs(os.path.join(BASE_DIR, 'logs'), exist_ok=True)

# 邮件配置
EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
