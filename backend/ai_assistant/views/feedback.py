"""
反馈视图
"""

from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from ai_assistant.mongodb_models import Feedback
from ai_assistant.serializers import FeedbackSerializer
from common.permissions import IsOwner
from common.pagination import StandardResultsSetPagination

class FeedbackViewSet(viewsets.ModelViewSet):
    """反馈视图集"""
    serializer_class = FeedbackSerializer
    permission_classes = [IsOwner]
    pagination_class = StandardResultsSetPagination
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['message', 'rating']
    ordering_fields = ['created_at']
    ordering = ['-created_at']

    def get_queryset(self):
        """获取查询集"""
        return Feedback.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        """创建反馈时设置用户"""
        serializer.save(user=self.request.user)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """获取反馈统计信息"""
        # 获取所有反馈
        feedbacks = self.get_queryset()

        # 总计
        total_count = feedbacks.count()

        # 计算平均评分
        if total_count > 0:
            total_rating = sum(feedback.rating for feedback in feedbacks)
            avg_rating = total_rating / total_count
        else:
            avg_rating = 0

        # 按评分分组
        rating_stats = []
        for rating in range(1, 6):  # 1-5星评分
            count = feedbacks.filter(rating=rating).count()
            if count > 0:
                rating_stats.append({
                    'rating': rating,
                    'count': count
                })

        return Response({
            "total_count": total_count,
            "average_rating": avg_rating,
            "rating_stats": rating_stats
        })
