"""
关注模型
"""

from django.db import models
from django.contrib.auth import get_user_model
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType

User = get_user_model()

class Follow(models.Model):
    """
    关注模型
    存储用户对内容的关注
    """
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='follows',
        verbose_name='用户'
    )
    # 通用外键，关联到任何模型
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE, verbose_name='内容类型')
    object_id = models.CharField(max_length=50, verbose_name='对象ID')
    content_object = GenericForeignKey('content_type', 'object_id')
    
    is_active = models.BooleanField(default=True, verbose_name='是否激活')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')
    
    class Meta:
        verbose_name = '关注'
        verbose_name_plural = '关注'
        unique_together = ('user', 'content_type', 'object_id')
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'is_active']),
            models.Index(fields=['content_type', 'object_id', 'is_active']),
        ]
    
    def __str__(self):
        return f"{self.user.username} 关注了 {self.content_type.model} {self.object_id}"
