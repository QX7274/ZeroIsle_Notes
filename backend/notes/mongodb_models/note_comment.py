"""
笔记评论模型
"""

import uuid
from django.utils import timezone
from mongoengine import Document, StringField, DateTimeField, BooleanField, IntField
from mongoengine import UUIDField, ReferenceField
from users.mongodb_models import User

class NoteComment(Document):
    """
    笔记评论文档模型
    """
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4(), verbose_name='评论ID')
    note = ReferenceField('Note', required=True, verbose_name='笔记')
    user = ReferenceField(User, required=True, verbose_name='用户')
    content = StringField(required=True, verbose_name='评论内容')
    parent = ReferenceField('self', verbose_name='父评论')
    is_deleted = BooleanField(default=False, verbose_name='是否删除')
    likes_count = IntField(default=0, verbose_name='点赞数')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')

    meta = {
        'collection': 'note_comments',
        'indexes': [
            {'fields': ['note']},
            {'fields': ['user']},
            {'fields': ['parent']},
            {'fields': ['is_deleted']},
            {'fields': ['created_at']}
        ],
        'ordering': ['-created_at']
    }

    def __str__(self):
        return f"Comment on {self.note.title} by {self.user.username} ({self.id})"
