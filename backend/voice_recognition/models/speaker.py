"""
说话人模型
"""

from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()

class Speaker(models.Model):
    """
    说话人模型
    存储说话人信息
    """
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='speakers',
        verbose_name='用户'
    )
    name = models.CharField(max_length=100, verbose_name='名称')
    description = models.TextField(blank=True, null=True, verbose_name='描述')
    voice_profile = models.JSONField(default=dict, blank=True, verbose_name='声音特征')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')
    
    class Meta:
        verbose_name = '说话人'
        verbose_name_plural = '说话人'
        ordering = ['name']
        unique_together = ('user', 'name')
    
    def __str__(self):
        return self.name
