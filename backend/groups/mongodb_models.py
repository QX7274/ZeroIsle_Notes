"""
群组模块MongoDB文档模型
使用MongoEngine ODM定义MongoDB文档模型
"""

from mongoengine import Document, StringField, DateTimeField, BooleanField, IntField, FloatField
from mongoengine import ReferenceField, ListField, DictField
from django.utils import timezone
import uuid
from users.mongodb_models import User

class Group(Document):
    """
    群组文档模型
    """
    id = StringField(primary_key=True, default=lambda: str(uuid.uuid4()), verbose_name='群组ID')
    name = StringField(max_length=100, required=True, verbose_name='群组名称')
    description = StringField(verbose_name='群组描述')
    creator = ReferenceField(User, required=True, verbose_name='创建者')
    join_code = StringField(max_length=4, verbose_name='加入码')
    join_code_expires_at = DateTimeField(verbose_name='加入码过期时间')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')
    is_active = BooleanField(default=True, verbose_name='是否活跃')
    
    meta = {
        'collection': 'groups',
        'indexes': [
            {'fields': ['creator']},
            {'fields': ['is_active']},
            {'fields': ['created_at']},
        ],
        'ordering': ['-created_at']
    }
    
    def __str__(self):
        return self.name
    
    def save(self, *args, **kwargs):
        """保存前更新更新时间"""
        self.updated_at = timezone.now()
        return super().save(*args, **kwargs)
    
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
        self.save()
        return self.join_code

class GroupMember(Document):
    """
    群组成员文档模型
    """
    ROLE_CHOICES = (
        ('admin', '管理员'),
        ('member', '成员'),
    )
    
    id = StringField(primary_key=True, default=lambda: str(uuid.uuid4()), verbose_name='成员ID')
    group = ReferenceField(Group, required=True, verbose_name='群组')
    user = ReferenceField(User, required=True, verbose_name='用户')
    role = StringField(max_length=20, choices=ROLE_CHOICES, default='member', verbose_name='角色')
    joined_at = DateTimeField(default=timezone.now, verbose_name='加入时间')
    is_active = BooleanField(default=True, verbose_name='是否活跃')
    
    meta = {
        'collection': 'group_members',
        'indexes': [
            {'fields': ['group']},
            {'fields': ['user']},
            {'fields': ['is_active']},
            {'fields': ['joined_at']},
            {'fields': ['group', 'user'], 'unique': True},
        ],
        'ordering': ['joined_at']
    }
    
    def __str__(self):
        return f"{self.user.username} in {self.group.name}"

class GroupInvitation(Document):
    """
    群组邀请文档模型
    """
    STATUS_CHOICES = (
        ('pending', '待处理'),
        ('accepted', '已接受'),
        ('rejected', '已拒绝'),
        ('expired', '已过期'),
    )
    
    id = StringField(primary_key=True, default=lambda: str(uuid.uuid4()), verbose_name='邀请ID')
    group = ReferenceField(Group, required=True, verbose_name='群组')
    inviter = ReferenceField(User, required=True, verbose_name='邀请人')
    invitee = ReferenceField(User, required=True, verbose_name='被邀请人')
    status = StringField(max_length=20, choices=STATUS_CHOICES, default='pending', verbose_name='状态')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    expires_at = DateTimeField(required=True, verbose_name='过期时间')
    responded_at = DateTimeField(verbose_name='响应时间')
    
    meta = {
        'collection': 'group_invitations',
        'indexes': [
            {'fields': ['group']},
            {'fields': ['inviter']},
            {'fields': ['invitee']},
            {'fields': ['status']},
            {'fields': ['created_at']},
            {'fields': ['expires_at']},
        ],
        'ordering': ['-created_at']
    }
    
    def __str__(self):
        return f"{self.inviter.username} invited {self.invitee.username} to {self.group.name}"
    
    def is_expired(self):
        """检查邀请是否过期"""
        return timezone.now() > self.expires_at

class SharedScreen(Document):
    """
    共享屏幕文档模型
    """
    STATUS_CHOICES = (
        ('active', '活跃'),
        ('paused', '暂停'),
        ('ended', '结束'),
    )
    
    id = StringField(primary_key=True, default=lambda: str(uuid.uuid4()), verbose_name='共享ID')
    group = ReferenceField(Group, required=True, verbose_name='群组')
    user = ReferenceField(User, required=True, verbose_name='共享用户')
    title = StringField(max_length=100, required=True, verbose_name='共享标题')
    status = StringField(max_length=20, choices=STATUS_CHOICES, default='active', verbose_name='状态')
    started_at = DateTimeField(default=timezone.now, verbose_name='开始时间')
    ended_at = DateTimeField(verbose_name='结束时间')
    webrtc_room_id = StringField(max_length=100, verbose_name='WebRTC房间ID')
    
    meta = {
        'collection': 'shared_screens',
        'indexes': [
            {'fields': ['group']},
            {'fields': ['user']},
            {'fields': ['status']},
            {'fields': ['started_at']},
        ],
        'ordering': ['-started_at']
    }
    
    def __str__(self):
        return f"{self.user.username}'s screen in {self.group.name}"
