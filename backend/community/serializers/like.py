"""
点赞序列化器
"""

from rest_framework import serializers
from community.models import Like
from users.serializers import UserSerializer

class LikeSerializer(serializers.ModelSerializer):
    """点赞序列化器"""
    user = UserSerializer(read_only=True)
    content_type_name = serializers.CharField(source='content_type.model', read_only=True)
    
    class Meta:
        model = Like
        fields = [
            'id', 'user', 'content_type', 'content_type_name',
            'object_id', 'is_active', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'user', 'content_type', 'content_type_name', 'object_id', 'created_at', 'updated_at']
