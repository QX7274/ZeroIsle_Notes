"""
搜索索引序列化器
"""

from rest_framework import serializers
from search.models import SearchIndex
from users.serializers import UserSerializer

class SearchIndexSerializer(serializers.ModelSerializer):
    """搜索索引序列化器"""
    user = UserSerializer(read_only=True)
    index_type_display = serializers.CharField(source='get_index_type_display', read_only=True)
    content_type_name = serializers.CharField(source='content_type.model', read_only=True)
    
    class Meta:
        model = SearchIndex
        fields = [
            'id', 'user', 'title', 'content', 'keywords',
            'index_type', 'index_type_display', 'content_type',
            'content_type_name', 'object_id', 'is_public',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
