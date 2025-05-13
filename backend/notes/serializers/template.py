"""
笔记模板序列化器
"""

from rest_framework import serializers
from notes.mongodb_models import Note, NoteTemplate


class NoteTemplateSerializer(serializers.Serializer):
    """
    笔记模板序列化器
    """
    id = serializers.UUIDField(read_only=True)
    title = serializers.CharField(max_length=255, required=True)
    content = serializers.CharField(required=True)
    description = serializers.CharField(required=False, allow_blank=True)
    template_type = serializers.ChoiceField(
        choices=['note', 'daily', 'weekly', 'monthly', 'project', 'custom'],
        default='note'
    )
    category = serializers.UUIDField(source='category.id', required=False, allow_null=True)
    tags = serializers.ListField(child=serializers.UUIDField(), required=False)
    thumbnail = serializers.FileField(required=False, allow_null=True)
    thumbnail_url = serializers.SerializerMethodField()
    created_by = serializers.UUIDField(source='created_by.id', read_only=True)
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)
    is_public = serializers.BooleanField(default=False)
    use_count = serializers.IntegerField(read_only=True)

    def get_thumbnail_url(self, obj):
        """
        获取缩略图URL
        """
        if obj.thumbnail:
            return obj.thumbnail.url
        return None
