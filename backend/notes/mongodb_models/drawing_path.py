"""
绘图路径模型
"""

import uuid
from django.utils import timezone
from mongoengine import Document, StringField, DateTimeField, BooleanField
from mongoengine import UUIDField, ReferenceField, DictField, IntField
from users.mongodb_models import User


class DrawingPath(Document):
    """
    绘图路径文档模型
    存储用户的绘图路径数据
    """
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4(), verbose_name='路径ID')
    user = ReferenceField(User, required=True, verbose_name='用户')
    note = ReferenceField('Note', required=False, verbose_name='笔记')
    canvas_id = StringField(max_length=100, verbose_name='画布ID')
    tool_type = StringField(max_length=20, choices=(
        'shape', 'text', 'image'
    ), required=True, verbose_name='工具类型')
    shape_type = StringField(max_length=20, choices=(
        'line', 'rectangle', 'circle', 'triangle', 'arrow', 'diamond', 'pentagon', 'hexagon', 'star', 'cloud'
    ), verbose_name='形状类型')
    path_data = DictField(required=True, verbose_name='路径数据')
    color = StringField(max_length=20, verbose_name='颜色')
    stroke_width = IntField(verbose_name='线条宽度')
    is_deleted = BooleanField(default=False, verbose_name='是否删除')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')

    meta = {
        'collection': 'drawing_paths',
        'indexes': [
            {'fields': ['user']},
            {'fields': ['note']},
            {'fields': ['canvas_id']},
            {'fields': ['tool_type']},
            {'fields': ['created_at']}
        ],
        'ordering': ['-created_at']
    }

    def __str__(self):
        return f"DrawingPath {self.id} by {self.user.username}"

    def save(self, *args, **kwargs):
        """保存前更新更新时间"""
        self.updated_at = timezone.now()
        return super().save(*args, **kwargs)

    def delete(self):
        """软删除"""
        self.is_deleted = True
        self.save()

    def hard_delete(self):
        """硬删除"""
        super().delete()



