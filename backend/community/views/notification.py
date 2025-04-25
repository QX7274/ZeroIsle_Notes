"""
通知视图
"""

from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend

from community.models import Notification
from community.serializers import NotificationSerializer
from community.services import NotificationService
from common.permissions import IsOwner
from common.pagination import StandardResultsSetPagination

class NotificationViewSet(viewsets.ReadOnlyModelViewSet):
    """通知视图集"""
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated, IsOwner]
    pagination_class = StandardResultsSetPagination
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['notification_type', 'is_read']
    ordering_fields = ['created_at']
    ordering = ['-created_at']
    
    def get_queryset(self):
        """获取查询集"""
        return Notification.objects.filter(recipient=self.request.user)
    
    @action(detail=True, methods=['post'])
    def mark_as_read(self, request, pk=None):
        """标记为已读"""
        notification = self.get_object()
        
        # 标记为已读
        notification_service = NotificationService()
        notification = notification_service.mark_as_read(notification.id, request.user)
        
        serializer = self.get_serializer(notification)
        return Response(serializer.data)
    
    @action(detail=False, methods=['post'])
    def mark_all_as_read(self, request):
        """标记所有为已读"""
        notification_service = NotificationService()
        count = notification_service.mark_all_as_read(request.user)
        
        return Response({
            'count': count
        })
    
    @action(detail=True, methods=['delete'])
    def delete(self, request, pk=None):
        """删除通知"""
        notification = self.get_object()
        
        # 删除通知
        notification_service = NotificationService()
        success = notification_service.delete_notification(notification.id, request.user)
        
        if success:
            return Response(status=status.HTTP_204_NO_CONTENT)
        else:
            return Response(
                {"detail": "删除失败"},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=False, methods=['get'])
    def unread(self, request):
        """获取未读通知"""
        notifications = Notification.objects.filter(
            recipient=request.user,
            is_read=False
        )
        
        # 分页
        page = self.paginate_queryset(notifications)
        
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        
        serializer = self.get_serializer(notifications, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def count(self, request):
        """获取未读通知数量"""
        notification_service = NotificationService()
        count = notification_service.get_unread_count(request.user)
        
        return Response({
            'count': count
        })
