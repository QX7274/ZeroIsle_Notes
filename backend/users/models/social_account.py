"""
社交账号模型
用于存储用户的第三方登录关联
"""

from django.db import models
from django.conf import settings


class SocialAccount(models.Model):
    """社交账号关联"""
    
    PROVIDER_CHOICES = [
        ('wechat', '微信'),
        ('google', 'Google'),
        ('apple', 'Apple'),
        ('qq', 'QQ'),
        ('weibo', '微博'),
    ]
    
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='social_accounts',
        verbose_name='用户'
    )
    
    provider = models.CharField(
        max_length=30,
        choices=PROVIDER_CHOICES,
        verbose_name='提供商'
    )
    
    provider_user_id = models.CharField(
        max_length=255,
        verbose_name='提供商用户ID'
    )
    
    extra_data = models.JSONField(
        default=dict,
        blank=True,
        verbose_name='额外数据'
    )
    
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name='创建时间'
    )
    
    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name='更新时间'
    )
    
    class Meta:
        db_table = 'users_socialaccount'
        verbose_name = '社交账号'
        verbose_name_plural = '社交账号'
        unique_together = [['provider', 'provider_user_id']]
        indexes = [
            models.Index(fields=['user', 'provider']),
            models.Index(fields=['provider', 'provider_user_id']),
        ]
    
    def __str__(self):
        return f"{self.user.username} - {self.provider}"
    
    @property
    def avatar(self):
        """获取社交账号头像"""
        return self.extra_data.get('avatar', '')
    
    @property
    def nickname(self):
        """获取社交账号昵称"""
        return self.extra_data.get('nickname', '')
