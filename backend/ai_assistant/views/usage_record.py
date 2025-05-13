"""
使用记录视图
"""

from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone
from datetime import timedelta, datetime

from ai_assistant.mongodb_models import UsageRecord
from ai_assistant.serializers import UsageRecordSerializer
from common.permissions import IsOwner
from common.pagination import StandardResultsSetPagination

class UsageRecordViewSet(viewsets.ReadOnlyModelViewSet):
    """使用记录视图集"""
    serializer_class = UsageRecordSerializer
    permission_classes = [IsOwner]
    pagination_class = StandardResultsSetPagination
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['model', 'conversation']
    ordering_fields = ['created_at']
    ordering = ['-created_at']

    def get_queryset(self):
        """获取查询集"""
        return UsageRecord.objects.filter(user=self.request.user)

    @action(detail=False, methods=['get'])
    def summary(self, request):
        """获取使用统计摘要"""
        records = self.get_queryset()

        # 总计
        total_tokens = sum(record.total_tokens for record in records)
        total_cost = sum(record.cost for record in records)

        # 按模型分组
        model_stats = {}
        for record in records:
            model = record.model
            if model not in model_stats:
                model_stats[model] = {
                    'count': 0,
                    'tokens': 0,
                    'cost': 0
                }
            model_stats[model]['count'] += 1
            model_stats[model]['tokens'] += record.total_tokens
            model_stats[model]['cost'] += record.cost

        # 转换为列表并排序
        model_stats_list = [
            {
                'model': model,
                'count': stats['count'],
                'tokens': stats['tokens'],
                'cost': stats['cost']
            }
            for model, stats in model_stats.items()
        ]
        model_stats_list.sort(key=lambda x: x['tokens'], reverse=True)

        return Response({
            "total_tokens": total_tokens,
            "total_cost": total_cost,
            "model_stats": model_stats_list
        })

    @action(detail=False, methods=['get'])
    def daily(self, request):
        """获取每日使用统计"""
        # 获取过去30天的数据
        start_date = timezone.now() - timedelta(days=30)
        records = self.get_queryset().filter(created_at__gte=start_date)

        # 按日期分组
        daily_stats = {}
        for record in records:
            # 获取日期字符串
            date_str = record.created_at.strftime('%Y-%m-%d')

            if date_str not in daily_stats:
                daily_stats[date_str] = {
                    'date': date_str,
                    'count': 0,
                    'tokens': 0,
                    'cost': 0
                }

            daily_stats[date_str]['count'] += 1
            daily_stats[date_str]['tokens'] += record.total_tokens
            daily_stats[date_str]['cost'] += record.cost

        # 转换为列表并排序
        daily_stats_list = list(daily_stats.values())
        daily_stats_list.sort(key=lambda x: x['date'])

        return Response(daily_stats_list)
