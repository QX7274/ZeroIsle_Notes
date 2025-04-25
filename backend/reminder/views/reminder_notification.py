"""
提醒通知视图
"""

from rest_framework import viewsets, status, filters
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend

from reminder.models import ReminderNotification
from reminder.serializers import ReminderNotificationSerializer
from common.permissions import IsOwner
from common.pagination import StandardResultsSetPagination

class ReminderNotificationViewSet(viewsets.ReadOnlyModelViewSet):
    """提醒通知视图集"""
    serializer_class = ReminderNotificationSerializer
    permission_classes = [IsAuthenticated, IsOwner]
    pagination_class = StandardResultsSetPagination
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['status', 'reminder']
    ordering_fields = ['scheduled_time', 'sent_time', 'created_at']
    ordering = ['-scheduled_time']
    
    def get_queryset(self):
        """获取查询集"""
        return ReminderNotification.objects.filter(
            reminder__user=self.request.user
        )
