"""
代码模块MongoDB文档模型
使用MongoEngine ODM定义MongoDB文档模型
"""

from mongoengine import Document, StringField, DateTimeField, BooleanField, IntField, FloatField
from mongoengine import ReferenceField, ListField, DictField
from django.utils import timezone
import uuid
from users.mongodb_models import User

class CodeExecution(Document):
    """
    代码执行文档模型
    存储代码执行记录
    """
    STATUS_CHOICES = (
        ('pending', '等待中'),
        ('running', '运行中'),
        ('completed', '已完成'),
        ('failed', '失败'),
    )
    
    id = StringField(primary_key=True, default=lambda: str(uuid.uuid4()), verbose_name='执行ID')
    user = ReferenceField(User, required=True, verbose_name='用户')
    code = StringField(required=True, verbose_name='代码')
    language = StringField(max_length=50, required=True, verbose_name='语言')
    input_data = StringField(verbose_name='输入数据')
    output = StringField(verbose_name='输出')
    error = StringField(verbose_name='错误')
    execution_time = FloatField(default=0, verbose_name='执行时间(秒)')
    memory_usage = FloatField(default=0, verbose_name='内存使用(MB)')
    status = StringField(max_length=20, choices=STATUS_CHOICES, default='pending', verbose_name='状态')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')
    
    meta = {
        'collection': 'code_executions',
        'indexes': [
            {'fields': ['user']},
            {'fields': ['language']},
            {'fields': ['status']},
            {'fields': ['created_at']},
        ],
        'ordering': ['-created_at']
    }
    
    def __str__(self):
        return f"{self.language} - {self.created_at}"
    
    def save(self, *args, **kwargs):
        """保存前更新更新时间"""
        self.updated_at = timezone.now()
        return super().save(*args, **kwargs)

class CodeSnippet(Document):
    """
    代码片段文档模型
    存储用户保存的代码片段
    """
    id = StringField(primary_key=True, default=lambda: str(uuid.uuid4()), verbose_name='片段ID')
    user = ReferenceField(User, required=True, verbose_name='用户')
    title = StringField(max_length=255, required=True, verbose_name='标题')
    code = StringField(required=True, verbose_name='代码')
    language = StringField(max_length=50, required=True, verbose_name='语言')
    description = StringField(verbose_name='描述')
    tags = ListField(StringField(max_length=50), verbose_name='标签')
    is_public = BooleanField(default=False, verbose_name='是否公开')
    is_favorite = BooleanField(default=False, verbose_name='是否收藏')
    view_count = IntField(default=0, verbose_name='查看次数')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')
    
    meta = {
        'collection': 'code_snippets',
        'indexes': [
            {'fields': ['user']},
            {'fields': ['language']},
            {'fields': ['tags']},
            {'fields': ['is_public']},
            {'fields': ['is_favorite']},
            {'fields': ['created_at']},
        ],
        'ordering': ['-created_at']
    }
    
    def __str__(self):
        return self.title
    
    def save(self, *args, **kwargs):
        """保存前更新更新时间"""
        self.updated_at = timezone.now()
        return super().save(*args, **kwargs)
    
    def increment_view_count(self):
        """增加查看次数"""
        self.view_count += 1
        self.save()
