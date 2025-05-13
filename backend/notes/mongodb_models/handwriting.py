"""
手写笔记模型
"""

import uuid
from django.utils import timezone
from mongoengine import Document, StringField, DateTimeField, BooleanField, IntField
from mongoengine import UUIDField, ReferenceField, ListField, FileField
from users.mongodb_models import User
from .category import Category
from .tag import Tag

class Handwriting(Document):
    """
    手写笔记文档模型
    """
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4(), verbose_name='手写笔记ID')
    user = ReferenceField(User, required=True, verbose_name='用户')
    title = StringField(max_length=255, required=True, verbose_name='标题')
    image = FileField(required=True, verbose_name='图片')
    thumbnail = FileField(verbose_name='缩略图')
    text_content = StringField(verbose_name='文本内容')
    category = ReferenceField(Category, verbose_name='分类')
    tags = ListField(ReferenceField(Tag), verbose_name='标签')
    is_favorite = BooleanField(default=False, verbose_name='是否收藏')
    is_public = BooleanField(default=False, verbose_name='是否公开')
    view_count = IntField(default=0, verbose_name='查看次数')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')

    meta = {
        'collection': 'handwritings',
        'indexes': [
            {'fields': ['user']},
            {'fields': ['category']},
            {'fields': ['is_favorite']},
            {'fields': ['is_public']},
            {'fields': ['created_at']}
        ],
        'ordering': ['-created_at']
    }

    def __str__(self):
        return f"{self.title} ({self.id})"
