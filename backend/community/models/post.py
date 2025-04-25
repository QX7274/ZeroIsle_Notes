"""
帖子模型
"""

from django.db import models
from django.contrib.auth import get_user_model
from common.models import UserOwnedModel, SoftDeleteModel, PublicModel

User = get_user_model()

class Post(UserOwnedModel, SoftDeleteModel, PublicModel):
    """
    帖子模型
    存储社区帖子
    """
    STATUS_CHOICES = (
        ('draft', '草稿'),
        ('published', '已发布'),
        ('hidden', '已隐藏'),
    )
    
    title = models.CharField(max_length=255, verbose_name='标题')
    content = models.TextField(verbose_name='内容')
    excerpt = models.TextField(blank=True, null=True, verbose_name='摘要')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='published', verbose_name='状态')
    category = models.ForeignKey(
        'community.Category',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='posts',
        verbose_name='分类'
    )
    tags = models.ManyToManyField(
        'community.Tag',
        blank=True,
        related_name='posts',
        verbose_name='标签'
    )
    cover_image = models.ImageField(upload_to='post_covers/', blank=True, null=True, verbose_name='封面图片')
    view_count = models.PositiveIntegerField(default=0, verbose_name='浏览次数')
    like_count = models.PositiveIntegerField(default=0, verbose_name='点赞次数')
    comment_count = models.PositiveIntegerField(default=0, verbose_name='评论次数')
    allow_comments = models.BooleanField(default=True, verbose_name='允许评论')
    is_pinned = models.BooleanField(default=False, verbose_name='是否置顶')
    is_featured = models.BooleanField(default=False, verbose_name='是否推荐')
    published_at = models.DateTimeField(blank=True, null=True, verbose_name='发布时间')
    
    class Meta:
        verbose_name = '帖子'
        verbose_name_plural = '帖子'
        ordering = ['-is_pinned', '-published_at', '-created_at']
        indexes = [
            models.Index(fields=['user', 'status']),
            models.Index(fields=['is_deleted']),
            models.Index(fields=['is_public']),
            models.Index(fields=['is_pinned']),
            models.Index(fields=['is_featured']),
            models.Index(fields=['published_at']),
        ]
    
    def __str__(self):
        return self.title
    
    def save(self, *args, **kwargs):
        """保存前处理"""
        # 如果没有摘要，自动生成
        if not self.excerpt and self.content:
            self.excerpt = self.content[:200]
        
        # 如果状态是已发布但没有发布时间，设置为当前时间
        if self.status == 'published' and not self.published_at:
            from django.utils import timezone
            self.published_at = timezone.now()
        
        super().save(*args, **kwargs)
    
    def increment_view_count(self):
        """增加浏览次数"""
        self.view_count += 1
        self.save(update_fields=['view_count'])
    
    def update_like_count(self):
        """更新点赞次数"""
        self.like_count = self.likes.filter(is_active=True).count()
        self.save(update_fields=['like_count'])
    
    def update_comment_count(self):
        """更新评论次数"""
        self.comment_count = self.comments.filter(is_deleted=False).count()
        self.save(update_fields=['comment_count'])
