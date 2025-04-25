"""
帖子序列化器
"""

from rest_framework import serializers
from community.models import Post, Category, Tag
from users.serializers import UserSerializer

class PostSerializer(serializers.ModelSerializer):
    """帖子基础序列化器"""
    class Meta:
        model = Post
        fields = [
            'id', 'title', 'content', 'excerpt', 'status',
            'category', 'tags', 'cover_image', 'view_count',
            'like_count', 'comment_count', 'allow_comments',
            'is_pinned', 'is_featured', 'is_public',
            'published_at', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'view_count', 'like_count', 'comment_count', 'published_at', 'created_at', 'updated_at']

class PostListSerializer(serializers.ModelSerializer):
    """帖子列表序列化器"""
    user = UserSerializer(read_only=True)
    category_name = serializers.CharField(source='category.name', read_only=True)
    tag_names = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    is_liked = serializers.SerializerMethodField()
    
    class Meta:
        model = Post
        fields = [
            'id', 'user', 'title', 'excerpt', 'status', 'status_display',
            'category', 'category_name', 'tag_names', 'cover_image',
            'view_count', 'like_count', 'comment_count',
            'is_pinned', 'is_featured', 'is_public', 'is_liked',
            'published_at', 'created_at'
        ]
        read_only_fields = ['id', 'user', 'view_count', 'like_count', 'comment_count', 'published_at', 'created_at']
    
    def get_tag_names(self, obj):
        """获取标签名称列表"""
        return [tag.name for tag in obj.tags.all()]
    
    def get_is_liked(self, obj):
        """获取当前用户是否点赞"""
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            from community.services import LikeService
            like_service = LikeService()
            return like_service.is_liked_by_user(request.user, obj)
        return False

class PostDetailSerializer(serializers.ModelSerializer):
    """帖子详情序列化器"""
    user = UserSerializer(read_only=True)
    category = serializers.SerializerMethodField()
    tags = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    is_liked = serializers.SerializerMethodField()
    is_followed = serializers.SerializerMethodField()
    
    class Meta:
        model = Post
        fields = [
            'id', 'user', 'title', 'content', 'excerpt', 'status', 'status_display',
            'category', 'tags', 'cover_image', 'view_count', 'like_count',
            'comment_count', 'allow_comments', 'is_pinned', 'is_featured',
            'is_public', 'is_liked', 'is_followed', 'published_at',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'user', 'view_count', 'like_count', 'comment_count', 'published_at', 'created_at', 'updated_at']
    
    def get_category(self, obj):
        """获取分类信息"""
        if obj.category:
            from community.serializers import CategorySerializer
            return CategorySerializer(obj.category).data
        return None
    
    def get_tags(self, obj):
        """获取标签信息"""
        from community.serializers import TagSerializer
        return TagSerializer(obj.tags.all(), many=True).data
    
    def get_is_liked(self, obj):
        """获取当前用户是否点赞"""
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            from community.services import LikeService
            like_service = LikeService()
            return like_service.is_liked_by_user(request.user, obj)
        return False
    
    def get_is_followed(self, obj):
        """获取当前用户是否关注作者"""
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            from community.services import FollowService
            follow_service = FollowService()
            return follow_service.is_following(request.user, obj.user)
        return False

class PostCreateSerializer(serializers.ModelSerializer):
    """帖子创建序列化器"""
    category_id = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.all(),
        required=False,
        allow_null=True,
        source='category'
    )
    tags = serializers.ListField(
        child=serializers.CharField(),
        required=False
    )
    
    class Meta:
        model = Post
        fields = [
            'title', 'content', 'excerpt', 'status',
            'category_id', 'tags', 'cover_image',
            'allow_comments', 'is_public'
        ]
    
    def create(self, validated_data):
        """创建帖子"""
        tags_data = validated_data.pop('tags', [])
        
        # 创建帖子
        post = Post.objects.create(**validated_data)
        
        # 添加标签
        if tags_data:
            tags = []
            for tag_name in tags_data:
                tag, _ = Tag.objects.get_or_create(name=tag_name)
                tags.append(tag)
            post.tags.set(tags)
        
        return post

class PostUpdateSerializer(serializers.ModelSerializer):
    """帖子更新序列化器"""
    category_id = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.all(),
        required=False,
        allow_null=True,
        source='category'
    )
    tags = serializers.ListField(
        child=serializers.CharField(),
        required=False
    )
    
    class Meta:
        model = Post
        fields = [
            'title', 'content', 'excerpt', 'status',
            'category_id', 'tags', 'cover_image',
            'allow_comments', 'is_public'
        ]
    
    def update(self, instance, validated_data):
        """更新帖子"""
        tags_data = validated_data.pop('tags', None)
        
        # 更新帖子字段
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        
        instance.save()
        
        # 更新标签
        if tags_data is not None:
            tags = []
            for tag_name in tags_data:
                tag, _ = Tag.objects.get_or_create(name=tag_name)
                tags.append(tag)
            instance.tags.set(tags)
        
        return instance
