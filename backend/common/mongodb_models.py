"""
MongoDB文档模型基类
使用MongoEngine ODM定义MongoDB文档模型
"""

from mongoengine import Document, DateTimeField, StringField, BooleanField, UUIDField
from django.utils import timezone
import uuid

class TimeStampedDocument(Document):
    """
    带时间戳的基础文档模型
    包含创建时间和更新时间字段
    """
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')
    
    meta = {
        'abstract': True,
        'ordering': ['-created_at']
    }
    
    def save(self, *args, **kwargs):
        """保存前更新更新时间"""
        self.updated_at = timezone.now()
        return super().save(*args, **kwargs)

class UserOwnedDocument(TimeStampedDocument):
    """
    用户所有的基础文档模型
    包含用户ID和时间戳
    """
    user_id = UUIDField(required=True, verbose_name='用户ID')
    
    meta = {
        'abstract': True,
        'indexes': [
            {'fields': ['user_id']}
        ]
    }

class SoftDeleteDocument(Document):
    """
    软删除基础文档模型
    包含删除标记和删除时间
    """
    is_deleted = BooleanField(default=False, verbose_name='是否删除')
    deleted_at = DateTimeField(null=True, verbose_name='删除时间')
    
    meta = {
        'abstract': True,
        'indexes': [
            {'fields': ['is_deleted']}
        ]
    }
    
    def delete(self, *args, **kwargs):
        """
        重写删除方法，实现软删除
        """
        self.is_deleted = True
        self.deleted_at = timezone.now()
        self.save()
    
    def hard_delete(self):
        """
        硬删除方法
        真正从数据库中删除记录
        """
        super().delete()

class PublicDocument(Document):
    """
    公开/私有基础文档模型
    包含公开标记
    """
    is_public = BooleanField(default=False, verbose_name='是否公开')
    
    meta = {
        'abstract': True,
        'indexes': [
            {'fields': ['is_public']}
        ]
    }

class BaseDocument(TimeStampedDocument, SoftDeleteDocument, PublicDocument):
    """
    基础文档模型
    包含ID、时间戳、软删除和公开/私有标记
    """
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4(), verbose_name='ID')
    
    meta = {
        'abstract': True
    }

class UserDocument(BaseDocument, UserOwnedDocument):
    """
    用户文档模型
    包含ID、用户ID、时间戳、软删除和公开/私有标记
    """
    meta = {
        'abstract': True
    }
