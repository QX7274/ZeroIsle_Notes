"""
笔记提醒视图
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from notes.models import NoteReminder
from notes.serializers import NoteReminderSerializer
from common.permissions import IsOwnerOrReadOnly
import logging
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

class NoteReminderViewSet(viewsets.ModelViewSet):
    """
    笔记提醒视图集
    """
    serializer_class = NoteReminderSerializer
    permission_classes = [IsOwnerOrReadOnly]
    
    def get_queryset(self):
        """获取查询集"""
        user = self.request.user
        note_id = self.request.query_params.get('note_id')
        if note_id:
            return NoteReminder.objects.filter(note__user=user, note_id=note_id)
        return NoteReminder.objects.filter(note__user=user)
    
    def perform_create(self, serializer):
        """创建提醒时设置创建时间"""
        serializer.save(created_at=timezone.now())
    
    @action(detail=True, methods=['post'])
    def snooze(self, request, pk=None):
        """延迟提醒"""
        reminder = self.get_object()
        try:
            minutes = request.data.get('minutes', 30)
            reminder.remind_at = timezone.now() + timedelta(minutes=minutes)
            reminder.save()
            return Response({
                'message': '提醒已延迟',
                'new_remind_at': reminder.remind_at
            })
        except Exception as e:
            logger.error(f"延迟提醒失败: {str(e)}")
            return Response(
                {'error': '延迟提醒失败'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'])
    def upcoming(self, request):
        """获取即将到来的提醒"""
        try:
            reminders = NoteReminder.objects.filter(
                note__user=request.user,
                remind_at__gt=timezone.now(),
                is_completed=False
            ).order_by('remind_at')
            return Response(
                NoteReminderSerializer(reminders, many=True).data
            )
        except Exception as e:
            logger.error(f"获取即将到来的提醒失败: {str(e)}")
            return Response(
                {'error': '获取即将到来的提醒失败'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'])
    def completed(self, request):
        """获取已完成的提醒"""
        try:
            reminders = NoteReminder.objects.filter(
                note__user=request.user,
                is_completed=True
            ).order_by('-remind_at')
            return Response(
                NoteReminderSerializer(reminders, many=True).data
            )
        except Exception as e:
            logger.error(f"获取已完成的提醒失败: {str(e)}")
            return Response(
                {'error': '获取已完成的提醒失败'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """标记提醒为已完成"""
        reminder = self.get_object()
        try:
            reminder.is_completed = True
            reminder.completed_at = timezone.now()
            reminder.save()
            return Response({'message': '提醒已标记为已完成'})
        except Exception as e:
            logger.error(f"标记提醒为已完成失败: {str(e)}")
            return Response(
                {'error': '标记提醒为已完成失败'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            ) 