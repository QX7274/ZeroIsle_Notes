"""
标签序列化器
"""

from rest_framework import serializers
from community.mongodb_models import Tag, Post

class TagSerializer(serializers.Serializer):
    """标签序列化器"""
    id = serializers.CharField(read_only=True)
    name = serializers.CharField(max_length=50)
    slug = serializers.CharField(max_length=50)
    description = serializers.CharField(required=False, allow_blank=True)
    color = serializers.CharField(max_length=20, required=False, allow_blank=True)
    is_active = serializers.BooleanField(default=True)
    post_count = serializers.SerializerMethodField()
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)

    def get_post_count(self, obj):
        """获取帖子数量"""
        return Post.objects.filter(tags=obj.name, is_deleted=False).count()
