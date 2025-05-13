"""
笔记提醒模型
"""

import uuid
from django.utils import timezone
from mongoengine import Document, StringField, DateTimeField, BooleanField
from mongoengine import UUIDField, ReferenceField
from users.mongodb_models import User

class NoteReminder(Document):
    """
    笔记提醒文档模型
    """
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4(), verbose_name='提醒ID')
    note = ReferenceField('Note', required=True, verbose_name='笔记')
    user = ReferenceField(User, required=True, verbose_name='用户')
    title = StringField(max_length=255, required=True, verbose_name='提醒标题')
    content = StringField(verbose_name='提醒内容')
    reminder_time = DateTimeField(required=True, verbose_name='提醒时间')
    reminder_type = StringField(max_length=20, choices=('once', 'daily', 'weekly', 'monthly', 'yearly'), default='once', verbose_name='提醒类型')
    status = StringField(max_length=20, choices=('pending', 'completed', 'cancelled'), default='pending', verbose_name='状态')
    is_read = BooleanField(default=False, verbose_name='是否已读')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')

    meta = {
        'collection': 'note_reminders',
        'indexes': [
            {'fields': ['note']},
            {'fields': ['user']},
            {'fields': ['reminder_time']},
            {'fields': ['status']},
            {'fields': ['is_read']},
            {'fields': ['created_at']}
        ],
        'ordering': ['-reminder_time']
    }

    def __str__(self):
        return f"{self.title} ({self.id})"
