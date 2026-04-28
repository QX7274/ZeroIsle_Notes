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
    笔记版本文档模型（优化版）
    - 统一并扩展字段以匹配视图逻辑
    - 支持软删除和版本恢复追踪
    """
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4(), verbose_name='版本ID')
    note = ReferenceField('Note', required=True, verbose_name='笔记')
    user = ReferenceField(User, required=True, verbose_name='创建者') # Renamed from created_by

    # 版本内容
    title = StringField(max_length=255, required=True, verbose_name='标题')
    content = StringField(required=True, verbose_name='内容')
    description = StringField(max_length=255, verbose_name='版本说明') # Renamed from comment

    # 版本元数据
    version_number = IntField(required=True, verbose_name='版本号')
    is_current = BooleanField(default=False, verbose_name='是否为当前版本')
    is_auto_save = BooleanField(default=False, verbose_name='是否自动保存')
    restored_from = ReferenceField('self', verbose_name='恢复自哪个版本')

    # 软删除字段
    is_deleted = BooleanField(default=False, verbose_name='是否删除')
    deleted_at = DateTimeField(verbose_name='删除时间')
    deleted_by = ReferenceField(User, verbose_name='删除者')

    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')

    meta = {
        'collection': 'note_versions',
        'indexes': [
            {'fields': ['note', 'is_deleted', '-version_number']}, # 复合索引，优化查询
            {'fields': ['note', 'is_current']}, # 快速找到当前版本
            {'fields': ['user', 'is_deleted']},
            {'fields': ['created_at']}
        ],
        'ordering': ['-version_number'] # 默认按版本号降序
    }

    def __str__(self):
        note_title = self.note.title if self.note else "Unknown Note"
        return f"Version {self.version_number} of {note_title} ({self.id})"

    def save(self, *args, **kwargs):
        """保存前更新更新时间"""
        self.updated_at = timezone.now()
        return super().save(*args, **kwargs)

    def soft_delete(self, user):
        """
        软删除版本

        Args:
            user: 执行删除操作的用户
        """
        self.is_deleted = True
        self.deleted_at = timezone.now()
        self.deleted_by = user
        self.save()

    def undelete(self):
        """
        撤销软删除
        """
        self.is_deleted = False
        self.deleted_at = None
        self.deleted_by = None
        self.save()
