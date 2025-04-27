"""
笔记模板模型
用于实现笔记模板功能
"""

from django.db import models
from django.utils import timezone
from django.contrib.auth import get_user_model

User = get_user_model()


class NoteTemplate(models.Model):
    """
    笔记模板模型
    存储笔记模板信息
    """
    TEMPLATE_TYPE_CHOICES = (
        ('system', '系统模板'),
        ('user', '用户模板'),
    )
    
    title = models.CharField(max_length=255, verbose_name="标题")
    content = models.TextField(verbose_name="内容")
    description = models.TextField(blank=True, null=True, verbose_name="描述")
    template_type = models.CharField(max_length=10, choices=TEMPLATE_TYPE_CHOICES, default='user', verbose_name="模板类型")
    category = models.CharField(max_length=50, blank=True, null=True, verbose_name="分类")
    tags = models.CharField(max_length=255, blank=True, null=True, verbose_name="标签")
    thumbnail = models.ImageField(upload_to='templates/thumbnails/', blank=True, null=True, verbose_name="缩略图")
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='note_templates', verbose_name="创建者")
    created_at = models.DateTimeField(default=timezone.now, verbose_name="创建时间")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="更新时间")
    is_public = models.BooleanField(default=False, verbose_name="是否公开")
    use_count = models.PositiveIntegerField(default=0, verbose_name="使用次数")
    
    class Meta:
        verbose_name = "笔记模板"
        verbose_name_plural = "笔记模板"
        ordering = ['-created_at']
    
    def __str__(self):
        return self.title
    
    def increment_use_count(self):
        """
        增加使用次数
        """
        self.use_count += 1
        self.save(update_fields=['use_count'])
