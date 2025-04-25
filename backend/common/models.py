"""
基础模型类
"""

from django.db import models
from django.utils import timezone
from django.conf import settings

class TimeStampedModel(models.Model):
    """
    带时间戳的基础模型
    包含创建时间和更新时间字段
    """
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')
    
    class Meta:
        abstract = True

class UserOwnedModel(TimeStampedModel):
    """
    用户所有的基础模型
    包含用户外键和时间戳
    """
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='%(class)ss',
        verbose_name='用户'
    )
    
    class Meta:
        abstract = True

class SoftDeleteModel(models.Model):
    """
    软删除基础模型
    包含删除标记和删除时间
    """
    is_deleted = models.BooleanField(default=False, verbose_name='是否删除')
    deleted_at = models.DateTimeField(null=True, blank=True, verbose_name='删除时间')
    
    class Meta:
        abstract = True
    
    def delete(self, using=None, keep_parents=False):
        """
        重写删除方法，实现软删除
        """
        self.is_deleted = True
        self.deleted_at = timezone.now()
        self.save(update_fields=['is_deleted', 'deleted_at'])
    
    def hard_delete(self):
        """
        硬删除方法
        真正从数据库中删除记录
        """
        super().delete()

class PublicModel(models.Model):
    """
    公开/私有基础模型
    包含公开标记
    """
    is_public = models.BooleanField(default=False, verbose_name='是否公开')
    
    class Meta:
        abstract = True
