"""
第三方账号模型
"""

from django.db import models
from django.conf import settings

class ThirdPartyAccount(models.Model):
    """
    第三方账号模型
    用于存储用户的第三方账号信息
    """
    PROVIDER_CHOICES = (
        ('wechat', '微信'),
        ('qq', 'QQ'),
        ('weibo', '微博'),
        ('github', 'GitHub'),
        ('google', 'Google'),
        ('apple', 'Apple'),
    )
    
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='third_party_accounts',
        verbose_name='用户'
    )
    provider = models.CharField(max_length=20, choices=PROVIDER_CHOICES, verbose_name='提供商')
    uid = models.CharField(max_length=255, verbose_name='第三方用户ID')
    access_token = models.CharField(max_length=255, blank=True, null=True, verbose_name='访问令牌')
    refresh_token = models.CharField(max_length=255, blank=True, null=True, verbose_name='刷新令牌')
    expires_at = models.DateTimeField(blank=True, null=True, verbose_name='过期时间')
    extra_data = models.JSONField(default=dict, blank=True, verbose_name='额外数据')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')
    
    class Meta:
        verbose_name = '第三方账号'
        verbose_name_plural = '第三方账号'
        unique_together = ('provider', 'uid')
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'provider']),
            models.Index(fields=['provider', 'uid']),
        ]
    
    def __str__(self):
        return f"{self.user} - {self.get_provider_display()}"
