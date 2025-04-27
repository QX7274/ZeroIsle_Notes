"""
笔记版本视图
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from notes.models import NoteVersion
from notes.serializers import NoteVersionSerializer
from common.permissions import IsOwnerOrReadOnly
import logging
from datetime import timedelta

logger = logging.getLogger(__name__)

class NoteVersionViewSet(viewsets.ModelViewSet):
    """
    笔记版本视图集
    """
    serializer_class = NoteVersionSerializer
    permission_classes = [IsOwnerOrReadOnly]
    
    def get_queryset(self):
        """获取查询集"""
        user = self.request.user
        note_id = self.request.query_params.get('note_id')
        if note_id:
            return NoteVersion.objects.filter(note__user=user, note_id=note_id)
        return NoteVersion.objects.filter(note__user=user)
    
    def perform_create(self, serializer):
        """创建版本时设置创建时间"""
        serializer.save(created_at=timezone.now())
    
    @action(detail=True, methods=['post'])
    def restore(self, request, pk=None):
        """恢复版本"""
        version = self.get_object()
        try:
            # 创建新版本
            new_version = NoteVersion.objects.create(
                note=version.note,
                content=version.note.content,
                created_at=timezone.now()
            )
            
            # 恢复内容
            version.note.content = version.content
            version.note.save()
            
            return Response({
                'message': '版本恢复成功',
                'new_version_id': new_version.id
            })
        except Exception as e:
            logger.error(f"恢复版本失败: {str(e)}")
            return Response(
                {'error': '恢复版本失败'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'])
    def auto_save(self, request):
        """获取自动保存的版本"""
        note_id = request.query_params.get('note_id')
        if not note_id:
            return Response(
                {'error': '缺少note_id参数'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            # 获取最近30分钟内的自动保存版本
            thirty_minutes_ago = timezone.now() - timedelta(minutes=30)
            version = NoteVersion.objects.filter(
                note_id=note_id,
                is_auto_save=True,
                created_at__gte=thirty_minutes_ago
            ).order_by('-created_at').first()
            
            if version:
                return Response(NoteVersionSerializer(version).data)
            return Response({'message': '没有找到自动保存的版本'})
        except Exception as e:
            logger.error(f"获取自动保存版本失败: {str(e)}")
            return Response(
                {'error': '获取自动保存版本失败'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['post'])
    def create_auto_save(self, request):
        """创建自动保存版本"""
        note_id = request.data.get('note_id')
        content = request.data.get('content')
        
        if not note_id or not content:
            return Response(
                {'error': '缺少必要参数'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            version = NoteVersion.objects.create(
                note_id=note_id,
                content=content,
                is_auto_save=True,
                created_at=timezone.now()
            )
            return Response(NoteVersionSerializer(version).data)
        except Exception as e:
            logger.error(f"创建自动保存版本失败: {str(e)}")
            return Response(
                {'error': '创建自动保存版本失败'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            ) 