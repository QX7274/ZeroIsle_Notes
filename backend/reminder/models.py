"""
提醒模块模型
"""

import uuid
from django.db import models
from django.utils import timezone
from django.contrib.auth import get_user_model

User = get_user_model()


class Reminder(models.Model):
    """
    提醒模型
    存储用户的提醒信息
    """
    REMINDER_STATUS_CHOICES = (
        ('pending', '待提醒'),
        ('completed', '已完成'),
        ('cancelled', '已取消'),
    )
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='reminders', verbose_name="用户")
    note = models.ForeignKey('notes.Note', on_delete=models.CASCADE, related_name='note_reminders', null=True, blank=True, verbose_name="关联笔记")
    title = models.CharField(max_length=255, verbose_name="标题")
    content = models.TextField(blank=True, null=True, verbose_name="内容")
    reminder_time = models.DateTimeField(verbose_name="提醒时间")
    status = models.CharField(max_length=10, choices=REMINDER_STATUS_CHOICES, default='pending', verbose_name="状态")
    created_at = models.DateTimeField(default=timezone.now, verbose_name="创建时间")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="更新时间")
    
    class Meta:
        verbose_name = "提醒"
        verbose_name_plural = "提醒"
        ordering = ['reminder_time']
    
    def __str__(self):
        return f"{self.user.username} - {self.title}"
    
    @property
    def is_overdue(self):
        """
        判断是否已过期
        """
        return self.reminder_time < timezone.now() and self.status == 'pending'


class ReminderNotification(models.Model):
    """
    提醒通知模型
    存储提醒的通知信息
    """
    NOTIFICATION_STATUS_CHOICES = (
        ('pending', '待发送'),
        ('sent', '已发送'),
        ('failed', '发送失败'),
    )
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    reminder = models.ForeignKey(Reminder, on_delete=models.CASCADE, related_name='notifications', verbose_name="提醒")
    status = models.CharField(max_length=10, choices=NOTIFICATION_STATUS_CHOICES, default='pending', verbose_name="状态")
    sent_at = models.DateTimeField(null=True, blank=True, verbose_name="发送时间")
    error_message = models.TextField(blank=True, null=True, verbose_name="错误信息")
    created_at = models.DateTimeField(default=timezone.now, verbose_name="创建时间")
    
    class Meta:
        verbose_name = "提醒通知"
        verbose_name_plural = "提醒通知"
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.reminder.title} - {self.get_status_display()}"
