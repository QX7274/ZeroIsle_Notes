"""
点赞模型
"""

from django.db import models
from django.contrib.auth import get_user_model
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType

User = get_user_model()

class Like(models.Model):
    """
    点赞模型
    存储用户对内容的点赞
    """
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='likes',
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
        verbose_name = '点赞'
        verbose_name_plural = '点赞'
        unique_together = ('user', 'content_type', 'object_id')
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'is_active']),
            models.Index(fields=['content_type', 'object_id', 'is_active']),
        ]
    
    def __str__(self):
        return f"{self.user.username} 点赞了 {self.content_type.model} {self.object_id}"
    
    def save(self, *args, **kwargs):
        """保存前处理"""
        is_new = self.pk is None
        old_is_active = None
        
        if not is_new:
            # 获取旧的激活状态
            old_obj = Like.objects.get(pk=self.pk)
            old_is_active = old_obj.is_active
        
        super().save(*args, **kwargs)
        
        # 更新被点赞对象的点赞数
        if hasattr(self.content_object, 'update_like_count'):
            if is_new or old_is_active != self.is_active:
                self.content_object.update_like_count()
