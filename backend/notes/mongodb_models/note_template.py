"""
笔记模板模型
"""

import uuid
from django.utils import timezone
from mongoengine import Document, StringField, DateTimeField, BooleanField, IntField
from mongoengine import UUIDField, ReferenceField, ListField, FileField
from users.mongodb_models import User
from .category import Category
from .tag import Tag

class NoteTemplate(Document):
    """
    笔记模板文档模型
    """
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4(), verbose_name='模板ID')
    title = StringField(max_length=255, required=True, verbose_name='标题')
    content = StringField(required=True, verbose_name='内容')
    description = StringField(verbose_name='描述')
    template_type = StringField(max_length=20, choices=('note', 'daily', 'weekly', 'monthly', 'project', 'custom'), default='note', verbose_name='模板类型')
    category = ReferenceField(Category, verbose_name='分类')
    tags = ListField(ReferenceField(Tag), verbose_name='标签')
    thumbnail = FileField(verbose_name='缩略图')
    created_by = ReferenceField(User, required=True, verbose_name='创建者')
    is_public = BooleanField(default=False, verbose_name='是否公开')
    use_count = IntField(default=0, verbose_name='使用次数')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')

    meta = {
        'collection': 'note_templates',
        'indexes': [
            {'fields': ['created_by']},
            {'fields': ['template_type']},
            {'fields': ['is_public']},
            {'fields': ['created_at']}
        ],
        'ordering': ['-created_at']
    }

    def __str__(self):
        return f"{self.title} ({self.id})"
