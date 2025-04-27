"""
登录尝试模型
用于记录用户登录尝试，防止暴力破解
"""

from django.db import models
from django.utils import timezone


class LoginAttempt(models.Model):
    """
    登录尝试记录
    """
    ip_address = models.CharField(max_length=45, verbose_name="IP地址")
    user_agent = models.TextField(blank=True, null=True, verbose_name="用户代理")
    username = models.CharField(max_length=150, blank=True, null=True, verbose_name="用户名")
    success = models.BooleanField(default=False, verbose_name="是否成功")
    timestamp = models.DateTimeField(default=timezone.now, verbose_name="尝试时间")

    class Meta:
        verbose_name = "登录尝试"
        verbose_name_plural = "登录尝试"
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['ip_address', 'timestamp']),
            models.Index(fields=['username', 'timestamp']),
        ]

    def __str__(self):
        return f"{self.ip_address} - {self.timestamp} - {'成功' if self.success else '失败'}"
