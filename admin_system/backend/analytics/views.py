from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone
from django.utils.translation import gettext as _
from django.http import HttpResponse
from dateutil.parser import parse as parse_datetime
from django.conf import settings

from .models import AnalyticsReport, DashboardWidget, ReportTemplate
from .serializers import (
    AnalyticsReportSerializer,
    AnalyticsReportListSerializer,
    DashboardWidgetSerializer,
    DashboardWidgetListSerializer,
    ReportTemplateSerializer,
    ReportTemplateListSerializer
)
from .services import analytics_service
from .permissions import CanViewAnalytics, CanGenerateReports, CanExportReports
import logging

logger = logging.getLogger(__name__)

class AnalyticsReportViewSet(viewsets.ModelViewSet):
    """分析报表视图集"""
    queryset = []
    serializer_class = AnalyticsReportSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['report_type', 'created_by', 'status']

    def get_permissions(self):
        """根据操作动态设置权限"""
        if self.action in ['list', 'retrieve']:
            self.permission_classes = [IsAuthenticated, CanViewAnalytics]
        elif self.action == 'generate':
            self.permission_classes = [IsAuthenticated, CanGenerateReports]
        elif self.action == 'export':
            self.permission_classes = [IsAuthenticated, CanExportReports]
        else:
            self.permission_classes = [IsAuthenticated] # 默认权限，如 update, destroy
        return super().get_permissions()
    search_fields = ['title', 'description']
    ordering_fields = ['created_at', 'updated_at']
    ordering = ['-created_at']
    
    def get_serializer_class(self):
        """根据操作类型选择序列化器"""
        if self.action == 'list':
            return AnalyticsReportListSerializer
        return AnalyticsReportSerializer
    
    def perform_create(self, serializer):
        """创建报表时的操作"""
        serializer.save(created_by=self.request.user.username)
    
    @action(detail=False, methods=['post'])
    def generate(self, request):
        """生成报表（异步）"""
        try:
            report_type = request.data.get('report_type')
            parameters = request.data.get('parameters', {})
            title = request.data.get('title', f'{report_type}分析报表')
            description = request.data.get('description', '')

            if not report_type:
                return Response(
                    {"error": "缺少必要参数: report_type"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # 创建报表，状态为PENDING
            report = AnalyticsReport(
                title=title,
                description=description,
                report_type=report_type,
                parameters=parameters,
                created_by=request.user.username,
                status='PENDING'
            )
            report.save()

            # 触发异步任务
            from .tasks import generate_report_task
            generate_report_task.delay(str(report.id))

            serializer = self.get_serializer(report)
            return Response(serializer.data, status=status.HTTP_202_ACCEPTED)
        
        except Exception as e:
            logger.error(f"生成报表时出错: {str(e)}")
            return Response(
                {"error": f"生成报表失败: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['get'])
    def export(self, request, pk=None):
        """导出报表"""
        try:
            report = self.get_object()
            export_format = request.query_params.get('format', 'csv')
            
            # 导出报表数据
            export_data = analytics_service.export_report(report.result_data, export_format)
            
            if export_format == 'csv':
                # 返回CSV文件
                response = HttpResponse(content_type='text/csv')
                response['Content-Disposition'] = f'attachment; filename="{_(report.title)}_{timezone.now().strftime("%Y%m%d%H%M%S")}.csv"'
                response.write(export_data)
                return response
            
            elif export_format == 'json':
                # 返回JSON文件
                response = HttpResponse(content_type='application/json')
                response['Content-Disposition'] = f'attachment; filename="{_(report.title)}_{timezone.now().strftime("%Y%m%d%H%M%S")}.json"'
                response.write(export_data)
                return response
            
            else:
                return Response(
                    {"error": f"不支持的导出格式: {export_format}"},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        except Exception as e:
            logger.error(f"导出报表时出错: {str(e)}")
            return Response(
                {"error": f"导出报表失败: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class DashboardWidgetViewSet(viewsets.ModelViewSet):
    """仪表盘小部件视图集"""
    queryset = []
    serializer_class = DashboardWidgetSerializer
    permission_classes = [IsAuthenticated, CanViewAnalytics]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['widget_type', 'created_by']
    search_fields = ['title', 'data_source']
    ordering_fields = ['created_at', 'updated_at']
    ordering = ['position']
    
    def get_serializer_class(self):
        """根据操作类型选择序列化器"""
        if self.action == 'list':
            return DashboardWidgetListSerializer
        return DashboardWidgetSerializer
    
    def perform_create(self, serializer):
        """创建小部件时的操作"""
        serializer.save(created_by=self.request.user.username)
    
    @action(detail=False, methods=['get'])
    def dashboard_data(self, request):
        """获取仪表盘数据"""
        try:
            # 获取仪表盘数据
            dashboard_data = analytics_service.get_dashboard_data()
            
            return Response(dashboard_data)
        
        except Exception as e:
            logger.error(f"获取仪表盘数据时出错: {str(e)}")
            return Response(
                {"error": f"获取仪表盘数据失败: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class ReportTemplateViewSet(viewsets.ModelViewSet):
    """报表模板视图集"""
    queryset = []
    serializer_class = ReportTemplateSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['template_type', 'is_system', 'created_by']
    search_fields = ['title', 'description']
    ordering_fields = ['created_at', 'updated_at']
    ordering = ['-created_at']
    
    def get_serializer_class(self):
        """根据操作类型选择序列化器"""
        if self.action == 'list':
            return ReportTemplateListSerializer
        return ReportTemplateSerializer
    
    def perform_create(self, serializer):
        """创建模板时的操作"""
        serializer.save(created_by=self.request.user.username)
    
    @action(detail=True, methods=['post'])
    def generate_report(self, request, pk=None):
        """使用模板生成报表"""
        try:
            template = self.get_object()
            parameters = request.data.get('parameters', {})
            title = request.data.get('title', f'基于{template.title}的报表')
            description = request.data.get('description', '')
            
            # 合并模板配置和参数
            merged_parameters = {**template.template_config, **parameters}
            
            # 生成报表数据
            result_data = analytics_service.generate_report(template.template_type, merged_parameters)
            
            # 保存报表
            report = AnalyticsReport(
                title=title,
                description=description,
                report_type=template.template_type,
                parameters=merged_parameters,
                result_data=result_data,
                created_by=request.user.username
            )
            report.save()
            
            serializer = AnalyticsReportSerializer(report)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        
        except Exception as e:
            logger.error(f"使用模板生成报表时出错: {str(e)}")
            return Response(
                {"error": f"使用模板生成报表失败: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class AnalyticsViewSet(viewsets.ViewSet):
    """分析视图集（增加日期解析和权限）"""
    permission_classes = [IsAuthenticated, CanViewAnalytics]

    def _parse_dates(self, request):
        """解析请求中的日期参数并使其时区感知"""
        start_date_str = request.query_params.get('start_date')
        end_date_str = request.query_params.get('end_date')

        start_date, end_date = None, None
        try:
            if start_date_str:
                start_date = parse_datetime(start_date_str)
                if timezone.is_naive(start_date):
                    start_date = timezone.make_aware(start_date, timezone.get_current_timezone())

            if end_date_str:
                end_date = parse_datetime(end_date_str)
                if timezone.is_naive(end_date):
                    end_date = timezone.make_aware(end_date, timezone.get_current_timezone())
        except ValueError as e:
            logger.warning(f"日期解析失败: {e}")
            # 可以选择抛出异常或返回None
            pass

        return start_date, end_date

    @action(detail=False, methods=['get'])
    def user_analytics(self, request):
        """获取用户分析数据"""
        try:
            start_date, end_date = self._parse_dates(request)
            user_analytics = analytics_service.get_user_analytics(start_date, end_date)
            return Response(user_analytics)
        except Exception as e:
            logger.error(f"获取用户分析数据时出错: {str(e)}")
            return Response({"error": f"获取用户分析数据失败: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'])
    def content_analytics(self, request):
        """获取内容分析数据"""
        try:
            start_date, end_date = self._parse_dates(request)
            content_analytics = analytics_service.get_content_analytics(start_date, end_date)
            return Response(content_analytics)
        except Exception as e:
            logger.error(f"获取内容分析数据时出错: {str(e)}")
            return Response({"error": f"获取内容分析数据失败: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'])
    def system_analytics(self, request):
        """获取系统分析数据"""
        try:
            start_date, end_date = self._parse_dates(request)
            system_analytics = analytics_service.get_system_analytics(start_date, end_date)
            return Response(system_analytics)
        except Exception as e:
            logger.error(f"获取系统分析数据时出错: {str(e)}")
            return Response({"error": f"获取系统分析数据失败: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
