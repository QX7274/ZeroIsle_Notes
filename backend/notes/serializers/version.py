"""
笔记版本序列化器（与MongoEngine模型对齐）
"""

from rest_framework import serializers
from notes.mongodb_models import NoteVersion


class NoteVersionSerializer(serializers.Serializer):
    """
    笔记版本序列化器
    - 对齐 notes.mongodb_models.note_version.NoteVersion 字段
    - 兼容视图和服务层（只读字段为输出专用）
    """
    id = serializers.UUIDField(read_only=True)
    note = serializers.UUIDField(source='note.id', read_only=True)
    title = serializers.CharField(max_length=255)
    content = serializers.CharField()
    version_number = serializers.IntegerField()

    # 字段统一：created_by -> user，comment -> description
    user = serializers.UUIDField(source='user.id')
    user_username = serializers.CharField(source='user.username', read_only=True)
    description = serializers.CharField(max_length=255, required=False, allow_blank=True, allow_null=True)

    is_auto_save = serializers.BooleanField(default=False)
    is_current = serializers.BooleanField(read_only=True)
    is_deleted = serializers.BooleanField(read_only=True)
    restored_from = serializers.UUIDField(source='restored_from.id', read_only=True, allow_null=True)

    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)
