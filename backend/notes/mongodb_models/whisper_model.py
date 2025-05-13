"""
Whisper模型
"""

import uuid
from django.utils import timezone
from mongoengine import Document, StringField, DateTimeField, BooleanField
from mongoengine import UUIDField, FileField

class WhisperModel(Document):
    """
    Whisper模型文档模型
    """
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4(), verbose_name='模型ID')
    name = StringField(max_length=100, required=True, verbose_name='模型名称')
    description = StringField(max_length=500, verbose_name='模型描述')
    model_file = FileField(verbose_name='模型文件')
    model_type = StringField(max_length=20, choices=('tiny', 'base', 'small', 'medium', 'large'), default='base', verbose_name='模型类型')
    language = StringField(max_length=50, verbose_name='语言')
    version = StringField(max_length=20, verbose_name='版本')
    accuracy = StringField(max_length=20, verbose_name='准确率')
    is_active = BooleanField(default=True, verbose_name='是否激活')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')

    meta = {
        'collection': 'whisper_models',
        'indexes': [
            {'fields': ['model_type']},
            {'fields': ['language']},
            {'fields': ['is_active']},
            {'fields': ['created_at']}
        ],
        'ordering': ['-created_at']
    }

    def __str__(self):
        return f"{self.name} ({self.id})"
