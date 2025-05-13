"""
Whisper训练数据模型
"""

import uuid
from django.utils import timezone
from mongoengine import Document, StringField, DateTimeField, BooleanField
from mongoengine import UUIDField, ReferenceField, FileField
from users.mongodb_models import User

class WhisperTrainingData(Document):
    """
    Whisper训练数据文档模型
    """
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4(), verbose_name='训练数据ID')
    user = ReferenceField(User, required=True, verbose_name='用户')
    audio = FileField(required=True, verbose_name='音频')
    text = StringField(required=True, verbose_name='文本')
    language = StringField(max_length=50, verbose_name='语言')
    is_verified = BooleanField(default=False, verbose_name='是否验证')
    verified_by = ReferenceField(User, verbose_name='验证人')
    verified_at = DateTimeField(verbose_name='验证时间')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')

    meta = {
        'collection': 'whisper_training_data',
        'indexes': [
            {'fields': ['user']},
            {'fields': ['language']},
            {'fields': ['is_verified']},
            {'fields': ['created_at']}
        ],
        'ordering': ['-created_at']
    }

    def __str__(self):
        return f"Whisper Training Data {self.id}"
