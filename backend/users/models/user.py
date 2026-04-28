"""
用户模型
"""

from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils.translation import gettext_lazy as _
import uuid
import logging

logger = logging.getLogger(__name__)

class User(AbstractUser):
    """
    自定义用户模型
    这个模型仅用于Django的认证系统
    实际的用户数据存储在MongoDB中

    使用UUID作为主键，与MongoDB保持一致
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    mongo_id = models.UUIDField(null=True, blank=True, help_text="对应的MongoDB用户ID")
    email = models.EmailField(_('email address'), unique=True, null=True, blank=True)
    phone = models.CharField(_('phone number'), max_length=20, unique=True, null=True, blank=True)

    class Meta:
        verbose_name = _('用户')
        verbose_name_plural = _('用户')

    def __str__(self):
        return self.username

    def save(self, *args, **kwargs):
        """重写save方法，确保ID是UUID格式"""
        if not self.id:
            self.id = uuid.uuid4()
        super().save(*args, **kwargs)
