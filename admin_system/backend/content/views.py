from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from .models import NoteCategory, Tag, ContentReport
from .serializers import (
    NoteCategorySerializer,
    TagSerializer,
    ContentReportSerializer,
    ContentReportListSerializer,
    ContentReportUpdateSerializer
)

class NoteCategoryViewSet(viewsets.ModelViewSet):
    """笔记分类视图集"""
    queryset = NoteCategory.objects.all()
    serializer_class = NoteCategorySerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'description']
    ordering_fields = ['name', 'created_at', 'updated_at']
    ordering = ['name']

class TagViewSet(viewsets.ModelViewSet):
    """标签视图集"""
    queryset = Tag.objects.all()
    serializer_class = TagSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name']
    ordering_fields = ['name', 'created_at']
    ordering = ['name']

class ContentReportViewSet(viewsets.ModelViewSet):
    """内容举报视图集"""
    queryset = ContentReport.objects.all()
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'reason', 'content_type']
    search_fields = ['content_id', 'reporter_id', 'description']
    ordering_fields = ['created_at', 'updated_at']
    ordering = ['-created_at']

    def get_serializer_class(self):
        """根据操作类型选择序列化器"""
        if self.action == 'list':
            return ContentReportListSerializer
        elif self.action in ['update', 'partial_update']:
            return ContentReportUpdateSerializer
        return ContentReportSerializer

    def get_queryset(self):
        """自定义查询集"""
        queryset = ContentReport.objects.all()

        # 按创建时间范围筛选
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        if start_date:
            queryset = queryset.filter(created_at__gte=start_date)
        if end_date:
            queryset = queryset.filter(created_at__lte=end_date)

        return queryset

    @action(detail=True, methods=['post'])
    def process(self, request, pk=None):
        """标记为处理中"""
        report = self.get_object()
        report.status = 'processing'
        report.save()
        return Response({
            'status': 'success',
            'message': '举报已标记为处理中'
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def resolve(self, request, pk=None):
        """标记为已解决"""
        report = self.get_object()
        report.status = 'resolved'
        report.admin_comment = request.data.get('admin_comment', report.admin_comment)
        report.save()
        return Response({
            'status': 'success',
            'message': '举报已标记为已解决'
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """标记为已驳回"""
        report = self.get_object()
        report.status = 'rejected'
        report.admin_comment = request.data.get('admin_comment', report.admin_comment)
        report.save()
        return Response({
            'status': 'success',
            'message': '举报已标记为已驳回'
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """举报统计信息"""
        total_reports = ContentReport.objects.count()
        pending_reports = ContentReport.objects.filter(status='pending').count()
        processing_reports = ContentReport.objects.filter(status='processing').count()
        resolved_reports = ContentReport.objects.filter(status='resolved').count()
        rejected_reports = ContentReport.objects.filter(status='rejected').count()

        return Response({
            'status': 'success',
            'data': {
                'total_reports': total_reports,
                'pending_reports': pending_reports,
                'processing_reports': processing_reports,
                'resolved_reports': resolved_reports,
                'rejected_reports': rejected_reports
            }
        }, status=status.HTTP_200_OK)
