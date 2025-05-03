"""
群组模块模型
"""

import uuid
from django.db import models
from django.utils import timezone
from users.models import User

class Group(models.Model):
    """
    群组模型
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, verbose_name='群组ID')
    name = models.CharField(max_length=100, verbose_name='群组名称')
    description = models.TextField(blank=True, null=True, verbose_name='群组描述')
    creator = models.ForeignKey(User, on_delete=models.CASCADE, related_name='created_groups', verbose_name='创建者')
    join_code = models.CharField(max_length=4, blank=True, null=True, verbose_name='加入码')
    join_code_expires_at = models.DateTimeField(blank=True, null=True, verbose_name='加入码过期时间')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')
    is_active = models.BooleanField(default=True, verbose_name='是否活跃')

    class Meta:
        db_table = 'groups'
        verbose_name = '群组'
        verbose_name_plural = verbose_name
        ordering = ['-created_at']

    def __str__(self):
        return self.name

    def is_join_code_valid(self):
        """检查加入码是否有效"""
        if not self.join_code or not self.join_code_expires_at:
            return False
        return timezone.now() < self.join_code_expires_at

    def generate_join_code(self, expires_in_minutes=30):
        """生成新的加入码"""
        import random
        self.join_code = ''.join([str(random.randint(0, 9)) for _ in range(4)])
        self.join_code_expires_at = timezone.now() + timezone.timedelta(minutes=expires_in_minutes)
        self.save(update_fields=['join_code', 'join_code_expires_at'])
        return self.join_code


class GroupMember(models.Model):
    """
    群组成员模型
    """
    ROLE_CHOICES = (
        ('admin', '管理员'),
        ('member', '成员'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, verbose_name='成员ID')
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name='members', verbose_name='群组')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='group_memberships', verbose_name='用户')
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='member', verbose_name='角色')
    joined_at = models.DateTimeField(auto_now_add=True, verbose_name='加入时间')
    is_active = models.BooleanField(default=True, verbose_name='是否活跃')

    class Meta:
        db_table = 'group_members'
        verbose_name = '群组成员'
        verbose_name_plural = verbose_name
        unique_together = ('group', 'user')
        ordering = ['joined_at']

    def __str__(self):
        return f"{self.user.username} in {self.group.name}"


class GroupInvitation(models.Model):
    """
    群组邀请模型
    """
    STATUS_CHOICES = (
        ('pending', '待处理'),
        ('accepted', '已接受'),
        ('rejected', '已拒绝'),
        ('expired', '已过期'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, verbose_name='邀请ID')
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name='invitations', verbose_name='群组')
    inviter = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_invitations', verbose_name='邀请人')
    invitee = models.ForeignKey(User, on_delete=models.CASCADE, related_name='received_invitations', verbose_name='被邀请人')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', verbose_name='状态')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    expires_at = models.DateTimeField(verbose_name='过期时间')
    responded_at = models.DateTimeField(blank=True, null=True, verbose_name='响应时间')

    class Meta:
        db_table = 'group_invitations'
        verbose_name = '群组邀请'
        verbose_name_plural = verbose_name
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.inviter.username} invited {self.invitee.username} to {self.group.name}"

    def is_expired(self):
        """检查邀请是否过期"""
        return timezone.now() > self.expires_at


class SharedScreen(models.Model):
    """
    共享屏幕模型
    """
    STATUS_CHOICES = (
        ('active', '活跃'),
        ('paused', '暂停'),
        ('ended', '结束'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, verbose_name='共享ID')
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name='shared_screens', verbose_name='群组')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='shared_screens', verbose_name='共享用户')
    title = models.CharField(max_length=100, verbose_name='共享标题')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active', verbose_name='状态')
    started_at = models.DateTimeField(auto_now_add=True, verbose_name='开始时间')
    ended_at = models.DateTimeField(blank=True, null=True, verbose_name='结束时间')
    webrtc_room_id = models.CharField(max_length=100, blank=True, null=True, verbose_name='WebRTC房间ID')

    class Meta:
        db_table = 'shared_screens'
        verbose_name = '共享屏幕'
        verbose_name_plural = verbose_name
        ordering = ['-started_at']

    def __str__(self):
        return f"{self.user.username}'s screen in {self.group.name}"
