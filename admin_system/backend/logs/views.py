from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from .models import AdminOperationLog, SystemLog
from .serializers import AdminOperationLogSerializer, SystemLogSerializer

class AdminOperationLogViewSet(viewsets.ReadOnlyModelViewSet):
    """管理员操作日志视图集"""
    queryset = AdminOperationLog.objects.all()
    serializer_class = AdminOperationLogSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['admin_username', 'module', 'action']
    search_fields = ['admin_username', 'module', 'description', 'resource_id']
    ordering_fields = ['operation_time']
    ordering = ['-operation_time']

    def get_queryset(self):
        """自定义查询集"""
        queryset = AdminOperationLog.objects.all()

        # 按操作时间范围筛选
        start_time = self.request.query_params.get('start_time')
        end_time = self.request.query_params.get('end_time')
        if start_time:
            queryset = queryset.filter(operation_time__gte=start_time)
        if end_time:
            queryset = queryset.filter(operation_time__lte=end_time)

        return queryset

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """操作日志统计信息"""
        total_logs = AdminOperationLog.objects.count()

        # 按操作类型统计
        action_stats = {}
        for action_choice in AdminOperationLog.ACTION_CHOICES:
            action_code = action_choice[0]
            action_stats[action_code] = AdminOperationLog.objects.filter(action=action_code).count()

        # 按模块统计
        module_stats = {}
        modules = AdminOperationLog.objects.values_list('module', flat=True).distinct()
        for module in modules:
            module_stats[module] = AdminOperationLog.objects.filter(module=module).count()

        return Response({
            'status': 'success',
            'data': {
                'total_logs': total_logs,
                'action_stats': action_stats,
                'module_stats': module_stats
            }
        }, status=status.HTTP_200_OK)

class SystemLogViewSet(viewsets.ReadOnlyModelViewSet):
    """系统日志视图集"""
    queryset = SystemLog.objects.all()
    serializer_class = SystemLogSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['level', 'source']
    search_fields = ['source', 'message']
    ordering_fields = ['timestamp']
    ordering = ['-timestamp']

    def get_queryset(self):
        """自定义查询集"""
        queryset = SystemLog.objects.all()

        # 按时间戳范围筛选
        start_time = self.request.query_params.get('start_time')
        end_time = self.request.query_params.get('end_time')
        if start_time:
            queryset = queryset.filter(timestamp__gte=start_time)
        if end_time:
            queryset = queryset.filter(timestamp__lte=end_time)

        return queryset

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """系统日志统计信息"""
        total_logs = SystemLog.objects.count()

        # 按日志级别统计
        level_stats = {}
        for level_choice in SystemLog.LEVEL_CHOICES:
            level_code = level_choice[0]
            level_stats[level_code] = SystemLog.objects.filter(level=level_code).count()

        # 按来源统计
        source_stats = {}
        sources = SystemLog.objects.values_list('source', flat=True).distinct()
        for source in sources:
            source_stats[source] = SystemLog.objects.filter(source=source).count()

        return Response({
            'status': 'success',
            'data': {
                'total_logs': total_logs,
                'level_stats': level_stats,
                'source_stats': source_stats
            }
        }, status=status.HTTP_200_OK)
