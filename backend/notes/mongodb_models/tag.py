"""
标签模型
"""

import uuid
from django.utils import timezone
from mongoengine import Document, StringField, DateTimeField
from mongoengine import UUIDField, ReferenceField
from users.mongodb_models import User

class Tag(Document):
    """
    标签文档模型
    """
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4(), verbose_name='标签ID')
    user = ReferenceField(User, required=True, verbose_name='用户')
    name = StringField(max_length=50, required=True, verbose_name='标签名称')
    color = StringField(max_length=20, default='#2196F3', verbose_name='标签颜色')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')

    meta = {
        'collection': 'tags',
        'indexes': [
            {'fields': ['user']},
            {'fields': ['user', 'name'], 'unique': True}
        ],
        'ordering': ['name']
    }

    def __str__(self):
        return f"{self.name} ({self.id})"
