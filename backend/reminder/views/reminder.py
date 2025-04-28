"""
提醒视图
"""

from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone
import uuid

from reminder.mongodb_models import Reminder
from reminder.serializers import (
    ReminderSerializer,
    ReminderListSerializer,
    ReminderDetailSerializer,
    ReminderCreateSerializer,
    ReminderUpdateSerializer
)
from reminder.services import ReminderService
from common.permissions import IsOwner
from common.pagination import StandardResultsSetPagination

class ReminderViewSet(viewsets.ViewSet):
    """提醒视图集"""
    serializer_class = ReminderSerializer
    permission_classes = [IsAuthenticated, IsOwner]
    pagination_class = StandardResultsSetPagination
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['priority', 'frequency', 'is_completed', 'is_enabled']
    search_fields = ['title', 'description']
    ordering_fields = ['due_date', 'priority', 'created_at']
    ordering = ['due_date']

    def list(self, request):
        """获取提醒列表"""
        # 获取查询参数
        priority = request.query_params.get('priority')
        frequency = request.query_params.get('frequency')
        is_completed = request.query_params.get('is_completed')
        is_enabled = request.query_params.get('is_enabled')
        search = request.query_params.get('search')
        ordering = request.query_params.get('ordering', 'due_date')

        # 构建查询条件
        query = {'user': request.user}

        if priority:
            query['priority'] = priority
        if frequency:
            query['frequency'] = frequency
        if is_completed:
            query['is_completed'] = is_completed.lower() == 'true'
        if is_enabled:
            query['is_enabled'] = is_enabled.lower() == 'true'
        if search:
            query['$or'] = [
                {'title': {'$regex': search, '$options': 'i'}},
                {'description': {'$regex': search, '$options': 'i'}}
            ]

        # 执行查询
        reminders = Reminder.objects.filter(**query).order_by(ordering)

        # 分页
        page = self.paginate_queryset(reminders)
        if page is not None:
            serializer = ReminderListSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = ReminderListSerializer(reminders, many=True)
        return Response(serializer.data)

    def retrieve(self, request, pk=None):
        """获取单个提醒详情"""
        try:
            reminder = Reminder.objects.get(id=pk)
            # 检查权限
            if reminder.user != request.user:
                return Response(
                    {"detail": "您没有权限查看此提醒"},
                    status=status.HTTP_403_FORBIDDEN
                )
            serializer = ReminderDetailSerializer(reminder)
            return Response(serializer.data)
        except Reminder.DoesNotExist:
            return Response(
                {"detail": "提醒不存在"},
                status=status.HTTP_404_NOT_FOUND
            )

    def create(self, request):
        """创建提醒"""
        serializer = ReminderCreateSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            # 创建提醒
            reminder = Reminder(
                id=uuid.uuid4(),
                user=request.user,
                title=serializer.validated_data['title'],
                description=serializer.validated_data.get('description', ''),
                due_date=serializer.validated_data['due_date'],
                priority=serializer.validated_data.get('priority', 'medium'),
                frequency=serializer.validated_data.get('frequency', 'once'),
                is_enabled=serializer.validated_data.get('is_enabled', True),
                note=serializer.validated_data.get('note'),
                created_at=timezone.now(),
                updated_at=timezone.now()
            )
            reminder.save()

            # 创建提醒通知
            ReminderService.schedule_notifications(reminder)

            serializer = ReminderDetailSerializer(reminder)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def update(self, request, pk=None):
        """更新提醒"""
        try:
            reminder = Reminder.objects.get(id=pk)
            # 检查权限
            if reminder.user != request.user:
                return Response(
                    {"detail": "您没有权限更新此提醒"},
                    status=status.HTTP_403_FORBIDDEN
                )

            serializer = ReminderUpdateSerializer(reminder, data=request.data, context={'request': request})
            if serializer.is_valid():
                # 更新提醒
                for key, value in serializer.validated_data.items():
                    setattr(reminder, key, value)
                reminder.updated_at = timezone.now()
                reminder.save()

                # 更新提醒通知
                ReminderService.update_notifications(reminder)

                serializer = ReminderDetailSerializer(reminder)
                return Response(serializer.data)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Reminder.DoesNotExist:
            return Response(
                {"detail": "提醒不存在"},
                status=status.HTTP_404_NOT_FOUND
            )

    def destroy(self, request, pk=None):
        """删除提醒"""
        try:
            reminder = Reminder.objects.get(id=pk)
            # 检查权限
            if reminder.user != request.user:
                return Response(
                    {"detail": "您没有权限删除此提醒"},
                    status=status.HTTP_403_FORBIDDEN
                )

            # 删除提醒通知
            ReminderService.delete_notifications(reminder)

            # 删除提醒
            reminder.delete()

            return Response(status=status.HTTP_204_NO_CONTENT)
        except Reminder.DoesNotExist:
            return Response(
                {"detail": "提醒不存在"},
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """完成提醒"""
        try:
            reminder = Reminder.objects.get(id=pk)
            # 检查权限
            if reminder.user != request.user:
                return Response(
                    {"detail": "您没有权限完成此提醒"},
                    status=status.HTTP_403_FORBIDDEN
                )

            # 完成提醒
            reminder.complete()

            serializer = ReminderDetailSerializer(reminder)
            return Response(serializer.data)
        except Reminder.DoesNotExist:
            return Response(
                {"detail": "提醒不存在"},
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=True, methods=['post'])
    def reopen(self, request, pk=None):
        """重新打开提醒"""
        try:
            reminder = Reminder.objects.get(id=pk)
            # 检查权限
            if reminder.user != request.user:
                return Response(
                    {"detail": "您没有权限重新打开此提醒"},
                    status=status.HTTP_403_FORBIDDEN
                )

            # 重新打开提醒
            reminder.is_completed = False
            reminder.completed_at = None
            reminder.updated_at = timezone.now()
            reminder.save()

            # 更新提醒通知
            ReminderService.update_notifications(reminder)

            serializer = ReminderDetailSerializer(reminder)
            return Response(serializer.data)
        except Reminder.DoesNotExist:
            return Response(
                {"detail": "提醒不存在"},
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=False, methods=['get'])
    def upcoming(self, request):
        """获取即将到期的提醒"""
        # 获取未完成且已启用的提醒
        query = {
            'user': request.user,
            'is_completed': False,
            'is_enabled': True,
            'due_date__gte': timezone.now()
        }

        # 执行查询
        reminders = Reminder.objects.filter(**query).order_by('due_date')

        # 限制数量
        limit = int(request.query_params.get('limit', 10))
        reminders = reminders[:limit]

        serializer = ReminderListSerializer(reminders, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def overdue(self, request):
        """获取已过期的提醒"""
        # 获取未完成且已过期的提醒
        query = {
            'user': request.user,
            'is_completed': False,
            'due_date__lt': timezone.now()
        }

        # 执行查询
        reminders = Reminder.objects.filter(**query).order_by('due_date')

        # 分页
        page = self.paginate_queryset(reminders)
        if page is not None:
            serializer = ReminderListSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = ReminderListSerializer(reminders, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def today(self, request):
        """获取今天的提醒"""
        # 获取今天的提醒
        today = timezone.now().date()

        # 构建查询条件
        from datetime import datetime, time
        start_of_day = datetime.combine(today, time.min)
        end_of_day = datetime.combine(today, time.max)

        query = {
            'user': request.user,
            'due_date__gte': start_of_day,
            'due_date__lte': end_of_day
        }

        # 执行查询
        reminders = Reminder.objects.filter(**query).order_by('due_date')

        serializer = ReminderListSerializer(reminders, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def by_note(self, request):
        """获取笔记相关的提醒"""
        note_id = request.query_params.get('note_id')
        if not note_id:
            return Response(
                {"detail": "缺少note_id参数"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 构建查询条件
        query = {
            'user': request.user,
            'note': note_id
        }

        # 执行查询
        reminders = Reminder.objects.filter(**query).order_by('due_date')

        serializer = ReminderListSerializer(reminders, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['post'])
    def batch_complete(self, request):
        """批量完成提醒"""
        reminder_ids = request.data.get('reminder_ids', [])
        if not reminder_ids:
            return Response(
                {"detail": "缺少reminder_ids参数"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 批量完成提醒
        completed_count = 0
        for reminder_id in reminder_ids:
            try:
                reminder = Reminder.objects.get(id=reminder_id, user=request.user)
                reminder.complete()
                completed_count += 1
            except Reminder.DoesNotExist:
                pass

        return Response({
            'message': f'成功完成{completed_count}个提醒',
            'completed_count': completed_count
        })

    @action(detail=False, methods=['post'])
    def batch_delete(self, request):
        """批量删除提醒"""
        reminder_ids = request.data.get('reminder_ids', [])
        if not reminder_ids:
            return Response(
                {"detail": "缺少reminder_ids参数"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 批量删除提醒
        deleted_count = 0
        for reminder_id in reminder_ids:
            try:
                reminder = Reminder.objects.get(id=reminder_id, user=request.user)
                # 删除提醒通知
                ReminderService.delete_notifications(reminder)
                # 删除提醒
                reminder.delete()
                deleted_count += 1
            except Reminder.DoesNotExist:
                pass

        return Response({
            'message': f'成功删除{deleted_count}个提醒',
            'deleted_count': deleted_count
        })
