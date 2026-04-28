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
    笔记附件文档模型（优化版）
    - 使用GridFS (FileField) 存储文件
    - 支持软删除
    """
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4(), verbose_name='附件ID')
    note = ReferenceField('Note', required=True, verbose_name='笔记')
    user = ReferenceField(User, required=True, verbose_name='用户')

    # 文件内容（使用GridFS）
    file = FileField(verbose_name='文件内容')

    # 元数据
    file_name = StringField(max_length=255, required=True, verbose_name='文件名')
    file_type = StringField(max_length=100, verbose_name='文件类型')
    file_size = IntField(verbose_name='文件大小(字节)')
    thumbnail_path = StringField(verbose_name='缩略图路径') # 缩略图生成后回写
    storage_key = StringField(verbose_name='对象存储键') # 对象存储启用时回写


    # 软删除字段
    is_deleted = BooleanField(default=False, verbose_name='是否删除')
    deleted_at = DateTimeField(verbose_name='删除时间')
    deleted_by = ReferenceField(User, verbose_name='删除者')

    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')

    meta = {
        'collection': 'note_attachments',
        'indexes': [
            {'fields': ['note', 'is_deleted', 'created_at']}, # 复合索引，优化查询
            {'fields': ['user', 'is_deleted']},
            {'fields': ['file_type', 'is_deleted']},
            {'fields': ['created_at']}
        ],
        'ordering': ['-created_at']
    }

    def __str__(self):
        return f"{self.file_name} ({self.id})"

    def save(self, *args, **kwargs):
        """Saves the attachment and updates the updated_at timestamp."""
        self.updated_at = timezone.now()
        return super().save(*args, **kwargs)

    def soft_delete(self, user):
        """
        Soft deletes the attachment.

        Args:
            user: The user performing the delete action.
        """
        self.is_deleted = True
        self.deleted_at = timezone.now()
        self.deleted_by = user
        self.save()

    def undelete(self):
        """
        Restores a soft-deleted attachment.
        """
        self.is_deleted = False
        self.deleted_at = None
        self.deleted_by = None
        self.save()
