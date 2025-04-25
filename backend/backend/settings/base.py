"""
Django基础设置文件
包含所有环境共享的设置
"""

import os
from pathlib import Path
from datetime import timedelta

# 构建项目路径
BASE_DIR = Path(__file__).resolve().parent.parent.parent

# 安全配置 - 在生产环境中应该保密
SECRET_KEY = 'django-insecure-zeroislenotes-secret-key-for-development'

# 应用定义
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    
    # 第三方应用
    'rest_framework',
    'rest_framework_simplejwt',
    'channels',
    'django_filters',
    'corsheaders',
    'drf_yasg',  # Swagger文档
    
    # 自定义应用
    'users',
    'notes',
    'reminder',
    'knowledge_graph',
    'ai_assistant',
    'voice_recognition',
    'community',
    'search',
    'canvas',
    'code',
    'common',
]

# 中间件配置
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'common.middleware.RequestLogMiddleware',  # 请求日志中间件
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
ASGI_APPLICATION = 'backend.routing.application'

# MongoDB数据库配置
DATABASES = {
    'default': {
        'ENGINE': 'djongo',
        'NAME': 'zeroislenotes',
        'CLIENT': {
            'host': os.environ.get('MONGO_HOST', 'localhost'),
            'port': int(os.environ.get('MONGO_PORT', 27017)),
            'username': os.environ.get('MONGO_USER', ''),
            'password': os.environ.get('MONGO_PASSWORD', ''),
            'authSource': 'admin',
        }
    }
}

# 用户认证配置
AUTH_USER_MODEL = 'users.User'

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
        'rest_framework_simplejwt.authentication.JWTAuthentication',
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
    'DEFAULT_VERSIONING_CLASS': 'rest_framework.versioning.URLPathVersioning',
    'DEFAULT_VERSION': 'v1',
    'ALLOWED_VERSIONS': ['v1', 'v2'],
    'VERSION_PARAM': 'version',
}

# JWT配置
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=60),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'ALGORITHM': 'HS256',
    'SIGNING_KEY': SECRET_KEY,
    'VERIFYING_KEY': None,
    'AUTH_HEADER_TYPES': ('Bearer',),
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

# CORS配置
CORS_ALLOW_ALL_ORIGINS = True  # 开发环境下允许所有来源
# 生产环境应该指定允许的来源
# CORS_ALLOWED_ORIGINS = [
#     "http://localhost:3000",
#     "http://127.0.0.1:3000",
# ]
CORS_ALLOW_CREDENTIALS = True

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
