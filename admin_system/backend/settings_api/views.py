from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone
from django.http import FileResponse
import os
import logging
from .models import SystemSetting, Announcement, SystemBackup
from .serializers import (
    SystemSettingSerializer,
    AnnouncementSerializer,
    AnnouncementListSerializer,
    SystemBackupSerializer,
    SystemBackupListSerializer
)
from .services import setting_service, backup_service

logger = logging.getLogger(__name__)

class SystemSettingViewSet(viewsets.ModelViewSet):
    """系统设置视图集"""
    queryset = SystemSetting.objects.all()
    serializer_class = SystemSettingSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['key', 'value', 'description']
    ordering_fields = ['key', 'created_at', 'updated_at']
    ordering = ['key']

    def perform_create(self, serializer):
        """创建设置时的操作"""
        setting = serializer.save()
        logger.info(f"管理员 {self.request.user} 创建了设置: {setting.key}")

        # 同步到主应用
        try:
            setting_service.update_setting_in_main_app(
                setting.key,
                setting.value,
                setting.description
            )
        except Exception as e:
            logger.error(f"同步设置数据到主应用时出错: {str(e)}")

    def perform_update(self, serializer):
        """更新设置时的操作"""
        setting = serializer.save()
        logger.info(f"管理员 {self.request.user} 更新了设置: {setting.key}")

        # 同步到主应用
        try:
            setting_service.update_setting_in_main_app(
                setting.key,
                setting.value,
                setting.description
            )
        except Exception as e:
            logger.error(f"同步设置数据到主应用时出错: {str(e)}")

    @action(detail=False, methods=['post'])
    def sync(self, request):
        """同步系统设置数据"""
        try:
            incremental = request.data.get('incremental', True)
            last_sync_time = None

            if incremental:
                # 获取上次同步时间
                from sync.models import SyncConfig
                try:
                    config = SyncConfig.objects.get(key='last_sync_time_settings')
                    last_sync_time = config.value
                except SyncConfig.DoesNotExist:
                    pass

            result = setting_service.sync_settings(incremental, last_sync_time)

            # 更新同步时间
            from sync.models import SyncConfig

            try:
                config = SyncConfig.objects.get(key='last_sync_time_settings')
                config.value = timezone.now().isoformat()
                config.save()
            except SyncConfig.DoesNotExist:
                SyncConfig(
                    key='last_sync_time_settings',
                    value=timezone.now().isoformat(),
                    description='系统设置的最后同步时间'
                ).save()

            return Response({
                'status': 'success',
                'message': '系统设置数据同步成功',
                'result': result
            })
        except Exception as e:
            logger.error(f"同步系统设置数据时出错: {str(e)}")
            return Response(
                {"error": f"同步系统设置数据失败: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

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

    @action(detail=False, methods=['get'])
    def all_configs(self, request):
        """获取所有系统配置"""
        settings = SystemSetting.objects.all()

        # 将设置转换为字典格式
        config_dict = {}
        for setting in settings:
            config_dict[setting.key] = setting.value

        # 如果没有配置，返回默认配置
        if not config_dict:
            config_dict = self._get_default_configs()

        return Response({
            'status': 'success',
            'data': config_dict
        }, status=status.HTTP_200_OK)

    def _get_default_configs(self):
        """获取默认配置"""
        return {
            'siteName': '零屿笔记管理系统',
            'siteDescription': '零屿笔记的管理后台系统，用于管理用户、内容和系统设置',
            'siteKeywords': '零屿笔记,管理系统,后台管理',
            'siteLogo': '/logo.png',
            'siteFavicon': '/favicon.ico',
            'adminEmail': 'admin@zeroisle.com',
            'userRegistration': 'true',
            'emailVerification': 'true',
            'defaultUserRole': 'user',
            'pageSize': '10',
            'uploadMaxSize': '10',
            'allowedFileTypes': 'jpg,jpeg,png,gif,pdf,doc,docx',
            'timezone': 'Asia/Shanghai',
            'dateFormat': 'YYYY-MM-DD',
            'timeFormat': 'HH:mm:ss',
        }

    @action(detail=False, methods=['post'])
    def batch_update(self, request):
        """批量更新设置"""
        settings_data = request.data
        if not isinstance(settings_data, list):
            # 尝试处理对象格式的配置
            if isinstance(settings_data, dict):
                results = []
                for key, value in settings_data.items():
                    description = f"{key}的配置值"

                    # 将值转换为字符串
                    if isinstance(value, (list, dict)):
                        import json
                        value = json.dumps(value)
                    else:
                        value = str(value)

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
            else:
                return Response({
                    'status': 'error',
                    'message': '请提供设置列表或对象'
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

            # 将值转换为字符串
            if isinstance(value, (list, dict)):
                import json
                value = json.dumps(value)
            else:
                value = str(value)

            setting, created = SystemSetting.objects.update_or_create(
                key=key,
                defaults={'value': value, 'description': description or f"{key}的配置值"}
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

    @action(detail=False, methods=['post'])
    def update_config(self, request):
        """更新系统配置"""
        config_data = request.data
        if not isinstance(config_data, dict):
            return Response({
                'status': 'error',
                'message': '请提供配置对象'
            }, status=status.HTTP_400_BAD_REQUEST)

        results = []
        for key, value in config_data.items():
            # 将值转换为字符串
            if isinstance(value, (list, dict)):
                import json
                value = json.dumps(value)
            elif isinstance(value, bool):
                value = 'true' if value else 'false'
            else:
                value = str(value)

            description = f"{key}的配置值"

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

    def perform_create(self, serializer):
        """创建公告时的操作"""
        announcement = serializer.save()
        logger.info(f"管理员 {self.request.user} 创建了公告: {announcement.title}")

    def perform_update(self, serializer):
        """更新公告时的操作"""
        announcement = serializer.save()
        logger.info(f"管理员 {self.request.user} 更新了公告: {announcement.title}")

        # 同步到主应用
        try:
            announcement_data = {
                "title": announcement.title,
                "content": announcement.content,
                "status": announcement.status,
                "start_time": announcement.start_time,
                "end_time": announcement.end_time,
                "updated_at": timezone.now()
            }
            setting_service.update_announcement_in_main_app(announcement.id, announcement_data)
        except Exception as e:
            logger.error(f"同步公告数据到主应用时出错: {str(e)}")

    def perform_destroy(self, instance):
        """删除公告时的操作"""
        announcement_id = instance.id
        announcement_title = instance.title

        # 同步到主应用
        try:
            setting_service.delete_announcement_in_main_app(announcement_id)
        except Exception as e:
            logger.error(f"从主应用删除公告时出错: {str(e)}")

        # 删除本地公告
        instance.delete()
        logger.info(f"管理员 {self.request.user} 删除了公告: {announcement_title}")

    @action(detail=False, methods=['post'])
    def sync(self, request):
        """同步系统公告数据"""
        try:
            incremental = request.data.get('incremental', True)
            last_sync_time = None

            if incremental:
                # 获取上次同步时间
                from sync.models import SyncConfig
                try:
                    config = SyncConfig.objects.get(key='last_sync_time_announcements')
                    last_sync_time = config.value
                except SyncConfig.DoesNotExist:
                    pass

            result = setting_service.sync_announcements(incremental, last_sync_time)

            # 更新同步时间
            from sync.models import SyncConfig

            try:
                config = SyncConfig.objects.get(key='last_sync_time_announcements')
                config.value = timezone.now().isoformat()
                config.save()
            except SyncConfig.DoesNotExist:
                SyncConfig(
                    key='last_sync_time_announcements',
                    value=timezone.now().isoformat(),
                    description='系统公告的最后同步时间'
                ).save()

            return Response({
                'status': 'success',
                'message': '系统公告数据同步成功',
                'result': result
            })
        except Exception as e:
            logger.error(f"同步系统公告数据时出错: {str(e)}")
            return Response(
                {"error": f"同步系统公告数据失败: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

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

        # 同步到主应用
        try:
            announcement_data = {
                "status": "published",
                "updated_at": timezone.now()
            }
            setting_service.update_announcement_in_main_app(announcement.id, announcement_data)
        except Exception as e:
            logger.error(f"同步公告状态到主应用时出错: {str(e)}")

        # 发送通知（如果请求中包含通知设置）
        notification_settings = request.data.get('notification_settings')
        if notification_settings:
            try:
                self._send_announcement_notification(announcement, notification_settings)
            except Exception as e:
                logger.error(f"发送公告通知时出错: {str(e)}")

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

        # 同步到主应用
        try:
            announcement_data = {
                "status": "expired",
                "updated_at": timezone.now()
            }
            setting_service.update_announcement_in_main_app(announcement.id, announcement_data)
        except Exception as e:
            logger.error(f"同步公告状态到主应用时出错: {str(e)}")

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

    @action(detail=True, methods=['post'])
    def send_notification(self, request, pk=None):
        """发送公告通知"""
        announcement = self.get_object()
        notification_settings = request.data.get('notification_settings')

        if not notification_settings:
            return Response({
                'status': 'error',
                'message': '缺少通知设置'
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            result = self._send_announcement_notification(announcement, notification_settings)
            return Response({
                'status': 'success',
                'message': '通知发送成功',
                'data': result
            }, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"发送公告通知时出错: {str(e)}")
            return Response({
                'status': 'error',
                'message': f"发送通知失败: {str(e)}"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def _send_announcement_notification(self, announcement, notification_settings):
        """发送公告通知的内部方法"""
        # 获取通知设置
        enable_email = notification_settings.get('enableEmailNotification', False)
        enable_app = notification_settings.get('enableAppNotification', False)
        notify_all_users = notification_settings.get('notifyAllUsers', False)
        selected_user_groups = notification_settings.get('selectedUserGroups', [])
        notification_delay = notification_settings.get('notificationDelay', 0)
        send_reminder = notification_settings.get('sendReminder', False)
        reminder_interval = notification_settings.get('reminderInterval', 24)

        # 记录通知设置
        logger.info(f"发送公告通知: ID={announcement.id}, 标题={announcement.title}, "
                   f"邮件通知={enable_email}, 应用内通知={enable_app}, "
                   f"通知所有用户={notify_all_users}, 用户组={selected_user_groups}, "
                   f"延迟={notification_delay}小时, 发送提醒={send_reminder}, "
                   f"提醒间隔={reminder_interval}小时")

        # 获取目标用户
        target_users = []
        try:
            if notify_all_users:
                # 获取所有用户
                target_users = setting_service.get_all_users_from_main_app()
            elif selected_user_groups:
                # 获取指定用户组的用户
                target_users = setting_service.get_users_by_groups_from_main_app(selected_user_groups)
        except Exception as e:
            logger.error(f"获取目标用户时出错: {str(e)}")
            raise

        # 发送通知
        notification_results = {
            'email': {'success': 0, 'failed': 0},
            'app': {'success': 0, 'failed': 0},
            'total_users': len(target_users)
        }

        try:
            # 准备通知数据
            notification_data = {
                'announcement_id': str(announcement.id),
                'title': announcement.title,
                'content': announcement.content,
                'start_time': announcement.start_time.isoformat(),
                'end_time': announcement.end_time.isoformat(),
                'created_by': announcement.created_by,
                'notification_settings': {
                    'delay': notification_delay,
                    'send_reminder': send_reminder,
                    'reminder_interval': reminder_interval
                }
            }

            # 发送邮件通知
            if enable_email and target_users:
                try:
                    # 这里可以添加发送邮件的逻辑
                    # 例如调用主应用的邮件发送API
                    email_result = setting_service.send_email_notification_to_main_app(
                        target_users, notification_data
                    )
                    notification_results['email']['success'] = email_result.get('success', 0)
                    notification_results['email']['failed'] = email_result.get('failed', 0)
                except Exception as e:
                    logger.error(f"发送邮件通知时出错: {str(e)}")
                    notification_results['email']['failed'] = len(target_users)

            # 发送应用内通知
            if enable_app and target_users:
                try:
                    # 这里可以添加发送应用内通知的逻辑
                    # 例如调用主应用的通知API
                    app_result = setting_service.send_app_notification_to_main_app(
                        target_users, notification_data
                    )
                    notification_results['app']['success'] = app_result.get('success', 0)
                    notification_results['app']['failed'] = app_result.get('failed', 0)
                except Exception as e:
                    logger.error(f"发送应用内通知时出错: {str(e)}")
                    notification_results['app']['failed'] = len(target_users)

            return notification_results

        except Exception as e:
            logger.error(f"发送通知时出错: {str(e)}")
            raise


class SystemBackupViewSet(viewsets.ModelViewSet):
    """系统备份视图集"""
    queryset = SystemBackup.objects.all()
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['backup_type', 'status', 'is_auto', 'created_by']
    search_fields = ['name', 'description']
    ordering_fields = ['created_at', 'completed_at']
    ordering = ['-created_at']

    def get_serializer_class(self):
        """根据操作类型选择序列化器"""
        if self.action == 'list':
            return SystemBackupListSerializer
        return SystemBackupSerializer

    def perform_create(self, serializer):
        """创建备份时的操作"""
        backup = serializer.save(created_by=self.request.user.username)
        logger.info(f"管理员 {self.request.user} 创建了备份: {backup.name}")

        # 执行备份操作
        try:
            result = backup_service.create_backup(backup)
            if result['status'] == 'error':
                logger.error(f"创建备份失败: {result['message']}")
        except Exception as e:
            logger.error(f"创建备份时出错: {str(e)}")

    def perform_destroy(self, instance):
        """删除备份时的操作"""
        backup_name = instance.name

        # 删除备份文件和记录
        try:
            result = backup_service.delete_backup(instance)
            if result['status'] == 'error':
                logger.error(f"删除备份失败: {result['message']}")
                raise Exception(result['message'])
        except Exception as e:
            logger.error(f"删除备份时出错: {str(e)}")
            raise

        logger.info(f"管理员 {self.request.user} 删除了备份: {backup_name}")

    @action(detail=True, methods=['post'])
    def restore(self, request, pk=None):
        """恢复备份"""
        backup = self.get_object()

        try:
            result = backup_service.restore_backup(backup)
            if result['status'] == 'error':
                return Response({
                    'status': 'error',
                    'message': result['message']
                }, status=status.HTTP_400_BAD_REQUEST)

            return Response({
                'status': 'success',
                'message': '备份恢复成功',
                'data': result
            }, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"恢复备份时出错: {str(e)}")
            return Response({
                'status': 'error',
                'message': f"恢复备份失败: {str(e)}"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['get'])
    def download(self, request, pk=None):
        """下载备份文件"""
        backup = self.get_object()

        try:
            result = backup_service.download_backup(backup)
            if result['status'] == 'error':
                return Response({
                    'status': 'error',
                    'message': result['message']
                }, status=status.HTTP_400_BAD_REQUEST)

            file_path = result['file_path']
            file_name = result['file_name']

            if not os.path.exists(file_path):
                return Response({
                    'status': 'error',
                    'message': '备份文件不存在'
                }, status=status.HTTP_404_NOT_FOUND)

            response = FileResponse(open(file_path, 'rb'))
            response['Content-Disposition'] = f'attachment; filename="{file_name}"'
            return response
        except Exception as e:
            logger.error(f"下载备份时出错: {str(e)}")
            return Response({
                'status': 'error',
                'message': f"下载备份失败: {str(e)}"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['get'])
    def info(self, request, pk=None):
        """获取备份信息"""
        backup = self.get_object()

        try:
            result = backup_service.get_backup_info(backup)
            if result['status'] == 'error':
                return Response({
                    'status': 'error',
                    'message': result['message']
                }, status=status.HTTP_400_BAD_REQUEST)

            return Response({
                'status': 'success',
                'data': result['metadata']
            }, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"获取备份信息时出错: {str(e)}")
            return Response({
                'status': 'error',
                'message': f"获取备份信息失败: {str(e)}"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['post'])
    def create_full_backup(self, request):
        """创建完整备份"""
        name = request.data.get('name', f"完整备份 {timezone.now().strftime('%Y-%m-%d %H:%M:%S')}")
        description = request.data.get('description', '自动创建的完整备份')

        try:
            # 创建备份记录
            backup = SystemBackup.objects.create(
                name=name,
                description=description,
                backup_type='full',
                status='pending',
                created_by=request.user.username
            )

            # 执行备份操作
            result = backup_service.create_backup(backup)
            if result['status'] == 'error':
                return Response({
                    'status': 'error',
                    'message': result['message']
                }, status=status.HTTP_400_BAD_REQUEST)

            return Response({
                'status': 'success',
                'message': '完整备份创建成功',
                'backup_id': result['backup_id']
            }, status=status.HTTP_201_CREATED)
        except Exception as e:
            logger.error(f"创建完整备份时出错: {str(e)}")
            return Response({
                'status': 'error',
                'message': f"创建完整备份失败: {str(e)}"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['post'])
    def create_data_backup(self, request):
        """创建数据备份"""
        name = request.data.get('name', f"数据备份 {timezone.now().strftime('%Y-%m-%d %H:%M:%S')}")
        description = request.data.get('description', '自动创建的数据备份')

        try:
            # 创建备份记录
            backup = SystemBackup.objects.create(
                name=name,
                description=description,
                backup_type='data',
                status='pending',
                created_by=request.user.username
            )

            # 执行备份操作
            result = backup_service.create_backup(backup)
            if result['status'] == 'error':
                return Response({
                    'status': 'error',
                    'message': result['message']
                }, status=status.HTTP_400_BAD_REQUEST)

            return Response({
                'status': 'success',
                'message': '数据备份创建成功',
                'backup_id': result['backup_id']
            }, status=status.HTTP_201_CREATED)
        except Exception as e:
            logger.error(f"创建数据备份时出错: {str(e)}")
            return Response({
                'status': 'error',
                'message': f"创建数据备份失败: {str(e)}"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['post'])
    def create_settings_backup(self, request):
        """创建设置备份"""
        name = request.data.get('name', f"设置备份 {timezone.now().strftime('%Y-%m-%d %H:%M:%S')}")
        description = request.data.get('description', '自动创建的设置备份')

        try:
            # 创建备份记录
            backup = SystemBackup.objects.create(
                name=name,
                description=description,
                backup_type='settings',
                status='pending',
                created_by=request.user.username
            )

            # 执行备份操作
            result = backup_service.create_backup(backup)
            if result['status'] == 'error':
                return Response({
                    'status': 'error',
                    'message': result['message']
                }, status=status.HTTP_400_BAD_REQUEST)

            return Response({
                'status': 'success',
                'message': '设置备份创建成功',
                'backup_id': result['backup_id']
            }, status=status.HTTP_201_CREATED)
        except Exception as e:
            logger.error(f"创建设置备份时出错: {str(e)}")
            return Response({
                'status': 'error',
                'message': f"创建设置备份失败: {str(e)}"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
