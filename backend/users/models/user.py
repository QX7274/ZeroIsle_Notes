"""
用户模型
"""

from django.contrib.auth.models import AbstractUser
from django.utils.translation import gettext_lazy as _

class User(AbstractUser):
    """
    自定义用户模型
    这个模型仅用于Django的认证系统
    实际的用户数据存储在MongoDB中
    """
    class Meta:
        verbose_name = _('用户')
        verbose_name_plural = _('用户')

    def __str__(self):
        return self.username
