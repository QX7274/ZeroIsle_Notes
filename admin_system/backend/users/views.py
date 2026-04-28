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
    # 避免导入阶段触发 MongoDB 连接
    queryset = []
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

    @action(detail=True, methods=['patch'])
    def status(self, request, pk=None):
        """更新用户状态"""
        user = self.get_object()
        new_status = request.data.get('status')

        if not new_status:
            return Response(
                {"error": "未提供状态参数"},
                status=status.HTTP_400_BAD_REQUEST
            )

        if new_status not in [s[0] for s in UserProfile.USER_STATUS_CHOICES]:
            return Response(
                {"error": f"无效的状态值: {new_status}"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 更新用户状态
        old_status = user.status
        user.status = new_status

        # 根据状态更新is_active
        if new_status == 'active':
            user.is_active = True
        else:
            user.is_active = False

        user.save()

        # 同步到主应用
        try:
            user_data = {
                "status": new_status,
                "is_active": user.is_active,
                "updated_at": timezone.now()
            }
            user_service.update_user_in_main_app(user.id, user_data)
        except Exception as e:
            logger.error(f"同步用户状态到主应用时出错: {str(e)}")

        # 记录用户状态变更活动
        activity_type = f'user_{new_status}'
        description = f'管理员将用户 {user.username} 的状态从 {old_status} 变更为 {new_status}'

        UserActivity(
            user=user,
            activity_type=activity_type,
            description=description,
            ip_address=request.META.get('REMOTE_ADDR', ''),
            user_agent=request.META.get('HTTP_USER_AGENT', '')
        ).save()

        logger.info(f"管理员 {request.user} 更新了用户状态: {user.username} -> {new_status}")

        return Response({
            'status': 'success',
            'message': f'用户 {user.username} 的状态已更新为 {new_status}'
        }, status=status.HTTP_200_OK)

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

    @action(detail=True, methods=['post'])
    def reset_password(self, request, pk=None):
        """重置用户密码"""
        user = self.get_object()

        try:
            # 生成随机密码
            import random
            import string
            password_length = 12
            password_chars = string.ascii_letters + string.digits + string.punctuation
            new_password = ''.join(random.choice(password_chars) for i in range(password_length))

            # 在主应用中更新密码
            try:
                # 这里应该调用主应用的密码重置API
                # 由于我们没有直接访问主应用的密码哈希逻辑，这里只是模拟
                user_service.update_user_in_main_app(user.id, {
                    "password_reset": True,
                    "updated_at": timezone.now()
                })
            except Exception as e:
                logger.error(f"在主应用中重置用户密码时出错: {str(e)}")
                return Response(
                    {"error": f"在主应用中重置用户密码失败: {str(e)}"},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )

            # 记录密码重置活动
            UserActivity(
                user=user,
                activity_type='password_reset',
                description=f'管理员重置了用户 {user.username} 的密码',
                ip_address=request.META.get('REMOTE_ADDR', ''),
                user_agent=request.META.get('HTTP_USER_AGENT', '')
            ).save()

            logger.info(f"管理员 {request.user} 重置了用户密码: {user.username}")

            return Response({
                'status': 'success',
                'message': f'用户 {user.username} 的密码已重置',
                'new_password': new_password  # 在实际生产环境中，应该通过更安全的方式传递密码
            })

        except Exception as e:
            logger.error(f"重置用户密码时出错: {str(e)}")
            return Response(
                {"error": f"重置用户密码失败: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

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
            # 获取基本统计信息
            total_users = UserProfile.objects.count()
            active_users = UserProfile.objects.filter(status='active').count()
            inactive_users = UserProfile.objects.filter(status='inactive').count()
            banned_users = UserProfile.objects.filter(status='banned').count()

            # 计算比率
            active_rate = round(active_users / total_users * 100, 2) if total_users > 0 else 0
            inactive_rate = round(inactive_users / total_users * 100, 2) if total_users > 0 else 0
            banned_rate = round(banned_users / total_users * 100, 2) if total_users > 0 else 0

            # 获取最近7天注册的用户数
            last_7_days = timezone.now() - timezone.timedelta(days=7)
            new_users_7_days = UserProfile.objects.filter(date_joined__gte=last_7_days).count()

            # 获取最近30天注册的用户数
            last_30_days = timezone.now() - timezone.timedelta(days=30)
            new_users_30_days = UserProfile.objects.filter(date_joined__gte=last_30_days).count()

            # 获取最近7天活跃用户数（有登录记录的用户）
            active_users_7_days = UserProfile.objects.filter(last_login__gte=last_7_days).count()

            # 获取最近30天活跃用户数
            active_users_30_days = UserProfile.objects.filter(last_login__gte=last_30_days).count()

            # 获取用户分布信息
            user_distribution = {
                'by_status': {
                    'active': active_users,
                    'inactive': inactive_users,
                    'banned': banned_users
                },
                'by_role': {
                    'admin': UserProfile.objects.filter(is_staff=True).count(),
                    'regular': UserProfile.objects.filter(is_staff=False).count()
                }
            }

            # 获取内容创建统计
            total_notes = sum(user.note_count for user in UserProfile.objects.all())
            total_canvases = sum(user.canvas_count for user in UserProfile.objects.all())

            # 获取用户活跃度分布
            login_distribution = {
                'never_logged_in': UserProfile.objects.filter(last_login__isnull=True).count(),
                'inactive_90_days': UserProfile.objects.filter(
                    last_login__lt=timezone.now() - timezone.timedelta(days=90)
                ).count(),
                'active_90_days': UserProfile.objects.filter(
                    last_login__gte=timezone.now() - timezone.timedelta(days=90)
                ).count(),
                'active_30_days': active_users_30_days,
                'active_7_days': active_users_7_days
            }

            # 尝试从主应用获取更多统计信息
            try:
                main_app_stats = user_service.get_user_stats()
            except Exception as e:
                logger.warning(f"从主应用获取用户统计信息时出错: {str(e)}")
                main_app_stats = {}

            # 合并统计信息
            stats_data = {
                'total_users': total_users,
                'active_users': active_users,
                'inactive_users': inactive_users,
                'banned_users': banned_users,
                'active_rate': active_rate,
                'inactive_rate': inactive_rate,
                'banned_rate': banned_rate,
                'new_users_7_days': new_users_7_days,
                'new_users_30_days': new_users_30_days,
                'active_users_7_days': active_users_7_days,
                'active_users_30_days': active_users_30_days,
                'user_distribution': user_distribution,
                'content_stats': {
                    'total_notes': total_notes,
                    'total_canvases': total_canvases,
                    'avg_notes_per_user': round(total_notes / total_users, 2) if total_users > 0 else 0,
                    'avg_canvases_per_user': round(total_canvases / total_users, 2) if total_users > 0 else 0
                },
                'login_distribution': login_distribution,
                'main_app_stats': main_app_stats
            }

            serializer = UserStatsSerializer(stats_data)
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"获取用户统计信息时出错: {str(e)}")
            return Response(
                {"error": f"获取用户统计信息失败: {str(e)}"},
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
    def import_users(self, request):
        """导入用户数据"""
        try:
            users_data = request.data.get('users', [])
            if not users_data:
                return Response(
                    {"error": "未提供用户数据"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # 处理导入的用户数据
            imported_count = 0
            updated_count = 0
            failed_count = 0
            errors = []

            for user_data in users_data:
                try:
                    # 检查必填字段
                    if not user_data.get('username'):
                        errors.append(f"用户数据缺少必填字段 'username': {user_data}")
                        failed_count += 1
                        continue

                    # 检查用户是否已存在
                    try:
                        existing_user = UserProfile.objects.get(username=user_data['username'])
                        # 更新现有用户
                        for key, value in user_data.items():
                            if key != 'username' and hasattr(existing_user, key):
                                setattr(existing_user, key, value)
                        existing_user.save()
                        updated_count += 1

                        # 同步到主应用
                        try:
                            user_service.update_user_in_main_app(existing_user.id, user_data)
                        except Exception as e:
                            logger.error(f"同步用户数据到主应用时出错: {str(e)}")

                    except UserProfile.DoesNotExist:
                        # 创建新用户
                        new_user = UserProfile(
                            username=user_data['username'],
                            email=user_data.get('email', ''),
                            phone=user_data.get('phone', ''),
                            nickname=user_data.get('nickname', ''),
                            avatar=user_data.get('avatar', ''),
                            bio=user_data.get('bio', ''),
                            is_active=user_data.get('is_active', True),
                            is_staff=user_data.get('is_staff', False),
                            status=user_data.get('status', 'active'),
                            preferences=user_data.get('preferences', {}),
                            date_joined=user_data.get('date_joined', timezone.now())
                        )
                        new_user.save()
                        imported_count += 1

                        # 记录用户创建活动
                        UserActivity(
                            user=new_user,
                            activity_type='user_imported',
                            description=f'通过导入功能创建了用户 {new_user.username}',
                            ip_address=request.META.get('REMOTE_ADDR', ''),
                            user_agent=request.META.get('HTTP_USER_AGENT', '')
                        ).save()

                except Exception as e:
                    errors.append(f"处理用户数据时出错: {user_data.get('username', 'unknown')}, 错误: {str(e)}")
                    failed_count += 1

            # 记录导入活动
            UserActivity(
                activity_type='users_imported',
                description=f'管理员导入了用户数据: 新增 {imported_count} 个, 更新 {updated_count} 个, 失败 {failed_count} 个',
                ip_address=request.META.get('REMOTE_ADDR', ''),
                user_agent=request.META.get('HTTP_USER_AGENT', '')
            ).save()

            return Response({
                "status": "success",
                "message": f"用户导入完成: 新增 {imported_count} 个, 更新 {updated_count} 个, 失败 {failed_count} 个",
                "imported_count": imported_count,
                "updated_count": updated_count,
                "failed_count": failed_count,
                "errors": errors
            })

        except Exception as e:
            logger.error(f"导入用户数据时出错: {str(e)}")
            return Response(
                {"error": f"导入用户数据失败: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['post'])
    def export(self, request):
        """导出用户数据"""
        try:
            # 获取筛选参数
            filters = request.data.get('filters', {})
            user_ids = request.data.get('user_ids', [])
            export_format = request.data.get('format', 'json')  # 支持json和csv格式

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

            # 记录导出活动
            UserActivity(
                activity_type='users_exported',
                description=f'管理员导出了 {len(users_data)} 个用户数据',
                ip_address=request.META.get('REMOTE_ADDR', ''),
                user_agent=request.META.get('HTTP_USER_AGENT', '')
            ).save()

            return Response({
                "status": "success",
                "message": f"成功导出 {len(users_data)} 个用户数据",
                "format": export_format,
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
    # 避免导入阶段触发 MongoDB 连接
    queryset = []
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
