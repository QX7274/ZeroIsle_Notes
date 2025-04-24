from mongoengine import Document, StringField, BooleanField, DateTimeField
from django.utils import timezone

class AdminLoginLog(Document):
    """管理员登录日志"""
    username = StringField(max_length=150, required=True, verbose_name='用户名')
    ip_address = StringField(required=True, verbose_name='IP地址')
    user_agent = StringField(required=True, verbose_name='用户代理')
    login_time = DateTimeField(default=timezone.now, verbose_name='登录时间')
    status = BooleanField(default=True, verbose_name='登录状态')
    message = StringField(max_length=255, required=False, verbose_name='消息')

    meta = {
        'collection': 'admin_login_logs',
        'ordering': ['-login_time'],
        'verbose_name': '管理员登录日志',
        'verbose_name_plural': '管理员登录日志'
    }

    def __str__(self):
        return f"{self.username} - {self.login_time}"
