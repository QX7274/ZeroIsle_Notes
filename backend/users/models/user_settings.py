"""
用户设置模型
"""

from mongoengine import Document, StringField, BooleanField, IntField, DateTimeField, ReferenceField
from django.utils import timezone
from ..mongodb_models import User

class UserSettings(Document):
    """
    用户设置模型
    存储用户的应用设置和偏好
    """
    THEME_CHOICES = (
        ('light', '浅色'),
        ('dark', '深色'),
        ('system', '跟随系统'),
    )

    FONT_SIZE_CHOICES = (
        ('small', '小'),
        ('medium', '中'),
        ('large', '大'),
    )

    LANGUAGE_CHOICES = (
        ('zh-CN', '简体中文'),
        ('en-US', '英文'),
    )

    user = ReferenceField(User, required=True, unique=True, verbose_name='用户')
    theme = StringField(max_length=10, choices=THEME_CHOICES, default='system', verbose_name='主题')
    font_size = StringField(max_length=10, choices=FONT_SIZE_CHOICES, default='medium', verbose_name='字体大小')
    language = StringField(max_length=10, choices=LANGUAGE_CHOICES, default='zh-CN', verbose_name='语言')
    notification_enabled = BooleanField(default=True, verbose_name='启用通知')
    email_notification = BooleanField(default=True, verbose_name='邮件通知')
    auto_save = BooleanField(default=True, verbose_name='自动保存')
    auto_save_interval = IntField(default=60, verbose_name='自动保存间隔(秒)')
    offline_mode = BooleanField(default=False, verbose_name='离线模式')

    ai_assistant_enabled = BooleanField(default=True, verbose_name='启用AI助手')
    ai_assistant_model = StringField(max_length=50, default='gpt-3.5-turbo', verbose_name='AI助手模型')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')

    meta = {
        'collection': 'user_settings',
        'ordering': ['-updated_at'],
        'indexes': [
            'user',
            'created_at',
            'updated_at'
        ],
        'verbose_name': '用户设置',
        'verbose_name_plural': '用户设置'
    }

    def __str__(self):
        return f"{self.user.username} 的设置"

    def save(self, *args, **kwargs):
        self.updated_at = timezone.now()
        return super(UserSettings, self).save(*args, **kwargs)

    @classmethod
    def get_default_settings(cls):
        """获取默认设置"""
        return {
            'theme': 'system',
            'font_size': 'medium',
            'language': 'zh-CN',
            'notification_enabled': True,
            'email_notification': True,
            'auto_save': True,
            'auto_save_interval': 60,
            'offline_mode': False,
            'handwriting_recognition_mode': 'realtime',
            'ai_assistant_enabled': True,
            'ai_assistant_model': 'gpt-3.5-turbo',
        }
