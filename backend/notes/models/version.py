"""
笔记版本模型
用于实现笔记的版本控制功能
"""

from django.db import models
from django.utils import timezone
from django.contrib.auth import get_user_model

User = get_user_model()


class NoteVersion(models.Model):
    """
    笔记版本模型
    存储笔记的历史版本
    """
    note = models.ForeignKey('notes.Note', on_delete=models.CASCADE, related_name='versions', verbose_name="笔记")
    title = models.CharField(max_length=255, verbose_name="标题")
    content = models.TextField(verbose_name="内容")
    version_number = models.PositiveIntegerField(verbose_name="版本号")
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='note_versions', verbose_name="创建者")
    created_at = models.DateTimeField(default=timezone.now, verbose_name="创建时间")
    comment = models.CharField(max_length=255, blank=True, null=True, verbose_name="版本说明")
    is_auto_save = models.BooleanField(default=False, verbose_name="是否自动保存")
    
    class Meta:
        verbose_name = "笔记版本"
        verbose_name_plural = "笔记版本"
        ordering = ['-version_number']
        unique_together = ['note', 'version_number']
    
    def __str__(self):
        return f"{self.note.title} - v{self.version_number}"
    
    @property
    def diff_from_previous(self):
        """
        与前一个版本的差异
        """
        if self.version_number <= 1:
            return None
        
        try:
            previous_version = NoteVersion.objects.get(
                note=self.note,
                version_number=self.version_number - 1
            )
            # 这里可以实现差异比较算法
            # 简单起见，先返回None
            return None
        except NoteVersion.DoesNotExist:
            return None
