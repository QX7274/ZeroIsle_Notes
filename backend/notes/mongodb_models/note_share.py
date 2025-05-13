"""
笔记分享模型
"""

import uuid
from django.utils import timezone
from mongoengine import Document, StringField, DateTimeField, BooleanField, IntField
from mongoengine import UUIDField, ReferenceField
from users.mongodb_models import User

class NoteShare(Document):
    """
    笔记分享文档模型
    """
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4(), verbose_name='分享ID')
    note = ReferenceField('Note', required=True, verbose_name='笔记')
    user = ReferenceField(User, required=True, verbose_name='分享用户')
    share_type = StringField(max_length=20, choices=('link', 'email', 'user'), required=True, verbose_name='分享类型')
    share_to = StringField(max_length=255, verbose_name='分享对象')
    share_code = StringField(max_length=20, verbose_name='分享码')
    expires_at = DateTimeField(verbose_name='过期时间')
    is_password_protected = BooleanField(default=False, verbose_name='是否密码保护')
    password = StringField(max_length=100, verbose_name='密码')
    is_active = BooleanField(default=True, verbose_name='是否激活')
    view_count = IntField(default=0, verbose_name='查看次数')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')

    meta = {
        'collection': 'note_shares',
        'indexes': [
            {'fields': ['note']},
            {'fields': ['user']},
            {'fields': ['share_code']},
            {'fields': ['is_active']},
            {'fields': ['expires_at']},
            {'fields': ['created_at']}
        ],
        'ordering': ['-created_at']
    }

    def is_expired(self):
        """
        判断是否已过期
        """
        if not self.expires_at:
            return False
        return self.expires_at < timezone.now()

    def __str__(self):
        return f"Share {self.share_code} for {self.note.title} ({self.id})"
