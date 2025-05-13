"""
笔记备份模型
"""

import uuid
from django.utils import timezone
from mongoengine import Document, StringField, DateTimeField, BooleanField, IntField
from mongoengine import UUIDField, ReferenceField, FileField
from users.mongodb_models import User

class NoteBackup(Document):
    """
    笔记备份文档模型
    """
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4(), verbose_name='备份ID')
    user = ReferenceField(User, required=True, verbose_name='用户')
    backup_file = FileField(verbose_name='备份文件')
    file_name = StringField(max_length=255, required=True, verbose_name='文件名')
    file_size = IntField(verbose_name='文件大小(字节)')
    notes_count = IntField(default=0, verbose_name='笔记数量')
    backup_type = StringField(max_length=20, choices=('manual', 'auto'), default='manual', verbose_name='备份类型')
    description = StringField(max_length=500, verbose_name='备份描述')
    is_deleted = BooleanField(default=False, verbose_name='是否删除')
    deleted_at = DateTimeField(verbose_name='删除时间')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')

    meta = {
        'collection': 'note_backups',
        'indexes': [
            {'fields': ['user']},
            {'fields': ['backup_type']},
            {'fields': ['is_deleted']},
            {'fields': ['created_at']}
        ],
        'ordering': ['-created_at']
    }

    def __str__(self):
        return f"{self.file_name} ({self.id})"
