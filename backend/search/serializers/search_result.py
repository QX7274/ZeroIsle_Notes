"""
搜索结果序列化器
"""

from rest_framework import serializers
from search.models import SearchResult

class SearchResultSerializer(serializers.ModelSerializer):
    """搜索结果序列化器"""
    content_type_name = serializers.CharField(source='content_type.model', read_only=True)
    
    class Meta:
        model = SearchResult
        fields = [
            'id', 'query', 'title', 'snippet',
            'score', 'position', 'content_type',
            'content_type_name', 'object_id', 'result_type',
            'created_at'
        ]
        read_only_fields = ['id', 'created_at']
