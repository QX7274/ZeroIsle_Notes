from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone
from django.db.models import Q
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
from .services import user_service

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

        # 同步到主应用
        try:
            user_data = {
                "username": user.username,
                "email": user.email,
                "phone": user.phone,
                "nickname": user.nickname,
                "avatar": user.avatar,
                "bio": user.bio,
                "is_active": user.is_active,
                "status": user.status,
                "preferences": user.preferences,
                "updated_at": timezone.now()
            }
            user_service.update_user_in_main_app(user.id, user_data)
        except Exception as e:
            logger.error(f"同步用户数据到主应用时出错: {str(e)}")

    def perform_destroy(self, instance):
        """删除用户时的操作"""
        username = instance.username
        user_id = instance.id

        # 同步到主应用
        try:
            user_service.delete_user_in_main_app(user_id)
        except Exception as e:
            logger.error(f"在主应用中删除用户时出错: {str(e)}")

        # 删除本地用户
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

        # 同步到主应用
        try:
            user_data = {
                "status": "banned",
                "is_active": False,
                "updated_at": timezone.now()
            }
            user_service.update_user_in_main_app(user.id, user_data)
        except Exception as e:
            logger.error(f"同步用户状态到主应用时出错: {str(e)}")

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

        # 同步到主应用
        try:
            user_data = {
                "status": "active",
                "is_active": True,
                "updated_at": timezone.now()
            }
            user_service.update_user_in_main_app(user.id, user_data)
        except Exception as e:
            logger.error(f"同步用户状态到主应用时出错: {str(e)}")

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

    @action(detail=False, methods=['post'])
    def sync(self, request):
        """同步用户数据"""
        try:
            incremental = request.data.get('incremental', True)
            last_sync_time = None

            if incremental:
                # 获取上次同步时间
                from sync.models import SyncConfig
                try:
                    config = SyncConfig.objects.get(key='last_sync_time_users')
                    last_sync_time = config.value
                except SyncConfig.DoesNotExist:
                    pass

            result = user_service.sync_users(incremental, last_sync_time)

            # 更新同步时间
            from sync.models import SyncConfig
            from django.utils import timezone

            try:
                config = SyncConfig.objects.get(key='last_sync_time_users')
                config.value = timezone.now().isoformat()
                config.save()
            except SyncConfig.DoesNotExist:
                SyncConfig(
                    key='last_sync_time_users',
                    value=timezone.now().isoformat(),
                    description='用户数据的最后同步时间'
                ).save()

            return Response({
                'status': 'success',
                'message': '用户数据同步成功',
                'result': result
            })
        except Exception as e:
            logger.error(f"同步用户数据时出错: {str(e)}")
            return Response(
                {"error": f"同步用户数据失败: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """用户统计信息"""
        try:
            # 使用用户服务获取统计信息
            stats_data = user_service.get_user_stats()

            # 添加额外的统计信息
            if 'total_users' in stats_data and stats_data['total_users'] > 0:
                stats_data['active_rate'] = round(stats_data.get('active_users', 0) / stats_data['total_users'] * 100, 2)
                stats_data['inactive_rate'] = round(stats_data.get('inactive_users', 0) / stats_data['total_users'] * 100, 2)
                stats_data['banned_rate'] = round(stats_data.get('banned_users', 0) / stats_data['total_users'] * 100, 2)
            else:
                stats_data['active_rate'] = 0
                stats_data['inactive_rate'] = 0
                stats_data['banned_rate'] = 0

            serializer = UserStatsSerializer(stats_data)
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"获取用户统计信息时出错: {str(e)}")
            return Response(
                {"error": "获取用户统计信息失败"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['post'])
    def batch_activate(self, request):
        """批量激活用户"""
        try:
            user_ids = request.data.get('user_ids', [])
            if not user_ids:
                return Response(
                    {"error": "未提供用户ID列表"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # 批量更新用户状态
            activated_count = 0
            for user_id in user_ids:
                try:
                    user = UserProfile.objects.get(id=user_id)
                    user.status = 'active'
                    user.is_active = True
                    user.save()

                    # 同步到主应用
                    try:
                        user_data = {
                            "status": "active",
                            "is_active": True,
                            "updated_at": timezone.now()
                        }
                        user_service.update_user_in_main_app(user.id, user_data)
                    except Exception as e:
                        logger.error(f"同步用户状态到主应用时出错: {str(e)}")

                    # 记录用户激活活动
                    UserActivity(
                        user=user,
                        activity_type='user_activated',
                        description=f'管理员批量激活了用户 {user.username}',
                        ip_address=request.META.get('REMOTE_ADDR', ''),
                        user_agent=request.META.get('HTTP_USER_AGENT', '')
                    ).save()

                    activated_count += 1
                except UserProfile.DoesNotExist:
                    logger.warning(f"用户不存在: {user_id}")
                except Exception as e:
                    logger.error(f"激活用户时出错: {str(e)}")

            return Response({
                "status": "success",
                "message": f"成功激活 {activated_count} 个用户",
                "activated_count": activated_count
            })
        except Exception as e:
            logger.error(f"批量激活用户时出错: {str(e)}")
            return Response(
                {"error": f"批量激活用户失败: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['post'])
    def batch_deactivate(self, request):
        """批量禁用用户"""
        try:
            user_ids = request.data.get('user_ids', [])
            if not user_ids:
                return Response(
                    {"error": "未提供用户ID列表"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # 批量更新用户状态
            deactivated_count = 0
            for user_id in user_ids:
                try:
                    user = UserProfile.objects.get(id=user_id)
                    user.status = 'inactive'
                    user.is_active = False
                    user.save()

                    # 同步到主应用
                    try:
                        user_data = {
                            "status": "inactive",
                            "is_active": False,
                            "updated_at": timezone.now()
                        }
                        user_service.update_user_in_main_app(user.id, user_data)
                    except Exception as e:
                        logger.error(f"同步用户状态到主应用时出错: {str(e)}")

                    # 记录用户禁用活动
                    UserActivity(
                        user=user,
                        activity_type='user_deactivated',
                        description=f'管理员批量禁用了用户 {user.username}',
                        ip_address=request.META.get('REMOTE_ADDR', ''),
                        user_agent=request.META.get('HTTP_USER_AGENT', '')
                    ).save()

                    deactivated_count += 1
                except UserProfile.DoesNotExist:
                    logger.warning(f"用户不存在: {user_id}")
                except Exception as e:
                    logger.error(f"禁用用户时出错: {str(e)}")

            return Response({
                "status": "success",
                "message": f"成功禁用 {deactivated_count} 个用户",
                "deactivated_count": deactivated_count
            })
        except Exception as e:
            logger.error(f"批量禁用用户时出错: {str(e)}")
            return Response(
                {"error": f"批量禁用用户失败: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['post'])
    def batch_delete(self, request):
        """批量删除用户"""
        try:
            user_ids = request.data.get('user_ids', [])
            if not user_ids:
                return Response(
                    {"error": "未提供用户ID列表"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # 批量删除用户
            deleted_count = 0
            for user_id in user_ids:
                try:
                    user = UserProfile.objects.get(id=user_id)
                    username = user.username

                    # 同步到主应用
                    try:
                        user_service.delete_user_in_main_app(user_id)
                    except Exception as e:
                        logger.error(f"在主应用中删除用户时出错: {str(e)}")

                    # 删除本地用户
                    user.delete()

                    # 记录用户删除活动
                    UserActivity(
                        activity_type='user_deleted',
                        description=f'管理员批量删除了用户 {username}',
                        ip_address=request.META.get('REMOTE_ADDR', ''),
                        user_agent=request.META.get('HTTP_USER_AGENT', '')
                    ).save()

                    deleted_count += 1
                except UserProfile.DoesNotExist:
                    logger.warning(f"用户不存在: {user_id}")
                except Exception as e:
                    logger.error(f"删除用户时出错: {str(e)}")

            return Response({
                "status": "success",
                "message": f"成功删除 {deleted_count} 个用户",
                "deleted_count": deleted_count
            })
        except Exception as e:
            logger.error(f"批量删除用户时出错: {str(e)}")
            return Response(
                {"error": f"批量删除用户失败: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['post'])
    def export(self, request):
        """导出用户数据"""
        try:
            # 获取筛选参数
            filters = request.data.get('filters', {})
            user_ids = request.data.get('user_ids', [])

            # 构建查询集
            queryset = self.get_queryset()

            # 如果提供了用户ID列表，则只导出这些用户
            if user_ids:
                queryset = queryset.filter(id__in=user_ids)

            # 应用筛选条件
            if 'keyword' in filters and filters['keyword']:
                keyword = filters['keyword']
                queryset = queryset.filter(
                    Q(username__icontains=keyword) |
                    Q(email__icontains=keyword) |
                    Q(phone__icontains=keyword) |
                    Q(nickname__icontains=keyword)
                )

            if 'status' in filters and filters['status'] != 'all':
                queryset = queryset.filter(status=filters['status'])

            if 'start_date' in filters and filters['start_date']:
                queryset = queryset.filter(date_joined__gte=filters['start_date'])

            if 'end_date' in filters and filters['end_date']:
                queryset = queryset.filter(date_joined__lte=filters['end_date'])

            # 获取用户数据
            users_data = []
            for user in queryset:
                users_data.append({
                    'id': str(user.id),
                    'username': user.username,
                    'email': user.email,
                    'phone': user.phone,
                    'nickname': user.nickname,
                    'status': user.status,
                    'is_active': user.is_active,
                    'date_joined': user.date_joined.strftime('%Y-%m-%d %H:%M:%S') if user.date_joined else '',
                    'last_login': user.last_login.strftime('%Y-%m-%d %H:%M:%S') if user.last_login else '',
                    'note_count': user.note_count,
                    'canvas_count': user.canvas_count,
                    'login_count': user.login_count
                })

            return Response({
                "status": "success",
                "message": f"成功导出 {len(users_data)} 个用户数据",
                "data": users_data
            })
        except Exception as e:
            logger.error(f"导出用户数据时出错: {str(e)}")
            return Response(
                {"error": f"导出用户数据失败: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['get'])
    def growth(self, request):
        """用户增长趋势"""
        try:
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

            # 尝试从主应用获取数据
            try:
                users_collection = user_service.db["users"]
                growth_data = []

                for date in date_range:
                    next_date = date + timedelta(days=1)
                    count = users_collection.count_documents({
                        "date_joined": {"$gte": date, "$lt": next_date}
                    })
                    growth_data.append({
                        'date': date.strftime('%Y-%m-%d'),
                        'count': count
                    })
            except Exception as e:
                logger.warning(f"从主应用获取用户增长数据失败，使用本地数据: {str(e)}")
                # 如果从主应用获取失败，使用本地数据
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
        except Exception as e:
            logger.error(f"获取用户增长趋势时出错: {str(e)}")
            return Response(
                {"error": "获取用户增长趋势失败"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

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
