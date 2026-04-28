"""
帖子序列化器
"""

from rest_framework import serializers
from community.mongodb_models import Post, Category, Tag
from users.serializers import UserSerializer

class PostSerializer(serializers.Serializer):
    """帖子基础序列化器"""
    id = serializers.CharField(read_only=True)
    user = serializers.CharField(read_only=True)
    title = serializers.CharField(max_length=255)
    content = serializers.CharField()
    excerpt = serializers.CharField(required=False, allow_blank=True)
    status = serializers.ChoiceField(choices=Post.STATUS_CHOICES, default='published')
    category = serializers.CharField(required=False, allow_null=True)
    tags = serializers.ListField(child=serializers.CharField(), required=False)
    cover_image = serializers.CharField(required=False, allow_blank=True)
    view_count = serializers.IntegerField(read_only=True)
    like_count = serializers.IntegerField(read_only=True)
    comment_count = serializers.IntegerField(read_only=True)
    allow_comments = serializers.BooleanField(default=True)
    is_pinned = serializers.BooleanField(default=False)
    is_featured = serializers.BooleanField(default=False)
    is_public = serializers.BooleanField(default=True)
    published_at = serializers.DateTimeField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)

class PostListSerializer(serializers.Serializer):
    """帖子列表序列化器"""
    id = serializers.CharField(read_only=True)
    user = UserSerializer(read_only=True)
    title = serializers.CharField(max_length=255)
    excerpt = serializers.CharField(required=False, allow_blank=True)
    status = serializers.ChoiceField(choices=Post.STATUS_CHOICES, default='published')
    status_display = serializers.SerializerMethodField()
    category = serializers.CharField(required=False, allow_null=True)
    category_name = serializers.SerializerMethodField()
    tag_names = serializers.SerializerMethodField()
    cover_image = serializers.CharField(required=False, allow_blank=True)
    view_count = serializers.IntegerField(read_only=True)
    like_count = serializers.IntegerField(read_only=True)
    comment_count = serializers.IntegerField(read_only=True)
    is_pinned = serializers.BooleanField(default=False)
    is_featured = serializers.BooleanField(default=False)
    is_public = serializers.BooleanField(default=True)
    is_liked = serializers.SerializerMethodField()
    published_at = serializers.DateTimeField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)

    def get_status_display(self, obj):
        """获取状态显示名称"""
        return dict(Post.STATUS_CHOICES).get(obj.status, '')

    def get_category_name(self, obj):
        """获取分类名称"""
        if hasattr(obj, 'category') and obj.category:
            try:
                category = Category.objects.get(id=obj.category)
                return category.name
            except Category.DoesNotExist:
                pass
        return ''

    def get_tag_names(self, obj):
        """获取标签名称列表"""
        if hasattr(obj, 'tags') and obj.tags:
            return obj.tags
        return []

    def get_is_liked(self, obj):
        """获取当前用户是否点赞"""
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            from community.mongodb_models import Like
            like = Like.objects.filter(
                user=request.user,
                content_type='Post',
                object_id=str(obj.id),
                is_active=True
            ).first()
            return like is not None
        return False

class PostDetailSerializer(serializers.Serializer):
    """帖子详情序列化器"""
    id = serializers.CharField(read_only=True)
    user = UserSerializer(read_only=True)
    title = serializers.CharField(max_length=255)
    content = serializers.CharField()
    excerpt = serializers.CharField(required=False, allow_blank=True)
    status = serializers.ChoiceField(choices=Post.STATUS_CHOICES, default='published')
    status_display = serializers.SerializerMethodField()
    category = serializers.SerializerMethodField()
    tags = serializers.SerializerMethodField()
    cover_image = serializers.CharField(required=False, allow_blank=True)
    view_count = serializers.IntegerField(read_only=True)
    like_count = serializers.IntegerField(read_only=True)
    comment_count = serializers.IntegerField(read_only=True)
    allow_comments = serializers.BooleanField(default=True)
    is_pinned = serializers.BooleanField(default=False)
    is_featured = serializers.BooleanField(default=False)
    is_public = serializers.BooleanField(default=True)
    is_liked = serializers.SerializerMethodField()
    is_followed = serializers.SerializerMethodField()
    published_at = serializers.DateTimeField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)

    def get_status_display(self, obj):
        """获取状态显示名称"""
        return dict(Post.STATUS_CHOICES).get(obj.status, '')

    def get_category(self, obj):
        """获取分类信息"""
        if hasattr(obj, 'category') and obj.category:
            try:
                category = Category.objects.get(id=obj.category)
                from community.serializers import CategorySerializer
                return CategorySerializer(category).data
            except Category.DoesNotExist:
                pass
        return None

    def get_tags(self, obj):
        """获取标签信息"""
        if hasattr(obj, 'tags') and obj.tags:
            tags = []
            for tag_name in obj.tags:
                try:
                    tag = Tag.objects.get(name=tag_name)
                    tags.append(tag)
                except Tag.DoesNotExist:
                    pass
            from community.serializers import TagSerializer
            return TagSerializer(tags, many=True).data
        return []

    def get_is_liked(self, obj):
        """获取当前用户是否点赞"""
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            from community.mongodb_models import Like
            like = Like.objects.filter(
                user=request.user,
                content_type='Post',
                object_id=str(obj.id),
                is_active=True
            ).first()
            return like is not None
        return False

    def get_is_followed(self, obj):
        """获取当前用户是否关注作者"""
        request = self.context.get('request')
        if request and request.user.is_authenticated and hasattr(obj, 'user') and obj.user:
            from community.mongodb_models import Follow
            follow = Follow.objects.filter(
                user=request.user,
                content_type='User',
                object_id=str(obj.user.id),
                is_active=True
            ).first()
            return follow is not None
        return False

class PostCreateSerializer(serializers.Serializer):
    """帖子创建序列化器"""
    title = serializers.CharField(max_length=255)
    content = serializers.CharField()
    group = serializers.CharField(required=False, allow_null=True) # 新增 group 字段
    excerpt = serializers.CharField(required=False, allow_blank=True)
    status = serializers.ChoiceField(choices=Post.STATUS_CHOICES, default='published')
    category_id = serializers.CharField(required=False, allow_null=True)
    tags = serializers.ListField(
        child=serializers.CharField(),
        required=False
    )
    cover_image = serializers.CharField(required=False, allow_blank=True)
    allow_comments = serializers.BooleanField(default=True)
    is_public = serializers.BooleanField(default=True)

class PostUpdateSerializer(serializers.Serializer):
    """帖子更新序列化器"""
    title = serializers.CharField(max_length=255, required=False)
    content = serializers.CharField(required=False)
    group = serializers.CharField(required=False, allow_null=True) # 新增 group 字段
    excerpt = serializers.CharField(required=False, allow_blank=True)
    status = serializers.ChoiceField(choices=Post.STATUS_CHOICES, required=False)
    category_id = serializers.CharField(required=False, allow_null=True)
    tags = serializers.ListField(
        child=serializers.CharField(),
        required=False
    )
    cover_image = serializers.CharField(required=False, allow_blank=True)
    allow_comments = serializers.BooleanField(required=False)
    is_public = serializers.BooleanField(required=False)
