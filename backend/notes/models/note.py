"""
笔记模型
"""

from django.db import models
from django.conf import settings
from common.models import UserOwnedModel, SoftDeleteModel, PublicModel

class Note(UserOwnedModel, SoftDeleteModel, PublicModel):
    """笔记模型"""
    title = models.CharField(max_length=255, verbose_name='标题')
    content = models.TextField(blank=True, verbose_name='内容')
    category = models.ForeignKey(
        'notes.Category',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='notes',
        verbose_name='分类'
    )
    tags = models.ManyToManyField(
        'notes.Tag',
        blank=True,
        related_name='notes',
        verbose_name='标签'
    )
    is_favorite = models.BooleanField(default=False, verbose_name='是否收藏')
    is_encrypted = models.BooleanField(default=False, verbose_name='是否加密')
    encryption_key = models.CharField(max_length=255, blank=True, null=True, verbose_name='加密密钥')
    view_count = models.PositiveIntegerField(default=0, verbose_name='查看次数')
    last_viewed_at = models.DateTimeField(null=True, blank=True, verbose_name='最后查看时间')
    
    class Meta:
        verbose_name = '笔记'
        verbose_name_plural = '笔记'
        ordering = ['-updated_at']
        indexes = [
            models.Index(fields=['user', 'is_deleted']),
            models.Index(fields=['user', 'is_favorite']),
            models.Index(fields=['user', 'category']),
            models.Index(fields=['is_public']),
        ]
    
    def __str__(self):
        return self.title
    
    def increment_view_count(self):
        """增加查看次数"""
        self.view_count += 1
        self.save(update_fields=['view_count'])
    
    @property
    def word_count(self):
        """计算字数"""
        if not self.content:
            return 0
        return len(self.content)
