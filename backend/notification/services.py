"""
通知服务
提供通知的创建、发送和管理功能
"""

import logging
from django.utils import timezone
from .mongodb_models import Notification
from users.mongodb_models import User

logger = logging.getLogger(__name__)

class NotificationService:
    """通知服务类"""

    def create_notification(self, recipient, notification_type, title, message, sender=None, related_object=None, dedupe_seconds=60):
        """
        创建通知，支持数据库级别的原子性合并与去重。
        """
        from users.services.user_settings_service import UserSettingsService
        from datetime import timedelta

        if isinstance(recipient, str):
            try:
                recipient = User.objects.get(id=recipient)
            except User.DoesNotExist:
                logger.error(f"创建通知失败：接收者用户不存在 {recipient}")
                return None

        preferences = UserSettingsService.get_notification_preferences(recipient)
        if not preferences.get(notification_type, {}).get('push', True):
            logger.info(f"用户 {recipient.id} 已禁用 {notification_type} 类型的通知，已跳过创建。")
            return None

        now = timezone.now()
        dedupe_window_start = now - timedelta(seconds=dedupe_seconds)
        MERGEABLE_TYPES = {'like', 'follow'}

        # 1. 检查是否存在可合并或可去重的近期通知
        existing_notification = Notification.objects.filter(
            recipient=recipient,
            notification_type=notification_type,
            related_object=related_object,
            is_read=False,
            created_at__gte=dedupe_window_start
        ).first()

        if existing_notification:
            # 2a. 如果是可合并类型，则合并
            if notification_type in MERGEABLE_TYPES and sender:
                # 确保发送者不在列表中，再执行更新
                if sender not in existing_notification.merged_senders:
                    result = Notification.objects(id=existing_notification.id).update_one(
                        inc__merged_count=1,
                        add_to_set__merged_senders=sender,
                        set__updated_at=now
                    )
                    if result:
                        logger.info(f"通知 {existing_notification.id} 已合并，发送者: {sender.id}")
                return existing_notification
            # 2b. 如果是其他类型，则直接去重，不创建新的
            else:
                logger.info(f"通知已去重，用户: {recipient.id}, 类型: {notification_type}")
                return existing_notification

        # 3. 如果没有找到现有通知，则创建新的
        try:
            is_mergeable = notification_type in MERGEABLE_TYPES and sender is not None
            notification = Notification(
                recipient=recipient,
                notification_type=notification_type,
                title=title,
                message=message,
                sender=sender,
                related_object=related_object,
                created_at=now,
                # 如果是可合并类型，初始化合并字段
                is_merged=is_mergeable,
                merged_count=1 if is_mergeable else 0,
                merged_senders=[sender] if is_mergeable else []
            )
            notification.save()
            logger.info(f"新通知创建成功: {notification.id}")
            
            # --- WebSocket Push ---
            try:
                from channels.layers import get_channel_layer
                from asgiref.sync import async_to_sync
                
                channel_layer = get_channel_layer()
                group_name = f'user_notifications_{recipient.id}'
                
                # Format payload
                payload = {
                    'id': str(notification.id),
                    'type': notification.notification_type,
                    'title': notification.title,
                    'message': notification.message,
                    'created_at': notification.created_at.isoformat(),
                    'is_read': False,
                    'sender': str(sender.id) if sender else None,
                    'sender_name': sender.username if sender else 'System'
                }
                
                async_to_sync(channel_layer.group_send)(
                    group_name,
                    {
                        'type': 'notification_message',
                        'message': payload
                    }
                )
            except Exception as e:
                # WS failure shouldn't fail the creation
                logger.error(f"WebSocket notification push failed: {e}")
            # ----------------------
            
            return notification
        except Exception as e:
            logger.error(f"创建通知失败: {str(e)}", exc_info=True)
            raise

    def mark_as_read(self, notification_id):
        """
        标记通知为已读

        Args:
            notification_id: 通知ID

        Returns:
            bool: 是否成功
        """
        try:
            notification = Notification.objects.get(id=notification_id)
            notification.mark_as_read()
            logger.info(f"通知已标记为已读: {notification_id}")
            return True
        except Exception as e:
            logger.error(f"标记通知为已读失败: {str(e)}")
            return False

    def mark_all_as_read(self, user_id):
        """
        标记用户所有通知为已读

        Args:
            user_id: 用户ID

        Returns:
            int: 标记的通知数量
        """
        try:
            user = User.objects.get(id=user_id)
            now = timezone.now()
            result = Notification.objects(recipient=user, is_read=False).update(
                is_read=True,
                read_at=now
            )
            logger.info(f"用户 {user_id} 的所有通知已标记为已读: {result}")
            return result
        except Exception as e:
            logger.error(f"标记所有通知为已读失败: {str(e)}")
            return 0

    def get_unread_count(self, user_id):
        """
        获取用户未读通知数量

        Args:
            user_id: 用户ID

        Returns:
            int: 未读通知数量
        """
        try:
            user = User.objects.get(id=user_id)
            count = Notification.objects(recipient=user, is_read=False).count()
            return count
        except Exception as e:
            logger.error(f"获取未读通知数量失败: {str(e)}")
            return 0

    def get_notifications_queryset(self, user_id, notification_type=None, is_read=None):
        """
        获取用户通知的查询集

        Args:
            user_id: 用户ID
            notification_type: 通知类型（可选）
            is_read: 是否已读（可选）

        Returns:
            QuerySet: 通知的查询集
        """
        try:
            user = User.objects.get(id=user_id)
            query = {'recipient': user}
            if notification_type:
                query['notification_type'] = notification_type
            if is_read is not None:
                query['is_read'] = is_read

            return Notification.objects(**query).order_by('-created_at')
        except User.DoesNotExist:
            logger.warning(f"获取通知查询集时用户不存在: {user_id}")
            return Notification.objects.none()
        except Exception as e:
            logger.error(f"获取通知查询集失败: {str(e)}")
            return Notification.objects.none()

    def delete_notification(self, notification_id):
        """
        删除通知

        Args:
            notification_id: 通知ID

        Returns:
            bool: 是否成功
        """
        try:
            notification = Notification.objects.get(id=notification_id)
            notification.delete()
            logger.info(f"通知已删除: {notification_id}")
            return True
        except Exception as e:
            logger.error(f"删除通知失败: {str(e)}")
            return False

    def delete_all_notifications(self, user_id):
        """
        删除用户所有通知

        Args:
            user_id: 用户ID

        Returns:
            int: 删除的通知数量
        """
        try:
            user = User.objects.get(id=user_id)
            result = Notification.objects(recipient=user).delete()
            logger.info(f"用户 {user_id} 的所有通知已删除: {result}")
            return result
        except Exception as e:
            logger.error(f"删除所有通知失败: {str(e)}")
            return 0

    def schedule_notification(self, user_id, title, message, scheduled_time, notification_type='system', sender=None, related_object=None, extra_data=None):
        """
        安排（定时）通知：在指定时间创建并发送通知
        - 依赖 Celery 的 ETA/Countdown 调度
        - 为避免对模型做兼容变更，不新增 scheduled_time 字段，而是按时创建通知

        Args:
            user_id: 接收者用户ID（str/UUID）
            title: 标题
            message: 内容
            scheduled_time: datetime (timezone-aware 优先)
            notification_type: 通知类型，默认 system
            sender: 发送者（可选）
            related_object: 关联对象（可选，GenericReferenceField 对象）
            extra_data: 额外数据（可选，dict），将合并进 message 尾部或相关 payload
        Returns:
            str: Celery 任务ID
        """
        try:
            from common.tasks import app as celery_app

            # Celery 任务参数
            task_kwargs = {
                'user_id': str(user_id),
                'title': title,
                'message': message,
                'notification_type': notification_type,
                'sender_id': str(sender.id) if sender else None,
                # 关联对象仅用于记录引用ID，真正对象引用在任务中通过ID再查（若需要）
                'related_object': None,
                'extra_data': extra_data or {},
            }

            # 使用 ETA 调度
            result = celery_app.send_task(
                'send_notification',
                args=[],
                kwargs=task_kwargs,
                eta=scheduled_time
            )
            logger.info(f"已安排通知任务: {result.id} @ {scheduled_time}")
            return result.id
        except Exception as e:
            logger.error(f"安排通知失败: {str(e)}")
            return None
