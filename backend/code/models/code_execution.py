"""
代码执行模型
"""

import uuid
from django.db import models
from django.utils.translation import gettext_lazy as _
from django.contrib.auth import get_user_model

User = get_user_model()

class CodeExecution(models.Model):
    """代码执行记录模型"""
    STATUS_CHOICES = (
        ('pending', _('等待中')),
        ('running', _('运行中')),
        ('completed', _('已完成')),
        ('failed', _('失败')),
    )
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='code_executions', verbose_name=_('用户'))
    code = models.TextField(_('代码'))
    language = models.CharField(_('语言'), max_length=50)
    input_data = models.TextField(_('输入数据'), blank=True, null=True)
    output = models.TextField(_('输出'), blank=True, null=True)
    error = models.TextField(_('错误'), blank=True, null=True)
    execution_time = models.FloatField(_('执行时间(秒)'), default=0)
    memory_usage = models.FloatField(_('内存使用(MB)'), default=0)
    status = models.CharField(_('状态'), max_length=20, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(_('创建时间'), auto_now_add=True)
    updated_at = models.DateTimeField(_('更新时间'), auto_now=True)
    
    class Meta:
        verbose_name = _('代码执行')
        verbose_name_plural = _('代码执行')
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.language} - {self.created_at}"
