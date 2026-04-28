"""
对话视图
"""

from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from mongoengine.queryset.visitor import Q

from ai_assistant.mongodb_models import Conversation
from ai_assistant.serializers import (
    ConversationSerializer,
    ConversationListSerializer,
    ConversationDetailSerializer,
    MessageSerializer
)
from ai_assistant.services import ConversationService
from common.permissions import IsOwner
from common.pagination import StandardResultsSetPagination
from ..throttling import UserMinuteRateThrottle, UserDayRateThrottle

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

    def get_throttles(self):
        """为 send_message 操作应用速率限制"""
        if self.action == 'send_message':
            return [UserMinuteRateThrottle(), UserDayRateThrottle()]
        return super().get_throttles()

    def get_queryset(self):
        """获取查询集（使用Mongo用户）"""
        return Conversation.objects(
            user=getattr(self.request, 'mongo_user', None),
            is_deleted=False
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
        tools = request.data.get('tools')
        response_format = request.data.get('response_format')

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
            user=request.user,
            tools=tools,
            response_format=response_format
        )

        return Response({
            "message": MessageSerializer(assistant_message).data
        })

    @action(detail=True, methods=['post'])
    def toggle_pin(self, request, pk=None):
        """切换置顶状态"""
        conversation = self.get_object()
        conversation.is_pinned = not conversation.is_pinned
        conversation.save()

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

        # 计算消息总数
        total_messages = 0
        for conversation in self.get_queryset():
            total_messages += len(conversation.messages)

        # 按模型分组统计
        model_stats = []
        models = self.get_queryset().distinct('model')
        for model in models:
            count = Conversation.objects(
                user=self.request.user,
                is_deleted=False,
                model=model
            ).count()
            model_stats.append({
                'model': model,
                'count': count
            })

        # 按消息数量排序
        model_stats.sort(key=lambda x: x['count'], reverse=True)

        return Response({
            "total_conversations": total_count,
            "total_messages": total_messages,
            "model_stats": model_stats
        })
