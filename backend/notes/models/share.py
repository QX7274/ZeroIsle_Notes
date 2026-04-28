"""
笔记分享模型（Django ORM版本 - 已弃用）

⚠️ 警告：此模型已弃用，请使用 notes.mongodb_models.note_share.NoteShare
⚠️ 本文件保留仅用于向后兼容，不应在新代码中使用

推荐使用：
    from notes.mongodb_models import NoteShare

迁移说明：
    1. 所有新功能应使用MongoEngine版本的NoteShare
    2. 现有代码应逐步迁移到MongoEngine版本
    3. 本模型将在未来版本中移除
"""

from django.db import models
from django.utils import timezone
from django.contrib.auth import get_user_model
import uuid

User = get_user_model()


class NoteShare(models.Model):
    """
    笔记分享模型（已弃用 - 请使用MongoEngine版本）

    ⚠️ 此模型已弃用，请使用 notes.mongodb_models.note_share.NoteShare
    """
    SHARE_TYPE_CHOICES = (
        ('public', '公开分享'),
        ('password', '密码分享'),
        ('link', '链接分享'),
        ('user', '指定用户分享'),
    )
    
    note = models.ForeignKey('notes.Note', on_delete=models.CASCADE, related_name='shares', verbose_name="笔记")
    share_type = models.CharField(max_length=20, choices=SHARE_TYPE_CHOICES, default='link', verbose_name="分享类型")
    share_code = models.CharField(max_length=32, default='', blank=True, verbose_name="分享码")
    password = models.CharField(max_length=64, blank=True, null=True, verbose_name="访问密码")
    shared_with = models.ManyToManyField(User, blank=True, related_name='shared_notes', verbose_name="分享给用户")
    expires_at = models.DateTimeField(blank=True, null=True, verbose_name="过期时间")
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='note_shares', verbose_name="创建者")
    created_at = models.DateTimeField(default=timezone.now, verbose_name="创建时间")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="更新时间")
    is_active = models.BooleanField(default=True, verbose_name="是否有效")
    view_count = models.PositiveIntegerField(default=0, verbose_name="查看次数")
    allow_comment = models.BooleanField(default=False, verbose_name="允许评论")
    
    class Meta:
        verbose_name = "笔记分享"
        verbose_name_plural = "笔记分享"
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.note.title} - {self.get_share_type_display()}"
    
    def save(self, *args, **kwargs):
        """
        重写保存方法，自动生成分享码
        """
        if not self.share_code:
            self.share_code = uuid.uuid4().hex[:8]
        super().save(*args, **kwargs)
    
    @property
    def is_expired(self):
        """
        判断分享是否过期
        """
        if not self.expires_at:
            return False
        return timezone.now() > self.expires_at
    
    def increment_view_count(self):
        """
        增加查看次数
        """
        self.view_count += 1
        self.save(update_fields=['view_count'])
        
    def get_share_url(self):
        """
        获取分享链接
        """
        return f"/share/{self.share_code}"
