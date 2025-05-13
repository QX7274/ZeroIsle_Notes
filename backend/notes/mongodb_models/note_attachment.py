"""
笔记附件模型
"""

import uuid
from django.utils import timezone
from mongoengine import Document, StringField, DateTimeField, BooleanField, IntField
from mongoengine import UUIDField, ReferenceField, FileField
from users.mongodb_models import User

class NoteAttachment(Document):
    """
    笔记附件文档模型
    """
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4(), verbose_name='附件ID')
    note = ReferenceField('Note', required=True, verbose_name='笔记')
    user = ReferenceField(User, required=True, verbose_name='用户')
    file_name = StringField(max_length=255, required=True, verbose_name='文件名')
    file_path = StringField(required=True, verbose_name='文件路径')
    file_type = StringField(max_length=100, verbose_name='文件类型')
    file_size = IntField(verbose_name='文件大小(字节)')
    thumbnail_path = StringField(verbose_name='缩略图路径')
    is_deleted = BooleanField(default=False, verbose_name='是否删除')
    deleted_at = DateTimeField(verbose_name='删除时间')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')

    meta = {
        'collection': 'note_attachments',
        'indexes': [
            {'fields': ['note']},
            {'fields': ['user']},
            {'fields': ['file_type']},
            {'fields': ['is_deleted']},
            {'fields': ['created_at']}
        ],
        'ordering': ['-created_at']
    }

    def __str__(self):
        return f"{self.file_name} ({self.id})"
