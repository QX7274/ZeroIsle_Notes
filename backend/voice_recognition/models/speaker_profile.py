"""
说话人档案模型
用于存储说话人的声纹特征和个人信息
"""

import uuid
import logging
from django.db import models
from django.utils import timezone
from mongoengine import Document, fields, EmbeddedDocument, EmbeddedDocumentField, ListField, DictField

logger = logging.getLogger('backend')


class SpeakerEmbedding(EmbeddedDocument):
    """说话人声纹嵌入向量"""
    embedding = fields.ListField(fields.FloatField(), required=True)
    created_at = fields.DateTimeField(default=timezone.now)
    source = fields.StringField()  # 来源，如 'meeting', 'note', 'call'
    audio_duration = fields.FloatField(default=0.0)  # 音频时长（秒）
    confidence = fields.FloatField(default=0.0)  # 置信度


class SpeakerProfile(Document):
    """说话人档案"""
    id = fields.UUIDField(primary_key=True, default=uuid.uuid4)
    user = fields.ReferenceField('User', required=True)
    name = fields.StringField(required=True)  # 说话人名称
    display_name = fields.StringField()  # 显示名称
    description = fields.StringField()  # 说话人描述
    avatar = fields.StringField()  # 头像URL
    
    # 声纹特征
    embeddings = fields.ListField(EmbeddedDocumentField(SpeakerEmbedding))
    
    # 元数据
    metadata = fields.DictField()  # 其他元数据
    
    # 统计信息
    recognition_count = fields.IntField(default=0)  # 识别次数
    total_speaking_time = fields.FloatField(default=0.0)  # 总发言时长（秒）
    
    # 时间戳
    created_at = fields.DateTimeField(default=timezone.now)
    updated_at = fields.DateTimeField(default=timezone.now)
    
    # 状态
    is_active = fields.BooleanField(default=True)
    
    meta = {
        'collection': 'speaker_profiles',
        'indexes': [
            'user',
            'name',
            'created_at'
        ]
    }
    
    def __str__(self):
        return f"{self.name} ({self.id})"
    
    def add_embedding(self, embedding, source=None, audio_duration=0.0, confidence=0.0):
        """添加声纹嵌入向量"""
        embedding_doc = SpeakerEmbedding(
            embedding=embedding,
            created_at=timezone.now(),
            source=source,
            audio_duration=audio_duration,
            confidence=confidence
        )
        self.embeddings.append(embedding_doc)
        self.updated_at = timezone.now()
        self.save()
        
        return embedding_doc
    
    def update_stats(self, speaking_time=0.0):
        """更新统计信息"""
        self.recognition_count += 1
        self.total_speaking_time += speaking_time
        self.updated_at = timezone.now()
        self.save()
        
        return self
