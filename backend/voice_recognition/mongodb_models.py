"""
语音识别模块MongoDB文档模型
使用MongoEngine ODM定义MongoDB文档模型
"""

from mongoengine import Document, StringField, DateTimeField, BooleanField, FloatField
from mongoengine import IntField, ReferenceField, ListField, DictField, URLField, FileField
from mongoengine import EmbeddedDocument, EmbeddedDocumentField
from django.utils import timezone
import uuid
from users.mongodb_models import User

class AudioFile(Document):
    """
    音频文件文档模型
    存储用户上传的音频文件
    """
    AUDIO_TYPE_CHOICES = (
        ('recording', '录音'),
        ('upload', '上传'),
        ('url', 'URL'),
    )

    id = StringField(primary_key=True, default=lambda: str(uuid.uuid4()), verbose_name='ID')
    user = ReferenceField(User, required=True, verbose_name='用户')
    file_path = StringField(required=True, verbose_name='文件路径')
    file_name = StringField(max_length=255, required=True, verbose_name='文件名')
    file_size = IntField(required=True, verbose_name='文件大小(字节)')
    file_type = StringField(max_length=50, required=True, verbose_name='文件类型')
    duration = FloatField(default=0, verbose_name='时长(秒)')
    audio_type = StringField(max_length=20, choices=AUDIO_TYPE_CHOICES, default='upload', verbose_name='音频类型')
    source_url = URLField(verbose_name='源URL')
    is_processed = BooleanField(default=False, verbose_name='是否已处理')
    is_deleted = BooleanField(default=False, verbose_name='是否删除')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')
    deleted_at = DateTimeField(verbose_name='删除时间')

    meta = {
        'collection': 'audio_files',
        'indexes': [
            {'fields': ['user']},
            {'fields': ['is_processed']},
            {'fields': ['is_deleted']},
            {'fields': ['created_at']},
        ],
        'ordering': ['-created_at']
    }

    def __str__(self):
        return self.file_name

    def save(self, *args, **kwargs):
        """保存前更新更新时间"""
        self.updated_at = timezone.now()
        return super().save(*args, **kwargs)

    def delete(self):
        """软删除"""
        self.is_deleted = True
        self.deleted_at = timezone.now()
        self.save()

    def hard_delete(self):
        """硬删除"""
        import os
        # 删除文件
        if os.path.isfile(self.file_path):
            os.remove(self.file_path)
        # 删除记录
        super().delete()

class Language(Document):
    """
    语言文档模型
    存储支持的语言
    """
    id = StringField(primary_key=True, default=lambda: str(uuid.uuid4()), verbose_name='ID')
    code = StringField(max_length=10, required=True, unique=True, verbose_name='语言代码')
    name = StringField(max_length=50, required=True, verbose_name='语言名称')
    native_name = StringField(max_length=50, verbose_name='本地名称')
    is_active = BooleanField(default=True, verbose_name='是否激活')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')

    meta = {
        'collection': 'languages',
        'indexes': [
            {'fields': ['code'], 'unique': True},
            {'fields': ['is_active']},
        ],
        'ordering': ['name']
    }

    def __str__(self):
        return f"{self.name} ({self.code})"

class Transcription(Document):
    """
    转录文档模型
    存储音频转录结果
    """
    id = StringField(primary_key=True, default=lambda: str(uuid.uuid4()), verbose_name='ID')
    user = ReferenceField(User, required=True, verbose_name='用户')
    audio_file = ReferenceField(AudioFile, required=True, verbose_name='音频文件')
    text = StringField(required=True, verbose_name='转录文本')
    language = ReferenceField(Language, verbose_name='语言')
    confidence = FloatField(default=0, verbose_name='置信度')
    duration = FloatField(default=0, verbose_name='时长(秒)')
    segments = ListField(DictField(), verbose_name='分段')
    model = StringField(max_length=50, verbose_name='模型')
    is_deleted = BooleanField(default=False, verbose_name='是否删除')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')
    deleted_at = DateTimeField(verbose_name='删除时间')

    meta = {
        'collection': 'transcriptions',
        'indexes': [
            {'fields': ['user']},
            {'fields': ['audio_file']},
            {'fields': ['language']},
            {'fields': ['is_deleted']},
            {'fields': ['created_at']},
        ],
        'ordering': ['-created_at']
    }

    def __str__(self):
        return f"{self.audio_file.file_name} - {self.text[:50]}..."

    def save(self, *args, **kwargs):
        """保存前更新更新时间"""
        self.updated_at = timezone.now()
        return super().save(*args, **kwargs)

    def delete(self):
        """软删除"""
        self.is_deleted = True
        self.deleted_at = timezone.now()
        self.save()

    def hard_delete(self):
        """硬删除"""
        super().delete()

class SpeakerEmbedding(EmbeddedDocument):
    """
    说话人嵌入向量嵌入文档
    存储说话人的声音特征向量
    """
    id = StringField(default=lambda: str(uuid.uuid4()), verbose_name='ID')
    vector = ListField(FloatField(), verbose_name='向量')
    model = StringField(max_length=50, verbose_name='模型')
    audio_file = StringField(verbose_name='音频文件ID')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')

    def __str__(self):
        return f"{self.model} - {self.created_at}"

class SpeakerProfile(Document):
    """
    说话人档案文档模型
    存储说话人的声音特征
    """
    id = StringField(primary_key=True, default=lambda: str(uuid.uuid4()), verbose_name='ID')
    user = ReferenceField(User, required=True, verbose_name='用户')
    speaker = ReferenceField('Speaker', verbose_name='说话人')
    embeddings = ListField(EmbeddedDocumentField(SpeakerEmbedding), verbose_name='嵌入向量')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')

    meta = {
        'collection': 'speaker_profiles',
        'indexes': [
            {'fields': ['user']},
            {'fields': ['speaker']},
            {'fields': ['created_at']},
        ],
        'ordering': ['-created_at']
    }

    def __str__(self):
        return f"Profile for {self.speaker.name if self.speaker else 'Unknown'}"

    def save(self, *args, **kwargs):
        """保存前更新更新时间"""
        self.updated_at = timezone.now()
        return super().save(*args, **kwargs)

    def add_embedding(self, vector, model, audio_file=None):
        """添加嵌入向量"""
        embedding = SpeakerEmbedding(
            vector=vector,
            model=model,
            audio_file=audio_file
        )
        self.embeddings.append(embedding)
        self.save()
        return embedding

class Speaker(Document):
    """
    说话人文档模型
    存储说话人信息
    """
    id = StringField(primary_key=True, default=lambda: str(uuid.uuid4()), verbose_name='ID')
    user = ReferenceField(User, required=True, verbose_name='用户')
    name = StringField(max_length=100, required=True, verbose_name='名称')
    display_name = StringField(max_length=100, verbose_name='显示名称')
    description = StringField(verbose_name='描述')
    voice_profile = DictField(default=dict, verbose_name='声音特征')
    external_id = StringField(max_length=100, verbose_name='外部ID')
    avatar = URLField(verbose_name='头像URL')

    # 统计信息
    recognition_count = IntField(default=0, verbose_name='识别次数')
    total_speaking_time = FloatField(default=0.0, verbose_name='总发言时长(秒)')

    # 状态
    is_favorite = BooleanField(default=False, verbose_name='是否收藏')
    is_active = BooleanField(default=True, verbose_name='是否激活')

    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')

    meta = {
        'collection': 'speakers',
        'indexes': [
            {'fields': ['user']},
            {'fields': ['name']},
            {'fields': ['is_favorite']},
            {'fields': ['is_active']},
            {'fields': ['created_at']},
            {'fields': ['user', 'name'], 'unique': True},
        ],
        'ordering': ['-is_favorite', 'name']
    }

    def __str__(self):
        return self.display_name or self.name

    def save(self, *args, **kwargs):
        """保存前更新更新时间"""
        self.updated_at = timezone.now()
        return super().save(*args, **kwargs)

    def update_stats(self, speaking_time=0.0):
        """更新统计信息"""
        self.recognition_count += 1
        self.total_speaking_time += speaking_time
        self.save()
        return self

    def get_profile(self):
        """获取说话人档案"""
        return SpeakerProfile.objects(speaker=self).first()
