"""
笔记协作视图
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from notes.models import NoteCollaboration
from notes.serializers import NoteCollaborationSerializer
from common.permissions import IsOwnerOrReadOnly
import logging

logger = logging.getLogger(__name__)

class NoteCollaborationViewSet(viewsets.ModelViewSet):
    """
    笔记协作视图集
    """
    serializer_class = NoteCollaborationSerializer
    permission_classes = [IsOwnerOrReadOnly]
    
    def get_queryset(self):
        """获取查询集"""
        user = self.request.user
        note_id = self.request.query_params.get('note_id')
        if note_id:
            return NoteCollaboration.objects.filter(note__user=user, note_id=note_id)
        return NoteCollaboration.objects.filter(note__user=user)
    
    def perform_create(self, serializer):
        """创建协作时设置创建时间"""
        serializer.save(created_at=timezone.now())
    
    @action(detail=True, methods=['post'])
    def invite(self, request, pk=None):
        """邀请协作者"""
        collaboration = self.get_object()
        try:
            user_id = request.data.get('user_id')
            if not user_id:
                return Response(
                    {'error': '缺少user_id参数'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            collaboration.collaborators.add(user_id)
            return Response({'message': '邀请成功'})
        except Exception as e:
            logger.error(f"邀请协作者失败: {str(e)}")
            return Response(
                {'error': '邀请协作者失败'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['post'])
    def remove_collaborator(self, request, pk=None):
        """移除协作者"""
        collaboration = self.get_object()
        try:
            user_id = request.data.get('user_id')
            if not user_id:
                return Response(
                    {'error': '缺少user_id参数'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            collaboration.collaborators.remove(user_id)
            return Response({'message': '移除成功'})
        except Exception as e:
            logger.error(f"移除协作者失败: {str(e)}")
            return Response(
                {'error': '移除协作者失败'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'])
    def my_collaborations(self, request):
        """获取我参与的协作"""
        try:
            collaborations = NoteCollaboration.objects.filter(
                collaborators=request.user
            )
            return Response(
                NoteCollaborationSerializer(collaborations, many=True).data
            )
        except Exception as e:
            logger.error(f"获取协作列表失败: {str(e)}")
            return Response(
                {'error': '获取协作列表失败'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            ) 