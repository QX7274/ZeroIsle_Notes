"""
提醒通知视图
"""

from rest_framework import viewsets, status, filters
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from reminder.mongodb_models import ReminderNotification
from reminder.serializers import ReminderNotificationSerializer
from common.permissions import IsOwner
from common.pagination import StandardResultsSetPagination

class ReminderNotificationViewSet(viewsets.ViewSet):
    """提醒通知视图集"""
    serializer_class = ReminderNotificationSerializer
    permission_classes = [IsAuthenticated, IsOwner]
    pagination_class = StandardResultsSetPagination
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['status', 'reminder']
    ordering_fields = ['scheduled_time', 'sent_time', 'created_at']
    ordering = ['-scheduled_time']

    def list(self, request):
        """获取通知列表"""
        # 获取查询参数
        status_param = request.query_params.get('status')
        reminder_param = request.query_params.get('reminder')
        ordering = request.query_params.get('ordering', '-scheduled_time')

        # 构建查询条件
        query = {'reminder__user': request.user}

        if status_param:
            query['status'] = status_param
        if reminder_param:
            query['reminder'] = reminder_param

        # 执行查询
        notifications = ReminderNotification.objects.filter(**query).order_by(ordering)

        # 分页
        page = self.paginate_queryset(notifications)
        if page is not None:
            serializer = ReminderNotificationSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = ReminderNotificationSerializer(notifications, many=True)
        return Response(serializer.data)

    def retrieve(self, request, pk=None):
        """获取单个通知详情"""
        try:
            notification = ReminderNotification.objects.get(id=pk)
            # 检查权限
            if notification.reminder.user != request.user:
                return Response(
                    {"detail": "您没有权限查看此通知"},
                    status=status.HTTP_403_FORBIDDEN
                )
            serializer = ReminderNotificationSerializer(notification)
            return Response(serializer.data)
        except ReminderNotification.DoesNotExist:
            return Response(
                {"detail": "通知不存在"},
                status=status.HTTP_404_NOT_FOUND
            )
