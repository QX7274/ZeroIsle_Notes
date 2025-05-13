"""
用户设备模型
"""

from mongoengine import Document, StringField, DateTimeField, BooleanField, ReferenceField
from django.utils import timezone
from ..mongodb_models import User

class UserDevice(Document):
    """
    用户设备模型
    存储用户的设备信息，用于推送通知和设备管理
    """
    DEVICE_TYPE_CHOICES = (
        ('ios', 'iOS'),
        ('android', 'Android'),
        ('web', 'Web'),
        ('desktop', '桌面端'),
    )

    user = ReferenceField(User, required=True, verbose_name='用户')
    device_id = StringField(max_length=255, required=True, verbose_name='设备ID')
    device_type = StringField(max_length=20, choices=DEVICE_TYPE_CHOICES, required=True, verbose_name='设备类型')
    device_name = StringField(max_length=100, required=False, verbose_name='设备名称')
    device_model = StringField(max_length=100, required=False, verbose_name='设备型号')
    os_version = StringField(max_length=50, required=False, verbose_name='操作系统版本')
    app_version = StringField(max_length=50, required=False, verbose_name='应用版本')
    push_token = StringField(max_length=255, required=False, verbose_name='推送令牌')
    is_active = BooleanField(default=True, verbose_name='是否活跃')
    last_login_at = DateTimeField(required=False, verbose_name='最后登录时间')
    last_login_ip = StringField(max_length=50, required=False, verbose_name='最后登录IP')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')

    meta = {
        'collection': 'user_devices',
        'ordering': ['-last_login_at'],
        'indexes': [
            {'fields': ['user', 'device_id'], 'unique': True},
            {'fields': ['user', 'is_active']},
            {'fields': ['device_id']},
            {'fields': ['push_token']}
        ],
        'verbose_name': '用户设备',
        'verbose_name_plural': '用户设备'
    }

    def __str__(self):
        return f"{self.user.username} - {self.device_name or self.device_id}"

    def save(self, *args, **kwargs):
        self.updated_at = timezone.now()
        return super(UserDevice, self).save(*args, **kwargs)
