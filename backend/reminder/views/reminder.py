"""
提醒视图
"""

from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone

from reminder.models import Reminder
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

class ReminderViewSet(viewsets.ModelViewSet):
    """提醒视图集"""
    serializer_class = ReminderSerializer
    permission_classes = [IsAuthenticated, IsOwner]
    pagination_class = StandardResultsSetPagination
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['priority', 'frequency', 'is_completed', 'is_enabled']
    search_fields = ['title', 'description']
    ordering_fields = ['due_date', 'priority', 'created_at']
    ordering = ['due_date']
    
    def get_queryset(self):
        """获取查询集"""
        return Reminder.objects.filter(user=self.request.user)
    
    def get_serializer_class(self):
        """根据操作类型选择序列化器"""
        if self.action == 'list':
            return ReminderListSerializer
        elif self.action == 'retrieve':
            return ReminderDetailSerializer
        elif self.action == 'create':
            return ReminderCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return ReminderUpdateSerializer
        return self.serializer_class
    
    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """完成提醒"""
        reminder = self.get_object()
        reminder.is_completed = True
        reminder.save()
        
        serializer = self.get_serializer(reminder)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def reopen(self, request, pk=None):
        """重新打开提醒"""
        reminder = self.get_object()
        reminder.is_completed = False
        reminder.save()
        
        serializer = self.get_serializer(reminder)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def upcoming(self, request):
        """获取即将到期的提醒"""
        # 获取未完成且已启用的提醒
        queryset = self.get_queryset().filter(
            is_completed=False,
            is_enabled=True,
            due_date__gte=timezone.now()
        ).order_by('due_date')
        
        # 限制数量
        limit = int(request.query_params.get('limit', 10))
        queryset = queryset[:limit]
        
        serializer = ReminderListSerializer(queryset, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def overdue(self, request):
        """获取已过期的提醒"""
        # 获取未完成且已过期的提醒
        queryset = self.get_queryset().filter(
            is_completed=False,
            due_date__lt=timezone.now()
        ).order_by('due_date')
        
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = ReminderListSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        
        serializer = ReminderListSerializer(queryset, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def today(self, request):
        """获取今天的提醒"""
        # 获取今天的提醒
        today = timezone.now().date()
        queryset = self.get_queryset().filter(
            due_date__date=today
        ).order_by('due_date')
        
        serializer = ReminderListSerializer(queryset, many=True)
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
        
        queryset = self.get_queryset().filter(note_id=note_id)
        serializer = ReminderListSerializer(queryset, many=True)
        return Response(serializer.data)
