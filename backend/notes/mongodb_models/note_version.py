"""
笔记版本模型
"""

import uuid
from django.utils import timezone
from mongoengine import Document, StringField, DateTimeField, BooleanField, IntField
from mongoengine import UUIDField, ReferenceField
from users.mongodb_models import User

class NoteVersion(Document):
    """
    笔记版本文档模型
    """
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4(), verbose_name='版本ID')
    note = ReferenceField('Note', required=True, verbose_name='笔记')
    title = StringField(max_length=255, required=True, verbose_name='标题')
    content = StringField(required=True, verbose_name='内容')
    version_number = IntField(required=True, verbose_name='版本号')
    created_by = ReferenceField(User, required=True, verbose_name='创建者')
    comment = StringField(max_length=255, verbose_name='版本说明')
    is_auto_save = BooleanField(default=False, verbose_name='是否自动保存')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')

    meta = {
        'collection': 'note_versions',
        'indexes': [
            {'fields': ['note']},
            {'fields': ['created_by']},
            {'fields': ['version_number']},
            {'fields': ['created_at']}
        ],
        'ordering': ['-created_at']
    }

    def __str__(self):
        return f"Version {self.version_number} of {self.note.title} ({self.id})"
