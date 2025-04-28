"""
笔记版本序列化器
"""

from rest_framework import serializers
from notes.mongodb_models import NoteVersion


class NoteVersionSerializer(serializers.Serializer):
    """
    笔记版本序列化器
    """
    id = serializers.UUIDField(read_only=True)
    note = serializers.UUIDField(source='note.id')
    title = serializers.CharField(max_length=255)
    content = serializers.CharField()
    version_number = serializers.IntegerField()
    created_by = serializers.UUIDField(source='created_by.id')
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)
    comment = serializers.CharField(max_length=255, required=False, allow_blank=True)
    is_auto_save = serializers.BooleanField(default=False)
    created_at = serializers.DateTimeField(read_only=True)
