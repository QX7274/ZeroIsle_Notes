"""
提醒模块MongoDB文档模型
使用MongoEngine ODM定义MongoDB文档模型
"""

from mongoengine import Document, StringField, DateTimeField, BooleanField, IntField, FloatField
from mongoengine import UUIDField, ReferenceField, ListField, DictField, URLField, EmbeddedDocument, EmbeddedDocumentField
from django.utils import timezone
import uuid
from users.mongodb_models import User
from notes.mongodb_models import Note

class Reminder(Document):
    """
    提醒文档模型
    """
    PRIORITY_CHOICES = (
        ('low', '低'),
        ('medium', '中'),
        ('high', '高'),
    )

    FREQUENCY_CHOICES = (
        ('once', '一次'),
        ('daily', '每天'),
        ('weekly', '每周'),
        ('monthly', '每月'),
        ('yearly', '每年'),
    )
    
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4(), verbose_name='提醒ID')
    user = ReferenceField(User, required=True, verbose_name='用户')
    title = StringField(max_length=200, required=True, verbose_name='标题')
    description = StringField(verbose_name='描述')
    due_date = DateTimeField(required=True, verbose_name='到期时间')
    priority = StringField(max_length=10, choices=PRIORITY_CHOICES, default='medium', verbose_name='优先级')
    frequency = StringField(max_length=10, choices=FREQUENCY_CHOICES, default='once', verbose_name='频率')
    is_completed = BooleanField(default=False, verbose_name='是否完成')
    is_enabled = BooleanField(default=True, verbose_name='是否启用')
    note = ReferenceField(Note, verbose_name='关联笔记')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')
    completed_at = DateTimeField(verbose_name='完成时间')
    
    meta = {
        'collection': 'reminders',
        'indexes': [
            {'fields': ['user']},
            {'fields': ['due_date']},
            {'fields': ['is_completed']},
            {'fields': ['is_enabled']},
            {'fields': ['priority']},
            {'fields': ['created_at']}
        ],
        'ordering': ['due_date', '-priority']
    }
    
    def __str__(self):
        return self.title
    
    def save(self, *args, **kwargs):
        """保存前更新更新时间"""
        self.updated_at = timezone.now()
        return super().save(*args, **kwargs)
    
    @property
    def is_overdue(self):
        """是否已过期"""
        return self.due_date < timezone.now() and not self.is_completed
    
    def complete(self):
        """完成提醒"""
        self.is_completed = True
        self.completed_at = timezone.now()
        self.save()
    
    def get_next_occurrence(self):
        """获取下一次提醒时间"""
        if self.is_completed or not self.is_enabled:
            return None

        if self.frequency == 'once':
            return self.due_date

        now = timezone.now()
        if self.due_date > now:
            return self.due_date

        # 计算下一次提醒时间
        if self.frequency == 'daily':
            days = 1
        elif self.frequency == 'weekly':
            days = 7
        elif self.frequency == 'monthly':
            days = 30
        elif self.frequency == 'yearly':
            days = 365
        else:
            return None

        # 计算从原始到期日到现在经过了多少个周期
        delta = now - self.due_date
        cycles = delta.days // days + 1

        # 计算下一次提醒时间
        from datetime import timedelta
        next_date = self.due_date + timedelta(days=cycles * days)

        return next_date

class ReminderNotification(Document):
    """
    提醒通知文档模型
    """
    STATUS_CHOICES = (
        ('pending', '待发送'),
        ('sent', '已发送'),
        ('failed', '发送失败'),
    )
    
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4(), verbose_name='通知ID')
    reminder = ReferenceField(Reminder, required=True, verbose_name='提醒')
    scheduled_time = DateTimeField(required=True, verbose_name='计划发送时间')
    status = StringField(max_length=10, choices=STATUS_CHOICES, default='pending', verbose_name='状态')
    sent_time = DateTimeField(verbose_name='发送时间')
    error_message = StringField(verbose_name='错误信息')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')
    
    meta = {
        'collection': 'reminder_notifications',
        'indexes': [
            {'fields': ['reminder']},
            {'fields': ['scheduled_time']},
            {'fields': ['status']},
            {'fields': ['created_at']}
        ],
        'ordering': ['scheduled_time']
    }
    
    def __str__(self):
        return f"{self.reminder.title} - {self.status}"
    
    def save(self, *args, **kwargs):
        """保存前更新更新时间"""
        self.updated_at = timezone.now()
        return super().save(*args, **kwargs)
