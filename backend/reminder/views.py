"""提醒系统视图"""

from rest_framework import viewsets, status, filters, permissions
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone
from django.shortcuts import get_object_or_404
from .models import Reminder, ReminderNotification
from .serializers import ReminderSerializer, ReminderCreateSerializer, ReminderNotificationSerializer
from datetime import datetime, timedelta


class ReminderViewSet(viewsets.ModelViewSet):
    """
    提醒视图集
    """
    serializer_class = ReminderSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['is_completed', 'frequency']
    search_fields = ['title', 'description']
    ordering_fields = ['due_date', 'created_at', 'updated_at']

    def get_queryset(self):
        return Reminder.objects.filter(user=self.request.user)

    def get_serializer_class(self):
        if self.action == 'create':
            return ReminderCreateSerializer
        return ReminderSerializer

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        reminder = self.get_object()
        reminder.is_completed = not reminder.is_completed
        reminder.save()
        return Response({'status': 'success'})

    @action(detail=True, methods=['post'])
    def toggle_enable(self, request, pk=None):
        reminder = self.get_object()
        reminder.is_enabled = not reminder.is_enabled
        reminder.save()
        return Response({'is_enabled': reminder.is_enabled})

    @action(detail=False, methods=['get'])
    def upcoming(self, request):
        reminders = self.get_queryset().filter(
            is_enabled=True,
            due_date__gte=timezone.now()
        ).order_by('due_date')
        serializer = self.get_serializer(reminders, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def schedule_notification(self, request, pk=None):
        reminder = self.get_object()
        notification_time = request.data.get('notification_time')
        notification_type = request.data.get('notification_type', 'in_app')
        
        if not notification_time:
            return Response(
                {'error': 'notification_time is required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        ReminderNotification.objects.create(
            reminder=reminder,
            notification_type=notification_type,
            notification_time=notification_time
        )
        return Response({'status': 'success'})

    @action(detail=False, methods=['get'])
    def upcoming_notifications(self, request):
        now = timezone.now()
        end_time = now + timedelta(days=7)  # 获取未来7天的提醒
        
        notifications = ReminderNotification.objects.filter(
            reminder__user=request.user,
            notification_time__gte=now,
            notification_time__lte=end_time,
            is_sent=False
        ).order_by('notification_time')
        
        serializer = ReminderNotificationSerializer(notifications, many=True)
        return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_upcoming_reminders(request):
    """
    获取即将到期的提醒
    """
    days = int(request.query_params.get('days', 7))
    end_date = datetime.now() + timedelta(days=days)
    
    reminders = Reminder.objects.filter(
        user=request.user,
        due_date__lte=end_date,
        status='pending'
    ).order_by('due_date')
    
    serializer = ReminderSerializer(reminders, many=True)
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mark_reminder_complete(request, pk):
    """
    标记提醒为已完成
    """
    try:
        reminder = Reminder.objects.get(pk=pk, user=request.user)
    except Reminder.DoesNotExist:
        return Response({"detail": "提醒不存在"}, status=status.HTTP_404_NOT_FOUND)
    
    reminder.status = 'completed'
    reminder.save()
    
    serializer = ReminderSerializer(reminder)
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_reminder_from_note(request):
    """
    从笔记创建提醒
    """
    note_id = request.data.get('note_id')
    title = request.data.get('title')
    description = request.data.get('description')
    due_date = request.data.get('due_date')
    priority = request.data.get('priority', 'medium')
    
    if not all([note_id, title, due_date]):
        return Response({"detail": "缺少必要参数"}, status=status.HTTP_400_BAD_REQUEST)
    
    data = {
        'title': title,
        'description': description,
        'due_date': due_date,
        'priority': priority,
        'note': note_id,
        'user': request.user.id
    }
    
    serializer = ReminderSerializer(data=data)
    if serializer.is_valid():
        serializer.save(user=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ReminderNotificationViewSet(viewsets.ModelViewSet):
    serializer_class = ReminderNotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return ReminderNotification.objects.filter(
            reminder__user=self.request.user
        )

    def perform_create(self, serializer):
        reminder = get_object_or_404(
            Reminder,
            id=self.request.data.get('reminder'),
            user=self.request.user
        )
        serializer.save(reminder=reminder)

    @action(detail=True, methods=['post'])
    def mark_sent(self, request, pk=None):
        notification = self.get_object()
        notification.is_sent = True
        notification.save()
        return Response({'status': 'success'})