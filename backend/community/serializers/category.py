"""
分类序列化器
"""

from rest_framework import serializers
from community.models import Category

class CategorySerializer(serializers.ModelSerializer):
    """分类序列化器"""
    parent_name = serializers.CharField(source='parent.name', read_only=True)
    post_count = serializers.IntegerField(read_only=True)
    
    class Meta:
        model = Category
        fields = [
            'id', 'name', 'slug', 'description', 'icon',
            'color', 'parent', 'parent_name', 'order',
            'is_active', 'post_count', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'post_count', 'created_at', 'updated_at']
