from django.db import models
from django.contrib.auth.models import User


class SearchHistory(models.Model):
    """
    搜索历史记录模型
    """
    SEARCH_TYPES = (
        ('text', '文本搜索'),
        ('voice', '语音搜索'),
        ('image', '图像搜索'),
        ('knowledge', '知识图谱搜索'),
    )
    
    id = models.AutoField(primary_key=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='search_history', verbose_name='用户')
    query = models.CharField(max_length=255, verbose_name='搜索查询')
    search_type = models.CharField(max_length=20, choices=SEARCH_TYPES, default='text', verbose_name='搜索类型')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='搜索时间')
    
    class Meta:
        verbose_name = '搜索历史'
        verbose_name_plural = '搜索历史'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.user.username} - {self.query} ({self.search_type})"


class SearchResult(models.Model):
    """
    搜索结果缓存模型
    """
    RESULT_TYPES = (
        ('note', '笔记'),
        ('tag', '标签'),
        ('knowledge', '知识点'),
    )
    
    id = models.AutoField(primary_key=True)
    search_history = models.ForeignKey(SearchHistory, on_delete=models.CASCADE, related_name='results', verbose_name='搜索历史')
    result_type = models.CharField(max_length=20, choices=RESULT_TYPES, verbose_name='结果类型')
    result_id = models.IntegerField(verbose_name='结果ID')
    title = models.CharField(max_length=255, verbose_name='标题')
    preview = models.TextField(blank=True, null=True, verbose_name='预览内容')
    relevance = models.FloatField(default=0.0, verbose_name='相关度')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    
    class Meta:
        verbose_name = '搜索结果'
        verbose_name_plural = '搜索结果'
        ordering = ['-relevance']
    
    def __str__(self):
        return f"{self.title} ({self.result_type})"
