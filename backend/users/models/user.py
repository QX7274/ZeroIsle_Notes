"""
用户模型
"""

import uuid
from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils.translation import gettext_lazy as _

class User(AbstractUser):
    """
    自定义用户模型
    扩展Django默认用户模型，添加额外字段
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, verbose_name='用户ID')
    email = models.EmailField(_('邮箱地址'), unique=True)
    phone = models.CharField(_('手机号'), max_length=20, blank=True, null=True, unique=True)
    avatar = models.ImageField(upload_to='avatars/', null=True, blank=True, verbose_name='头像')
    bio = models.TextField(max_length=500, blank=True, verbose_name='个人简介')
    is_verified = models.BooleanField(default=False, verbose_name='是否验证')
    last_login_ip = models.GenericIPAddressField(blank=True, null=True, verbose_name='最后登录IP')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')
    
    # 用户偏好设置
    preferences = models.JSONField(default=dict, verbose_name='偏好设置')
    
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']
    
    class Meta:
        verbose_name = _('用户')
        verbose_name_plural = _('用户')
        ordering = ['-date_joined']
        indexes = [
            models.Index(fields=['email']),
            models.Index(fields=['phone']),
            models.Index(fields=['username']),
        ]
    
    def __str__(self):
        return self.email or self.username
    
    def clean(self):
        """确保至少提供了手机号或邮箱"""
        from django.core.exceptions import ValidationError
        if not self.email and not self.phone:
            raise ValidationError(_('必须提供邮箱或手机号'))
    
    def get_full_name(self):
        """获取用户全名"""
        if self.first_name and self.last_name:
            return f"{self.first_name} {self.last_name}"
        return self.username
    
    def get_short_name(self):
        """获取用户简称"""
        return self.first_name or self.username
    
    @property
    def is_complete_profile(self):
        """检查用户资料是否完整"""
        return bool(self.first_name and self.last_name and self.avatar)
