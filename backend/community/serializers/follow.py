"""
关注序列化器
"""

from rest_framework import serializers
from community.models import Follow
from users.serializers import UserSerializer

class FollowSerializer(serializers.ModelSerializer):
    """关注序列化器"""
    user = UserSerializer(read_only=True)
    content_type_name = serializers.CharField(source='content_type.model', read_only=True)
    
    class Meta:
        model = Follow
        fields = [
            'id', 'user', 'content_type', 'content_type_name',
            'object_id', 'is_active', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'user', 'content_type', 'content_type_name', 'object_id', 'created_at', 'updated_at']
