"""
开发环境特定设置
"""

from .base import *
from pymongo import MongoClient

# 调试模式
DEBUG = True

# 允许的主机
ALLOWED_HOSTS = ['localhost', '127.0.0.1', '0.0.0.0', '10.138.116.105', '10.0.2.2', '*']

# 使用base.py中的MongoDB配置
# 直接使用PyMongo客户端进行原生操作
MONGO_CLIENT = MongoClient(
    host=os.environ.get('MONGO_HOST', 'localhost'),
    port=int(os.environ.get('MONGO_PORT', 27017)),
    username=os.environ.get('MONGO_USER', ''),
    password=os.environ.get('MONGO_PASSWORD', ''),
    authSource='admin'
)
MONGO_DB = MONGO_CLIENT['zeroislenotes']

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
