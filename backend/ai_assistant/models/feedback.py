"""
反馈模型
"""

from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()

class Feedback(models.Model):
    """
    反馈模型
    存储用户对AI回复的反馈
    """
    RATING_CHOICES = (
        (1, '很差'),
        (2, '差'),
        (3, '一般'),
        (4, '好'),
        (5, '很好'),
    )
    
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='ai_feedbacks',
        verbose_name='用户'
    )
    message = models.ForeignKey(
        'ai_assistant.Message',
        on_delete=models.CASCADE,
        related_name='feedbacks',
        verbose_name='消息'
    )
    rating = models.IntegerField(choices=RATING_CHOICES, verbose_name='评分')
    comment = models.TextField(blank=True, null=True, verbose_name='评论')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    
    class Meta:
        verbose_name = '反馈'
        verbose_name_plural = '反馈'
        ordering = ['-created_at']
        unique_together = ('user', 'message')
        indexes = [
            models.Index(fields=['user', 'rating']),
            models.Index(fields=['message']),
        ]
    
    def __str__(self):
        return f"{self.user} - {self.get_rating_display()} - {self.created_at}"
