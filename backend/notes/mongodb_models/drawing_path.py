"""
绘图路径模型
"""

import uuid
from django.utils import timezone
from mongoengine import Document, StringField, DateTimeField, BooleanField, IntField
from mongoengine import UUIDField, ReferenceField, DictField, ListField
from users.mongodb_models import User

class DrawingPath(Document):
    """
    绘图路径文档模型
    """
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4(), verbose_name='路径ID')
    note = ReferenceField('Note', required=True, verbose_name='笔记')
    user = ReferenceField(User, required=True, verbose_name='用户')
    path_data = ListField(DictField(), required=True, verbose_name='路径数据')
    stroke_color = StringField(max_length=20, default='#000000', verbose_name='线条颜色')
    stroke_width = IntField(default=2, verbose_name='线条宽度')
    is_deleted = BooleanField(default=False, verbose_name='是否删除')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')

    meta = {
        'collection': 'drawing_paths',
        'indexes': [
            {'fields': ['note']},
            {'fields': ['user']},
            {'fields': ['is_deleted']},
            {'fields': ['created_at']}
        ],
        'ordering': ['-created_at']
    }

    def __str__(self):
        return f"Drawing Path {self.id} for Note {self.note.id}"
