from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from django.utils import timezone
from .models import SyncRecord, SyncConfig, SyncStatistics
from .serializers import SyncRecordSerializer, SyncConfigSerializer, SyncStatisticsSerializer
from .services import sync_service
import logging

logger = logging.getLogger(__name__)

class SyncViewSet(viewsets.ModelViewSet):
    """同步视图集"""
    queryset = []
    serializer_class = SyncRecordSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]
    
    def get_queryset(self):
        """获取查询集"""
        queryset = SyncRecord.objects.all().order_by('-start_time')
        
        # 过滤同步类型
        sync_type = self.request.query_params.get('sync_type')
        if sync_type:
            queryset = queryset.filter(sync_type=sync_type)
        
        # 过滤同步状态
        status = self.request.query_params.get('status')
        if status:
            queryset = queryset.filter(status=status)
        
        # 过滤发起人
        initiated_by = self.request.query_params.get('initiated_by')
        if initiated_by:
            queryset = queryset.filter(initiated_by=initiated_by)
        
        # 过滤时间范围
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        
        if start_date:
            queryset = queryset.filter(start_time__gte=start_date)
        
        if end_date:
            queryset = queryset.filter(start_time__lte=end_date)
        
        return queryset
    
    @action(detail=False, methods=['get'])
    def status(self, request):
        """获取同步状态"""
        try:
            sync_status = sync_service.get_sync_status()
            return Response(sync_status)
        except Exception as e:
            logger.error(f"获取同步状态时出错: {str(e)}")
            return Response(
                {"error": f"获取同步状态时出错: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['post'])
    def execute(self, request):
        """执行同步操作"""
        try:
            sync_type = request.data.get('sync_type', 'full')
            options = request.data.get('options', {})
            
            # 获取发起人
            initiated_by = request.user.username
            
            # 检查同步类型
            valid_sync_types = ["full", "users", "notes", "categories", "tags"]
            if sync_type not in valid_sync_types:
                return Response(
                    {"error": f"无效的同步类型: {sync_type}. 有效类型: {', '.join(valid_sync_types)}"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # 检查是否有正在进行的同步
            in_progress = SyncRecord.objects.filter(status="in_progress").first()
            if in_progress:
                return Response(
                    {
                        "error": "已有同步正在进行中",
                        "sync_id": in_progress.sync_id,
                        "sync_type": in_progress.sync_type,
                        "start_time": in_progress.start_time
                    },
                    status=status.HTTP_409_CONFLICT
                )
            
            # 执行同步
            if sync_type == "full":
                sync_record = sync_service.sync_all(options)
            elif sync_type == "users":
                sync_record = sync_service.sync_users(options)
            elif sync_type == "notes":
                sync_record = sync_service.sync_notes(options)
            elif sync_type == "categories":
                sync_record = sync_service.sync_categories(options)
            elif sync_type == "tags":
                sync_record = sync_service.sync_tags(options)
            
            # 返回同步记录
            serializer = SyncRecordSerializer(sync_record)
            return Response(serializer.data)
        
        except Exception as e:
            logger.error(f"执行同步操作时出错: {str(e)}")
            return Response(
                {"error": f"执行同步操作时出错: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """取消同步操作"""
        try:
            sync_record = self.get_object()
            
            # 检查是否可以取消
            if sync_record.status != "in_progress":
                return Response(
                    {"error": f"无法取消状态为 {sync_record.status} 的同步"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # 取消同步
            sync_record = sync_service.complete_sync(
                sync_record.sync_id,
                "cancelled",
                {"message": "同步已被用户取消"}
            )
            
            # 返回同步记录
            serializer = SyncRecordSerializer(sync_record)
            return Response(serializer.data)
        
        except Exception as e:
            logger.error(f"取消同步操作时出错: {str(e)}")
            return Response(
                {"error": f"取消同步操作时出错: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'])
    def statistics(self, request):
        """获取同步统计数据"""
        try:
            # 获取时间范围
            days = int(request.query_params.get('days', 7))
            end_date = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
            start_date = end_date - timezone.timedelta(days=days)
            
            # 获取统计数据
            stats = SyncStatistics.objects.filter(date__gte=start_date, date__lte=end_date).order_by('date')
            serializer = SyncStatisticsSerializer(stats, many=True)
            
            return Response(serializer.data)
        
        except Exception as e:
            logger.error(f"获取同步统计数据时出错: {str(e)}")
            return Response(
                {"error": f"获取同步统计数据时出错: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class SyncConfigViewSet(viewsets.ModelViewSet):
    """同步配置视图集"""
    queryset = []
    serializer_class = SyncConfigSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]
    
    @action(detail=False, methods=['get'])
    def all_configs(self, request):
        """获取所有配置"""
        try:
            configs = SyncConfig.objects.all()
            
            # 转换为字典格式
            config_dict = {}
            for config in configs:
                config_dict[config.key] = config.value
            
            # 添加默认配置
            default_configs = {
                "auto_sync": "true",
                "sync_interval": "60",  # 分钟
                "sync_time": "03:00:00",  # 每天定时同步时间
                "sync_types": "users,notes,categories,tags",
                "conflict_resolution": "newer",  # newer, admin, main
                "max_retries": "3",
                "timeout": "300",  # 秒
                "batch_size": "100",
                "notify_on_complete": "true",
                "notify_on_error": "true",
                "log_level": "info",  # debug, info, warning, error
            }
            
            # 合并默认配置和数据库配置
            for key, value in default_configs.items():
                if key not in config_dict:
                    config_dict[key] = value
            
            return Response(config_dict)
        
        except Exception as e:
            logger.error(f"获取所有配置时出错: {str(e)}")
            return Response(
                {"error": f"获取所有配置时出错: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['post'])
    def update_configs(self, request):
        """批量更新配置"""
        try:
            configs = request.data
            
            # 更新配置
            for key, value in configs.items():
                # 将值转换为字符串
                if not isinstance(value, str):
                    value = str(value)
                
                # 更新或创建配置
                try:
                    config = SyncConfig.objects.get(key=key)
                    config.value = value
                    config.updated_at = timezone.now()
                    config.save()
                except SyncConfig.DoesNotExist:
                    config = SyncConfig(
                        key=key,
                        value=value,
                        description=f"{key}的配置值"
                    )
                    config.save()
            
            return Response({"message": "配置更新成功"})
        
        except Exception as e:
            logger.error(f"批量更新配置时出错: {str(e)}")
            return Response(
                {"error": f"批量更新配置时出错: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
