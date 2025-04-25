"""
搜索建议模型
"""

from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()

class SearchSuggestion(models.Model):
    """
    搜索建议模型
    存储搜索建议
    """
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='search_suggestions',
        verbose_name='用户',
        null=True,
        blank=True
    )
    text = models.CharField(max_length=255, verbose_name='建议文本')
    frequency = models.IntegerField(default=1, verbose_name='频率')
    is_global = models.BooleanField(default=False, verbose_name='是否全局')
    last_used = models.DateTimeField(auto_now=True, verbose_name='最后使用时间')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    
    class Meta:
        verbose_name = '搜索建议'
        verbose_name_plural = '搜索建议'
        ordering = ['-frequency', '-last_used']
        unique_together = ('user', 'text')
        indexes = [
            models.Index(fields=['user', 'frequency']),
            models.Index(fields=['is_global']),
            models.Index(fields=['text']),
        ]
    
    def __str__(self):
        if self.user:
            return f"{self.user.username}: {self.text} ({self.frequency})"
        return f"全局: {self.text} ({self.frequency})"
