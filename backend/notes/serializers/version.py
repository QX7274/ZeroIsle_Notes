"""
笔记版本序列化器
"""

from rest_framework import serializers
from notes.models import NoteVersion


class NoteVersionSerializer(serializers.ModelSerializer):
    """
    笔记版本序列化器
    """
    created_by_username = serializers.SerializerMethodField()
    
    class Meta:
        model = NoteVersion
        fields = [
            'id', 'note', 'title', 'content', 'version_number',
            'created_by', 'created_by_username', 'created_at',
            'comment', 'is_auto_save'
        ]
        read_only_fields = ['id', 'created_at']
    
    def get_created_by_username(self, obj):
        """
        获取创建者用户名
        """
        if obj.created_by:
            return obj.created_by.username
        return None
