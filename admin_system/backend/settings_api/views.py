from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from .models import SystemSetting, Announcement
from .serializers import (
    SystemSettingSerializer,
    AnnouncementSerializer,
    AnnouncementListSerializer
)

class SystemSettingViewSet(viewsets.ModelViewSet):
    """系统设置视图集"""
    queryset = SystemSetting.objects.all()
    serializer_class = SystemSettingSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['key', 'value', 'description']
    ordering_fields = ['key', 'created_at', 'updated_at']
    ordering = ['key']

    @action(detail=False, methods=['get'])
    def by_key(self, request):
        """通过键获取设置值"""
        key = request.query_params.get('key')
        if not key:
            return Response({
                'status': 'error',
                'message': '缺少key参数'
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            setting = SystemSetting.objects.get(key=key)
            serializer = self.get_serializer(setting)
            return Response({
                'status': 'success',
                'data': serializer.data
            }, status=status.HTTP_200_OK)
        except SystemSetting.DoesNotExist:
            return Response({
                'status': 'error',
                'message': f'未找到键为{key}的设置'
            }, status=status.HTTP_404_NOT_FOUND)

    @action(detail=False, methods=['post'])
    def batch_update(self, request):
        """批量更新设置"""
        settings_data = request.data
        if not isinstance(settings_data, list):
            return Response({
                'status': 'error',
                'message': '请提供设置列表'
            }, status=status.HTTP_400_BAD_REQUEST)

        results = []
        for item in settings_data:
            key = item.get('key')
            value = item.get('value')
            description = item.get('description')

            if not key or value is None:
                results.append({
                    'key': key,
                    'status': 'error',
                    'message': '缺少必要字段'
                })
                continue

            setting, created = SystemSetting.objects.update_or_create(
                key=key,
                defaults={'value': value, 'description': description}
            )

            results.append({
                'key': key,
                'status': 'success',
                'message': '创建成功' if created else '更新成功'
            })

        return Response({
            'status': 'success',
            'data': results
        }, status=status.HTTP_200_OK)

class AnnouncementViewSet(viewsets.ModelViewSet):
    """系统公告视图集"""
    queryset = Announcement.objects.all()
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status']
    search_fields = ['title', 'content', 'created_by']
    ordering_fields = ['start_time', 'end_time', 'created_at']
    ordering = ['-created_at']

    def get_serializer_class(self):
        """根据操作类型选择序列化器"""
        if self.action == 'list':
            return AnnouncementListSerializer
        return AnnouncementSerializer

    def get_queryset(self):
        """自定义查询集"""
        queryset = Announcement.objects.all()

        # 按时间范围筛选
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        if start_date:
            queryset = queryset.filter(created_at__gte=start_date)
        if end_date:
            queryset = queryset.filter(created_at__lte=end_date)

        return queryset

    @action(detail=True, methods=['post'])
    def publish(self, request, pk=None):
        """发布公告"""
        announcement = self.get_object()
        announcement.status = 'published'
        announcement.save()
        return Response({
            'status': 'success',
            'message': '公告已发布'
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def expire(self, request, pk=None):
        """设置公告为过期"""
        announcement = self.get_object()
        announcement.status = 'expired'
        announcement.save()
        return Response({
            'status': 'success',
            'message': '公告已设置为过期'
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'])
    def active(self, request):
        """获取当前有效的公告"""
        from django.utils import timezone
        now = timezone.now()

        announcements = Announcement.objects.filter(
            status='published',
            start_time__lte=now,
            end_time__gte=now
        ).order_by('-created_at')

        serializer = AnnouncementSerializer(announcements, many=True)
        return Response({
            'status': 'success',
            'data': serializer.data
        }, status=status.HTTP_200_OK)
