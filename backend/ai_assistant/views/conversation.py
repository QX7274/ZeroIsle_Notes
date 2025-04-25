"""
对话视图
"""

from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Count

from ai_assistant.models import Conversation, Message
from ai_assistant.serializers import (
    ConversationSerializer,
    ConversationListSerializer,
    ConversationDetailSerializer,
    MessageSerializer
)
from ai_assistant.services import ConversationService
from common.permissions import IsOwner
from common.pagination import StandardResultsSetPagination

class ConversationViewSet(viewsets.ModelViewSet):
    """对话视图集"""
    serializer_class = ConversationSerializer
    permission_classes = [IsOwner]
    pagination_class = StandardResultsSetPagination
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['model', 'is_pinned']
    search_fields = ['title']
    ordering_fields = ['created_at', 'updated_at', 'last_message_at']
    ordering = ['-last_message_at']
    
    def get_queryset(self):
        """获取查询集"""
        return Conversation.objects.filter(
            user=self.request.user,
            is_deleted=False
        ).annotate(
            message_count=Count('messages')
        )
    
    def get_serializer_class(self):
        """根据操作类型选择序列化器"""
        if self.action == 'list':
            return ConversationListSerializer
        elif self.action == 'retrieve':
            return ConversationDetailSerializer
        return self.serializer_class
    
    def perform_create(self, serializer):
        """创建对话时设置用户"""
        serializer.save(user=self.request.user)
    
    @action(detail=True, methods=['post'])
    def send_message(self, request, pk=None):
        """发送消息"""
        conversation = self.get_object()
        content = request.data.get('content')
        
        if not content:
            return Response(
                {"detail": "消息内容不能为空"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # 使用对话服务发送消息
        conversation_service = ConversationService()
        assistant_message = conversation_service.send_message(
            conversation=conversation,
            content=content,
            user=request.user
        )
        
        return Response({
            "message": MessageSerializer(assistant_message).data
        })
    
    @action(detail=True, methods=['post'])
    def toggle_pin(self, request, pk=None):
        """切换置顶状态"""
        conversation = self.get_object()
        conversation.is_pinned = not conversation.is_pinned
        conversation.save(update_fields=['is_pinned'])
        
        return Response({
            "is_pinned": conversation.is_pinned
        })
    
    @action(detail=False, methods=['get'])
    def pinned(self, request):
        """获取置顶对话"""
        queryset = self.get_queryset().filter(is_pinned=True)
        serializer = ConversationListSerializer(queryset, many=True)
        
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def recent(self, request):
        """获取最近对话"""
        queryset = self.get_queryset().order_by('-last_message_at')[:5]
        serializer = ConversationListSerializer(queryset, many=True)
        
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def stats(self, request):
        """获取对话统计信息"""
        total_count = self.get_queryset().count()
        total_messages = Message.objects.filter(
            conversation__user=request.user,
            conversation__is_deleted=False
        ).count()
        
        # 按模型分组统计
        model_stats = self.get_queryset().values('model').annotate(
            count=Count('id')
        ).order_by('-count')
        
        return Response({
            "total_conversations": total_count,
            "total_messages": total_messages,
            "model_stats": model_stats
        })
