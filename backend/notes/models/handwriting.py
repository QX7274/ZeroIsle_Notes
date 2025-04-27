"""
手写笔记模型
用于实现手写笔记功能
"""

from django.db import models
from django.utils import timezone
from django.contrib.auth import get_user_model

User = get_user_model()


class Handwriting(models.Model):
    """
    手写笔记模型
    存储手写笔记信息
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='handwritings', verbose_name="用户")
    title = models.CharField(max_length=255, verbose_name="标题")
    image = models.ImageField(upload_to='handwritings/', verbose_name="手写图片")
    text = models.TextField(blank=True, null=True, verbose_name="识别文本")
    note = models.ForeignKey('notes.Note', on_delete=models.SET_NULL, null=True, blank=True, related_name='handwritings', verbose_name="关联笔记")
    created_at = models.DateTimeField(default=timezone.now, verbose_name="创建时间")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="更新时间")
    is_recognized = models.BooleanField(default=False, verbose_name="是否已识别")
    
    class Meta:
        verbose_name = "手写笔记"
        verbose_name_plural = "手写笔记"
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.user.username} - {self.title}"


class HandwritingShare(models.Model):
    """
    手写笔记分享模型
    存储手写笔记的分享信息
    """
    handwriting = models.ForeignKey(Handwriting, on_delete=models.CASCADE, related_name='shares', verbose_name="手写笔记")
    share_code = models.CharField(max_length=32, unique=True, verbose_name="分享码")
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='handwriting_shares', verbose_name="创建者")
    created_at = models.DateTimeField(default=timezone.now, verbose_name="创建时间")
    expires_at = models.DateTimeField(blank=True, null=True, verbose_name="过期时间")
    is_active = models.BooleanField(default=True, verbose_name="是否有效")
    view_count = models.PositiveIntegerField(default=0, verbose_name="查看次数")
    
    class Meta:
        verbose_name = "手写笔记分享"
        verbose_name_plural = "手写笔记分享"
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.handwriting.title} - {self.share_code}"
    
    @property
    def is_expired(self):
        """
        判断是否已过期
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
