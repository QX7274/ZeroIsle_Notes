"""
通知视图
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from notes.mongodb_models import Notification
from notes.serializers import NotificationSerializer
from common.permissions import IsOwnerOrReadOnly
import logging
import uuid

logger = logging.getLogger(__name__)

class NotificationViewSet(viewsets.ViewSet):
    """
    通知视图集
    """
    serializer_class = NotificationSerializer
    permission_classes = [IsOwnerOrReadOnly]

    def list(self, request):
        """获取通知列表"""
        user = request.user
        is_read = request.query_params.get('is_read')

        if is_read is not None:
            notifications = Notification.objects.filter(
                user=user,
                is_read=is_read.lower() == 'true',
                is_deleted=False
            )
        else:
            notifications = Notification.objects.filter(
                user=user,
                is_deleted=False
            )

        serializer = NotificationSerializer(notifications, many=True)
        return Response(serializer.data)

    def retrieve(self, request, pk=None):
        """获取单个通知详情"""
        try:
            notification = Notification.objects.get(id=pk, is_deleted=False)
            # 检查权限
            if notification.user != request.user:
                return Response(
                    {"detail": "您没有权限查看此通知"},
                    status=status.HTTP_403_FORBIDDEN
                )
            serializer = NotificationSerializer(notification)
            return Response(serializer.data)
        except Notification.DoesNotExist:
            return Response(
                {"detail": "通知不存在或已删除"},
                status=status.HTTP_404_NOT_FOUND
            )

    def create(self, request):
        """创建通知"""
        serializer = NotificationSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            # 创建通知
            notification = Notification(
                id=uuid.uuid4(),
                user=request.user,
                title=request.data.get('title'),
                content=request.data.get('content'),
                notification_type=request.data.get('notification_type'),
                related_object_id=request.data.get('related_object_id', ''),
                related_object_type=request.data.get('related_object_type', ''),
                created_at=timezone.now(),
                updated_at=timezone.now()
            )
            notification.save()

            serializer = NotificationSerializer(notification)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def destroy(self, request, pk=None):
        """删除通知"""
        try:
            notification = Notification.objects.get(id=pk, user=request.user, is_deleted=False)
            notification.delete()  # 软删除
            return Response(status=status.HTTP_204_NO_CONTENT)
        except Notification.DoesNotExist:
            return Response(
                {"detail": "通知不存在或已删除"},
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=True, methods=['post'])
    def mark_as_read(self, request, pk=None):
        """标记通知为已读"""
        try:
            notification = Notification.objects.get(id=pk, user=request.user, is_deleted=False)
            notification.mark_as_read()

            serializer = NotificationSerializer(notification)
            return Response({
                'message': '通知已标记为已读',
                'notification': serializer.data
            })
        except Notification.DoesNotExist:
            return Response(
                {"detail": "通知不存在或已删除"},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"标记通知为已读失败: {str(e)}")
            return Response(
                {'error': f'标记通知为已读失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['post'])
    def mark_as_unread(self, request, pk=None):
        """标记通知为未读"""
        try:
            notification = Notification.objects.get(id=pk, user=request.user, is_deleted=False)
            notification.mark_as_unread()

            serializer = NotificationSerializer(notification)
            return Response({
                'message': '通知已标记为未读',
                'notification': serializer.data
            })
        except Notification.DoesNotExist:
            return Response(
                {"detail": "通知不存在或已删除"},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"标记通知为未读失败: {str(e)}")
            return Response(
                {'error': f'标记通知为未读失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['post'])
    def mark_all_as_read(self, request):
        """标记所有通知为已读"""
        try:
            notifications = Notification.objects.filter(
                user=request.user,
                is_read=False,
                is_deleted=False
            )

            # 批量更新
            for notification in notifications:
                notification.mark_as_read()

            return Response({'message': '所有通知已标记为已读'})
        except Exception as e:
            logger.error(f"标记所有通知为已读失败: {str(e)}")
            return Response(
                {'error': f'标记所有通知为已读失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['get'])
    def unread_count(self, request):
        """获取未读通知数量"""
        try:
            count = Notification.objects.filter(
                user=request.user,
                is_read=False,
                is_deleted=False
            ).count()

            return Response({'unread_count': count})
        except Exception as e:
            logger.error(f"获取未读通知数量失败: {str(e)}")
            return Response(
                {'error': f'获取未读通知数量失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['get'])
    def recent(self, request):
        """获取最近的通知"""
        try:
            notifications = Notification.objects.filter(
                user=request.user,
                is_deleted=False
            ).order_by('-created_at')[:10]

            serializer = NotificationSerializer(notifications, many=True)
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"获取最近通知失败: {str(e)}")
            return Response(
                {'error': f'获取最近通知失败: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )