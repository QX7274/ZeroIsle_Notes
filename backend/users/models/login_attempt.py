"""
登录尝试模型
用于记录用户登录尝试，防止暴力破解
"""

from mongoengine import Document, StringField, BooleanField, DateTimeField
from django.utils import timezone


class LoginAttempt(Document):
    """
    登录尝试记录
    """
    ip_address = StringField(max_length=45, required=True, verbose_name="IP地址")
    user_agent = StringField(required=False, verbose_name="用户代理")
    username = StringField(max_length=150, required=False, verbose_name="用户名")
    success = BooleanField(default=False, verbose_name="是否成功")
    timestamp = DateTimeField(default=timezone.now, verbose_name="尝试时间")

    meta = {
        'collection': 'login_attempts',
        'ordering': ['-timestamp'],
        'indexes': [
            {'fields': ['ip_address', 'timestamp']},
            {'fields': ['username', 'timestamp']},
        ],
        'verbose_name': "登录尝试",
        'verbose_name_plural': "登录尝试"
    }

    def __str__(self):
        return f"{self.ip_address} - {self.timestamp} - {'成功' if self.success else '失败'}"
