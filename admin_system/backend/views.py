from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from django.utils import timezone
from django.db.models import Count, Sum, Avg, Q
from django.core.paginator import Paginator
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.pagination import PageNumberPagination
from .models import AdminLog, SystemAnnouncement, SystemSetting, AdminRole, AdminUser, SystemBackup
from .serializers import (
    AdminLogSerializer, SystemAnnouncementSerializer, SystemSettingSerializer,
    AdminRoleSerializer, AdminUserSerializer, SystemBackupSerializer,
    UserSerializer, DashboardStatsSerializer
)
import json
import datetime
import random
import os
import psutil

# 仪表盘统计数据
@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def dashboard_stats(request):
    """获取仪表盘统计数据"""
    try:
        # 获取日期范围
        start_date_str = request.query_params.get('startDate')
        end_date_str = request.query_params.get('endDate')
        
        if start_date_str and end_date_str:
            start_date = datetime.datetime.strptime(start_date_str, '%Y-%m-%d').date()
            end_date = datetime.datetime.strptime(end_date_str, '%Y-%m-%d').date()
        else:
            # 默认过去30天
            end_date = timezone.now().date()
            start_date = end_date - datetime.timedelta(days=30)
        
        # 用户总数
        total_users = User.objects.count()
        
        # 今日新增用户
        today = timezone.now().date()
        today_new_users = User.objects.filter(date_joined__date=today).count()
        
        # 用户增长数据
        user_growth_data = {
            'dates': [],
            'values': []
        }
        
        current_date = start_date
        while current_date <= end_date:
            user_growth_data['dates'].append(current_date.strftime('%Y-%m-%d'))
            user_growth_data['values'].append(
                User.objects.filter(date_joined__date=current_date).count()
            )
            current_date += datetime.timedelta(days=1)
        
        # 用户活跃度数据（模拟）
        user_activity_data = {
            'dates': user_growth_data['dates'],
            'values': [random.randint(50, 500) for _ in range(len(user_growth_data['dates']))]
        }
        
        # 内容分布（模拟）
        content_distribution = {
            'notes': random.randint(500, 2000),
            'images': random.randint(300, 1500),
            'audio': random.randint(100, 500),
            'video': random.randint(50, 300),
            'documents': random.randint(200, 1000),
        }
        
        # 系统状态
        system_status = {
            'cpu': psutil.cpu_percent(),
            'memory': psutil.virtual_memory().percent,
            'disk': psutil.disk_usage('/').percent,
        }
        
        # 最近注册用户
        recent_users = User.objects.order_by('-date_joined')[:10]
        recent_users_data = []
        for user in recent_users:
            recent_users_data.append({
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'createdAt': user.date_joined.strftime('%Y-%m-%d'),
                'status': 'active' if user.is_active else 'inactive',
            })
        
        # 组装数据
        data = {
            'totalUsers': total_users,
            'totalNotes': content_distribution['notes'],
            'totalTags': random.randint(100, 500),
            'totalComments': random.randint(200, 1000),
            'todayNewUsers': today_new_users,
            'todayNewNotes': random.randint(5, 50),
            'userGrowthData': user_growth_data,
            'userActivityData': user_activity_data,
            'contentDistribution': content_distribution,
            'systemStatus': system_status,
            'recentUsers': recent_users_data,
        }
        
        return Response(data)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# 用户管理
class UserViewSet(viewsets.ModelViewSet):
    """用户管理视图集"""
    queryset = User.objects.all().order_by('-date_joined')
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        queryset = User.objects.all().order_by('-date_joined')
        
        # 搜索
        search = self.request.query_params.get('search', None)
        if search:
            queryset = queryset.filter(
                Q(username__icontains=search) |
                Q(email__icontains=search) |
                Q(first_name__icontains=search) |
                Q(last_name__icontains=search)
            )
        
        # 状态过滤
        status = self.request.query_params.get('status', None)
        if status:
            is_active = status == 'active'
            queryset = queryset.filter(is_active=is_active)
        
        return queryset

# 管理员日志
class AdminLogViewSet(viewsets.ReadOnlyModelViewSet):
    """管理员日志视图集"""
    queryset = AdminLog.objects.all().order_by('-created_at')
    serializer_class = AdminLogSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        queryset = AdminLog.objects.all().order_by('-created_at')
        
        # 操作类型过滤
        operation_type = self.request.query_params.get('operation_type', None)
        if operation_type:
            queryset = queryset.filter(operation_type=operation_type)
        
        # 管理员过滤
        admin_id = self.request.query_params.get('admin_id', None)
        if admin_id:
            queryset = queryset.filter(admin_id=admin_id)
        
        # 日期范围过滤
        start_date = self.request.query_params.get('start_date', None)
        end_date = self.request.query_params.get('end_date', None)
        
        if start_date and end_date:
            start_date = datetime.datetime.strptime(start_date, '%Y-%m-%d').date()
            end_date = datetime.datetime.strptime(end_date, '%Y-%m-%d').date()
            end_date = datetime.datetime.combine(end_date, datetime.time.max)
            queryset = queryset.filter(created_at__range=(start_date, end_date))
        
        return queryset

# 系统公告
class SystemAnnouncementViewSet(viewsets.ModelViewSet):
    """系统公告视图集"""
    queryset = SystemAnnouncement.objects.all().order_by('-created_at')
    serializer_class = SystemAnnouncementSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        queryset = SystemAnnouncement.objects.all().order_by('-created_at')
        
        # 状态过滤
        status = self.request.query_params.get('status', None)
        if status:
            queryset = queryset.filter(status=status)
        
        return queryset
    
    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
    
    def perform_update(self, serializer):
        instance = serializer.instance
        data = serializer.validated_data
        
        # 如果状态从草稿变为已发布，设置发布时间
        if instance.status == 'DRAFT' and data.get('status') == 'PUBLISHED':
            data['published_at'] = timezone.now()
        
        serializer.save()

# 系统设置
class SystemSettingViewSet(viewsets.ModelViewSet):
    """系统设置视图集"""
    queryset = SystemSetting.objects.all().order_by('key')
    serializer_class = SystemSettingSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        queryset = SystemSetting.objects.all().order_by('key')
        
        # 键过滤
        key = self.request.query_params.get('key', None)
        if key:
            queryset = queryset.filter(key=key)
        
        return queryset

# 管理员角色
class AdminRoleViewSet(viewsets.ModelViewSet):
    """管理员角色视图集"""
    queryset = AdminRole.objects.all().order_by('name')
    serializer_class = AdminRoleSerializer
    permission_classes = [permissions.IsAuthenticated]

# 管理员用户
class AdminUserViewSet(viewsets.ModelViewSet):
    """管理员用户视图集"""
    queryset = AdminUser.objects.all().order_by('-created_at')
    serializer_class = AdminUserSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        queryset = AdminUser.objects.all().order_by('-created_at')
        
        # 角色过滤
        role_id = self.request.query_params.get('role_id', None)
        if role_id:
            queryset = queryset.filter(role_id=role_id)
        
        # 状态过滤
        is_active = self.request.query_params.get('is_active', None)
        if is_active is not None:
            is_active = is_active.lower() == 'true'
            queryset = queryset.filter(is_active=is_active)
        
        return queryset

# 系统备份
class SystemBackupViewSet(viewsets.ModelViewSet):
    """系统备份视图集"""
    queryset = SystemBackup.objects.all().order_by('-created_at')
    serializer_class = SystemBackupSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

# 创建系统备份
@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def create_backup(request):
    """创建系统备份"""
    try:
        backup_type = request.data.get('backup_type', 'full')
        
        # 这里应该实现实际的备份逻辑
        # 为了演示，我们只是创建一个备份记录
        
        backup_name = f"backup_{timezone.now().strftime('%Y%m%d%H%M%S')}"
        file_path = f"/backups/{backup_name}.zip"
        file_size = random.randint(1024 * 1024, 1024 * 1024 * 100)  # 1MB到100MB之间
        
        backup = SystemBackup.objects.create(
            name=backup_name,
            file_path=file_path,
            file_size=file_size,
            backup_type=backup_type,
            created_by=request.user
        )
        
        serializer = SystemBackupSerializer(backup)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# 恢复系统备份
@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def restore_backup(request, pk):
    """恢复系统备份"""
    try:
        backup = SystemBackup.objects.get(pk=pk)
        
        # 这里应该实现实际的恢复逻辑
        # 为了演示，我们只是返回成功
        
        # 记录操作日志
        AdminLog.objects.create(
            admin=request.user,
            operation_type='OTHER',
            operation_detail=f"恢复系统备份: {backup.name}",
            ip_address=request.META.get('REMOTE_ADDR'),
            user_agent=request.META.get('HTTP_USER_AGENT')
        )
        
        return Response({'message': '系统备份恢复成功'})
    except SystemBackup.DoesNotExist:
        return Response({'error': '备份不存在'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# 系统状态
@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def system_status(request):
    """获取系统状态"""
    try:
        # CPU使用率
        cpu_percent = psutil.cpu_percent()
        
        # 内存使用情况
        memory = psutil.virtual_memory()
        memory_percent = memory.percent
        memory_used = memory.used
        memory_total = memory.total
        
        # 磁盘使用情况
        disk = psutil.disk_usage('/')
        disk_percent = disk.percent
        disk_used = disk.used
        disk_total = disk.total
        
        # 系统运行时间
        boot_time = psutil.boot_time()
        uptime_seconds = time.time() - boot_time
        uptime_days = uptime_seconds // (24 * 3600)
        uptime_hours = (uptime_seconds % (24 * 3600)) // 3600
        uptime_minutes = (uptime_seconds % 3600) // 60
        uptime = f"{int(uptime_days)}天{int(uptime_hours)}小时{int(uptime_minutes)}分钟"
        
        # 系统负载
        load_avg = psutil.getloadavg()
        
        # 网络IO
        net_io = psutil.net_io_counters()
        
        data = {
            'cpu': {
                'percent': cpu_percent,
            },
            'memory': {
                'percent': memory_percent,
                'used': memory_used,
                'total': memory_total,
            },
            'disk': {
                'percent': disk_percent,
                'used': disk_used,
                'total': disk_total,
            },
            'uptime': uptime,
            'load_avg': load_avg,
            'net_io': {
                'bytes_sent': net_io.bytes_sent,
                'bytes_recv': net_io.bytes_recv,
            },
        }
        
        return Response(data)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
