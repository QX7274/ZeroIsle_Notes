from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone
from django.db import models
from .models import AdminOperationLog, SystemLog
from .serializers import AdminOperationLogSerializer, SystemLogSerializer
from .services import log_service
import logging
import csv
from django.http import HttpResponse
import json
from datetime import datetime, timedelta
from rest_framework.views import APIView

logger = logging.getLogger(__name__)

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

    @action(detail=False, methods=['post'])
    def sync(self, request):
        """同步管理员操作日志数据"""
        try:
            incremental = request.data.get('incremental', True)
            last_sync_time = None

            if incremental:
                # 获取上次同步时间
                from sync.models import SyncConfig
                try:
                    config = SyncConfig.objects.get(key='last_sync_time_admin_logs')
                    last_sync_time = config.value
                except SyncConfig.DoesNotExist:
                    pass

            result = log_service.sync_admin_logs(incremental, last_sync_time)

            # 更新同步时间
            from sync.models import SyncConfig

            try:
                config = SyncConfig.objects.get(key='last_sync_time_admin_logs')
                config.value = timezone.now().isoformat()
                config.save()
            except SyncConfig.DoesNotExist:
                SyncConfig(
                    key='last_sync_time_admin_logs',
                    value=timezone.now().isoformat(),
                    description='管理员操作日志的最后同步时间'
                ).save()

            return Response({
                'status': 'success',
                'message': '管理员操作日志数据同步成功',
                'result': result
            })
        except Exception as e:
            logger.error(f"同步管理员操作日志数据时出错: {str(e)}")
            return Response(
                {"error": f"同步管理员操作日志数据失败: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

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

    @action(detail=False, methods=['get'])
    def export(self, request):
        """导出操作日志"""
        try:
            # 获取查询参数
            format_type = request.query_params.get('format', 'csv')

            # 构建查询条件
            query = {}

            # 按管理员用户名筛选
            admin_username = request.query_params.get('admin_username')
            if admin_username:
                query['admin_username'] = admin_username

            # 按模块筛选
            module = request.query_params.get('module')
            if module:
                query['module'] = module

            # 按操作类型筛选
            action = request.query_params.get('action')
            if action:
                query['action'] = action

            # 按时间范围筛选
            start_time = request.query_params.get('start_time')
            end_time = request.query_params.get('end_time')
            if start_time or end_time:
                time_query = {}
                if start_time:
                    time_query['$gte'] = start_time
                if end_time:
                    time_query['$lte'] = end_time
                query['operation_time'] = time_query

            # 导出日志
            logs = log_service.export_admin_logs(query, format_type)

            if format_type == 'csv':
                # 创建CSV响应
                response = HttpResponse(content_type='text/csv')
                response['Content-Disposition'] = 'attachment; filename="admin_logs.csv"'

                # 创建CSV写入器
                writer = csv.writer(response)

                # 写入表头
                writer.writerow(['ID', '管理员用户名', 'IP地址', '模块', '操作类型', '资源ID', '描述', '操作时间'])

                # 写入数据
                for log in logs:
                    writer.writerow([
                        log.get('_id', ''),
                        log.get('admin_username', ''),
                        log.get('ip_address', ''),
                        log.get('module', ''),
                        log.get('action', ''),
                        log.get('resource_id', ''),
                        log.get('description', ''),
                        log.get('operation_time', '')
                    ])

                return response
            elif format_type == 'json':
                # 创建JSON响应
                return Response({
                    'status': 'success',
                    'data': logs
                })
            else:
                return Response({
                    'status': 'error',
                    'message': f'不支持的导出格式: {format_type}'
                }, status=status.HTTP_400_BAD_REQUEST)

        except Exception as e:
            logger.error(f"导出操作日志时出错: {str(e)}")
            return Response({
                'status': 'error',
                'message': f'导出操作日志失败: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

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

    @action(detail=False, methods=['post'])
    def sync(self, request):
        """同步系统日志数据"""
        try:
            incremental = request.data.get('incremental', True)
            last_sync_time = None

            if incremental:
                # 获取上次同步时间
                from sync.models import SyncConfig
                try:
                    config = SyncConfig.objects.get(key='last_sync_time_system_logs')
                    last_sync_time = config.value
                except SyncConfig.DoesNotExist:
                    pass

            result = log_service.sync_system_logs(incremental, last_sync_time)

            # 更新同步时间
            from sync.models import SyncConfig

            try:
                config = SyncConfig.objects.get(key='last_sync_time_system_logs')
                config.value = timezone.now().isoformat()
                config.save()
            except SyncConfig.DoesNotExist:
                SyncConfig(
                    key='last_sync_time_system_logs',
                    value=timezone.now().isoformat(),
                    description='系统日志的最后同步时间'
                ).save()

            return Response({
                'status': 'success',
                'message': '系统日志数据同步成功',
                'result': result
            })
        except Exception as e:
            logger.error(f"同步系统日志数据时出错: {str(e)}")
            return Response(
                {"error": f"同步系统日志数据失败: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

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

    @action(detail=False, methods=['get'])
    def export(self, request):
        """导出系统日志"""
        try:
            # 获取查询参数
            format_type = request.query_params.get('format', 'csv')

            # 构建查询条件
            query = {}

            # 按日志级别筛选
            level = request.query_params.get('level')
            if level:
                query['level'] = level

            # 按来源筛选
            source = request.query_params.get('source')
            if source:
                query['source'] = source

            # 按时间范围筛选
            start_time = request.query_params.get('start_time')
            end_time = request.query_params.get('end_time')
            if start_time or end_time:
                time_query = {}
                if start_time:
                    time_query['$gte'] = start_time
                if end_time:
                    time_query['$lte'] = end_time
                query['timestamp'] = time_query

            # 导出日志
            logs = log_service.export_system_logs(query, format_type)

            if format_type == 'csv':
                # 创建CSV响应
                response = HttpResponse(content_type='text/csv')
                response['Content-Disposition'] = 'attachment; filename="system_logs.csv"'

                # 创建CSV写入器
                writer = csv.writer(response)

                # 写入表头
                writer.writerow(['ID', '级别', '来源', '消息', '时间戳'])

                # 写入数据
                for log in logs:
                    writer.writerow([
                        log.get('_id', ''),
                        log.get('level', ''),
                        log.get('source', ''),
                        log.get('message', ''),
                        log.get('timestamp', '')
                    ])

                return response
            elif format_type == 'json':
                # 创建JSON响应
                return Response({
                    'status': 'success',
                    'data': logs
                })
            else:
                return Response({
                    'status': 'error',
                    'message': f'不支持的导出格式: {format_type}'
                }, status=status.HTTP_400_BAD_REQUEST)

        except Exception as e:
            logger.error(f"导出系统日志时出错: {str(e)}")
            return Response({
                'status': 'error',
                'message': f'导出系统日志失败: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class LogAnalyticsView(APIView):
    """日志分析视图"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """获取日志分析数据"""
        try:
            # 获取查询参数
            days = int(request.query_params.get('days', 30))
            log_type = request.query_params.get('type', 'all')

            # 限制最大查询天数
            if days > 365:
                days = 365

            # 计算日期范围
            end_date = timezone.now()
            start_date = end_date - timedelta(days=days)

            # 初始化返回数据
            analytics_data = {
                'log_trend': [],
                'error_trend': [],
                'log_type_distribution': [],
                'log_level_distribution': [],
                'admin_action_distribution': [],
                'top_modules': [],
                'top_ips': [],
                'top_errors': [],
                'top_admins': [],
                'admin_time_distribution': [],
                'health_status': 'good',
                'health_description': '系统运行正常，未发现严重问题。',
                'error_rate': 0,
                'stability_score': 95,
                'performance_score': 90,
                'health_suggestions': []
            }

            # 获取日志趋势数据
            analytics_data['log_trend'] = self._get_log_trend(start_date, end_date, log_type)

            # 获取错误日志趋势数据
            analytics_data['error_trend'] = self._get_error_trend(start_date, end_date)

            # 获取日志类型分布数据
            analytics_data['log_type_distribution'] = self._get_log_type_distribution()

            # 获取日志级别分布数据
            analytics_data['log_level_distribution'] = self._get_log_level_distribution()

            # 获取管理员操作类型分布数据
            analytics_data['admin_action_distribution'] = self._get_admin_action_distribution()

            # 获取热门模块排行榜
            analytics_data['top_modules'] = self._get_top_modules()

            # 获取热门IP地址排行榜
            analytics_data['top_ips'] = self._get_top_ips()

            # 获取热门错误消息
            analytics_data['top_errors'] = self._get_top_errors()

            # 获取活跃管理员排行
            analytics_data['top_admins'] = self._get_top_admins()

            # 获取管理员操作时间分布
            analytics_data['admin_time_distribution'] = self._get_admin_time_distribution()

            # 计算系统健康状态
            health_data = self._calculate_health_status()
            analytics_data.update(health_data)

            return Response({
                'status': 'success',
                'data': analytics_data
            }, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"获取日志分析数据时出错: {str(e)}")
            return Response({
                'status': 'error',
                'message': f'获取日志分析数据失败: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def _get_log_trend(self, start_date, end_date, log_type):
        """获取日志趋势数据"""
        # 初始化日期范围
        date_range = []
        current_date = start_date.replace(hour=0, minute=0, second=0, microsecond=0)
        while current_date <= end_date:
            date_range.append(current_date)
            current_date += timedelta(days=1)

        # 初始化趋势数据
        trend_data = []

        # 获取管理员操作日志趋势
        if log_type in ['all', 'admin']:
            admin_trend = []
            for date in date_range:
                next_date = date + timedelta(days=1)
                count = AdminOperationLog.objects.filter(
                    operation_time__gte=date,
                    operation_time__lt=next_date
                ).count()
                admin_trend.append({
                    'date': date.strftime('%Y-%m-%d'),
                    'count': count,
                    'type': '管理员操作'
                })
            trend_data.extend(admin_trend)

        # 获取系统日志趋势
        if log_type in ['all', 'system']:
            system_trend = []
            for date in date_range:
                next_date = date + timedelta(days=1)
                count = SystemLog.objects.filter(
                    timestamp__gte=date,
                    timestamp__lt=next_date
                ).count()
                system_trend.append({
                    'date': date.strftime('%Y-%m-%d'),
                    'count': count,
                    'type': '系统日志'
                })
            trend_data.extend(system_trend)

        return trend_data

    def _get_error_trend(self, start_date, end_date):
        """获取错误日志趋势数据"""
        # 初始化日期范围
        date_range = []
        current_date = start_date.replace(hour=0, minute=0, second=0, microsecond=0)
        while current_date <= end_date:
            date_range.append(current_date)
            current_date += timedelta(days=1)

        # 初始化趋势数据
        trend_data = []

        # 获取错误日志趋势
        error_trend = []
        for date in date_range:
            next_date = date + timedelta(days=1)
            count = SystemLog.objects.filter(
                timestamp__gte=date,
                timestamp__lt=next_date,
                level='error'
            ).count()
            error_trend.append({
                'date': date.strftime('%Y-%m-%d'),
                'count': count,
                'type': '错误'
            })
        trend_data.extend(error_trend)

        # 获取警告日志趋势
        warning_trend = []
        for date in date_range:
            next_date = date + timedelta(days=1)
            count = SystemLog.objects.filter(
                timestamp__gte=date,
                timestamp__lt=next_date,
                level='warning'
            ).count()
            warning_trend.append({
                'date': date.strftime('%Y-%m-%d'),
                'count': count,
                'type': '警告'
            })
        trend_data.extend(warning_trend)

        return trend_data

    def _get_log_type_distribution(self):
        """获取日志类型分布数据"""
        admin_count = AdminOperationLog.objects.count()
        system_count = SystemLog.objects.count()

        return [
            {'name': '管理员操作日志', 'value': admin_count},
            {'name': '系统日志', 'value': system_count}
        ]

    def _get_log_level_distribution(self):
        """获取日志级别分布数据"""
        distribution = []

        for level_choice in SystemLog.LEVEL_CHOICES:
            level_code = level_choice[0]
            level_name = level_choice[1]
            count = SystemLog.objects.filter(level=level_code).count()

            if count > 0:
                distribution.append({
                    'name': level_name,
                    'value': count
                })

        return distribution

    def _get_admin_action_distribution(self):
        """获取管理员操作类型分布数据"""
        distribution = []

        for action_choice in AdminOperationLog.ACTION_CHOICES:
            action_code = action_choice[0]
            action_name = action_choice[1]
            count = AdminOperationLog.objects.filter(action=action_code).count()

            if count > 0:
                distribution.append({
                    'name': action_name,
                    'value': count
                })

        return distribution

    def _get_top_modules(self):
        """获取热门模块排行榜"""
        modules = AdminOperationLog.objects.values('module').annotate(
            count=models.Count('module')
        ).order_by('-count')[:10]

        return [{'name': module['module'], 'value': module['count']} for module in modules]

    def _get_top_ips(self):
        """获取热门IP地址排行榜"""
        ips = AdminOperationLog.objects.values('ip_address').annotate(
            count=models.Count('ip_address')
        ).order_by('-count')[:10]

        return [{'name': ip['ip_address'], 'value': ip['count']} for ip in ips]

    def _get_top_errors(self):
        """获取热门错误消息"""
        errors = SystemLog.objects.filter(level='error').values('message', 'source').annotate(
            count=models.Count('message')
        ).order_by('-count')[:10]

        return [
            {
                'message': error['message'],
                'source': error['source'],
                'count': error['count'],
                'last_time': SystemLog.objects.filter(
                    message=error['message'],
                    level='error'
                ).order_by('-timestamp').first().timestamp
            }
            for error in errors
        ]

    def _get_top_admins(self):
        """获取活跃管理员排行"""
        admins = AdminOperationLog.objects.values('admin_username', 'admin_id').annotate(
            count=models.Count('admin_username')
        ).order_by('-count')[:10]

        return [
            {
                'admin_username': admin['admin_username'],
                'admin_id': admin['admin_id'],
                'count': admin['count']
            }
            for admin in admins
        ]

    def _get_admin_time_distribution(self):
        """获取管理员操作时间分布"""
        distribution = []

        for hour in range(24):
            count = AdminOperationLog.objects.filter(
                operation_time__hour=hour
            ).count()

            distribution.append({
                'hour': f"{hour:02d}:00",
                'count': count
            })

        return distribution

    def _calculate_health_status(self):
        """计算系统健康状态"""
        # 计算错误率
        total_logs = SystemLog.objects.count()
        error_logs = SystemLog.objects.filter(level='error').count()
        error_rate = (error_logs / total_logs * 100) if total_logs > 0 else 0

        # 计算稳定性评分
        stability_score = 100 - min(error_rate * 5, 50)

        # 计算性能评分
        # 这里可以根据实际情况计算性能评分，这里简单模拟
        performance_score = 90 - min(error_rate * 2, 30)

        # 确定健康状态
        health_status = 'good'
        health_description = '系统运行正常，未发现严重问题。'

        if error_rate > 10:
            health_status = 'critical'
            health_description = '系统错误率过高，请尽快排查问题。'
        elif error_rate > 5:
            health_status = 'warning'
            health_description = '系统错误率较高，建议关注。'

        # 生成健康建议
        health_suggestions = []

        if error_rate > 5:
            health_suggestions.append({
                'title': '降低系统错误率',
                'description': '系统错误率较高，建议排查错误日志，修复常见错误。',
                'priority': 'high' if error_rate > 10 else 'medium'
            })

        # 检查是否有频繁出现的错误
        top_errors = SystemLog.objects.filter(level='error').values('message').annotate(
            count=models.Count('message')
        ).order_by('-count')[:3]

        for error in top_errors:
            if error['count'] > 10:
                health_suggestions.append({
                    'title': f'修复频繁出现的错误',
                    'description': f'错误消息 "{error["message"][:50]}..." 出现了 {error["count"]} 次，建议优先修复。',
                    'priority': 'high' if error['count'] > 50 else 'medium'
                })

        # 检查日志增长趋势
        now = timezone.now()
        logs_today = SystemLog.objects.filter(
            timestamp__gte=now.replace(hour=0, minute=0, second=0, microsecond=0)
        ).count()
        logs_yesterday = SystemLog.objects.filter(
            timestamp__gte=(now - timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0),
            timestamp__lt=now.replace(hour=0, minute=0, second=0, microsecond=0)
        ).count()

        if logs_today > logs_yesterday * 2 and logs_today > 100:
            health_suggestions.append({
                'title': '日志数量激增',
                'description': f'今天的日志数量 ({logs_today}) 是昨天 ({logs_yesterday}) 的两倍以上，建议检查系统是否有异常。',
                'priority': 'medium'
            })

        return {
            'health_status': health_status,
            'health_description': health_description,
            'error_rate': round(error_rate, 2),
            'stability_score': round(stability_score, 1),
            'performance_score': round(performance_score, 1),
            'health_suggestions': health_suggestions
        }