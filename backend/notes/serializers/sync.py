"""
笔记同步序列化器
"""

from rest_framework import serializers
from notes.mongodb_models import Note


class NoteSyncSerializer(serializers.Serializer):
    """
    笔记同步序列化器
    """
    id = serializers.UUIDField(read_only=True)
    user = serializers.UUIDField(source='user.id', read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)
    device_id = serializers.CharField(max_length=100)
    last_sync_at = serializers.DateTimeField()
    sync_status = serializers.ChoiceField(
        choices=['success', 'failed', 'in_progress'],
        default='success'
    )
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)
