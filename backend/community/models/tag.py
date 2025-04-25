"""
标签模型
"""

from django.db import models
from django.utils.text import slugify

class Tag(models.Model):
    """
    标签模型
    存储帖子标签
    """
    name = models.CharField(max_length=50, unique=True, verbose_name='名称')
    slug = models.SlugField(max_length=50, unique=True, verbose_name='别名')
    description = models.TextField(blank=True, null=True, verbose_name='描述')
    color = models.CharField(max_length=20, blank=True, null=True, verbose_name='颜色')
    is_active = models.BooleanField(default=True, verbose_name='是否激活')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')
    
    class Meta:
        verbose_name = '标签'
        verbose_name_plural = '标签'
        ordering = ['name']
        indexes = [
            models.Index(fields=['slug']),
            models.Index(fields=['is_active']),
        ]
    
    def __str__(self):
        return self.name
    
    def save(self, *args, **kwargs):
        """保存前处理"""
        # 如果没有别名，自动生成
        if not self.slug:
            self.slug = slugify(self.name)
        
        super().save(*args, **kwargs)
    
    @property
    def post_count(self):
        """获取帖子数量"""
        return self.posts.filter(is_deleted=False, status='published').count()
