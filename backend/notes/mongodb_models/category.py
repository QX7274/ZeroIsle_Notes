"""
分类模型
"""

import uuid
from django.utils import timezone
from mongoengine import Document, StringField, DateTimeField, BooleanField
from mongoengine import UUIDField, ReferenceField
from users.mongodb_models import User

class Category(Document):
    """
    分类文档模型
    """
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4(), verbose_name='分类ID')
    user = ReferenceField(User, required=True, verbose_name='用户')
    name = StringField(max_length=100, required=True, verbose_name='分类名称')
    description = StringField(max_length=500, verbose_name='分类描述')
    color = StringField(max_length=20, default='#2196F3', verbose_name='分类颜色')
    icon = StringField(max_length=50, verbose_name='分类图标')
    parent = ReferenceField('self', verbose_name='父分类')
    is_deleted = BooleanField(default=False, verbose_name='是否删除')
    deleted_at = DateTimeField(verbose_name='删除时间')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')

    meta = {
        'collection': 'categories',
        'indexes': [
            {'fields': ['user']},
            {'fields': ['parent']},
            {'fields': ['is_deleted']},
            {'fields': ['user', 'name'], 'unique': True}
        ],
        'ordering': ['name']
    }

    def __str__(self):
        return f"{self.name} ({self.id})"
