"""标签序列化器"""

from rest_framework import serializers
from notes.mongodb_models import Tag

class TagSerializer(serializers.Serializer):
    """标签序列化器"""
    id = serializers.UUIDField(read_only=True)
    name = serializers.CharField(max_length=50, required=True)
    color = serializers.CharField(max_length=20, required=False, allow_null=True)
    category = serializers.UUIDField(source='category.id', required=False, allow_null=True)
    category_name = serializers.CharField(source='category.name', read_only=True, allow_null=True)
    user = serializers.UUIDField(source='user.id', read_only=True)
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)