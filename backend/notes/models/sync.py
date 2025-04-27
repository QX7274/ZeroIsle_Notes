"""
笔记同步模型
用于记录笔记的同步状态
"""

from django.db import models
from django.utils import timezone
from django.contrib.auth import get_user_model

User = get_user_model()


class NoteSync(models.Model):
    """
    笔记同步模型
    记录每个设备的同步状态
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='note_syncs', verbose_name="用户")
    device_id = models.CharField(max_length=64, verbose_name="设备ID")
    last_sync_at = models.DateTimeField(default=timezone.now, verbose_name="最后同步时间")
    sync_status = models.CharField(max_length=20, default='success', verbose_name="同步状态")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="更新时间")
    
    class Meta:
        verbose_name = "笔记同步"
        verbose_name_plural = "笔记同步"
        unique_together = ['user', 'device_id']
        ordering = ['-last_sync_at']
    
    def __str__(self):
        return f"{self.user.username} - {self.device_id}"
