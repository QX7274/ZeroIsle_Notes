"""
分类序列化器
"""

from rest_framework import serializers
from community.mongodb_models import Category, Post

class CategorySerializer(serializers.Serializer):
    """分类序列化器"""
    id = serializers.CharField(read_only=True)
    name = serializers.CharField(max_length=100)
    slug = serializers.CharField(max_length=100)
    description = serializers.CharField(required=False, allow_blank=True)
    icon = serializers.CharField(max_length=50, required=False, allow_blank=True)
    color = serializers.CharField(max_length=20, required=False, allow_blank=True)
    parent = serializers.CharField(required=False, allow_null=True)
    parent_name = serializers.SerializerMethodField()
    order = serializers.IntegerField(default=0)
    is_active = serializers.BooleanField(default=True)
    post_count = serializers.SerializerMethodField()
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)

    def get_parent_name(self, obj):
        """获取父分类名称"""
        if hasattr(obj, 'parent') and obj.parent:
            try:
                parent = Category.objects.get(id=obj.parent)
                return parent.name
            except Category.DoesNotExist:
                pass
        return ''

    def get_post_count(self, obj):
        """获取帖子数量"""
        return Post.objects.filter(category=obj.id, is_deleted=False).count()
