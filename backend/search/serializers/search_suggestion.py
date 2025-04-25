"""
搜索建议序列化器
"""

from rest_framework import serializers
from search.models import SearchSuggestion
from users.serializers import UserSerializer

class SearchSuggestionSerializer(serializers.ModelSerializer):
    """搜索建议序列化器"""
    user = UserSerializer(read_only=True)
    
    class Meta:
        model = SearchSuggestion
        fields = [
            'id', 'user', 'text', 'frequency',
            'is_global', 'last_used', 'created_at'
        ]
        read_only_fields = ['id', 'frequency', 'last_used', 'created_at']
