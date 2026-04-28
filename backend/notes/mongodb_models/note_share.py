"""
笔记分享模型（优化版）
- 密码哈希存储
- 分享码唯一索引
- 原子操作支持
- 访问审计
"""

import uuid
import secrets
import hashlib
from django.utils import timezone
from django.contrib.auth.hashers import make_password, check_password
from mongoengine import Document, StringField, DateTimeField, BooleanField, IntField
from mongoengine import UUIDField, ReferenceField, ListField, DictField
from users.mongodb_models import User

class NoteShare(Document):
    """
    笔记分享文档模型（优化版）
    - 密码使用Django的哈希存储（PBKDF2）
    - 分享码唯一索引
    - 访问审计日志
    - 最大访问次数限制
    """
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4(), verbose_name='分享ID')
    note = ReferenceField('Note', required=True, verbose_name='笔记')
    user = ReferenceField(User, required=True, verbose_name='分享用户')
    share_type = StringField(max_length=20, choices=('link', 'email', 'user'), required=True, verbose_name='分享类型')
    share_to = StringField(max_length=255, verbose_name='分享对象')
    share_code = StringField(max_length=32, unique=True, sparse=True, verbose_name='分享码')  # 增加长度，添加唯一索引
    expires_at = DateTimeField(verbose_name='过期时间')
    is_password_protected = BooleanField(default=False, verbose_name='是否密码保护')
    password_hash = StringField(max_length=255, verbose_name='密码哈希')  # 改为哈希存储
    is_active = BooleanField(default=True, verbose_name='是否激活')
    view_count = IntField(default=0, verbose_name='查看次数')
    max_view_count = IntField(verbose_name='最大查看次数')  # 新增：访问次数限制
    access_logs = ListField(DictField(), verbose_name='访问日志')  # 新增：访问审计
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')

    meta = {
        'collection': 'note_shares',
        'indexes': [
            {'fields': ['note']},
            {'fields': ['user']},
            {'fields': ['share_code'], 'unique': True, 'sparse': True},  # 唯一索引
            {'fields': ['is_active']},
            {'fields': ['expires_at']},
            {'fields': ['created_at']},
            {'fields': ['share_type', 'share_to']},  # 复合索引，用于shared_with_me查询
        ],
        'ordering': ['-created_at']
    }

    @staticmethod
    def generate_share_code(length=16):
        """
        生成安全的分享码

        Args:
            length: 分享码长度（默认16位）

        Returns:
            str: 随机分享码
        """
        # 使用secrets模块生成密码学安全的随机字符串
        alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
        return ''.join(secrets.choice(alphabet) for _ in range(length))

    def set_password(self, raw_password):
        """
        设置密码（使用Django的哈希算法）

        Args:
            raw_password: 明文密码
        """
        if raw_password:
            self.password_hash = make_password(raw_password)
            self.is_password_protected = True
        else:
            self.password_hash = None
            self.is_password_protected = False

    def verify_password(self, raw_password):
        """
        验证密码（常数时间比较）

        Args:
            raw_password: 待验证的明文密码

        Returns:
            bool: 密码是否正确
        """
        if not self.is_password_protected or not self.password_hash:
            return True  # 无密码保护时直接通过
        return check_password(raw_password, self.password_hash)

    def increment_view_count(self, request_meta=None):
        """
        原子增加查看次数

        Args:
            request_meta: 请求元数据（用于审计日志）

        Returns:
            bool: 是否成功（如果达到最大次数限制则返回False）
        """
        # 检查是否达到最大访问次数
        if self.max_view_count and self.view_count >= self.max_view_count:
            return False

        # 使用原子操作增加计数
        from mongoengine.queryset import QuerySet
        result = NoteShare.objects(id=self.id).update_one(inc__view_count=1)

        # 添加访问日志（可选）
        if request_meta:
            access_log = {
                'timestamp': timezone.now(),
                'ip': request_meta.get('REMOTE_ADDR', 'unknown'),
                'user_agent': request_meta.get('HTTP_USER_AGENT', 'unknown')[:200]  # 限制长度
            }
            # 只保留最近100条访问记录
            NoteShare.objects(id=self.id).update_one(
                push__access_logs={'$each': [access_log], '$slice': -100}
            )

        # 更新本地实例
        self.view_count += 1
        return True

    def is_expired(self):
        """
        判断是否已过期

        Returns:
            bool: 是否过期
        """
        if not self.expires_at:
            return False
        return self.expires_at < timezone.now()

    def is_view_limit_reached(self):
        """
        判断是否达到访问次数限制

        Returns:
            bool: 是否达到限制
        """
        if not self.max_view_count:
            return False
        return self.view_count >= self.max_view_count

    def is_accessible(self):
        """
        判断分享是否可访问

        Returns:
            bool: 是否可访问
        """
        return (
            self.is_active and
            not self.is_expired() and
            not self.is_view_limit_reached()
        )

    def __str__(self):
        return f"Share {self.share_code} for {self.note.title if self.note else 'Unknown'} ({self.id})"
