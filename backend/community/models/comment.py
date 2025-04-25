"""
评论模型
"""

from django.db import models
from django.contrib.auth import get_user_model
from common.models import UserOwnedModel, SoftDeleteModel

User = get_user_model()

class Comment(UserOwnedModel, SoftDeleteModel):
    """
    评论模型
    存储帖子评论
    """
    post = models.ForeignKey(
        'community.Post',
        on_delete=models.CASCADE,
        related_name='comments',
        verbose_name='帖子'
    )
    parent = models.ForeignKey(
        'self',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='replies',
        verbose_name='父评论'
    )
    content = models.TextField(verbose_name='内容')
    like_count = models.PositiveIntegerField(default=0, verbose_name='点赞次数')
    is_pinned = models.BooleanField(default=False, verbose_name='是否置顶')
    
    class Meta:
        verbose_name = '评论'
        verbose_name_plural = '评论'
        ordering = ['-is_pinned', '-created_at']
        indexes = [
            models.Index(fields=['post', 'is_deleted']),
            models.Index(fields=['parent', 'is_deleted']),
            models.Index(fields=['user', 'is_deleted']),
            models.Index(fields=['is_pinned']),
        ]
    
    def __str__(self):
        return f"{self.user.username}: {self.content[:50]}"
    
    def save(self, *args, **kwargs):
        """保存前处理"""
        is_new = self.pk is None
        
        super().save(*args, **kwargs)
        
        # 如果是新评论，更新帖子评论数
        if is_new and not self.is_deleted:
            self.post.update_comment_count()
    
    def delete(self, *args, **kwargs):
        """删除前处理"""
        # 软删除
        self.is_deleted = True
        self.save(update_fields=['is_deleted'])
        
        # 更新帖子评论数
        self.post.update_comment_count()
    
    def hard_delete(self):
        """硬删除"""
        super().delete()
        
        # 更新帖子评论数
        self.post.update_comment_count()
    
    def update_like_count(self):
        """更新点赞次数"""
        self.like_count = self.likes.filter(is_active=True).count()
        self.save(update_fields=['like_count'])
