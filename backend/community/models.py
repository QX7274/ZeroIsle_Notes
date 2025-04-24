"""社区模型"""

from django.db import models
from django.utils.translation import gettext_lazy as _
from django.utils import timezone
from users.models import User
from notes.models import Note, NoteAttachment


class CommunityPost(models.Model):
    """社区帖子模型"""
    title = models.CharField(_('标题'), max_length=200)
    content = models.TextField(_('内容'))
    author = models.ForeignKey(User, on_delete=models.CASCADE, related_name='community_posts', verbose_name=_('作者'))
    note = models.ForeignKey(Note, on_delete=models.SET_NULL, null=True, blank=True, related_name='community_posts', verbose_name=_('关联笔记'))
    is_public = models.BooleanField(_('是否公开'), default=True)
    is_featured = models.BooleanField(_('是否精选'), default=False)
    view_count = models.PositiveIntegerField(_('查看次数'), default=0)
    like_count = models.PositiveIntegerField(_('点赞次数'), default=0)
    comment_count = models.PositiveIntegerField(_('评论次数'), default=0)
    download_count = models.PositiveIntegerField(_('下载次数'), default=0)
    created_at = models.DateTimeField(_('创建时间'), default=timezone.now)
    updated_at = models.DateTimeField(_('更新时间'), auto_now=True)
    
    class Meta:
        verbose_name = _('社区帖子')
        verbose_name_plural = _('社区帖子')
        ordering = ['-created_at']
    
    def __str__(self):
        return self.title


class PostTag(models.Model):
    """帖子标签模型"""
    name = models.CharField(_('标签名称'), max_length=50)
    posts = models.ManyToManyField(CommunityPost, related_name='tags', verbose_name=_('帖子'))
    created_at = models.DateTimeField(_('创建时间'), default=timezone.now)
    
    class Meta:
        verbose_name = _('帖子标签')
        verbose_name_plural = _('帖子标签')
    
    def __str__(self):
        return self.name


class PostCategory(models.Model):
    """帖子分类模型"""
    name = models.CharField(_('分类名称'), max_length=50)
    description = models.TextField(_('描述'), blank=True)
    icon = models.CharField(_('图标'), max_length=50, blank=True)
    order = models.IntegerField(_('排序'), default=0)
    created_at = models.DateTimeField(_('创建时间'), default=timezone.now)
    
    class Meta:
        verbose_name = _('帖子分类')
        verbose_name_plural = _('帖子分类')
        ordering = ['order', 'name']
    
    def __str__(self):
        return self.name


class PostAttachment(models.Model):
    """帖子附件模型"""
    post = models.ForeignKey(CommunityPost, on_delete=models.CASCADE, related_name='attachments', verbose_name=_('帖子'))
    file = models.FileField(_('文件'), upload_to='community_attachments/%Y/%m/%d/')
    file_name = models.CharField(_('文件名'), max_length=255)
    file_size = models.IntegerField(_('文件大小(字节)'))
    file_type = models.CharField(_('文件类型'), max_length=100)
    download_count = models.PositiveIntegerField(_('下载次数'), default=0)
    created_at = models.DateTimeField(_('上传时间'), auto_now_add=True)
    
    class Meta:
        verbose_name = _('帖子附件')
        verbose_name_plural = _('帖子附件')
        ordering = ['-created_at']
    
    def __str__(self):
        return self.file_name


class Comment(models.Model):
    """评论模型"""
    post = models.ForeignKey(CommunityPost, on_delete=models.CASCADE, related_name='comments', verbose_name=_('帖子'))
    author = models.ForeignKey(User, on_delete=models.CASCADE, related_name='comments', verbose_name=_('作者'))
    content = models.TextField(_('内容'))
    parent = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='replies', verbose_name=_('父评论'))
    like_count = models.PositiveIntegerField(_('点赞次数'), default=0)
    created_at = models.DateTimeField(_('创建时间'), default=timezone.now)
    updated_at = models.DateTimeField(_('更新时间'), auto_now=True)
    
    class Meta:
        verbose_name = _('评论')
        verbose_name_plural = _('评论')
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.author.username}的评论: {self.content[:20]}..."


class Like(models.Model):
    """点赞模型"""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='likes', verbose_name=_('用户'))
    post = models.ForeignKey(CommunityPost, on_delete=models.CASCADE, null=True, blank=True, related_name='likes', verbose_name=_('帖子'))
    comment = models.ForeignKey(Comment, on_delete=models.CASCADE, null=True, blank=True, related_name='likes', verbose_name=_('评论'))
    created_at = models.DateTimeField(_('创建时间'), auto_now_add=True)
    
    class Meta:
        verbose_name = _('点赞')
        verbose_name_plural = _('点赞')
        unique_together = [
            ('user', 'post'),
            ('user', 'comment'),
        ]
    
    def __str__(self):
        if self.post:
            return f"{self.user.username} 点赞了帖子 {self.post.title}"
        return f"{self.user.username} 点赞了评论"


class Favorite(models.Model):
    """收藏模型"""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='favorites', verbose_name=_('用户'))
    post = models.ForeignKey(CommunityPost, on_delete=models.CASCADE, related_name='favorites', verbose_name=_('帖子'))
    created_at = models.DateTimeField(_('创建时间'), auto_now_add=True)
    
    class Meta:
        verbose_name = _('收藏')
        verbose_name_plural = _('收藏')
        unique_together = ('user', 'post')
    
    def __str__(self):
        return f"{self.user.username} 收藏了 {self.post.title}"


class Follow(models.Model):
    """关注模型"""
    follower = models.ForeignKey(User, on_delete=models.CASCADE, related_name='following', verbose_name=_('关注者'))
    followed = models.ForeignKey(User, on_delete=models.CASCADE, related_name='followers', verbose_name=_('被关注者'))
    created_at = models.DateTimeField(_('创建时间'), auto_now_add=True)
    
    class Meta:
        verbose_name = _('关注')
        verbose_name_plural = _('关注')
        unique_together = ('follower', 'followed')
    
    def __str__(self):
        return f"{self.follower.username} 关注了 {self.followed.username}"


class Notification(models.Model):
    """通知模型"""
    TYPE_CHOICES = (
        ('like', '点赞'),
        ('comment', '评论'),
        ('reply', '回复'),
        ('follow', '关注'),
        ('system', '系统通知'),
    )
    
    recipient = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications', verbose_name=_('接收者'))
    sender = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True, related_name='sent_notifications', verbose_name=_('发送者'))
    type = models.CharField(_('类型'), max_length=20, choices=TYPE_CHOICES)
    post = models.ForeignKey(CommunityPost, on_delete=models.CASCADE, null=True, blank=True, verbose_name=_('相关帖子'))
    comment = models.ForeignKey(Comment, on_delete=models.CASCADE, null=True, blank=True, verbose_name=_('相关评论'))
    content = models.TextField(_('内容'), blank=True)
    is_read = models.BooleanField(_('是否已读'), default=False)
    created_at = models.DateTimeField(_('创建时间'), auto_now_add=True)
    
    class Meta:
        verbose_name = _('通知')
        verbose_name_plural = _('通知')
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.recipient.username}的{self.get_type_display()}通知"
