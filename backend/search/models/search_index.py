"""
搜索索引模型
"""

from django.db import models
from django.contrib.auth import get_user_model
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType

User = get_user_model()

class SearchIndex(models.Model):
    """
    搜索索引模型
    存储可搜索内容的索引
    """
    INDEX_TYPE_CHOICES = (
        ('note', '笔记'),
        ('tag', '标签'),
        ('category', '分类'),
        ('knowledge_node', '知识节点'),
        ('transcription', '转录'),
        ('community_post', '社区帖子'),
        ('community_comment', '社区评论'),
    )
    
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='search_indices',
        verbose_name='用户'
    )
    title = models.CharField(max_length=255, verbose_name='标题')
    content = models.TextField(blank=True, null=True, verbose_name='内容')
    keywords = models.TextField(blank=True, null=True, verbose_name='关键词')
    index_type = models.CharField(max_length=20, choices=INDEX_TYPE_CHOICES, verbose_name='索引类型')
    
    # 通用外键，关联到任何模型
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE, verbose_name='内容类型')
    object_id = models.CharField(max_length=50, verbose_name='对象ID')
    content_object = GenericForeignKey('content_type', 'object_id')
    
    # 向量表示，用于语义搜索
    vector = models.BinaryField(null=True, blank=True, verbose_name='向量表示')
    
    is_public = models.BooleanField(default=False, verbose_name='是否公开')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')
    
    class Meta:
        verbose_name = '搜索索引'
        verbose_name_plural = '搜索索引'
        ordering = ['-updated_at']
        indexes = [
            models.Index(fields=['user', 'index_type']),
            models.Index(fields=['content_type', 'object_id']),
            models.Index(fields=['is_public']),
        ]
    
    def __str__(self):
        return f"{self.get_index_type_display()}: {self.title}"
