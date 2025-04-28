"""
关注序列化器
"""

from rest_framework import serializers
from community.mongodb_models import Follow
from users.serializers import UserSerializer

class FollowSerializer(serializers.Serializer):
    """关注序列化器"""
    id = serializers.CharField(read_only=True)
    user = UserSerializer(read_only=True)
    content_type = serializers.CharField(read_only=True)
    content_type_name = serializers.SerializerMethodField()
    object_id = serializers.CharField(read_only=True)
    is_active = serializers.BooleanField(default=True)
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)

    def get_content_type_name(self, obj):
        """获取内容类型名称"""
        return obj.content_type.lower() if obj.content_type else ''
