"""
笔记模型
"""

import uuid
from django.utils import timezone
from mongoengine import Document, StringField, DateTimeField, BooleanField, IntField
from mongoengine import UUIDField, ReferenceField, ListField
from users.mongodb_models import User
from .category import Category
from .tag import Tag

class Note(Document):
    """
    笔记文档模型
    """
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4(), verbose_name='笔记ID')
    user = ReferenceField(User, required=True, verbose_name='用户')
    title = StringField(max_length=255, required=True, verbose_name='标题')
    content = StringField(required=True, verbose_name='内容')
    category = ReferenceField(Category, verbose_name='分类')
    tags = ListField(ReferenceField(Tag), verbose_name='标签')
    is_favorite = BooleanField(default=False, verbose_name='是否收藏')
    is_encrypted = BooleanField(default=False, verbose_name='是否加密')
    encryption_key = StringField(max_length=255, verbose_name='加密密钥')
    is_public = BooleanField(default=False, verbose_name='是否公开')
    is_deleted = BooleanField(default=False, verbose_name='是否删除')
    deleted_at = DateTimeField(verbose_name='删除时间')
    view_count = IntField(default=0, verbose_name='查看次数')
    last_viewed_at = DateTimeField(verbose_name='最后查看时间')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')

    # MongoDB Realm相关字段
    realm_id = StringField(max_length=100, sparse=True, verbose_name='Realm ID')
    realm_partition = StringField(max_length=100, sparse=True, verbose_name='Realm Partition')
    realm_sync_status = StringField(max_length=20, choices=('pending', 'synced', 'error'), default='pending', verbose_name='Realm同步状态')
    realm_last_sync_time = DateTimeField(verbose_name='最后同步时间')
    realm_error_message = StringField(verbose_name='同步错误信息')

    meta = {
        'collection': 'notes',
        'indexes': [
            {'fields': ['user']},
            {'fields': ['category']},
            {'fields': ['is_deleted']},
            {'fields': ['is_favorite']},
            {'fields': ['is_public']},
            {'fields': ['created_at']},
            {'fields': ['updated_at']},
            {'fields': ['realm_id'], 'sparse': True},
            {'fields': ['realm_partition'], 'sparse': True},
            {'fields': ['realm_sync_status']}
        ],
        'ordering': ['-updated_at']
    }

    def __str__(self):
        return f"{self.title} ({self.id})"
