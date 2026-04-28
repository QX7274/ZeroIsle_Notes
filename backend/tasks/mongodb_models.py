"""
异步任务模型 (MongoEngine 版本)
"""

import uuid
from mongoengine import Document, UUIDField, StringField, IntField, DictField, DateTimeField, ReferenceField
from django.utils import timezone
from users.mongodb_models import User

class AsyncTask(Document):
    """
    统一异步任务模型 (MongoEngine 版本)
    用于跟踪所有后台任务的状态，如文档转换、数据导入等。
    """
    class TaskStatus:
        PENDING = 'PENDING'
        IN_PROGRESS = 'IN_PROGRESS'
        SUCCESS = 'SUCCESS'
        FAILURE = 'FAILURE'
        RETRY = 'RETRY'

    id = UUIDField(primary_key=True, default=uuid.uuid4)
    task_name = StringField(max_length=255, required=True)
    status = StringField(max_length=20, default=TaskStatus.PENDING)
    user = ReferenceField(User, required=False) # 允许匿名任务
    progress = IntField(default=0, min_value=0, max_value=100)
    result = DictField()
    error_details = DictField()
    created_at = DateTimeField(default=timezone.now)
    updated_at = DateTimeField(default=timezone.now)

    meta = {
        'collection': 'async_tasks',
        'indexes': [
            'task_name',
            'status',
            'user',
            'created_at'
        ],
        'ordering': ['-created_at']
    }

    def save(self, *args, **kwargs):
        self.updated_at = timezone.now()
        return super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.task_name} ({self.id}) - {self.status}'

