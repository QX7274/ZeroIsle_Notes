"""
通知视图
"""

import logging
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.viewsets import ViewSet
from rest_framework.permissions import IsAuthenticated
from .serializers import NotificationSerializer
from .services import NotificationService

logger = logging.getLogger(__name__)

class NotificationViewSet(ViewSet):
    """通知视图集"""
    permission_classes = [IsAuthenticated]
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.notification_service = NotificationService()
    
    def list(self, request):
        """
        获取当前用户的通知列表
        
        Query参数:
            page: 页码，默认1
            page_size: 每页数量，默认20
            type: 通知类型，可选
            is_read: 是否已读，可选
        """
        try:
            user_id = str(request.user.id)
            page = int(request.query_params.get('page', 1))
            page_size = int(request.query_params.get('page_size', 20))
            notification_type = request.query_params.get('type')
            
            is_read_param = request.query_params.get('is_read')
            is_read = None
            if is_read_param is not None:
                is_read = is_read_param.lower() == 'true'
            
            notifications, total = self.notification_service.get_notifications(
                user_id, page, page_size, notification_type, is_read
            )
            
            serializer = NotificationSerializer(notifications, many=True)
            
            return Response({
                'results': serializer.data,
                'total': total,
                'page': page,
                'page_size': page_size
            })
        except Exception as e:
            logger.error(f"获取通知列表失败: {str(e)}")
            return Response(
                {'error': f"获取通知列表失败: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def retrieve(self, request, pk=None):
        """获取单个通知详情"""
        try:
            from .mongodb_models import Notification
            notification = Notification.objects.get(id=pk, recipient=request.user)
            serializer = NotificationSerializer(notification)
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"获取通知详情失败: {str(e)}")
            return Response(
                {'error': f"获取通知详情失败: {str(e)}"},
                status=status.HTTP_404_NOT_FOUND
            )
    
    @action(detail=True, methods=['post'])
    def mark_as_read(self, request, pk=None):
        """标记通知为已读"""
        try:
            success = self.notification_service.mark_as_read(pk)
            if success:
                return Response({'status': 'success'})
            else:
                return Response(
                    {'error': '标记通知为已读失败'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        except Exception as e:
            logger.error(f"标记通知为已读失败: {str(e)}")
            return Response(
                {'error': f"标记通知为已读失败: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['post'])
    def mark_all_as_read(self, request):
        """标记所有通知为已读"""
        try:
            user_id = str(request.user.id)
            count = self.notification_service.mark_all_as_read(user_id)
            return Response({'status': 'success', 'count': count})
        except Exception as e:
            logger.error(f"标记所有通知为已读失败: {str(e)}")
            return Response(
                {'error': f"标记所有通知为已读失败: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'])
    def unread_count(self, request):
        """获取未读通知数量"""
        try:
            user_id = str(request.user.id)
            count = self.notification_service.get_unread_count(user_id)
            return Response({'count': count})
        except Exception as e:
            logger.error(f"获取未读通知数量失败: {str(e)}")
            return Response(
                {'error': f"获取未读通知数量失败: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def destroy(self, request, pk=None):
        """删除通知"""
        try:
            success = self.notification_service.delete_notification(pk)
            if success:
                return Response(status=status.HTTP_204_NO_CONTENT)
            else:
                return Response(
                    {'error': '删除通知失败'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        except Exception as e:
            logger.error(f"删除通知失败: {str(e)}")
            return Response(
                {'error': f"删除通知失败: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['delete'])
    def delete_all(self, request):
        """删除所有通知"""
        try:
            user_id = str(request.user.id)
            count = self.notification_service.delete_all_notifications(user_id)
            return Response({'status': 'success', 'count': count}, status=status.HTTP_204_NO_CONTENT)
        except Exception as e:
            logger.error(f"删除所有通知失败: {str(e)}")
            return Response(
                {'error': f"删除所有通知失败: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
