"""
用户设置模型
"""

from django.db import models
from django.conf import settings

class UserSettings(models.Model):
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
    
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='settings',
        verbose_name='用户'
    )
    theme = models.CharField(max_length=10, choices=THEME_CHOICES, default='system', verbose_name='主题')
    font_size = models.CharField(max_length=10, choices=FONT_SIZE_CHOICES, default='medium', verbose_name='字体大小')
    language = models.CharField(max_length=10, choices=LANGUAGE_CHOICES, default='zh-CN', verbose_name='语言')
    notification_enabled = models.BooleanField(default=True, verbose_name='启用通知')
    email_notification = models.BooleanField(default=True, verbose_name='邮件通知')
    auto_save = models.BooleanField(default=True, verbose_name='自动保存')
    auto_save_interval = models.IntegerField(default=60, verbose_name='自动保存间隔(秒)')
    offline_mode = models.BooleanField(default=False, verbose_name='离线模式')
    handwriting_recognition_mode = models.CharField(max_length=20, default='realtime', verbose_name='手写识别模式')
    ai_assistant_enabled = models.BooleanField(default=True, verbose_name='启用AI助手')
    ai_assistant_model = models.CharField(max_length=50, default='gpt-3.5-turbo', verbose_name='AI助手模型')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')
    
    class Meta:
        verbose_name = '用户设置'
        verbose_name_plural = '用户设置'
        ordering = ['-updated_at']
    
    def __str__(self):
        return f"{self.user} 的设置"
    
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
