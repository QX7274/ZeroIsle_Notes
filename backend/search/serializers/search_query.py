"""
搜索查询序列化器
"""

from rest_framework import serializers
from search.models import SearchQuery
from users.serializers import UserSerializer

class SearchQuerySerializer(serializers.ModelSerializer):
    """搜索查询序列化器"""
    user = UserSerializer(read_only=True)
    
    class Meta:
        model = SearchQuery
        fields = [
            'id', 'user', 'query', 'filters',
            'result_count', 'execution_time', 'created_at'
        ]
        read_only_fields = ['id', 'user', 'result_count', 'execution_time', 'created_at']
