"""
通知视图
"""

import logging

from django.http import Http404
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ViewSet

from common.pagination import StandardResultsSetPagination
from .mongodb_models import Notification
from .serializers import NotificationSerializer
from .services import NotificationService

logger = logging.getLogger(__name__)


class MongoUserViewSetBase(ViewSet):
    """
    提供 Mongo 用户映射能力的基础视图集。
    """

    permission_classes = [IsAuthenticated]

    def _get_mongo_user(self, request):
        if hasattr(request, 'mongo_user') and request.mongo_user:
            return request.mongo_user

        try:
            from users.utils import get_mongo_user_from_django

            return get_mongo_user_from_django(request.user)
        except Exception as exc:
            logger.error("获取 MongoDB 用户失败: %s", exc, exc_info=True)
            return None

    def _get_required_mongo_user(self, request):
        mongo_user = self._get_mongo_user(request)
        if not mongo_user:
            return None, Response(
                {"detail": "当前用户缺少 Mongo 用户映射，无法访问该接口"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return mongo_user, None


class NotificationViewSet(MongoUserViewSetBase):
    """通知视图集"""

    pagination_class = StandardResultsSetPagination

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

        return self.notification_service.get_notifications_queryset(
            mongo_user,
            notification_type,
            is_read,
        )

    def get_object(self):
        pk = self.kwargs.get('pk')
        if not pk:
            raise Http404("需要提供通知 ID")

        try:
            obj = Notification.objects.get(id=pk)
        except (Notification.DoesNotExist, ValueError):
            raise Http404("通知不存在")

        mongo_user = self._get_mongo_user(self.request)
        if not mongo_user:
            raise Http404("当前用户缺少 Mongo 用户映射")
        if str(getattr(obj.recipient, 'id', '')) != str(getattr(mongo_user, 'id', '')):
            raise Http404("通知不存在")
        return obj

    def list(self, request):
        """获取当前用户的通知列表"""
        try:
            queryset = self.get_queryset()
            paginator = self.pagination_class()
            page = paginator.paginate_queryset(queryset, request, view=self)
            if page is not None:
                serializer = NotificationSerializer(page, many=True)
                return paginator.get_paginated_response(serializer.data)

            serializer = NotificationSerializer(queryset, many=True)
            return Response(serializer.data)
        except Exception as exc:
            logger.error("获取通知列表失败: %s", exc, exc_info=True)
            return Response(
                {"error": f"获取通知列表失败: {exc}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    def retrieve(self, request, pk=None):
        """获取单个通知详情"""
        try:
            notification = self.get_object()
            serializer = NotificationSerializer(notification)
            return Response(serializer.data)
        except Http404 as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_404_NOT_FOUND)
        except Exception as exc:
            logger.error("获取通知详情失败: %s", exc, exc_info=True)
            return Response(
                {"detail": "获取通知详情时发生内部错误"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @action(detail=True, methods=['post'])
    def mark_as_read(self, request, pk=None):
        """标记通知为已读"""
        try:
            notification = self.get_object()
            notification.mark_as_read()
            return Response({"status": "success"})
        except Http404 as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_404_NOT_FOUND)
        except Exception as exc:
            logger.error("标记通知为已读失败: %s", exc, exc_info=True)
            return Response(
                {"detail": "标记通知为已读时发生内部错误"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @action(detail=False, methods=['post'])
    def mark_all_as_read(self, request):
        """标记所有通知为已读"""
        try:
            mongo_user, error_response = self._get_required_mongo_user(request)
            if error_response:
                return error_response

            count = self.notification_service.mark_all_as_read(mongo_user)
            return Response({"status": "success", "count": count})
        except Exception as exc:
            logger.error("标记所有通知为已读失败: %s", exc, exc_info=True)
            return Response(
                {"error": f"标记所有通知为已读失败: {exc}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @action(detail=False, methods=['get'])
    def unread_count(self, request):
        """获取未读通知数量"""
        try:
            mongo_user, error_response = self._get_required_mongo_user(request)
            if error_response:
                return error_response

            count = self.notification_service.get_unread_count(mongo_user)
            return Response({"count": count})
        except Exception as exc:
            logger.error("获取未读通知数量失败: %s", exc, exc_info=True)
            return Response(
                {"error": f"获取未读通知数量失败: {exc}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    def destroy(self, request, pk=None):
        """删除通知"""
        try:
            notification = self.get_object()
            notification.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except Http404 as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_404_NOT_FOUND)
        except Exception as exc:
            logger.error("删除通知失败: %s", exc, exc_info=True)
            return Response(
                {"detail": "删除通知时发生内部错误"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @action(detail=False, methods=['delete'])
    def delete_all(self, request):
        """删除所有通知"""
        try:
            mongo_user, error_response = self._get_required_mongo_user(request)
            if error_response:
                return error_response

            count = self.notification_service.delete_all_notifications(mongo_user)
            return Response({"status": "success", "count": count}, status=status.HTTP_200_OK)
        except Exception as exc:
            logger.error("删除所有通知失败: %s", exc, exc_info=True)
            return Response(
                {"error": f"删除所有通知失败: {exc}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
