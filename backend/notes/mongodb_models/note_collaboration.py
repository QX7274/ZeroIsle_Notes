"""
笔记协作模型
"""

import uuid
from django.utils import timezone
from mongoengine import Document, StringField, DateTimeField, BooleanField
from mongoengine import UUIDField, ReferenceField
from users.mongodb_models import User

class NoteCollaboration(Document):
    """
    笔记协作文档模型
    """
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4(), verbose_name='协作ID')
    note = ReferenceField('Note', required=True, verbose_name='笔记')
    user = ReferenceField(User, required=True, verbose_name='协作用户')
    created_by = ReferenceField(User, required=True, verbose_name='创建者')
    permission = StringField(max_length=20, choices=('read', 'write', 'admin'), default='read', verbose_name='权限')
    is_active = BooleanField(default=True, verbose_name='是否激活')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')

    meta = {
        'collection': 'note_collaborations',
        'indexes': [
            {'fields': ['note']},
            {'fields': ['user']},
            {'fields': ['created_by']},
            {'fields': ['is_active']},
            {'fields': ['created_at']}
        ],
        'ordering': ['-created_at']
    }

    def __str__(self):
        return f"Collaboration on {self.note.title} for {self.user.username} ({self.id})"
