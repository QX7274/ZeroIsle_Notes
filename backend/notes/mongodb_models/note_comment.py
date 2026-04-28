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
    笔记评论文档模型（优化版）
    - 支持软删除
    - 包含审计字段
    - 支持原子操作
    """
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4(), verbose_name='评论ID')
    note = ReferenceField('Note', required=True, verbose_name='笔记')
    user = ReferenceField(User, required=True, verbose_name='用户')
    content = StringField(required=True, max_length=2000, verbose_name='评论内容') # 增加长度限制
    parent = ReferenceField('self', verbose_name='父评论')

    # 软删除字段
    is_deleted = BooleanField(default=False, verbose_name='是否删除')
    deleted_at = DateTimeField(verbose_name='删除时间')
    deleted_by = ReferenceField(User, verbose_name='删除者')

    # 统计与审计
    likes_count = IntField(default=0, verbose_name='点赞数')
    ip_address = StringField(max_length=45, verbose_name='IP地址')
    user_agent = StringField(max_length=255, verbose_name='User-Agent')

    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')

    meta = {
        'collection': 'note_comments',
        'indexes': [
            {'fields': ['note', 'is_deleted', 'created_at']}, # 复合索引，优化查询
            {'fields': ['user', 'is_deleted']},
            {'fields': ['parent']},
            {'fields': ['created_at']}
        ],
        'ordering': ['-created_at']
    }

    def __str__(self):
        note_title = self.note.title if self.note else "Unknown Note"
        user_name = self.user.username if self.user else "Unknown User"
        return f"Comment on {note_title} by {user_name} ({self.id})"

    def save(self, *args, **kwargs):
        """保存前更新更新时间"""
        self.updated_at = timezone.now()
        return super().save(*args, **kwargs)

    def soft_delete(self, user):
        """
        软删除评论

        Args:
            user: 执行删除操作的用户
        """
        self.is_deleted = True
        self.deleted_at = timezone.now()
        self.deleted_by = user
        self.save()

    def undelete(self):
        """
        撤销软删除
        """
        self.is_deleted = False
        self.deleted_at = None
        self.deleted_by = None
        self.save()

    def increment_likes(self):
        """
        原子增加点赞数
        """
        NoteComment.objects(id=self.id).update_one(inc__likes_count=1)
        self.reload() # 重新加载以获取最新计数

    def decrement_likes(self):
        """
        原子减少点赞数
        """
        # 使用原子操作减少计数，确保不小于0
        NoteComment.objects(id=self.id, likes_count__gt=0).update_one(dec__likes_count=1)
        self.reload() # 重新加载以获取最新计数
