"""提醒系统模型"""

from django.db import models
from django.utils.translation import gettext_lazy as _
from users.models import User
from notes.models import Note
import uuid
from django.contrib.auth import get_user_model
from django.utils import timezone

User = get_user_model()

class Reminder(models.Model):
    """提醒模型"""
    FREQUENCY_CHOICES = [
        ('once', _('Once')),
        ('daily', _('Daily')),
        ('weekly', _('Weekly')),
        ('monthly', _('Monthly')),
    ]
    
    STATUS_CHOICES = (
        ('pending', _('待处理')),
        ('completed', _('已完成')),
        ('cancelled', _('已取消')),
    )
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(_('title'), max_length=200)
    description = models.TextField(_('description'), blank=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='reminders')
    due_date = models.DateTimeField(_('due date'))
    frequency = models.CharField(_('frequency'), max_length=10, choices=FREQUENCY_CHOICES, default='once')
    status = models.CharField(_('状态'), max_length=10, choices=STATUS_CHOICES, default='pending')
    is_enabled = models.BooleanField(default=True, verbose_name='是否启用')
    is_completed = models.BooleanField(_('is completed'), default=False)
    created_at = models.DateTimeField(_('created at'), auto_now_add=True)
    updated_at = models.DateTimeField(_('updated at'), auto_now=True)
    note = models.ForeignKey(Note, on_delete=models.SET_NULL, related_name='reminders', verbose_name=_('关联笔记'), null=True, blank=True)
    
    class Meta:
        ordering = ['due_date']
        verbose_name = _('reminder')
        verbose_name_plural = _('reminders')
    
    def __str__(self):
        return self.title


class ReminderNotification(models.Model):
    """提醒通知模型"""
    NOTIFICATION_TYPE_CHOICES = (
        ('email', _('邮件')),
        ('push', _('推送')),
        ('in_app', _('应用内')),
    )
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    reminder = models.ForeignKey(Reminder, on_delete=models.CASCADE, related_name='notifications', verbose_name='提醒')
    notification_type = models.CharField(_('通知类型'), max_length=10, choices=NOTIFICATION_TYPE_CHOICES)
    notification_time = models.DateTimeField(verbose_name='通知时间')
    is_sent = models.BooleanField(default=False, verbose_name='是否已发送')
    created_at = models.DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')
    
    class Meta:
        verbose_name = '提醒通知'
        verbose_name_plural = verbose_name
        ordering = ['notification_time']
    
    def __str__(self):
        return f"{self.reminder.title} - {self.get_notification_type_display()}"