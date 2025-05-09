"""
基础模型类
"""

from django.db import models
from django.utils import timezone
from django.conf import settings

class TimeStampedModel(models.Model):
    """
    带时间戳的基础模型
    包含创建时间和更新时间字段
    """
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        abstract = True

class UserOwnedModel(TimeStampedModel):
    """
    用户所有的基础模型
    包含用户外键和时间戳
    """
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='%(class)ss',
        verbose_name='用户'
    )

    class Meta:
        abstract = True

class SoftDeleteModel(models.Model):
    """
    软删除基础模型
    包含删除标记和删除时间
    """
    is_deleted = models.BooleanField(default=False, verbose_name='是否删除')
    deleted_at = models.DateTimeField(null=True, blank=True, verbose_name='删除时间')

    class Meta:
        abstract = True

    def delete(self, using=None, keep_parents=False):
        """
        重写删除方法，实现软删除
        """
        self.is_deleted = True
        self.deleted_at = timezone.now()
        self.save(update_fields=['is_deleted', 'deleted_at'])

    def hard_delete(self):
        """
        硬删除方法
        真正从数据库中删除记录
        """
        super().delete()

class PublicModel(models.Model):
    """
    公开/私有基础模型
    包含公开标记
    """
    is_public = models.BooleanField(default=False, verbose_name='是否公开')

    class Meta:
        abstract = True

class OrderedModel(models.Model):
    """
    可排序基础模型
    包含排序字段
    """
    order = models.IntegerField(default=0, verbose_name='排序')

    class Meta:
        abstract = True
        ordering = ['order']

class TaggableModel(models.Model):
    """
    可标记基础模型
    包含标签字段
    """
    tags = models.ManyToManyField(
        'tags.Tag',
        blank=True,
        related_name='%(class)ss',
        verbose_name='标签'
    )

    class Meta:
        abstract = True

class VersionedModel(models.Model):
    """
    版本化基础模型
    包含版本号字段
    """
    version = models.IntegerField(default=1, verbose_name='版本号')

    class Meta:
        abstract = True

    def increment_version(self):
        """
        增加版本号
        """
        self.version += 1
        self.save(update_fields=['version'])

class ArchivableModel(models.Model):
    """
    可归档基础模型
    包含归档标记和归档时间
    """
    is_archived = models.BooleanField(default=False, verbose_name='是否归档')
    archived_at = models.DateTimeField(null=True, blank=True, verbose_name='归档时间')

    class Meta:
        abstract = True

    def archive(self):
        """
        归档方法
        """
        self.is_archived = True
        self.archived_at = timezone.now()
        self.save(update_fields=['is_archived', 'archived_at'])

    def unarchive(self):
        """
        取消归档方法
        """
        self.is_archived = False
        self.archived_at = None
        self.save(update_fields=['is_archived', 'archived_at'])

class FeaturedModel(models.Model):
    """
    可推荐基础模型
    包含推荐标记和推荐时间
    """
    is_featured = models.BooleanField(default=False, verbose_name='是否推荐')
    featured_at = models.DateTimeField(null=True, blank=True, verbose_name='推荐时间')

    class Meta:
        abstract = True

    def feature(self):
        """
        推荐方法
        """
        self.is_featured = True
        self.featured_at = timezone.now()
        self.save(update_fields=['is_featured', 'featured_at'])

    def unfeature(self):
        """
        取消推荐方法
        """
        self.is_featured = False
        self.featured_at = None
        self.save(update_fields=['is_featured', 'featured_at'])

class LockableModel(models.Model):
    """
    可锁定基础模型
    包含锁定标记、锁定时间和锁定用户
    """
    is_locked = models.BooleanField(default=False, verbose_name='是否锁定')
    locked_at = models.DateTimeField(null=True, blank=True, verbose_name='锁定时间')
    locked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='%(class)s_locks',
        verbose_name='锁定用户'
    )

    class Meta:
        abstract = True

    def lock(self, user):
        """
        锁定方法
        """
        self.is_locked = True
        self.locked_at = timezone.now()
        self.locked_by = user
        self.save(update_fields=['is_locked', 'locked_at', 'locked_by'])

    def unlock(self):
        """
        解锁方法
        """
        self.is_locked = False
        self.locked_at = None
        self.locked_by = None
        self.save(update_fields=['is_locked', 'locked_at', 'locked_by'])

class ApprovalModel(models.Model):
    """
    需要审批的基础模型
    包含审批状态、审批时间和审批用户
    """
    APPROVAL_STATUS_CHOICES = (
        ('pending', '待审批'),
        ('approved', '已批准'),
        ('rejected', '已拒绝')
    )

    approval_status = models.CharField(
        max_length=20,
        choices=APPROVAL_STATUS_CHOICES,
        default='pending',
        verbose_name='审批状态'
    )
    approved_at = models.DateTimeField(null=True, blank=True, verbose_name='审批时间')
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='%(class)s_approvals',
        verbose_name='审批用户'
    )

    class Meta:
        abstract = True

    def approve(self, user):
        """
        批准方法
        """
        self.approval_status = 'approved'
        self.approved_at = timezone.now()
        self.approved_by = user
        self.save(update_fields=['approval_status', 'approved_at', 'approved_by'])

    def reject(self, user):
        """
        拒绝方法
        """
        self.approval_status = 'rejected'
        self.approved_at = timezone.now()
        self.approved_by = user
        self.save(update_fields=['approval_status', 'approved_at', 'approved_by'])
