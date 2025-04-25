"""
用户设备模型
"""

from django.db import models
from django.conf import settings

class UserDevice(models.Model):
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
    
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='devices',
        verbose_name='用户'
    )
    device_id = models.CharField(max_length=255, verbose_name='设备ID')
    device_type = models.CharField(max_length=20, choices=DEVICE_TYPE_CHOICES, verbose_name='设备类型')
    device_name = models.CharField(max_length=100, blank=True, verbose_name='设备名称')
    device_model = models.CharField(max_length=100, blank=True, verbose_name='设备型号')
    os_version = models.CharField(max_length=50, blank=True, verbose_name='操作系统版本')
    app_version = models.CharField(max_length=50, blank=True, verbose_name='应用版本')
    push_token = models.CharField(max_length=255, blank=True, null=True, verbose_name='推送令牌')
    is_active = models.BooleanField(default=True, verbose_name='是否活跃')
    last_login_at = models.DateTimeField(blank=True, null=True, verbose_name='最后登录时间')
    last_login_ip = models.GenericIPAddressField(blank=True, null=True, verbose_name='最后登录IP')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')
    
    class Meta:
        verbose_name = '用户设备'
        verbose_name_plural = '用户设备'
        unique_together = ('user', 'device_id')
        ordering = ['-last_login_at']
        indexes = [
            models.Index(fields=['user', 'is_active']),
            models.Index(fields=['device_id']),
            models.Index(fields=['push_token']),
        ]
    
    def __str__(self):
        return f"{self.user} - {self.device_name or self.device_id}"
