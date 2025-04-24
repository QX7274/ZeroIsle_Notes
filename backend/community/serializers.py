"""社区序列化器"""

from rest_framework import serializers
from .models import (
    CommunityPost, PostTag, PostCategory, PostAttachment,
    Comment, Like, Favorite, Follow, Notification
)
from users.serializers import UserSerializer


class PostTagSerializer(serializers.ModelSerializer):
    """帖子标签序列化器"""
    class Meta:
        model = PostTag
        fields = ['id', 'name']


class PostCategorySerializer(serializers.ModelSerializer):
    """帖子分类序列化器"""
    class Meta:
        model = PostCategory
        fields = ['id', 'name', 'description', 'icon']


class PostAttachmentSerializer(serializers.ModelSerializer):
    """帖子附件序列化器"""
    class Meta:
        model = PostAttachment
        fields = ['id', 'file', 'file_name', 'file_size', 'file_type', 'download_count', 'created_at']


class CommentSerializer(serializers.ModelSerializer):
    """评论序列化器"""
    author = UserSerializer(read_only=True)
    replies_count = serializers.SerializerMethodField()
    is_liked = serializers.SerializerMethodField()
    
    class Meta:
        model = Comment
        fields = ['id', 'post', 'author', 'content', 'parent', 'like_count', 
                  'replies_count', 'is_liked', 'created_at', 'updated_at']
        read_only_fields = ['author', 'like_count', 'created_at', 'updated_at']
    
    def get_replies_count(self, obj):
        return obj.replies.count()
    
    def get_is_liked(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.likes.filter(user=request.user).exists()
        return False


class CommentCreateSerializer(serializers.ModelSerializer):
    """评论创建序列化器"""
    class Meta:
        model = Comment
        fields = ['post', 'content', 'parent']
    
    def create(self, validated_data):
        request = self.context.get('request')
        validated_data['author'] = request.user
        comment = Comment.objects.create(**validated_data)
        
        # 更新帖子评论计数
        post = validated_data['post']
        post.comment_count = post.comments.count()
        post.save(update_fields=['comment_count'])
        
        return comment


class CommunityPostListSerializer(serializers.ModelSerializer):
    """社区帖子列表序列化器"""
    author = UserSerializer(read_only=True)
    tags = PostTagSerializer(many=True, read_only=True)
    is_liked = serializers.SerializerMethodField()
    is_favorited = serializers.SerializerMethodField()
    
    class Meta:
        model = CommunityPost
        fields = ['id', 'title', 'content', 'author', 'tags', 'is_public', 
                  'is_featured', 'view_count', 'like_count', 'comment_count', 
                  'download_count', 'is_liked', 'is_favorited', 'created_at', 'updated_at']
    
    def get_is_liked(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.likes.filter(user=request.user).exists()
        return False
    
    def get_is_favorited(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.favorites.filter(user=request.user).exists()
        return False


class CommunityPostDetailSerializer(CommunityPostListSerializer):
    """社区帖子详情序列化器"""
    attachments = PostAttachmentSerializer(many=True, read_only=True)
    comments = serializers.SerializerMethodField()
    
    class Meta(CommunityPostListSerializer.Meta):
        fields = CommunityPostListSerializer.Meta.fields + ['attachments', 'comments']
    
    def get_comments(self, obj):
        # 只获取顶级评论
        comments = obj.comments.filter(parent=None)
        return CommentSerializer(comments, many=True, context=self.context).data


class CommunityPostCreateSerializer(serializers.ModelSerializer):
    """社区帖子创建序列化器"""
    tags = serializers.ListField(
        child=serializers.CharField(max_length=50),
        required=False
    )
    
    class Meta:
        model = CommunityPost
        fields = ['title', 'content', 'note', 'is_public', 'tags']
    
    def create(self, validated_data):
        tags_data = validated_data.pop('tags', [])
        request = self.context.get('request')
        validated_data['author'] = request.user
        
        post = CommunityPost.objects.create(**validated_data)
        
        # 处理标签
        for tag_name in tags_data:
            tag, _ = PostTag.objects.get_or_create(name=tag_name)
            post.tags.add(tag)
        
        return post


class LikeSerializer(serializers.ModelSerializer):
    """点赞序列化器"""
    class Meta:
        model = Like
        fields = ['id', 'user', 'post', 'comment', 'created_at']
        read_only_fields = ['user', 'created_at']


class FavoriteSerializer(serializers.ModelSerializer):
    """收藏序列化器"""
    class Meta:
        model = Favorite
        fields = ['id', 'user', 'post', 'created_at']
        read_only_fields = ['user', 'created_at']


class FollowSerializer(serializers.ModelSerializer):
    """关注序列化器"""
    class Meta:
        model = Follow
        fields = ['id', 'follower', 'followed', 'created_at']
        read_only_fields = ['follower', 'created_at']


class NotificationSerializer(serializers.ModelSerializer):
    """通知序列化器"""
    sender = UserSerializer(read_only=True)
    
    class Meta:
        model = Notification
        fields = ['id', 'recipient', 'sender', 'type', 'post', 'comment', 
                  'content', 'is_read', 'created_at']
        read_only_fields = ['recipient', 'sender', 'type', 'post', 'comment', 
                           'content', 'created_at']
