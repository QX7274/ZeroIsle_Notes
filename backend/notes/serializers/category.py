"""分类序列化器"""

from rest_framework import serializers
from notes.mongodb_models import Category

class CategorySerializer(serializers.Serializer):
    """分类序列化器"""
    id = serializers.UUIDField(read_only=True)
    name = serializers.CharField(max_length=100, required=True)
    description = serializers.CharField(required=False, allow_blank=True)
    color = serializers.CharField(max_length=20, required=False, allow_null=True)
    parent = serializers.UUIDField(source='parent.id', required=False, allow_null=True)
    user = serializers.UUIDField(source='user.id', read_only=True)
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)