"""
通知模型
"""

from django.db import models
from django.contrib.auth import get_user_model
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType

User = get_user_model()

class Notification(models.Model):
    """
    通知模型
    存储用户通知
    """
    TYPE_CHOICES = (
        ('like', '点赞'),
        ('comment', '评论'),
        ('reply', '回复'),
        ('follow', '关注'),
        ('mention', '提及'),
        ('system', '系统'),
    )
    
    recipient = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='notifications',
        verbose_name='接收者'
    )
    sender = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='sent_notifications',
        verbose_name='发送者'
    )
    notification_type = models.CharField(max_length=20, choices=TYPE_CHOICES, verbose_name='通知类型')
    title = models.CharField(max_length=255, verbose_name='标题')
    message = models.TextField(verbose_name='消息')
    
    # 通用外键，关联到任何模型
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE, null=True, blank=True, verbose_name='内容类型')
    object_id = models.CharField(max_length=50, null=True, blank=True, verbose_name='对象ID')
    content_object = GenericForeignKey('content_type', 'object_id')
    
    is_read = models.BooleanField(default=False, verbose_name='是否已读')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    
    class Meta:
        verbose_name = '通知'
        verbose_name_plural = '通知'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['recipient', 'is_read']),
            models.Index(fields=['notification_type']),
            models.Index(fields=['content_type', 'object_id']),
        ]
    
    def __str__(self):
        return f"{self.get_notification_type_display()} 通知: {self.title}"
    
    def mark_as_read(self):
        """标记为已读"""
        self.is_read = True
        self.save(update_fields=['is_read'])
    
    @classmethod
    def create_notification(cls, recipient, notification_type, title, message, sender=None, content_object=None):
        """
        创建通知
        
        Args:
            recipient: 接收者
            notification_type: 通知类型
            title: 标题
            message: 消息
            sender: 发送者
            content_object: 关联对象
            
        Returns:
            Notification: 创建的通知
        """
        notification = cls(
            recipient=recipient,
            notification_type=notification_type,
            title=title,
            message=message,
            sender=sender
        )
        
        if content_object:
            notification.content_object = content_object
        
        notification.save()
        return notification
