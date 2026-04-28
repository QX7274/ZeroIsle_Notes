"""
通知模块MongoDB文档模型
使用MongoEngine ODM定义MongoDB文档模型
"""

from mongoengine import Document, StringField, DateTimeField, BooleanField, IntField, FloatField
from mongoengine import UUIDField, ReferenceField, ListField, DictField, URLField, GenericReferenceField
from django.utils import timezone
import uuid
from users.mongodb_models import User

class Notification(Document):
    """
    通知文档模型
    统一存储所有类型的通知
    """
    TYPE_CHOICES = (
        ('system', '系统通知'),
        ('note', '笔记通知'),
        ('comment', '评论通知'),
        ('share', '分享通知'),
        ('collaboration', '协作通知'),
        ('reminder', '提醒通知'),
        ('like', '点赞通知'),
        ('reply', '回复通知'),
        ('follow', '关注通知'),
        ('mention', '提及通知'),
    )
    
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4(), verbose_name='通知ID')
    recipient = ReferenceField(User, required=True, verbose_name='接收者')
    sender = ReferenceField(User, verbose_name='发送者')
    notification_type = StringField(max_length=20, choices=TYPE_CHOICES, required=True, verbose_name='通知类型')
    title = StringField(max_length=255, required=True, verbose_name='标题')
    message = StringField(required=True, verbose_name='消息内容')
    
    # 关联内容，可以关联到任何文档
    related_object = GenericReferenceField(verbose_name='关联对象')

    # 用于通知合并
    is_merged = BooleanField(default=False, verbose_name='是否已合并')
    merged_count = IntField(default=0, verbose_name='合并计数')
    merged_senders = ListField(ReferenceField(User), verbose_name='合并发送者列表')
    
    is_read = BooleanField(default=False, verbose_name='是否已读')
    is_sent = BooleanField(default=False, verbose_name='是否已发送')
    read_at = DateTimeField(verbose_name='读取时间')
    sent_at = DateTimeField(verbose_name='发送时间')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')
    
    meta = {
        'collection': 'notifications',
        'indexes': [
            {'fields': ['recipient']},
            {'fields': ['notification_type']},
            {'fields': ['is_read']},
            {'fields': ['created_at']}
        ],
        'ordering': ['-created_at']
    }
    
    def __str__(self):
        return f"{self.recipient.username} - {self.title}"
    
    def save(self, *args, **kwargs):
        """保存前更新更新时间"""
        self.updated_at = timezone.now()
        return super().save(*args, **kwargs)
    
    def mark_as_read(self):
        """标记为已读"""
        self.is_read = True
        self.read_at = timezone.now()
        self.save()
    
    def mark_as_sent(self):
        """标记为已发送"""
        self.is_sent = True
        self.sent_at = timezone.now()
        self.save()
