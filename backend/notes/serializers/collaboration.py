"""
笔记协作序列化器
"""

from rest_framework import serializers
from notes.mongodb_models import Note


class NoteCollaborationSerializer(serializers.Serializer):
    """
    笔记协作序列化器
    """
    id = serializers.UUIDField(read_only=True)
    note = serializers.UUIDField(source='note.id')
    note_title = serializers.CharField(source='note.title', read_only=True)
    user = serializers.UUIDField(source='user.id')
    username = serializers.CharField(source='user.username', read_only=True)
    user_avatar = serializers.SerializerMethodField()
    permission = serializers.ChoiceField(
        choices=['read', 'write', 'admin'],
        default='read'
    )
    permission_display = serializers.SerializerMethodField()
    created_by = serializers.UUIDField(source='created_by.id', read_only=True)
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)
    is_active = serializers.BooleanField(default=True)

    def get_user_avatar(self, obj):
        """
        获取用户头像
        """
        if hasattr(obj.user, 'profile') and obj.user.profile.avatar:
            return obj.user.profile.avatar.url
        return None

    def get_permission_display(self, obj):
        """
        获取权限显示名称
        """
        permission_map = {
            'read': '只读',
            'write': '编辑',
            'admin': '管理员'
        }
        return permission_map.get(obj.permission, obj.permission)
