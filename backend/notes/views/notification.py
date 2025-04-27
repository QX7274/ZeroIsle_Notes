"""
通知视图
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from notes.models import Notification
from notes.serializers import NotificationSerializer
from common.permissions import IsOwnerOrReadOnly
import logging

logger = logging.getLogger(__name__)

class NotificationViewSet(viewsets.ModelViewSet):
    """
    通知视图集
    """
    serializer_class = NotificationSerializer
    permission_classes = [IsOwnerOrReadOnly]
    
    def get_queryset(self):
        """获取查询集"""
        user = self.request.user
        is_read = self.request.query_params.get('is_read')
        if is_read is not None:
            return Notification.objects.filter(
                user=user,
                is_read=is_read.lower() == 'true'
            )
        return Notification.objects.filter(user=user)
    
    def perform_create(self, serializer):
        """创建通知时设置创建时间"""
        serializer.save(created_at=timezone.now())
    
    @action(detail=True, methods=['post'])
    def mark_as_read(self, request, pk=None):
        """标记通知为已读"""
        notification = self.get_object()
        try:
            notification.is_read = True
            notification.read_at = timezone.now()
            notification.save()
            return Response({'message': '通知已标记为已读'})
        except Exception as e:
            logger.error(f"标记通知为已读失败: {str(e)}")
            return Response(
                {'error': '标记通知为已读失败'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['post'])
    def mark_all_as_read(self, request):
        """标记所有通知为已读"""
        try:
            Notification.objects.filter(
                user=request.user,
                is_read=False
            ).update(
                is_read=True,
                read_at=timezone.now()
            )
            return Response({'message': '所有通知已标记为已读'})
        except Exception as e:
            logger.error(f"标记所有通知为已读失败: {str(e)}")
            return Response(
                {'error': '标记所有通知为已读失败'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'])
    def unread_count(self, request):
        """获取未读通知数量"""
        try:
            count = Notification.objects.filter(
                user=request.user,
                is_read=False
            ).count()
            return Response({'unread_count': count})
        except Exception as e:
            logger.error(f"获取未读通知数量失败: {str(e)}")
            return Response(
                {'error': '获取未读通知数量失败'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'])
    def recent(self, request):
        """获取最近的通知"""
        try:
            notifications = Notification.objects.filter(
                user=request.user
            ).order_by('-created_at')[:10]
            return Response(
                NotificationSerializer(notifications, many=True).data
            )
        except Exception as e:
            logger.error(f"获取最近通知失败: {str(e)}")
            return Response(
                {'error': '获取最近通知失败'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            ) 