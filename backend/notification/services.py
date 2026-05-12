"""
通知服务
提供通知的创建、发送和管理能力。
"""

import logging

from django.utils import timezone

from .mongodb_models import Notification
from users.mongodb_models import User

logger = logging.getLogger(__name__)


class NotificationService:
    """通知服务类"""

    @staticmethod
    def _resolve_mongo_user(user_or_id):
        """
        将 Django 用户、Mongo 用户或 Mongo 用户 ID 统一解析为 Mongo 用户对象。
        """
        if not user_or_id:
            return None

        if isinstance(user_or_id, User):
            return user_or_id

        if isinstance(user_or_id, str):
            try:
                return User.objects.get(id=user_or_id)
            except User.DoesNotExist:
                logger.error("通知用户解析失败，Mongo 用户不存在: %s", user_or_id)
                return None

        try:
            from users.utils import get_mongo_user_from_django

            if getattr(user_or_id, 'is_authenticated', False):
                return get_mongo_user_from_django(user_or_id)
        except Exception as exc:
            logger.error("通知用户解析失败: %s", exc, exc_info=True)

        return None

    def create_notification(
        self,
        recipient,
        notification_type,
        title,
        message,
        sender=None,
        related_object=None,
        dedupe_seconds=60,
    ):
        """
        创建通知，支持数据库级别的原子去重与合并。
        """
        from datetime import timedelta
        from users.services.user_settings_service import UserSettingsService

        recipient = self._resolve_mongo_user(recipient)
        sender = self._resolve_mongo_user(sender)

        if recipient is None:
            logger.error("创建通知失败：接收者无法映射到 Mongo 用户")
            return None

        preferences = UserSettingsService.get_notification_preferences(recipient)
        if not preferences.get(notification_type, {}).get('push', True):
            logger.info("用户 %s 已禁用 %s 类型通知，跳过创建", recipient.id, notification_type)
            return None

        now = timezone.now()
        dedupe_window_start = now - timedelta(seconds=dedupe_seconds)
        mergeable_types = {'like', 'follow'}

        existing_notification = Notification.objects.filter(
            recipient=recipient,
            notification_type=notification_type,
            related_object=related_object,
            is_read=False,
            created_at__gte=dedupe_window_start,
        ).first()

        if existing_notification:
            if notification_type in mergeable_types and sender:
                if sender not in existing_notification.merged_senders:
                    result = Notification.objects(id=existing_notification.id).update_one(
                        inc__merged_count=1,
                        add_to_set__merged_senders=sender,
                        set__updated_at=now,
                    )
                    if result:
                        logger.info("通知 %s 已合并，发送者: %s", existing_notification.id, sender.id)
                return existing_notification

            logger.info("通知已去重，用户: %s, 类型: %s", recipient.id, notification_type)
            return existing_notification

        try:
            is_mergeable = notification_type in mergeable_types and sender is not None
            notification = Notification(
                recipient=recipient,
                notification_type=notification_type,
                title=title,
                message=message,
                sender=sender,
                related_object=related_object,
                created_at=now,
                is_merged=is_mergeable,
                merged_count=1 if is_mergeable else 0,
                merged_senders=[sender] if is_mergeable else [],
            )
            notification.save()
            logger.info("新通知创建成功: %s", notification.id)

            try:
                from asgiref.sync import async_to_sync
                from channels.layers import get_channel_layer

                channel_layer = get_channel_layer()
                group_name = f'user_notifications_{recipient.id}'
                payload = {
                    'id': str(notification.id),
                    'type': notification.notification_type,
                    'title': notification.title,
                    'message': notification.message,
                    'created_at': notification.created_at.isoformat(),
                    'is_read': False,
                    'sender': str(sender.id) if sender else None,
                    'sender_name': sender.username if sender else 'System',
                }

                async_to_sync(channel_layer.group_send)(
                    group_name,
                    {
                        'type': 'notification_message',
                        'message': payload,
                    },
                )
            except Exception as exc:
                logger.error("WebSocket 通知推送失败: %s", exc, exc_info=True)

            return notification
        except Exception as exc:
            logger.error("创建通知失败: %s", exc, exc_info=True)
            raise

    def mark_as_read(self, notification_id):
        try:
            notification = Notification.objects.get(id=notification_id)
            notification.mark_as_read()
            logger.info("通知已标记为已读: %s", notification_id)
            return True
        except Exception as exc:
            logger.error("标记通知为已读失败: %s", exc, exc_info=True)
            return False

    def mark_all_as_read(self, user_id):
        try:
            user = self._resolve_mongo_user(user_id)
            if user is None:
                return 0

            now = timezone.now()
            result = Notification.objects(recipient=user, is_read=False).update(
                is_read=True,
                read_at=now,
            )
            logger.info("用户 %s 的所有通知已标记为已读: %s", user.id, result)
            return result
        except Exception as exc:
            logger.error("标记所有通知为已读失败: %s", exc, exc_info=True)
            return 0

    def get_unread_count(self, user_id):
        try:
            user = self._resolve_mongo_user(user_id)
            if user is None:
                return 0
            return Notification.objects(recipient=user, is_read=False).count()
        except Exception as exc:
            logger.error("获取未读通知数量失败: %s", exc, exc_info=True)
            return 0

    def get_notifications_queryset(self, user_id, notification_type=None, is_read=None):
        try:
            user = self._resolve_mongo_user(user_id)
            if user is None:
                return Notification.objects.none()

            query = {'recipient': user}
            if notification_type:
                query['notification_type'] = notification_type
            if is_read is not None:
                query['is_read'] = is_read

            return Notification.objects(**query).order_by('-created_at')
        except Exception as exc:
            logger.error("获取通知查询集失败: %s", exc, exc_info=True)
            return Notification.objects.none()

    def delete_notification(self, notification_id):
        try:
            notification = Notification.objects.get(id=notification_id)
            notification.delete()
            logger.info("通知已删除: %s", notification_id)
            return True
        except Exception as exc:
            logger.error("删除通知失败: %s", exc, exc_info=True)
            return False

    def delete_all_notifications(self, user_id):
        try:
            user = self._resolve_mongo_user(user_id)
            if user is None:
                return 0

            result = Notification.objects(recipient=user).delete()
            logger.info("用户 %s 的所有通知已删除: %s", user.id, result)
            return result
        except Exception as exc:
            logger.error("删除所有通知失败: %s", exc, exc_info=True)
            return 0

    def schedule_notification(
        self,
        user_id,
        title,
        message,
        scheduled_time,
        notification_type='system',
        sender=None,
        related_object=None,
        extra_data=None,
    ):
        """
        安排定时通知，通过 Celery 在指定时间创建通知。
        """
        try:
            from common.tasks import app as celery_app

            sender = self._resolve_mongo_user(sender)
            task_kwargs = {
                'user_id': str(user_id),
                'title': title,
                'message': message,
                'notification_type': notification_type,
                'sender_id': str(sender.id) if sender else None,
                'related_object': None,
                'extra_data': extra_data or {},
            }

            result = celery_app.send_task(
                'send_notification',
                args=[],
                kwargs=task_kwargs,
                eta=scheduled_time,
            )
            logger.info("已安排通知任务: %s @ %s", result.id, scheduled_time)
            return result.id
        except Exception as exc:
            logger.error("安排通知失败: %s", exc, exc_info=True)
            return None
