"""
搜索查询模型
"""

from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()

class SearchQuery(models.Model):
    """
    搜索查询模型
    存储用户的搜索查询历史
    """
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='search_queries',
        verbose_name='用户'
    )
    query = models.CharField(max_length=255, verbose_name='查询内容')
    search_type = models.CharField(max_length=20, default='text', verbose_name='搜索类型')
    filters = models.JSONField(default=dict, blank=True, verbose_name='过滤条件')
    result_count = models.IntegerField(default=0, verbose_name='结果数量')
    execution_time = models.FloatField(default=0, verbose_name='执行时间(秒)')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')

    class Meta:
        verbose_name = '搜索查询'
        verbose_name_plural = '搜索查询'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'created_at']),
            models.Index(fields=['query']),
        ]

    def __str__(self):
        return f"{self.user.username}: {self.query}"
