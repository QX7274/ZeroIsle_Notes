"""标签序列化器"""

from rest_framework import serializers
from notes.models import Tag

class TagSerializer(serializers.ModelSerializer):
    """标签序列化器"""
    category_name = serializers.CharField(source='category.name', read_only=True)
    
    class Meta:
        model = Tag
        fields = ['id', 'name', 'category', 'category_name', 'created_at']
        read_only_fields = ['id', 'created_at']