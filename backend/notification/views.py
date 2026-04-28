"""
通知视图
"""

import logging
import uuid
from django.http import Http404
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.viewsets import ViewSet
from rest_framework.permissions import IsAuthenticated
from rest_framework.pagination import PageNumberPagination

from .serializers import NotificationSerializer
from .services import NotificationService
from common.permissions import IsOwner
from .mongodb_models import Notification

logger = logging.getLogger(__name__)

class MongoUserViewSetBase(ViewSet):
    """
    一个基础视图集，提供获取 MongoDB 用户和通用权限检查的功能。
    """
    permission_classes = [IsAuthenticated, IsOwner]

    def _get_mongo_user(self, request):
        """
        从请求中获取对应的 MongoDB 用户对象
        优先使用中间件注入的 request.mongo_user
        """
        # 优先使用中间件注入的 mongo_user
        if hasattr(request, 'mongo_user') and request.mongo_user:
            return request.mongo_user

        # 降级方案：手动查找（兼容旧代码）
        try:
            from users.mongodb_models import User as MongoUser
            django_user = request.user
            if not django_user or not django_user.is_authenticated:
                return None
            mongo_user = MongoUser.objects(username=django_user.username).first()
            if not mongo_user:
                logger.warning(f"未找到对应的MongoDB用户: {django_user.username}")
            return mongo_user
        except Exception as e:
            logger.error(f"获取 MongoDB 用户失败: {e}", exc_info=True)
            return None

class NotificationViewSet(MongoUserViewSetBase):
    """通知视图集"""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.notification_service = NotificationService()

    def get_queryset(self):
        mongo_user = self._get_mongo_user(self.request)
        if not mongo_user:
            return Notification.objects.none()

        notification_type = self.request.query_params.get('type')
        is_read_param = self.request.query_params.get('is_read')
        is_read = None
        if is_read_param is not None:
            is_read = is_read_param.lower() == 'true'

        return self.notification_service.get_notifications_queryset(mongo_user.id, notification_type, is_read)

    def get_object(self):
        pk = self.kwargs.get('pk')
        if not pk:
            raise Http404("需要提供通知ID")

        try:
            obj = Notification.objects.get(id=pk)
        except (Notification.DoesNotExist, ValueError):
            raise Http404("通知不存在")

        self.check_object_permissions(self.request, obj)
        return obj

    def list(self, request):
        """获取当前用户的通知列表"""
        try:
            queryset = self.get_queryset()
            paginator = PageNumberPagination()
            page = paginator.paginate_queryset(queryset, request)
            if page is not None:
                serializer = NotificationSerializer(page, many=True)
                return paginator.get_paginated_response(serializer.data)

            serializer = NotificationSerializer(queryset, many=True)
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"获取通知列表失败: {str(e)}")
            return Response(
                {'error': f"获取通知列表失败: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def retrieve(self, request, pk=None):
        """获取单个通知详情"""
        try:
            notification = self.get_object()
            serializer = NotificationSerializer(notification)
            return Response(serializer.data)
        except Http404 as e:
            return Response({"detail": str(e)}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"获取通知详情时发生内部错误: {str(e)}", exc_info=True)
            return Response(
                {"detail": "获取通知详情时发生内部错误"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['post'])
    def mark_as_read(self, request, pk=None):
        """标记通知为已读"""
        try:
            notification = self.get_object()
            notification.mark_as_read()
            return Response({'status': 'success'})
        except Http404 as e:
            return Response({"detail": str(e)}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"标记通知为已读失败: {e}", exc_info=True)
            return Response(
                {"detail": "标记通知为已读时发生内部错误"},
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
            notification = self.get_object()
            notification.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except Http404 as e:
            return Response({"detail": str(e)}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"删除通知时发生内部错误: {e}", exc_info=True)
            return Response(
                {"detail": "删除通知时发生内部错误"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['delete'])
    def delete_all(self, request):
        """删除所有通知"""
        try:
            user_id = str(request.user.id)
            count = self.notification_service.delete_all_notifications(user_id)
            # 204 不应携带响应体，改为 200 返回删除数量
            return Response({'status': 'success', 'count': count}, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"删除所有通知失败: {str(e)}")
            return Response(
                {'error': f"删除所有通知失败: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
