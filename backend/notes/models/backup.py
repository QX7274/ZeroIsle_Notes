"""
笔记备份模型
用于实现笔记的备份功能
"""

from django.db import models
from django.utils import timezone
from django.contrib.auth import get_user_model

User = get_user_model()


class NoteBackup(models.Model):
    """
    笔记备份模型
    存储笔记的备份信息
    """
    BACKUP_TYPE_CHOICES = (
        ('auto', '自动备份'),
        ('manual', '手动备份'),
        ('scheduled', '定时备份'),
    )
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='note_backups', verbose_name="用户")
    backup_name = models.CharField(max_length=255, verbose_name="备份名称")
    backup_type = models.CharField(max_length=10, choices=BACKUP_TYPE_CHOICES, default='manual', verbose_name="备份类型")
    backup_file = models.FileField(upload_to='backups/', verbose_name="备份文件")
    file_size = models.PositiveIntegerField(default=0, verbose_name="文件大小")
    notes_count = models.PositiveIntegerField(default=0, verbose_name="笔记数量")
    created_at = models.DateTimeField(default=timezone.now, verbose_name="创建时间")
    description = models.TextField(blank=True, null=True, verbose_name="描述")
    is_encrypted = models.BooleanField(default=False, verbose_name="是否加密")
    
    class Meta:
        verbose_name = "笔记备份"
        verbose_name_plural = "笔记备份"
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.user.username} - {self.backup_name}"
    
    @property
    def file_size_display(self):
        """
        格式化文件大小显示
        """
        size = self.file_size
        if size < 1024:
            return f"{size} B"
        elif size < 1024 * 1024:
            return f"{size/1024:.1f} KB"
        elif size < 1024 * 1024 * 1024:
            return f"{size/(1024*1024):.1f} MB"
        else:
            return f"{size/(1024*1024*1024):.1f} GB"
