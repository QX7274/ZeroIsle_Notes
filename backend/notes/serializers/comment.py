"""
笔记评论序列化器
"""

from rest_framework import serializers
from notes.models import NoteComment


class NoteCommentSerializer(serializers.ModelSerializer):
    """
    笔记评论序列化器
    """
    username = serializers.SerializerMethodField()
    user_avatar = serializers.SerializerMethodField()
    replies_count = serializers.SerializerMethodField()
    is_reply = serializers.SerializerMethodField()
    
    class Meta:
        model = NoteComment
        fields = [
            'id', 'note', 'user', 'username', 'user_avatar', 'content',
            'parent', 'created_at', 'updated_at', 'is_deleted',
            'likes_count', 'replies_count', 'is_reply'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'likes_count']
    
    def get_username(self, obj):
        """
        获取用户名
        """
        return obj.user.username
    
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
        return obj.replies.filter(is_deleted=False).count()
    
    def get_is_reply(self, obj):
        """
        判断是否为回复
        """
        return obj.is_reply
