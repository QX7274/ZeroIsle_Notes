"""
提醒通知模型
"""

import uuid
from django.db import models
from django.utils.translation import gettext_lazy as _

class ReminderNotification(models.Model):
    """提醒通知模型"""
    STATUS_CHOICES = (
        ('pending', _('待发送')),
        ('sent', _('已发送')),
        ('failed', _('发送失败')),
    )
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    reminder = models.ForeignKey('reminder.Reminder', on_delete=models.CASCADE, related_name='notifications', verbose_name=_('提醒'))
    scheduled_time = models.DateTimeField(_('计划发送时间'))
    status = models.CharField(_('状态'), max_length=10, choices=STATUS_CHOICES, default='pending')
    sent_time = models.DateTimeField(_('发送时间'), null=True, blank=True)
    error_message = models.TextField(_('错误信息'), null=True, blank=True)
    created_at = models.DateTimeField(_('创建时间'), auto_now_add=True)
    updated_at = models.DateTimeField(_('更新时间'), auto_now=True)
    
    class Meta:
        verbose_name = _('提醒通知')
        verbose_name_plural = _('提醒通知')
        ordering = ['scheduled_time']
    
    def __str__(self):
        return f"{self.reminder.title} - {self.scheduled_time}"
