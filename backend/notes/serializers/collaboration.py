"""
笔记协作序列化器
"""

from rest_framework import serializers
from notes.models import NoteCollaboration


class NoteCollaborationSerializer(serializers.ModelSerializer):
    """
    笔记协作序列化器
    """
    username = serializers.SerializerMethodField()
    user_avatar = serializers.SerializerMethodField()
    note_title = serializers.SerializerMethodField()
    created_by_username = serializers.SerializerMethodField()
    permission_display = serializers.SerializerMethodField()
    
    class Meta:
        model = NoteCollaboration
        fields = [
            'id', 'note', 'note_title', 'user', 'username', 'user_avatar',
            'permission', 'permission_display', 'created_by', 'created_by_username',
            'created_at', 'updated_at', 'is_active'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
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
    
    def get_note_title(self, obj):
        """
        获取笔记标题
        """
        return obj.note.title
    
    def get_created_by_username(self, obj):
        """
        获取创建者用户名
        """
        return obj.created_by.username
    
    def get_permission_display(self, obj):
        """
        获取权限显示名称
        """
        return obj.get_permission_display()
