"""
提醒模块视图
"""

from rest_framework import viewsets, permissions, status
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.response import Response
from django.utils import timezone
from django.shortcuts import get_object_or_404
import uuid

from .mongodb_models import Reminder, ReminderNotification
from .serializers import ReminderSerializer, ReminderNotificationSerializer
from notes.mongodb_models import Note


class MongoReminderViewSet(viewsets.ViewSet):
    """
    提醒视图集
    提供提醒的CRUD操作
    使用MongoDB模型
    """
    permission_classes = [permissions.IsAuthenticated]

    def list(self, request):
        """
        获取当前用户的所有提醒
        """
        user = request.user
        reminders = Reminder.objects.filter(user=user)
        serializer = ReminderSerializer(reminders, many=True)
        return Response(serializer.data)

    def create(self, request):
        """
        创建提醒
        """
        serializer = ReminderSerializer(data=request.data)
        if serializer.is_valid():
            # 获取关联笔记（如果有）
            note = None
            note_id = request.data.get('note_id')
            if note_id:
                try:
                    note = Note.objects.get(id=uuid.UUID(note_id), user=request.user)
                except (Note.DoesNotExist, ValueError):
                    return Response(
                        {'error': '笔记不存在或ID无效'},
                        status=status.HTTP_400_BAD_REQUEST
                    )

            # 创建提醒
            reminder = Reminder(
                user=request.user,
                title=serializer.validated_data['title'],
                description=serializer.validated_data.get('description', ''),
                due_date=serializer.validated_data['due_date'],
                priority=serializer.validated_data.get('priority', 'medium'),
                frequency=serializer.validated_data.get('frequency', 'once'),
                note=note
            )
            reminder.save()

            return Response(
                ReminderSerializer(reminder).data,
                status=status.HTTP_201_CREATED
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def retrieve(self, request, pk=None):
        """
        获取单个提醒详情
        """
        try:
            reminder = Reminder.objects.get(id=uuid.UUID(pk), user=request.user)
            serializer = ReminderSerializer(reminder)
            return Response(serializer.data)
        except (Reminder.DoesNotExist, ValueError):
            return Response(
                {'error': '提醒不存在或ID无效'},
                status=status.HTTP_404_NOT_FOUND
            )

    def update(self, request, pk=None):
        """
        更新提醒
        """
        try:
            reminder = Reminder.objects.get(id=uuid.UUID(pk), user=request.user)
            serializer = ReminderSerializer(data=request.data, partial=True)

            if serializer.is_valid():
                # 更新字段
                if 'title' in serializer.validated_data:
                    reminder.title = serializer.validated_data['title']
                if 'description' in serializer.validated_data:
                    reminder.description = serializer.validated_data['description']
                if 'due_date' in serializer.validated_data:
                    reminder.due_date = serializer.validated_data['due_date']
                if 'priority' in serializer.validated_data:
                    reminder.priority = serializer.validated_data['priority']
                if 'frequency' in serializer.validated_data:
                    reminder.frequency = serializer.validated_data['frequency']
                if 'is_completed' in serializer.validated_data:
                    reminder.is_completed = serializer.validated_data['is_completed']
                    if reminder.is_completed:
                        reminder.completed_at = timezone.now()
                if 'is_enabled' in serializer.validated_data:
                    reminder.is_enabled = serializer.validated_data['is_enabled']

                # 更新关联笔记
                note_id = request.data.get('note_id')
                if note_id:
                    try:
                        note = Note.objects.get(id=uuid.UUID(note_id), user=request.user)
                        reminder.note = note
                    except (Note.DoesNotExist, ValueError):
                        return Response(
                            {'error': '笔记不存在或ID无效'},
                            status=status.HTTP_400_BAD_REQUEST
                        )

                reminder.save()
                return Response(ReminderSerializer(reminder).data)

            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        except (Reminder.DoesNotExist, ValueError):
            return Response(
                {'error': '提醒不存在或ID无效'},
                status=status.HTTP_404_NOT_FOUND
            )

    def partial_update(self, request, pk=None):
        """
        部分更新提醒
        """
        return self.update(request, pk)

    def destroy(self, request, pk=None):
        """
        删除提醒
        """
        try:
            reminder = Reminder.objects.get(id=uuid.UUID(pk), user=request.user)
            reminder.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except (Reminder.DoesNotExist, ValueError):
            return Response(
                {'error': '提醒不存在或ID无效'},
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """
        标记提醒为已完成
        """
        try:
            reminder = Reminder.objects.get(id=uuid.UUID(pk), user=request.user)
            reminder.is_completed = True
            reminder.completed_at = timezone.now()
            reminder.save()
            return Response(ReminderSerializer(reminder).data)
        except (Reminder.DoesNotExist, ValueError):
            return Response(
                {'error': '提醒不存在或ID无效'},
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=False, methods=['get'])
    def upcoming(self, request):
        """
        获取即将到来的提醒
        """
        user = request.user
        now = timezone.now()

        # 获取未来24小时内的提醒
        end_time = now + timezone.timedelta(hours=24)
        reminders = Reminder.objects.filter(
            user=user,
            due_date__gte=now,
            due_date__lte=end_time,
            is_completed=False,
            is_enabled=True
        ).order_by('due_date')

        serializer = ReminderSerializer(reminders, many=True)
        return Response(serializer.data)


class MongoReminderNotificationViewSet(viewsets.ViewSet):
    """
    提醒通知视图集
    提供提醒通知的CRUD操作
    使用MongoDB模型
    """
    permission_classes = [permissions.IsAuthenticated]

    def list(self, request):
        """
        获取当前用户的所有提醒通知
        """
        user = request.user
        notifications = ReminderNotification.objects.filter(reminder__user=user)
        serializer = ReminderNotificationSerializer(notifications, many=True)
        return Response(serializer.data)

    def retrieve(self, request, pk=None):
        """
        获取单个提醒通知详情
        """
        try:
            notification = ReminderNotification.objects.get(id=uuid.UUID(pk), reminder__user=request.user)
            serializer = ReminderNotificationSerializer(notification)
            return Response(serializer.data)
        except (ReminderNotification.DoesNotExist, ValueError):
            return Response(
                {'error': '提醒通知不存在或ID无效'},
                status=status.HTTP_404_NOT_FOUND
            )


# 兼容旧版API - 使用MongoDB模型
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
        due_date__gte=now,
        due_date__lte=end_time,
        is_completed=False,
        is_enabled=True
    ).order_by('due_date')

    serializer = ReminderSerializer(reminders, many=True)
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def mark_reminder_complete(request, pk):
    """
    标记提醒为已完成
    """
    try:
        reminder = Reminder.objects.get(id=uuid.UUID(pk), user=request.user)
        reminder.is_completed = True
        reminder.completed_at = timezone.now()
        reminder.save()

        serializer = ReminderSerializer(reminder)
        return Response(serializer.data)
    except (Reminder.DoesNotExist, ValueError):
        return Response(
            {'error': '提醒不存在或ID无效'},
            status=status.HTTP_404_NOT_FOUND
        )


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def create_reminder_from_note(request):
    """
    从笔记创建提醒
    """
    note_id = request.data.get('note_id')
    title = request.data.get('title')
    description = request.data.get('description')
    reminder_time = request.data.get('reminder_time')

    if not note_id or not title or not reminder_time:
        return Response(
            {'error': '缺少必要参数'},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        note = Note.objects.get(id=uuid.UUID(note_id), user=request.user)
    except (Note.DoesNotExist, ValueError):
        return Response(
            {'error': '笔记不存在或ID无效'},
            status=status.HTTP_404_NOT_FOUND
        )

    reminder = Reminder(
        user=request.user,
        note=note,
        title=title,
        description=description or '',
        due_date=reminder_time,
        priority='medium',
        frequency='once'
    )
    reminder.save()

    serializer = ReminderSerializer(reminder)
    return Response(serializer.data, status=status.HTTP_201_CREATED)


# 保留旧的视图集以兼容现有代码，但内部使用MongoDB模型
class ReminderViewSet(viewsets.ViewSet):
    """
    提醒视图集（兼容层）
    提供提醒的CRUD操作
    内部使用MongoDB模型
    """
    serializer_class = ReminderSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """
        根据用户筛选查询集
        """
        user = self.request.user
        return Reminder.objects.filter(user=user)

    def list(self, request):
        """
        获取当前用户的所有提醒
        """
        user = request.user
        reminders = Reminder.objects.filter(user=user)
        serializer = ReminderSerializer(reminders, many=True)
        return Response(serializer.data)

    def create(self, request):
        """
        创建提醒
        """
        return MongoReminderViewSet().create(request)

    def retrieve(self, request, pk=None):
        """
        获取单个提醒详情
        """
        return MongoReminderViewSet().retrieve(request, pk)

    def update(self, request, pk=None):
        """
        更新提醒
        """
        return MongoReminderViewSet().update(request, pk)

    def partial_update(self, request, pk=None):
        """
        部分更新提醒
        """
        return MongoReminderViewSet().partial_update(request, pk)

    def destroy(self, request, pk=None):
        """
        删除提醒
        """
        return MongoReminderViewSet().destroy(request, pk)


class ReminderNotificationViewSet(viewsets.ViewSet):
    """
    提醒通知视图集（兼容层）
    提供提醒通知的CRUD操作
    内部使用MongoDB模型
    """
    serializer_class = ReminderNotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """
        根据用户筛选查询集
        """
        user = self.request.user
        return ReminderNotification.objects.filter(reminder__user=user)

    def list(self, request):
        """
        获取当前用户的所有提醒通知
        """
        return MongoReminderNotificationViewSet().list(request)

    def retrieve(self, request, pk=None):
        """
        获取单个提醒通知详情
        """
        return MongoReminderNotificationViewSet().retrieve(request, pk)
