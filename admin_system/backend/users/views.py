from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone
from datetime import timedelta
import logging

from .models import UserProfile, UserActivity
from .serializers import (
    UserProfileSerializer,
    UserProfileListSerializer,
    UserProfileCreateSerializer,
    UserProfileUpdateSerializer,
    UserActivitySerializer,
    UserStatsSerializer
)

logger = logging.getLogger(__name__)

class UserProfileViewSet(viewsets.ModelViewSet):
    """用户资料视图集"""
    queryset = UserProfile.objects.all()
    permission_classes = [IsAuthenticated, IsAdminUser]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'is_active', 'is_staff']
    search_fields = ['username', 'email', 'phone', 'nickname']
    ordering_fields = ['date_joined', 'last_login', 'note_count', 'canvas_count', 'login_count']
    ordering = ['-date_joined']

    def get_serializer_class(self):
        """根据操作类型选择序列化器"""
        if self.action == 'list':
            return UserProfileListSerializer
        elif self.action == 'create':
            return UserProfileCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return UserProfileUpdateSerializer
        elif self.action == 'stats':
            return UserStatsSerializer
        return UserProfileSerializer

    def get_queryset(self):
        """自定义查询集"""
        queryset = UserProfile.objects.all()

        # 按创建时间范围筛选
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        if start_date:
            queryset = queryset.filter(date_joined__gte=start_date)
        if end_date:
            queryset = queryset.filter(date_joined__lte=end_date)

        # 按最后登录时间范围筛选
        last_login_start = self.request.query_params.get('last_login_start')
        last_login_end = self.request.query_params.get('last_login_end')
        if last_login_start:
            queryset = queryset.filter(last_login__gte=last_login_start)
        if last_login_end:
            queryset = queryset.filter(last_login__lte=last_login_end)

        # 按笔记数量筛选
        min_notes = self.request.query_params.get('min_notes')
        max_notes = self.request.query_params.get('max_notes')
        if min_notes:
            queryset = queryset.filter(note_count__gte=int(min_notes))
        if max_notes:
            queryset = queryset.filter(note_count__lte=int(max_notes))

        # 按登录次数筛选
        min_logins = self.request.query_params.get('min_logins')
        max_logins = self.request.query_params.get('max_logins')
        if min_logins:
            queryset = queryset.filter(login_count__gte=int(min_logins))
        if max_logins:
            queryset = queryset.filter(login_count__lte=int(max_logins))

        return queryset

    def perform_create(self, serializer):
        """创建用户时的操作"""
        user = serializer.save()
        logger.info(f"管理员 {self.request.user} 创建了新用户: {user.username}")

    def perform_update(self, serializer):
        """更新用户时的操作"""
        user = serializer.save()
        logger.info(f"管理员 {self.request.user} 更新了用户: {user.username}")

    def perform_destroy(self, instance):
        """删除用户时的操作"""
        username = instance.username
        instance.delete()
        logger.info(f"管理员 {self.request.user} 删除了用户: {username}")

        # 记录用户删除活动
        UserActivity(
            activity_type='user_deleted',
            description=f'管理员删除了用户 {username}',
            ip_address=self.request.META.get('REMOTE_ADDR', ''),
            user_agent=self.request.META.get('HTTP_USER_AGENT', '')
        ).save()

    @action(detail=True, methods=['post'])
    def ban(self, request, pk=None):
        """禁用用户"""
        user = self.get_object()
        user.status = 'banned'
        user.is_active = False
        user.save()

        # 记录用户禁用活动
        UserActivity(
            user=user,
            activity_type='user_banned',
            description=f'管理员禁用了用户 {user.username}',
            ip_address=request.META.get('REMOTE_ADDR', ''),
            user_agent=request.META.get('HTTP_USER_AGENT', '')
        ).save()

        logger.info(f"管理员 {request.user} 禁用了用户: {user.username}")

        return Response({
            'status': 'success',
            'message': f'用户 {user.username} 已被禁用'
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        """激活用户"""
        user = self.get_object()
        user.status = 'active'
        user.is_active = True
        user.save()

        # 记录用户激活活动
        UserActivity(
            user=user,
            activity_type='user_activated',
            description=f'管理员激活了用户 {user.username}',
            ip_address=request.META.get('REMOTE_ADDR', ''),
            user_agent=request.META.get('HTTP_USER_AGENT', '')
        ).save()

        logger.info(f"管理员 {request.user} 激活了用户: {user.username}")

        return Response({
            'status': 'success',
            'message': f'用户 {user.username} 已被激活'
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'])
    def activities(self, request, pk=None):
        """获取用户活动记录"""
        user = self.get_object()
        activities = UserActivity.objects.filter(user=user).order_by('-created_at')

        # 分页
        page = self.paginate_queryset(activities)
        if page is not None:
            serializer = UserActivitySerializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = UserActivitySerializer(activities, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """用户统计信息"""
        today = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
        week_ago = today - timedelta(days=7)
        month_ago = today - timedelta(days=30)

        total_users = UserProfile.objects.count()
        active_users = UserProfile.objects.filter(is_active=True).count()
        inactive_users = UserProfile.objects.filter(is_active=False, status='inactive').count()
        banned_users = UserProfile.objects.filter(status='banned').count()

        new_users_today = UserProfile.objects.filter(date_joined__gte=today).count()
        new_users_this_week = UserProfile.objects.filter(date_joined__gte=week_ago).count()
        new_users_this_month = UserProfile.objects.filter(date_joined__gte=month_ago).count()

        login_users_today = UserProfile.objects.filter(last_login__gte=today).count()

        stats_data = {
            'total_users': total_users,
            'active_users': active_users,
            'inactive_users': inactive_users,
            'banned_users': banned_users,
            'new_users_today': new_users_today,
            'new_users_this_week': new_users_this_week,
            'new_users_this_month': new_users_this_month,
            'login_users_today': login_users_today
        }

        serializer = UserStatsSerializer(stats_data)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def growth(self, request):
        """用户增长趋势"""
        days = int(request.query_params.get('days', 30))
        if days > 365:
            days = 365  # 限制最大查询天数

        end_date = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
        start_date = end_date - timedelta(days=days)

        # 准备日期范围
        date_range = []
        current_date = start_date
        while current_date <= end_date:
            date_range.append(current_date)
            current_date += timedelta(days=1)

        # 查询每天新增用户数
        growth_data = []
        for date in date_range:
            next_date = date + timedelta(days=1)
            count = UserProfile.objects.filter(date_joined__gte=date, date_joined__lt=next_date).count()
            growth_data.append({
                'date': date.strftime('%Y-%m-%d'),
                'count': count
            })

        return Response({
            'days': days,
            'data': growth_data
        })

class UserActivityViewSet(viewsets.ReadOnlyModelViewSet):
    """用户活动视图集"""
    queryset = UserActivity.objects.all().order_by('-created_at')
    serializer_class = UserActivitySerializer
    permission_classes = [IsAuthenticated, IsAdminUser]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['activity_type']
    search_fields = ['description', 'ip_address']
    ordering_fields = ['created_at']

    def get_queryset(self):
        """自定义查询集"""
        queryset = UserActivity.objects.all()

        # 按用户筛选
        user_id = self.request.query_params.get('user_id')
        if user_id:
            queryset = queryset.filter(user=user_id)

        # 按活动类型筛选
        activity_type = self.request.query_params.get('activity_type')
        if activity_type:
            queryset = queryset.filter(activity_type=activity_type)

        # 按时间范围筛选
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        if start_date:
            queryset = queryset.filter(created_at__gte=start_date)
        if end_date:
            queryset = queryset.filter(created_at__lte=end_date)

        return queryset.order_by('-created_at')
