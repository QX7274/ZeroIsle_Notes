"""
提醒操作视图
"""

import logging
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from ..services import ReminderService
from ..serializers import ReminderSerializer
from django.utils.dateparse import parse_datetime

logger = logging.getLogger('backend')

class ReminderActionView(viewsets.ViewSet):
    """处理提醒的单个实例操作：完成、取消、延期"""
    permission_classes = [IsAuthenticated]
    service = ReminderService()

    def _get_date_param(self, request, param_name):
        date_str = request.data.get(param_name)
        if not date_str: return None
        try:
            return parse_datetime(date_str)
        except (ValueError, TypeError):
            raise ValueError(f"无效的日期格式: {param_name}")

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        try:
            original_date = self._get_date_param(request, 'original_occurrence_date')
            reminder = self.service.complete_reminder(
                user=request.user,
                reminder_id=pk,
                scope=request.data.get('scope', 'this_instance'),
                completion_date=original_date,
                request=request
            )
            return Response(ReminderSerializer(reminder).data)
        except Exception as e:
            logger.error(f"完成提醒失败: {e}")
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        try:
            original_date = self._get_date_param(request, 'original_occurrence_date')
            reminder = self.service.cancel_reminder(
                user=request.user,
                reminder_id=pk,
                scope=request.data.get('scope', 'this_instance'),
                cancellation_date=original_date,
                request=request
            )
            return Response(ReminderSerializer(reminder).data)
        except Exception as e:
            logger.error(f"取消提醒失败: {e}")
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def delay(self, request, pk=None):
        try:
            new_due_date = self._get_date_param(request, 'new_due_date')
            if not new_due_date:
                raise ValueError("延期操作必须提供 'new_due_date'")
            
            original_date = self._get_date_param(request, 'original_occurrence_date')
            reminder = self.service.delay_reminder(
                user=request.user,
                reminder_id=pk,
                new_due_date=new_due_date,
                scope=request.data.get('scope', 'this_instance'),
                original_due_date=original_date,
                request=request
            )
            return Response(ReminderSerializer(reminder).data)
        except Exception as e:
            logger.error(f"延期提醒失败: {e}")
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

