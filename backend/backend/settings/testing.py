"""
测试环境特定设置
"""

from .base import *

# 调试模式
DEBUG = True

# 允许的主机
ALLOWED_HOSTS = ['localhost', '127.0.0.1', 'testserver']

# 使用内存数据库进行测试
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': ':memory:',
    }
}

# 禁用密码哈希以加速测试
PASSWORD_HASHERS = [
    'django.contrib.auth.hashers.MD5PasswordHasher',
]

# 邮件配置
EMAIL_BACKEND = 'django.core.mail.backends.locmem.EmailBackend'

# 禁用Celery任务
CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True
