"""
群组模型
"""

import uuid
from django.db import models
from django.utils import timezone
from django.contrib.auth import get_user_model

User = get_user_model()

class Group(models.Model):
    """群组模型"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100, verbose_name='群组名称')
    description = models.TextField(blank=True, null=True, verbose_name='群组描述')
    creator = models.ForeignKey(User, on_delete=models.CASCADE, related_name='created_groups', verbose_name='创建者')
    avatar = models.CharField(max_length=255, blank=True, null=True, verbose_name='群组头像')
    is_public = models.BooleanField(default=False, verbose_name='是否公开')
    is_deleted = models.BooleanField(default=False, verbose_name='是否删除')
    created_at = models.DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        verbose_name = '群组'
        verbose_name_plural = '群组'
        ordering = ['-created_at']

    def __str__(self):
        return self.name

    def delete(self, using=None, keep_parents=False):
        """软删除"""
        self.is_deleted = True
        self.save()

class GroupMember(models.Model):
    """群组成员模型"""
    ROLE_CHOICES = (
        ('admin', '管理员'),
        ('member', '成员'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name='members', verbose_name='群组')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='group_memberships', verbose_name='用户')
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='member', verbose_name='角色')
    nickname = models.CharField(max_length=50, blank=True, null=True, verbose_name='群内昵称')
    joined_at = models.DateTimeField(default=timezone.now, verbose_name='加入时间')
    is_active = models.BooleanField(default=True, verbose_name='是否活跃')

    class Meta:
        verbose_name = '群组成员'
        verbose_name_plural = '群组成员'
        ordering = ['group', 'joined_at']
        unique_together = ('group', 'user')

    def __str__(self):
        return f"{self.user.username} in {self.group.name}"

class GroupInvitation(models.Model):
    """群组邀请模型"""
    STATUS_CHOICES = (
        ('pending', '待处理'),
        ('accepted', '已接受'),
        ('rejected', '已拒绝'),
        ('expired', '已过期'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name='invitations', verbose_name='群组')
    inviter = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_invitations', verbose_name='邀请人')
    invitee = models.ForeignKey(User, on_delete=models.CASCADE, related_name='received_invitations', verbose_name='被邀请人')
    message = models.TextField(blank=True, null=True, verbose_name='邀请消息')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', verbose_name='状态')
    created_at = models.DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')
    expires_at = models.DateTimeField(blank=True, null=True, verbose_name='过期时间')

    class Meta:
        verbose_name = '群组邀请'
        verbose_name_plural = '群组邀请'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.inviter.username} invited {self.invitee.username} to {self.group.name}"

    def is_expired(self):
        """检查邀请是否过期"""
        if self.expires_at and timezone.now() > self.expires_at:
            return True
        return False

class SharedScreen(models.Model):
    """共享屏幕模型"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name='shared_screens', verbose_name='群组')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='shared_screens', verbose_name='分享者')
    title = models.CharField(max_length=100, verbose_name='标题')
    description = models.TextField(blank=True, null=True, verbose_name='描述')
    stream_url = models.CharField(max_length=255, verbose_name='流地址')
    is_active = models.BooleanField(default=True, verbose_name='是否活跃')
    started_at = models.DateTimeField(default=timezone.now, verbose_name='开始时间')
    ended_at = models.DateTimeField(blank=True, null=True, verbose_name='结束时间')

    class Meta:
        verbose_name = '共享屏幕'
        verbose_name_plural = '共享屏幕'
        ordering = ['-started_at']

    def __str__(self):
        return f"{self.user.username}'s screen in {self.group.name}"

    def end_sharing(self):
        """结束共享"""
        self.is_active = False
        self.ended_at = timezone.now()
        self.save()
