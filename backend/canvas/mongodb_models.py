"""
Canvas模块MongoDB模型
"""

import uuid
from django.utils import timezone
from mongoengine import (
    Document, EmbeddedDocument, StringField, DateTimeField,
    UUIDField, ListField, EmbeddedDocumentField, BooleanField,
    FloatField, IntField, DictField, ReferenceField, PointField
)
from users.mongodb_models import User


class StrokePoint(EmbeddedDocument):
    """笔触点模型"""
    x = FloatField(required=True)
    y = FloatField(required=True)
    pressure = FloatField(default=0.5)  # 压力感应


class CanvasElement(Document):
    """
    画布元素文档模型
    """
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4(), verbose_name='元素ID')
    canvas_id = UUIDField(required=True, verbose_name='画布ID')
    type = StringField(required=True, verbose_name='元素类型')
    content = StringField(verbose_name='内容')  # 用于文本等简单内容
    path_data = ListField(EmbeddedDocumentField(StrokePoint), verbose_name='路径数据')  # 用于笔触等复杂路径
    position_x = FloatField(required=True, verbose_name='X坐标')
    position_y = FloatField(required=True, verbose_name='Y坐标')
    width = FloatField(required=True, verbose_name='宽度')
    height = FloatField(required=True, verbose_name='高度')
    style = DictField(verbose_name='样式')
    properties = DictField(verbose_name='属性')
    is_deleted = BooleanField(default=False, verbose_name='是否删除')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')

    meta = {
        'collection': 'canvas_elements',
        'indexes': [
            'canvas_id',
            'type',
            'is_deleted'
        ],
        'ordering': ['created_at']
    }

    def __str__(self):
        return f"{self.type} - {self.id}"

    def save(self, *args, **kwargs):
        """保存前更新更新时间"""
        self.updated_at = timezone.now()
        return super().save(*args, **kwargs)


class CanvasConnection(Document):
    """
    画布连接文档模型
    """
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4(), verbose_name='连接ID')
    canvas_id = UUIDField(required=True, verbose_name='画布ID')
    source_id = UUIDField(required=True, verbose_name='源元素ID')
    target_id = UUIDField(required=True, verbose_name='目标元素ID')
    type = StringField(required=True, verbose_name='连接类型')
    label = StringField(verbose_name='标签')
    style = DictField(verbose_name='样式')
    properties = DictField(verbose_name='属性')
    is_deleted = BooleanField(default=False, verbose_name='是否删除')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')

    meta = {
        'collection': 'canvas_connections',
        'indexes': [
            'canvas_id',
            'source_id',
            'target_id',
            'is_deleted'
        ],
        'ordering': ['created_at']
    }

    def __str__(self):
        return f"{self.type} - {self.id}"

    def save(self, *args, **kwargs):
        """保存前更新更新时间"""
        self.updated_at = timezone.now()
        return super().save(*args, **kwargs)


class Canvas(Document):
    """
    画布文档模型
    """
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4(), verbose_name='画布ID')
    user = ReferenceField(User, required=True, verbose_name='用户')
    title = StringField(required=True, verbose_name='标题')
    description = StringField(verbose_name='描述')
    type = StringField(required=True, default='freeform', verbose_name='类型')
    thumbnail = StringField(verbose_name='缩略图')
    width = FloatField(default=3000, verbose_name='宽度')
    height = FloatField(default=3000, verbose_name='高度')
    scale = FloatField(default=1.0, verbose_name='缩放')
    position_x = FloatField(default=0, verbose_name='X坐标')
    position_y = FloatField(default=0, verbose_name='Y坐标')
    background_color = StringField(default='#ffffff', verbose_name='背景颜色')
    is_deleted = BooleanField(default=False, verbose_name='是否删除')
    is_template = BooleanField(default=False, verbose_name='是否模板')
    is_public = BooleanField(default=False, verbose_name='是否公开')
    tags = ListField(StringField(), verbose_name='标签')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')

    meta = {
        'collection': 'canvases',
        'indexes': [
            'user',
            'type',
            'is_deleted',
            'is_template',
            'is_public',
            'tags'
        ],
        'ordering': ['-updated_at']
    }

    def __str__(self):
        return f"{self.title} - {self.id}"

    def save(self, *args, **kwargs):
        """保存前更新更新时间"""
        self.updated_at = timezone.now()
        return super().save(*args, **kwargs)
