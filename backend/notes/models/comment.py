"""
笔记评论模型
用于实现笔记的评论功能
"""

from django.db import models
from django.utils import timezone
from django.contrib.auth import get_user_model

User = get_user_model()


class NoteComment(models.Model):
    """
    笔记评论模型
    存储笔记的评论信息
    """
    note = models.ForeignKey('notes.Note', on_delete=models.CASCADE, related_name='comments', verbose_name="笔记")
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='note_comments', verbose_name="用户")
    content = models.TextField(verbose_name="评论内容")
    parent = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='replies', verbose_name="父评论")
    created_at = models.DateTimeField(default=timezone.now, verbose_name="创建时间")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="更新时间")
    is_deleted = models.BooleanField(default=False, verbose_name="是否删除")
    likes_count = models.PositiveIntegerField(default=0, verbose_name="点赞数")
    
    class Meta:
        verbose_name = "笔记评论"
        verbose_name_plural = "笔记评论"
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.user.username} - {self.note.title[:20]}"
    
    @property
    def is_reply(self):
        """
        判断是否为回复
        """
        return self.parent is not None
    
    def soft_delete(self):
        """
        软删除评论
        """
        self.is_deleted = True
        self.save(update_fields=['is_deleted'])
        
    def add_like(self):
        """
        增加点赞数
        """
        self.likes_count += 1
        self.save(update_fields=['likes_count'])
        
    def remove_like(self):
        """
        减少点赞数
        """
        if self.likes_count > 0:
            self.likes_count -= 1
            self.save(update_fields=['likes_count'])
