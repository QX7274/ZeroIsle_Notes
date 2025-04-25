"""
语言模型
"""

from django.db import models

class Language(models.Model):
    """
    语言模型
    存储支持的语言
    """
    code = models.CharField(max_length=10, unique=True, verbose_name='代码')
    name = models.CharField(max_length=50, verbose_name='名称')
    native_name = models.CharField(max_length=50, verbose_name='本地名称')
    is_active = models.BooleanField(default=True, verbose_name='是否激活')
    
    class Meta:
        verbose_name = '语言'
        verbose_name_plural = '语言'
        ordering = ['name']
    
    def __str__(self):
        return f"{self.name} ({self.code})"
