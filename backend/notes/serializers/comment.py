"""
笔记评论序列化器
"""

from rest_framework import serializers
from notes.mongodb_models import Note, NoteComment


class NoteCommentSerializer(serializers.Serializer):
    """
    笔记评论序列化器
    """
    id = serializers.UUIDField(read_only=True)
    note = serializers.UUIDField(source='note.id')
    user = serializers.UUIDField(source='user.id', read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)
    user_avatar = serializers.SerializerMethodField()
    content = serializers.CharField(required=True)
    parent = serializers.UUIDField(source='parent.id', required=False, allow_null=True)
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)
    is_deleted = serializers.BooleanField(default=False, read_only=True)
    likes_count = serializers.IntegerField(read_only=True)
    replies_count = serializers.SerializerMethodField()
    is_reply = serializers.SerializerMethodField()

    def get_user_avatar(self, obj):
        """
        获取用户头像
        """
        if hasattr(obj.user, 'profile') and obj.user.profile.avatar:
            return obj.user.profile.avatar.url
        return None

    def get_replies_count(self, obj):
        """
        获取回复数量
        """
        if hasattr(obj, 'replies'):
            return len([r for r in obj.replies if not r.is_deleted])
        return 0

    def get_is_reply(self, obj):
        """
        判断是否为回复
        """
        return obj.parent is not None
