from mongoengine import Document, StringField, EmailField, URLField, DateTimeField
from django.utils import timezone

class UserProfile(Document):
    """用户资料"""
    USER_STATUS_CHOICES = (
        ('active', '活跃'),
        ('inactive', '未激活'),
        ('banned', '已禁用'),
    )

    username = StringField(max_length=150, unique=True, required=True, verbose_name='用户名')
    email = EmailField(unique=True, required=True, verbose_name='邮箱')
    phone = StringField(max_length=20, required=False, verbose_name='手机号')
    nickname = StringField(max_length=50, required=False, verbose_name='昵称')
    avatar = URLField(required=False, verbose_name='头像URL')
    status = StringField(choices=USER_STATUS_CHOICES, default='active', verbose_name='状态')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    last_login = DateTimeField(required=False, verbose_name='最后登录时间')

    meta = {
        'collection': 'user_profiles',
        'ordering': ['-created_at'],
        'verbose_name': '用户资料',
        'verbose_name_plural': '用户资料'
    }

    def __str__(self):
        return self.username
