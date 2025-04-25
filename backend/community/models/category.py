"""
分类模型
"""

from django.db import models
from django.utils.text import slugify

class Category(models.Model):
    """
    分类模型
    存储帖子分类
    """
    name = models.CharField(max_length=100, unique=True, verbose_name='名称')
    slug = models.SlugField(max_length=100, unique=True, verbose_name='别名')
    description = models.TextField(blank=True, null=True, verbose_name='描述')
    icon = models.CharField(max_length=50, blank=True, null=True, verbose_name='图标')
    color = models.CharField(max_length=20, blank=True, null=True, verbose_name='颜色')
    parent = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='children',
        verbose_name='父分类'
    )
    order = models.PositiveIntegerField(default=0, verbose_name='排序')
    is_active = models.BooleanField(default=True, verbose_name='是否激活')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')
    
    class Meta:
        verbose_name = '分类'
        verbose_name_plural = '分类'
        ordering = ['order', 'name']
        indexes = [
            models.Index(fields=['parent', 'is_active']),
            models.Index(fields=['slug']),
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
    
    @property
    def full_name(self):
        """获取完整名称，包含父分类"""
        if self.parent:
            return f"{self.parent.name} / {self.name}"
        return self.name
