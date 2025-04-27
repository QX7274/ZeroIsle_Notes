"""
笔记评论视图
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from notes.models import NoteComment
from notes.serializers import NoteCommentSerializer
from common.permissions import IsOwnerOrReadOnly
import logging

logger = logging.getLogger(__name__)

class NoteCommentViewSet(viewsets.ModelViewSet):
    """
    笔记评论视图集
    """
    serializer_class = NoteCommentSerializer
    permission_classes = [IsOwnerOrReadOnly]
    
    def get_queryset(self):
        """获取查询集"""
        user = self.request.user
        note_id = self.request.query_params.get('note_id')
        if note_id:
            return NoteComment.objects.filter(note__user=user, note_id=note_id)
        return NoteComment.objects.filter(note__user=user)
    
    def perform_create(self, serializer):
        """创建评论时设置创建时间和用户"""
        serializer.save(
            user=self.request.user,
            created_at=timezone.now()
        )
    
    @action(detail=True, methods=['post'])
    def like(self, request, pk=None):
        """点赞评论"""
        comment = self.get_object()
        try:
            if request.user in comment.likes.all():
                comment.likes.remove(request.user)
                return Response({'message': '取消点赞成功'})
            else:
                comment.likes.add(request.user)
                return Response({'message': '点赞成功'})
        except Exception as e:
            logger.error(f"点赞操作失败: {str(e)}")
            return Response(
                {'error': '点赞操作失败'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['post'])
    def reply(self, request, pk=None):
        """回复评论"""
        parent_comment = self.get_object()
        try:
            reply = NoteComment.objects.create(
                note=parent_comment.note,
                user=request.user,
                content=request.data.get('content'),
                parent=parent_comment,
                created_at=timezone.now()
            )
            return Response(NoteCommentSerializer(reply).data)
        except Exception as e:
            logger.error(f"回复评论失败: {str(e)}")
            return Response(
                {'error': '回复评论失败'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'])
    def my_comments(self, request):
        """获取我的评论"""
        try:
            comments = NoteComment.objects.filter(user=request.user)
            return Response(NoteCommentSerializer(comments, many=True).data)
        except Exception as e:
            logger.error(f"获取我的评论失败: {str(e)}")
            return Response(
                {'error': '获取我的评论失败'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            ) 