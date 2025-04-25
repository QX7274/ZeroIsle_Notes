"""
消息视图
"""

from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from ai_assistant.models import Message, Feedback
from ai_assistant.serializers import MessageSerializer, FeedbackSerializer
from common.permissions import IsOwner
from common.pagination import StandardResultsSetPagination

class MessageViewSet(viewsets.ReadOnlyModelViewSet):
    """消息视图集"""
    serializer_class = MessageSerializer
    permission_classes = [IsOwner]
    pagination_class = StandardResultsSetPagination
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['conversation', 'role']
    ordering_fields = ['created_at']
    ordering = ['created_at']
    
    def get_queryset(self):
        """获取查询集"""
        return Message.objects.filter(
            conversation__user=self.request.user,
            conversation__is_deleted=False
        )
    
    @action(detail=True, methods=['post'])
    def feedback(self, request, pk=None):
        """提交反馈"""
        message = self.get_object()
        
        # 检查是否已经提交过反馈
        existing_feedback = Feedback.objects.filter(
            user=request.user,
            message=message
        ).first()
        
        if existing_feedback:
            # 更新现有反馈
            serializer = FeedbackSerializer(
                existing_feedback,
                data=request.data,
                partial=True
            )
        else:
            # 创建新反馈
            serializer = FeedbackSerializer(data={
                **request.data,
                'user': request.user.id,
                'message': message.id
            })
        
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        
        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )
