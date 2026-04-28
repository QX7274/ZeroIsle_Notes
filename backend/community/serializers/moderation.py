"""
社区内容治理（审核）序列化器
"""

from rest_framework import serializers
from ..mongodb_models import Report, Post, Comment
from users.serializers import UserSerializer

class ReportSerializer(serializers.Serializer):
    """
    举报列表序列化器
    """
    id = serializers.UUIDField(read_only=True)
    user = UserSerializer(read_only=True)
    content_type = serializers.CharField(read_only=True)
    object_id = serializers.CharField(read_only=True)
    reason = serializers.CharField(read_only=True)
    status = serializers.CharField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)

class ReportDetailSerializer(ReportSerializer):
    """
    举报详情序列化器，包含被举报内容的快照。
    """
    description = serializers.CharField(read_only=True)
    handled_by = UserSerializer(read_only=True)
    handled_at = serializers.DateTimeField(read_only=True)
    content_object = serializers.SerializerMethodField()

    def get_content_object(self, obj):
        """获取被举报的具体内容"""
        if obj.content_type == 'Post':
            try:
                post = Post.objects.get(id=obj.object_id)
                from .post import PostDetailSerializer # 避免循环导入
                return PostDetailSerializer(post).data
            except Post.DoesNotExist:
                return {'error': '被举报的帖子不存在或已被删除'}
        elif obj.content_type == 'Comment':
            try:
                comment = Comment.objects.get(id=obj.object_id)
                from .comment import CommentSerializer
                return CommentSerializer(comment).data
            except Comment.DoesNotExist:
                return {'error': '被举报的评论不存在或已被删除'}
        return None
