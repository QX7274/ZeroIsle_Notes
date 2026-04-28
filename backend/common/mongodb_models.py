"""
MongoDB文档模型基类
使用MongoEngine ODM定义MongoDB文档模型
"""

from mongoengine import Document, DateTimeField, StringField, BooleanField, UUIDField, IntField, DictField
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

class AuditLog(Document):
    """
    通用审计日志模型
    """
    id = UUIDField(primary_key=True, default=uuid.uuid4, verbose_name='日志ID')
    user_id = StringField(required=True, verbose_name='用户ID')
    action = StringField(required=True, verbose_name='操作') # e.g., 'reminder_completed', 'note_created'
    target_model = StringField(required=True, verbose_name='目标模型') # e.g., 'Reminder', 'Note'
    target_id = StringField(required=True, verbose_name='目标ID')
    details = DictField(verbose_name='操作详情')
    ip_address = StringField(verbose_name='IP地址')
    user_agent = StringField(verbose_name='User-Agent')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')

    meta = {
        'collection': 'audit_logs',
        'indexes': [
            'user_id',
            'action',
            'target_model',
            'target_id',
            'created_at',
        ],
        'ordering': ['-created_at']
    }



class AsyncTask(Document):
    """
    通用异步任务模型
    """
    STATUS_CHOICES = ('pending', 'in_progress', 'completed', 'failed', 'cancelled')

    id = UUIDField(primary_key=True, default=uuid.uuid4, verbose_name='任务UUID')
    task_id = StringField(unique=True, required=True, verbose_name='Celery任务ID')
    task_name = StringField(required=True, verbose_name='任务名称')
    user_id = StringField(verbose_name='用户ID')
    status = StringField(choices=STATUS_CHOICES, default='pending', verbose_name='状态')
    progress = IntField(default=0, min_value=0, max_value=100, verbose_name='进度')
    result = DictField(verbose_name='任务结果')
    error_message = StringField(verbose_name='错误信息')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')
    expires_at = DateTimeField(verbose_name='过期时间')

    meta = {
        'collection': 'async_tasks',
        'indexes': [
            'task_id',
            'user_id',
            'status',
            'task_name',
            {'fields': ['expires_at'], 'expireAfterSeconds': 0}
        ],
        'ordering': ['-created_at']
    }

    def save(self, *args, **kwargs):
        self.updated_at = timezone.now()
        return super().save(*args, **kwargs)
