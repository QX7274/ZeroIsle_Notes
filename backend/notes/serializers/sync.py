"""
笔记同步序列化器
"""

from rest_framework import serializers
from notes.models import NoteSync


class NoteSyncSerializer(serializers.ModelSerializer):
    """
    笔记同步序列化器
    """
    username = serializers.SerializerMethodField()
    
    class Meta:
        model = NoteSync
        fields = [
            'id', 'user', 'username', 'device_id', 'last_sync_at',
            'sync_status', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_username(self, obj):
        """
        获取用户名
        """
        return obj.user.username
