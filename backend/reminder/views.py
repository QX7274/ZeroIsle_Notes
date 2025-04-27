"""
提醒模块视图
"""

from rest_framework import viewsets, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django.utils import timezone
from django.shortcuts import get_object_or_404
from django.db.models import Q

from .models import Reminder, ReminderNotification
from .serializers import ReminderSerializer, ReminderNotificationSerializer
from notes.models import Note


class ReminderViewSet(viewsets.ModelViewSet):
    """
    提醒视图集
    提供提醒的CRUD操作
    """
    serializer_class = ReminderSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        """
        根据用户筛选查询集
        """
        user = self.request.user
        return Reminder.objects.filter(user=user)
    
    def perform_create(self, serializer):
        """
        创建提醒时设置用户
        """
        serializer.save(user=self.request.user)


class ReminderNotificationViewSet(viewsets.ModelViewSet):
    """
    提醒通知视图集
    提供提醒通知的CRUD操作
    """
    serializer_class = ReminderNotificationSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        """
        根据用户筛选查询集
        """
        user = self.request.user
        return ReminderNotification.objects.filter(reminder__user=user)


# 兼容旧版API
@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_upcoming_reminders(request):
    """
    获取即将到来的提醒
    """
    user = request.user
    now = timezone.now()
    
    # 获取未来24小时内的提醒
    end_time = now + timezone.timedelta(hours=24)
    reminders = Reminder.objects.filter(
        user=user,
        reminder_time__gte=now,
        reminder_time__lte=end_time,
        status='pending'
    ).order_by('reminder_time')
    
    serializer = ReminderSerializer(reminders, many=True)
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def mark_reminder_complete(request, pk):
    """
    标记提醒为已完成
    """
    reminder = get_object_or_404(Reminder, pk=pk, user=request.user)
    reminder.status = 'completed'
    reminder.save()
    
    serializer = ReminderSerializer(reminder)
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def create_reminder_from_note(request):
    """
    从笔记创建提醒
    """
    note_id = request.data.get('note_id')
    title = request.data.get('title')
    content = request.data.get('content')
    reminder_time = request.data.get('reminder_time')
    
    if not note_id or not title or not reminder_time:
        return Response(
            {'error': '缺少必要参数'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        note = Note.objects.get(id=note_id, user=request.user)
    except Note.DoesNotExist:
        return Response(
            {'error': '笔记不存在'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    reminder = Reminder.objects.create(
        user=request.user,
        note=note,
        title=title,
        content=content or '',
        reminder_time=reminder_time
    )
    
    serializer = ReminderSerializer(reminder)
    return Response(serializer.data, status=status.HTTP_201_CREATED)
