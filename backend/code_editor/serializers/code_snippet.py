"""
代码片段序列化器
"""

from rest_framework import serializers

from users.serializers.mongo_auth import MongoUserSerializer


class CodeSnippetSerializer(serializers.Serializer):
    """Mongo 代码片段序列化器"""

    id = serializers.CharField(read_only=True)
    user = MongoUserSerializer(read_only=True)
    title = serializers.CharField(max_length=255)
    description = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    code = serializers.CharField()
    language = serializers.CharField(max_length=50)
    is_public = serializers.BooleanField(default=False)
    is_favorite = serializers.BooleanField(required=False, default=False)
    tags = serializers.ListField(
        child=serializers.CharField(max_length=50),
        required=False,
        allow_empty=True,
    )
    tags_list = serializers.ListField(
        child=serializers.CharField(max_length=50),
        source='tags',
        required=False,
        allow_empty=True,
    )
    view_count = serializers.IntegerField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        tags = list(getattr(instance, 'tags', []) or [])
        data['tags'] = tags
        data['tags_list'] = tags
        return data

