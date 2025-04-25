"""
评论序列化器
"""

from rest_framework import serializers
from community.models import Comment, Post
from users.serializers import UserSerializer

class CommentSerializer(serializers.ModelSerializer):
    """评论基础序列化器"""
    class Meta:
        model = Comment
        fields = [
            'id', 'post', 'parent', 'content',
            'like_count', 'is_pinned', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'like_count', 'created_at', 'updated_at']

class CommentListSerializer(serializers.ModelSerializer):
    """评论列表序列化器"""
    user = UserSerializer(read_only=True)
    reply_count = serializers.SerializerMethodField()
    is_liked = serializers.SerializerMethodField()
    
    class Meta:
        model = Comment
        fields = [
            'id', 'user', 'post', 'parent', 'content',
            'like_count', 'is_pinned', 'reply_count',
            'is_liked', 'created_at'
        ]
        read_only_fields = ['id', 'user', 'like_count', 'reply_count', 'created_at']
    
    def get_reply_count(self, obj):
        """获取回复数量"""
        return obj.replies.filter(is_deleted=False).count()
    
    def get_is_liked(self, obj):
        """获取当前用户是否点赞"""
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            from community.services import LikeService
            like_service = LikeService()
            return like_service.is_liked_by_user(request.user, obj)
        return False

class CommentDetailSerializer(serializers.ModelSerializer):
    """评论详情序列化器"""
    user = UserSerializer(read_only=True)
    post_title = serializers.CharField(source='post.title', read_only=True)
    parent_user = serializers.SerializerMethodField()
    replies = serializers.SerializerMethodField()
    is_liked = serializers.SerializerMethodField()
    
    class Meta:
        model = Comment
        fields = [
            'id', 'user', 'post', 'post_title', 'parent',
            'parent_user', 'content', 'like_count', 'is_pinned',
            'is_liked', 'replies', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'user', 'like_count', 'created_at', 'updated_at']
    
    def get_parent_user(self, obj):
        """获取父评论用户"""
        if obj.parent:
            return UserSerializer(obj.parent.user).data
        return None
    
    def get_replies(self, obj):
        """获取回复列表"""
        replies = obj.replies.filter(is_deleted=False)[:5]
        return CommentListSerializer(replies, many=True, context=self.context).data
    
    def get_is_liked(self, obj):
        """获取当前用户是否点赞"""
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            from community.services import LikeService
            like_service = LikeService()
            return like_service.is_liked_by_user(request.user, obj)
        return False

class CommentCreateSerializer(serializers.ModelSerializer):
    """评论创建序列化器"""
    post_id = serializers.PrimaryKeyRelatedField(
        queryset=Post.objects.all(),
        source='post'
    )
    parent_id = serializers.PrimaryKeyRelatedField(
        queryset=Comment.objects.all(),
        required=False,
        allow_null=True,
        source='parent'
    )
    
    class Meta:
        model = Comment
        fields = ['post_id', 'parent_id', 'content']
    
    def validate_post_id(self, value):
        """验证帖子"""
        # 检查帖子是否允许评论
        if not value.allow_comments:
            raise serializers.ValidationError("该帖子不允许评论")
        return value
    
    def validate_parent_id(self, value):
        """验证父评论"""
        if value and value.is_deleted:
            raise serializers.ValidationError("父评论不存在")
        return value
    
    def validate(self, data):
        """验证数据"""
        # 检查父评论是否属于同一帖子
        parent = data.get('parent')
        post = data.get('post')
        
        if parent and parent.post != post:
            raise serializers.ValidationError({"parent_id": "父评论不属于该帖子"})
        
        return data

class CommentUpdateSerializer(serializers.ModelSerializer):
    """评论更新序列化器"""
    class Meta:
        model = Comment
        fields = ['content']
