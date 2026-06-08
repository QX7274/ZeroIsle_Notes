"""
评论序列化器
"""

from rest_framework import serializers
from community.mongodb_models import Comment, Post
from users.serializers import UserSerializer

class CommentSerializer(serializers.Serializer):
    """评论基础序列化器"""
    id = serializers.CharField(read_only=True)
    user = serializers.CharField(read_only=True)
    post = serializers.CharField()
    parent = serializers.CharField(required=False, allow_null=True)
    content = serializers.CharField()
    like_count = serializers.IntegerField(read_only=True)
    is_pinned = serializers.BooleanField(default=False)
    is_deleted = serializers.BooleanField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)

class CommentListSerializer(serializers.Serializer):
    """评论列表序列化器"""
    id = serializers.CharField(read_only=True)
    user = UserSerializer(read_only=True)
    post = serializers.CharField()
    parent = serializers.CharField(required=False, allow_null=True)
    content = serializers.CharField()
    like_count = serializers.IntegerField(read_only=True)
    is_pinned = serializers.BooleanField(default=False)
    reply_count = serializers.SerializerMethodField()
    is_liked = serializers.SerializerMethodField()
    created_at = serializers.DateTimeField(read_only=True)

    def get_reply_count(self, obj):
        """获取回复数量"""
        return Comment.objects.filter(parent=obj, is_deleted=False).count()

    def get_is_liked(self, obj):
        """获取当前用户是否点赞"""
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            from community.mongodb_models import Like
            like = Like.objects.filter(
                user=request.user,
                content_type='Comment',
                object_id=str(obj.id),
                is_active=True
            ).first()
            return like is not None
        return False

class CommentDetailSerializer(serializers.Serializer):
    """评论详情序列化器"""
    id = serializers.CharField(read_only=True)
    user = UserSerializer(read_only=True)
    post = serializers.CharField()
    post_title = serializers.SerializerMethodField()
    parent = serializers.CharField(required=False, allow_null=True)
    parent_user = serializers.SerializerMethodField()
    content = serializers.CharField()
    like_count = serializers.IntegerField(read_only=True)
    is_pinned = serializers.BooleanField(default=False)
    is_liked = serializers.SerializerMethodField()
    replies = serializers.SerializerMethodField()
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)

    def get_post_title(self, obj):
        """获取帖子标题"""
        if getattr(obj, 'post', None):
            return getattr(obj.post, 'title', '') or ''
        return ''

    def get_parent_user(self, obj):
        """获取父评论用户"""
        if getattr(obj, 'parent', None) and getattr(obj.parent, 'user', None):
            return UserSerializer(obj.parent.user).data
        return None

    def get_replies(self, obj):
        """获取回复列表"""
        replies = Comment.objects.filter(parent=obj, is_deleted=False)[:5]
        return CommentListSerializer(replies, many=True, context=self.context).data

    def get_is_liked(self, obj):
        """获取当前用户是否点赞"""
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            from community.mongodb_models import Like
            like = Like.objects.filter(
                user=request.user,
                content_type='Comment',
                object_id=str(obj.id),
                is_active=True
            ).first()
            return like is not None
        return False

class CommentCreateSerializer(serializers.Serializer):
    """评论创建序列化器"""
    post_id = serializers.CharField()
    parent_id = serializers.CharField(required=False, allow_null=True)
    content = serializers.CharField()

    def validate_post_id(self, value):
        """验证帖子"""
        try:
            post = Post.objects.get(id=value, is_deleted=False)
            # 检查帖子是否允许评论
            if not post.allow_comments:
                raise serializers.ValidationError("该帖子不允许评论")
            return value
        except Post.DoesNotExist:
            raise serializers.ValidationError("帖子不存在或已删除")

    def validate_parent_id(self, value):
        """验证父评论"""
        if value:
            try:
                parent = Comment.objects.get(id=value)
                if parent.is_deleted:
                    raise serializers.ValidationError("父评论不存在或已删除")
                return value
            except Comment.DoesNotExist:
                raise serializers.ValidationError("父评论不存在或已删除")
        return value

    def validate(self, data):
        """验证数据"""
        # 检查父评论是否属于同一帖子
        parent_id = data.get('parent_id')
        post_id = data.get('post_id')

        if parent_id:
            try:
                parent = Comment.objects.get(id=parent_id)
                if str(parent.post.id) != str(post_id):
                    raise serializers.ValidationError({"parent_id": "父评论不属于该帖子"})
            except Comment.DoesNotExist:
                pass

        return data

class CommentUpdateSerializer(serializers.Serializer):
    """评论更新序列化器"""
    content = serializers.CharField()
