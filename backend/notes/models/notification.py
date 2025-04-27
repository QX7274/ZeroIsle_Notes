"""
笔记通知模型
用于实现笔记的通知功能
"""

from django.db import models
from django.utils import timezone
from django.contrib.auth import get_user_model

User = get_user_model()


class Notification(models.Model):
    """
    通知模型
    存储用户的通知信息
    """
    NOTIFICATION_TYPE_CHOICES = (
        ('system', '系统通知'),
        ('note', '笔记通知'),
        ('comment', '评论通知'),
        ('share', '分享通知'),
        ('collaboration', '协作通知'),
        ('reminder', '提醒通知'),
    )

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='note_notifications', verbose_name="用户")
    title = models.CharField(max_length=255, verbose_name="标题")
    content = models.TextField(verbose_name="内容")
    notification_type = models.CharField(max_length=20, choices=NOTIFICATION_TYPE_CHOICES, default='system', verbose_name="通知类型")
    related_id = models.CharField(max_length=50, blank=True, null=True, verbose_name="关联ID")
    related_type = models.CharField(max_length=50, blank=True, null=True, verbose_name="关联类型")
    created_at = models.DateTimeField(default=timezone.now, verbose_name="创建时间")
    is_read = models.BooleanField(default=False, verbose_name="是否已读")

    class Meta:
        verbose_name = "通知"
        verbose_name_plural = "通知"
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.username} - {self.title}"

    def mark_as_read(self):
        """
        标记为已读
        """
        self.is_read = True
        self.save(update_fields=['is_read'])
