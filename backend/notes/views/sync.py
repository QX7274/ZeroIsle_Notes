"""
笔记同步视图
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from notes.models import NoteSync
from notes.serializers import NoteSyncSerializer
from common.permissions import IsOwnerOrReadOnly
import logging
from datetime import timedelta

logger = logging.getLogger(__name__)

class NoteSyncViewSet(viewsets.ModelViewSet):
    """
    笔记同步视图集
    """
    serializer_class = NoteSyncSerializer
    permission_classes = [IsOwnerOrReadOnly]
    
    def get_queryset(self):
        """获取查询集"""
        user = self.request.user
        device_id = self.request.query_params.get('device_id')
        if device_id:
            return NoteSync.objects.filter(user=user, device_id=device_id)
        return NoteSync.objects.filter(user=user)
    
    def perform_create(self, serializer):
        """创建同步记录时设置时间"""
        serializer.save(
            last_sync_at=timezone.now(),
            user=self.request.user
        )
    
    @action(detail=False, methods=['post'])
    def sync_all(self, request):
        """同步所有笔记"""
        try:
            device_id = request.data.get('device_id')
            if not device_id:
                return Response(
                    {'error': '缺少device_id参数'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # 获取上次同步时间
            last_sync = NoteSync.objects.filter(
                user=request.user,
                device_id=device_id
            ).first()
            
            last_sync_time = last_sync.last_sync_at if last_sync else None
            
            # 获取需要同步的笔记
            notes = request.user.notes.all()
            if last_sync_time:
                notes = notes.filter(updated_at__gt=last_sync_time)
            
            # 更新同步记录
            NoteSync.objects.update_or_create(
                user=request.user,
                device_id=device_id,
                defaults={'last_sync_at': timezone.now()}
            )
            
            return Response({
                'message': '同步成功',
                'notes_count': notes.count(),
                'last_sync_time': timezone.now()
            })
        except Exception as e:
            logger.error(f"同步失败: {str(e)}")
            return Response(
                {'error': '同步失败'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'])
    def sync_status(self, request):
        """获取同步状态"""
        try:
            device_id = request.query_params.get('device_id')
            if not device_id:
                return Response(
                    {'error': '缺少device_id参数'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            sync = NoteSync.objects.filter(
                user=request.user,
                device_id=device_id
            ).first()
            
            if not sync:
                return Response({'message': '未找到同步记录'})
            
            return Response({
                'last_sync_at': sync.last_sync_at,
                'sync_status': 'success' if sync.last_sync_at else 'pending'
            })
        except Exception as e:
            logger.error(f"获取同步状态失败: {str(e)}")
            return Response(
                {'error': '获取同步状态失败'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            ) 