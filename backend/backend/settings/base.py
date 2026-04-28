"""
Django基础设置文件
包含所有环境共享的设置
"""

import os
from pathlib import Path
from datetime import timedelta

# 导入 AI 配置
from .ai_config import *

# 构建项目路径
BASE_DIR = Path(__file__).resolve().parent.parent.parent

# 安全配置 - 在生产环境中应该保密
SECRET_KEY = 'django-insecure-zeroislenotes-secret-key-for-development'

# 应用定义
INSTALLED_APPS = [
    'django_prometheus',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # 第三方应用
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'channels',
    'django_filters',
    'corsheaders',
    'drf_yasg',  # Swagger文档

    # 自定义应用
    'users',
    'notes',
    'reminder',
    'knowledge_graph',
    'mind_map',
    'ai_assistant',
    'voice_recognition',
    'community',
    'search',
    'canvas',
    'code_editor',
    'common',
    'notification',
    'groups',
    'sync',
    'document_converter',
    'personal_activity',
    'tasks',
]

# 中间件配置
MIDDLEWARE = [
    'django_prometheus.middleware.PrometheusBeforeMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'common.middleware.SecurityHeadersMiddleware',
    'common.middleware.XSSProtectionMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'users.middleware.CustomAuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'common.middleware.RateLimitMiddleware',
    'common.middleware.RequestLogMiddleware',
    'django_prometheus.middleware.PrometheusAfterMiddleware',
]

# URL配置
ROOT_URLCONF = 'backend.urls'

# 模板配置
TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [os.path.join(BASE_DIR, 'templates')],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

# WSGI配置
WSGI_APPLICATION = 'backend.wsgi.application'

# ASGI配置
ASGI_APPLICATION = 'backend.asgi.application'

# 数据库配置 - 使用SQLite作为Django内部数据库，但主要数据存储在MongoDB
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': os.path.join(BASE_DIR, 'db.sqlite3'),
    }
}

# MongoDB Atlas/Realm连接配置
import mongoengine
from pymongo import MongoClient
import logging

logger = logging.getLogger(__name__)

# 连接到MongoDB
mongo_uri = os.environ.get('MONGO_URI')  # 强制通过环境变量配置，在开发未设置时走本地连接分支
mongo_db_name = os.environ.get('MONGO_DB', 'ZeroIsle_Notes')
MONGO_DB_NAME = mongo_db_name

# 断开所有现有连接
mongoengine.disconnect_all()

# 设置MongoDB连接标志
MONGODB_AVAILABLE = False

try:
    if mongo_uri:
        # 使用MongoDB Atlas连接字符串
        mongoengine.connect(
            db=mongo_db_name,
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
            db=mongo_db_name,
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
    MONGO_DB = MONGO_CLIENT[mongo_db_name]

    # 设置MongoDB可用标志
    MONGODB_AVAILABLE = True
    logger.info(f"MongoDB配置成功: {mongo_db_name}")

except Exception as e:
    logger.error(f"MongoDB配置错误: {str(e)}")
    # 不抛出异常，让应用继续启动，但记录错误

# 用户认证配置
AUTH_USER_MODEL = 'users.User'

# 认证后端
AUTHENTICATION_BACKENDS = [
    'users.auth.MongoDBUserBackend',
    # 'django.contrib.auth.backends.ModelBackend', # Replaced by MongoDBUserBackend
]

# 密码哈希设置
PASSWORD_HASHERS = [
    'django.contrib.auth.hashers.PBKDF2PasswordHasher',
    'django.contrib.auth.hashers.PBKDF2SHA1PasswordHasher',
    'django.contrib.auth.hashers.Argon2PasswordHasher',
    'django.contrib.auth.hashers.BCryptSHA256PasswordHasher',
]

# 密码验证设置
AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
        'OPTIONS': {
            'min_length': 8,
        }
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

# 国际化配置
LANGUAGE_CODE = 'zh-hans'
TIME_ZONE = 'Asia/Shanghai'
USE_I18N = True
USE_L10N = True
USE_TZ = True

# 静态文件配置
STATIC_URL = '/static/'
STATIC_ROOT = os.path.join(BASE_DIR, 'static_collected')
STATICFILES_DIRS = [
    os.path.join(BASE_DIR, 'static'),
]

# 媒体文件配置
MEDIA_URL = '/media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')

# 默认主键字段类型
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# REST Framework配置
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'users.jwt_auth.CustomJWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
    'DEFAULT_FILTER_BACKENDS': (
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ),
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle'
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '100/day',
        'user': '1000/day',
        'user_minute': '20/min',
        'user_day': '100/day',
    },
    'DEFAULT_VERSIONING_CLASS': 'rest_framework.versioning.URLPathVersioning',
    'DEFAULT_VERSION': 'v1',
    'ALLOWED_VERSIONS': ['v1', 'v2'],
    'VERSION_PARAM': 'version',
}

# Rate Limiting (per IP)
# Used by common.middleware.RateLimitMiddleware
RATE_LIMIT = 1000  # requests
RATE_LIMIT_WINDOW = 60  # seconds


# JWT配置
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=60),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': False, # Set to False as we use a custom MongoEngine blacklist
    'ALGORITHM': 'HS256',
    'SIGNING_KEY': SECRET_KEY,
    'VERIFYING_KEY': None,
    'AUTH_HEADER_TYPES': ('Bearer',),
    'USER_ID_FIELD': 'id',  # 使用UUID字段作为用户ID
    'USER_ID_CLAIM': 'user_id',  # JWT令牌中的用户ID声明
    # 添加UUID处理
    'JTI_CLAIM': 'jti',
    'TOKEN_TYPE_CLAIM': 'token_type',
}

# Channels配置
CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels_redis.core.RedisChannelLayer',
        'CONFIG': {
            "hosts": [(os.environ.get('REDIS_HOST', '127.0.0.1'),
                      int(os.environ.get('REDIS_PORT', 6379)))],
        },
    },
}

# Celery配置
CELERY_BROKER_URL = os.environ.get('CELERY_BROKER_URL', 'redis://localhost:6379/0')
CELERY_RESULT_BACKEND = os.environ.get('CELERY_RESULT_BACKEND', 'redis://localhost:6379/0')
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = 'Asia/Shanghai'

# Neo4j配置
NEO4J_URI = os.environ.get('NEO4J_URI', 'bolt://localhost:7687')
NEO4J_USER = os.environ.get('NEO4J_USER', 'neo4j')
NEO4J_PASSWORD = os.environ.get('NEO4J_PASSWORD', 'password')

# 短信服务配置
SMS_API_KEY = os.environ.get('SMS_API_KEY', 'your_sms_api_key')
SMS_API_SECRET = os.environ.get('SMS_API_SECRET', 'your_sms_api_secret')

# 第三方登录配置
WECHAT_APP_ID = os.environ.get('WECHAT_APP_ID', 'your_wechat_app_id')
WECHAT_APP_SECRET = os.environ.get('WECHAT_APP_SECRET', 'your_wechat_app_secret')
QQ_APP_ID = os.environ.get('QQ_APP_ID', 'your_qq_app_id')
QQ_APP_KEY = os.environ.get('QQ_APP_KEY', 'your_qq_app_key')

# CORS配置（按环境覆盖）
# 在 development.py 中启用 CORS_ALLOW_ALL_ORIGINS = True
# 在 production.py 中配置 CORS_ALLOWED_ORIGINS 白名单
# CORS_ALLOW_CREDENTIALS 也由各环境文件自行设置

# Swagger文档配置
SWAGGER_SETTINGS = {
    'SECURITY_DEFINITIONS': {
        'Bearer': {
            'type': 'apiKey',
            'name': 'Authorization',
            'in': 'header'
        }
    },
    'USE_SESSION_AUTH': False,
    'JSON_EDITOR': True,
}

# 搜索服务配置
SEARCH_VECTOR_MAX_CANDIDATES = 1000  # 向量搜索中用于重排的最大候选集大小
SEARCH_VECTOR_SIMILARITY_THRESHOLD = 0.1  # 向量搜索的最低相似度阈值

# Vector Search Configuration / 搜索模型配置
VECTOR_MODEL_TYPE = os.environ.get('VECTOR_MODEL_TYPE', 'sentence_transformer')
VECTOR_MODEL_NAME = os.environ.get('VECTOR_MODEL_NAME', 'paraphrase-multilingual-MiniLM-L12-v2')
VECTOR_STORE_TYPE = os.environ.get('VECTOR_STORE_TYPE', 'faiss')
VECTOR_COLLECTION_NAME = 'zeroisle_notes_vectors'




# 文档转换模式（可选：lite|loffice）
DOC_CONVERTER_MODE = os.environ.get('DOC_CONVERTER_MODE', 'lite')

# 文档转换器配置
LIBREOFFICE_PATH = os.environ.get('LIBREOFFICE_PATH', 'libreoffice')
PANDOC_PATH = os.environ.get('PANDOC_PATH', 'pandoc')
CONVERSION_TIMEOUT = int(os.environ.get('CONVERSION_TIMEOUT', 300))
DOWNLOAD_TOKEN_TTL_SECONDS = int(os.environ.get('DOWNLOAD_TOKEN_TTL_SECONDS', 600))


# 文件上传配置
MAX_UPLOAD_MB = int(os.environ.get('MAX_UPLOAD_MB', 20))
ALLOWED_UPLOAD_EXTENSIONS = ['.doc', '.docx', '.ppt', '.pptx', '.pdf', '.md', '.txt']

# 对象存储（可选）
OBJECT_STORAGE_PROVIDER = os.environ.get('OBJECT_STORAGE_PROVIDER', 'none')  # none|s3|minio
AWS_S3_BUCKET_NAME = os.environ.get('AWS_S3_BUCKET_NAME')
AWS_S3_ENDPOINT_URL = os.environ.get('AWS_S3_ENDPOINT_URL')
AWS_S3_REGION_NAME = os.environ.get('AWS_S3_REGION_NAME')
AWS_ACCESS_KEY_ID = os.environ.get('AWS_ACCESS_KEY_ID')
AWS_SECRET_ACCESS_KEY = os.environ.get('AWS_SECRET_ACCESS_KEY')

# 转换任务限制（资源保护）
CONVERSION_SOFT_LIMIT = int(os.environ.get('CONVERSION_SOFT_LIMIT', 240))  # seconds
CONVERSION_HARD_LIMIT = int(os.environ.get('CONVERSION_HARD_LIMIT', 300))  # seconds
# 病毒扫描（可选）
DOC_CONVERTER_VIRUS_SCAN = os.environ.get('DOC_CONVERTER_VIRUS_SCAN', 'false').lower() in ('1','true','yes')
VIRUS_SCAN_AUDIT_LOG_ENABLED = os.environ.get('VIRUS_SCAN_AUDIT_LOG_ENABLED', 'false').lower() in ('1','true','yes')

CLAMAV_HOST = os.environ.get('CLAMAV_HOST', '127.0.0.1')
CLAMAV_PORT = int(os.environ.get('CLAMAV_PORT', 3310))

DOC_CONVERTER_MAX_PAGES = int(os.environ.get('DOC_CONVERTER_MAX_PAGES', 200))  # pages


# Logging Configuration
LOGS_DIR = BASE_DIR / 'logs'
LOGS_DIR.mkdir(exist_ok=True)

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
        'audit': {
            'format': '{asctime} | {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'simple',
        },
        'file': {
            'level': 'INFO',
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': LOGS_DIR / 'django.log',
            'maxBytes': 1024 * 1024 * 5,  # 5 MB
            'backupCount': 2,
            'formatter': 'verbose',
        },
        'virus_scan_audit_file': {
            'level': 'INFO',
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': LOGS_DIR / 'virus_scan_audit.log',
            'maxBytes': 1024 * 1024 * 5,  # 5 MB
            'backupCount': 2,
            'formatter': 'audit',
        },
    },
    'loggers': {
        'django': {
            'handlers': ['console', 'file'],
            'level': 'INFO',
            'propagate': True,
        },
        'virus_scan_audit': {
            'handlers': ['virus_scan_audit_file'],
            'level': 'INFO',
            'propagate': False,
        },
    },
}
