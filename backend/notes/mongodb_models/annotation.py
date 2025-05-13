"""
PDF注释模型
"""

import uuid
from django.utils import timezone
from mongoengine import Document, UUIDField, ReferenceField, StringField, IntField, DictField, ListField, BooleanField, DateTimeField
from users.mongodb_models import User

class Annotation(Document):
    """
    PDF注释文档模型
    存储PDF文档的注释信息
    """
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4(), verbose_name='注释ID')
    note = ReferenceField('Note', required=True, verbose_name='笔记')
    user = ReferenceField(User, required=True, verbose_name='用户')
    page = IntField(required=True, verbose_name='页码')
    type = StringField(max_length=20, choices=('text', 'drawing', 'highlight', 'shape'), required=True, verbose_name='注释类型')
    content = StringField(verbose_name='文本内容')
    position = DictField(verbose_name='位置信息')
    path_data = DictField(verbose_name='路径数据')
    color = StringField(max_length=20, verbose_name='颜色')
    stroke_width = IntField(verbose_name='线条宽度')
    is_deleted = BooleanField(default=False, verbose_name='是否删除')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')

    meta = {
        'collection': 'annotations',
        'indexes': [
            'note',
            'user',
            'page',
            'type',
            'created_at'
        ]
    }

    def __str__(self):
        return f"Annotation {self.id} for Note {self.note.id} Page {self.page}"
