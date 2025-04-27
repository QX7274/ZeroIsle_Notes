"""
笔记协作模型
用于实现笔记的协作编辑功能
"""

from django.db import models
from django.utils import timezone
from django.contrib.auth import get_user_model

User = get_user_model()


class NoteCollaboration(models.Model):
    """
    笔记协作模型
    存储笔记的协作信息
    """
    PERMISSION_CHOICES = (
        ('view', '查看'),
        ('comment', '评论'),
        ('edit', '编辑'),
        ('admin', '管理'),
    )
    
    note = models.ForeignKey('notes.Note', on_delete=models.CASCADE, related_name='collaborations', verbose_name="笔记")
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='note_collaborations', verbose_name="用户")
    permission = models.CharField(max_length=10, choices=PERMISSION_CHOICES, default='view', verbose_name="权限")
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='created_collaborations', verbose_name="创建者")
    created_at = models.DateTimeField(default=timezone.now, verbose_name="创建时间")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="更新时间")
    is_active = models.BooleanField(default=True, verbose_name="是否有效")
    
    class Meta:
        verbose_name = "笔记协作"
        verbose_name_plural = "笔记协作"
        unique_together = ['note', 'user']
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.note.title} - {self.user.username} - {self.get_permission_display()}"
    
    def can_view(self):
        """
        判断是否有查看权限
        """
        return self.is_active and self.permission in ['view', 'comment', 'edit', 'admin']
    
    def can_comment(self):
        """
        判断是否有评论权限
        """
        return self.is_active and self.permission in ['comment', 'edit', 'admin']
    
    def can_edit(self):
        """
        判断是否有编辑权限
        """
        return self.is_active and self.permission in ['edit', 'admin']
    
    def can_admin(self):
        """
        判断是否有管理权限
        """
        return self.is_active and self.permission == 'admin'
