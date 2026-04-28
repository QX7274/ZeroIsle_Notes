"""
标签模型
"""

import uuid
from django.utils import timezone
from mongoengine import Document, StringField, DateTimeField, BooleanField
from mongoengine import UUIDField, ReferenceField
from users.mongodb_models import User
from .category import Category

class Tag(Document):
    """
    标签文档模型
    """
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4(), verbose_name='标签ID')
    user = ReferenceField(User, required=True, verbose_name='用户')
    name = StringField(max_length=50, required=True, verbose_name='标签名称')
    category = ReferenceField(Category, verbose_name='分类')
    color = StringField(max_length=20, default='#2196F3', verbose_name='标签颜色')
    is_deleted = BooleanField(default=False, verbose_name='是否删除')
    deleted_at = DateTimeField(verbose_name='删除时间')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')

    # MongoDB Realm相关字段
    realm_id = StringField(max_length=100, sparse=True, verbose_name='Realm ID')
    realm_partition = StringField(max_length=100, sparse=True, verbose_name='Realm Partition')
    realm_sync_status = StringField(max_length=20, choices=('pending', 'synced', 'error'), default='pending', verbose_name='Realm同步状态')
    realm_last_sync_time = DateTimeField(verbose_name='最后同步时间')
    realm_error_message = StringField(verbose_name='同步错误信息')

    meta = {
        'collection': 'tags',
        'indexes': [
            {'fields': ['user']},
            {'fields': ['is_deleted']},
            {'fields': ['user', 'name'], 'unique': True}
        ],
        'ordering': ['name']
    }

    def __str__(self):
        return f"{self.name} ({self.id})"
