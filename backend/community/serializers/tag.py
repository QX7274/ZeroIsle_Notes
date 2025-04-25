"""
标签序列化器
"""

from rest_framework import serializers
from community.models import Tag

class TagSerializer(serializers.ModelSerializer):
    """标签序列化器"""
    post_count = serializers.IntegerField(read_only=True)
    
    class Meta:
        model = Tag
        fields = [
            'id', 'name', 'slug', 'description', 'color',
            'is_active', 'post_count', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'post_count', 'created_at', 'updated_at']
