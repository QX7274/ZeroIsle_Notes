"""
搜索结果模型
"""

from django.db import models
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType

class SearchResult(models.Model):
    """
    搜索结果模型
    存储搜索查询的结果
    """
    query = models.ForeignKey(
        'search.SearchQuery',
        on_delete=models.CASCADE,
        related_name='results',
        verbose_name='查询'
    )
    title = models.CharField(max_length=255, verbose_name='标题')
    snippet = models.TextField(blank=True, null=True, verbose_name='摘要')
    score = models.FloatField(default=0, verbose_name='相关度分数')
    position = models.IntegerField(default=0, verbose_name='位置')
    
    # 通用外键，关联到任何模型
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE, verbose_name='内容类型')
    object_id = models.CharField(max_length=50, verbose_name='对象ID')
    content_object = GenericForeignKey('content_type', 'object_id')
    
    result_type = models.CharField(max_length=20, verbose_name='结果类型')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    
    class Meta:
        verbose_name = '搜索结果'
        verbose_name_plural = '搜索结果'
        ordering = ['position']
        indexes = [
            models.Index(fields=['query', 'position']),
            models.Index(fields=['content_type', 'object_id']),
        ]
    
    def __str__(self):
        return f"{self.query.query} - {self.title} ({self.score})"
