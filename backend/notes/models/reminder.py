"""
笔记提醒模型
用于实现笔记的提醒功能
"""

from django.db import models
from django.utils import timezone
from django.contrib.auth import get_user_model

User = get_user_model()


class NoteReminder(models.Model):
    """
    笔记提醒模型
    存储笔记的提醒信息
    """
    REMINDER_TYPE_CHOICES = (
        ('once', '一次性'),
        ('daily', '每天'),
        ('weekly', '每周'),
        ('monthly', '每月'),
        ('yearly', '每年'),
    )

    REMINDER_STATUS_CHOICES = (
        ('pending', '待提醒'),
        ('completed', '已完成'),
        ('cancelled', '已取消'),
    )

    note = models.ForeignKey('notes.Note', on_delete=models.CASCADE, related_name='note_reminders', verbose_name="笔记")
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='note_reminders', verbose_name="用户")
    title = models.CharField(max_length=255, verbose_name="标题")
    content = models.TextField(blank=True, null=True, verbose_name="内容")
    reminder_time = models.DateTimeField(verbose_name="提醒时间")
    reminder_type = models.CharField(max_length=10, choices=REMINDER_TYPE_CHOICES, default='once', verbose_name="提醒类型")
    status = models.CharField(max_length=10, choices=REMINDER_STATUS_CHOICES, default='pending', verbose_name="状态")
    created_at = models.DateTimeField(default=timezone.now, verbose_name="创建时间")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="更新时间")
    is_read = models.BooleanField(default=False, verbose_name="是否已读")

    class Meta:
        verbose_name = "笔记提醒"
        verbose_name_plural = "笔记提醒"
        ordering = ['reminder_time']

    def __str__(self):
        return f"{self.note.title} - {self.title}"

    @property
    def is_overdue(self):
        """
        判断是否已过期
        """
        return self.reminder_time < timezone.now() and self.status == 'pending'

    def mark_as_completed(self):
        """
        标记为已完成
        """
        self.status = 'completed'
        self.save(update_fields=['status'])

    def mark_as_cancelled(self):
        """
        标记为已取消
        """
        self.status = 'cancelled'
        self.save(update_fields=['status'])

    def mark_as_read(self):
        """
        标记为已读
        """
        self.is_read = True
        self.save(update_fields=['is_read'])
