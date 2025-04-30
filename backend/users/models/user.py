"""
用户模型
"""

import uuid
import json
import logging
from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils.translation import gettext_lazy as _

logger = logging.getLogger(__name__)

class User(AbstractUser):
    """
    自定义用户模型
    扩展Django默认用户模型，添加额外字段
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, verbose_name='用户ID')
    email = models.EmailField(_('邮箱地址'), unique=True, blank=True, null=True)
    phone = models.CharField(_('手机号'), max_length=20, blank=True, null=True, unique=True)
    nickname = models.CharField(_('昵称'), max_length=50, blank=True, null=True)
    avatar = models.ImageField(upload_to='avatars/', null=True, blank=True, verbose_name='头像')
    bio = models.TextField(max_length=500, blank=True, verbose_name='个人简介')
    is_verified = models.BooleanField(default=False, verbose_name='是否验证')
    last_login_ip = models.GenericIPAddressField(blank=True, null=True, verbose_name='最后登录IP')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    # 第三方登录相关字段
    wechat_openid = models.CharField(max_length=100, blank=True, null=True, unique=True, verbose_name='微信OpenID')
    wechat_unionid = models.CharField(max_length=100, blank=True, null=True, verbose_name='微信UnionID')
    wechat_avatar = models.URLField(max_length=500, blank=True, null=True, verbose_name='微信头像')
    qq_openid = models.CharField(max_length=100, blank=True, null=True, unique=True, verbose_name='QQ OpenID')
    qq_avatar = models.URLField(max_length=500, blank=True, null=True, verbose_name='QQ头像')

    # 用户偏好设置 - 使用TextField而不是JSONField以避免与MongoDB的兼容性问题
    preferences = models.TextField(default='{}', verbose_name='偏好设置')

    USERNAME_FIELD = 'username'
    REQUIRED_FIELDS = ['email']

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

    def get_preferences(self):
        """获取用户偏好设置（反序列化）"""
        try:
            if not self.preferences:
                return {}
            return json.loads(self.preferences)
        except Exception as e:
            logger.error(f"解析用户偏好设置失败: {str(e)}")
            return {}

    def set_preferences(self, preferences_dict):
        """设置用户偏好设置（序列化）"""
        try:
            self.preferences = json.dumps(preferences_dict)
            self.save(update_fields=['preferences'])
        except Exception as e:
            logger.error(f"设置用户偏好设置失败: {str(e)}")

    def update_preference(self, key, value):
        """更新单个偏好设置"""
        prefs = self.get_preferences()
        prefs[key] = value
        self.set_preferences(prefs)
