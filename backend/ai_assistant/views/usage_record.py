"""
使用记录视图
"""

from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Sum, Count
from django.utils import timezone
from datetime import timedelta

from ai_assistant.models import UsageRecord
from ai_assistant.serializers import UsageRecordSerializer
from common.permissions import IsOwner
from common.pagination import StandardResultsSetPagination

class UsageRecordViewSet(viewsets.ReadOnlyModelViewSet):
    """使用记录视图集"""
    serializer_class = UsageRecordSerializer
    permission_classes = [IsOwner]
    pagination_class = StandardResultsSetPagination
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['model', 'provider', 'conversation']
    ordering_fields = ['created_at']
    ordering = ['-created_at']
    
    def get_queryset(self):
        """获取查询集"""
        return UsageRecord.objects.filter(user=self.request.user)
    
    @action(detail=False, methods=['get'])
    def summary(self, request):
        """获取使用统计摘要"""
        # 总计
        total_tokens = self.get_queryset().aggregate(
            total=Sum('total_tokens')
        )['total'] or 0
        
        total_cost = self.get_queryset().aggregate(
            total=Sum('cost')
        )['total'] or 0
        
        # 按模型分组
        model_stats = self.get_queryset().values('model').annotate(
            count=Count('id'),
            tokens=Sum('total_tokens'),
            cost=Sum('cost')
        ).order_by('-tokens')
        
        # 按提供商分组
        provider_stats = self.get_queryset().values('provider').annotate(
            count=Count('id'),
            tokens=Sum('total_tokens'),
            cost=Sum('cost')
        ).order_by('-tokens')
        
        return Response({
            "total_tokens": total_tokens,
            "total_cost": total_cost,
            "model_stats": model_stats,
            "provider_stats": provider_stats
        })
    
    @action(detail=False, methods=['get'])
    def daily(self, request):
        """获取每日使用统计"""
        # 获取过去30天的数据
        start_date = timezone.now() - timedelta(days=30)
        
        # 按日期分组
        daily_stats = self.get_queryset().filter(
            created_at__gte=start_date
        ).extra(
            select={'date': "DATE(created_at)"}
        ).values('date').annotate(
            count=Count('id'),
            tokens=Sum('total_tokens'),
            cost=Sum('cost')
        ).order_by('date')
        
        return Response(daily_stats)
