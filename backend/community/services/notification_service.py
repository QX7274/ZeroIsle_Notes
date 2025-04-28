"""
通知服务
"""

import logging
import uuid
from django.utils import timezone
from community.mongodb_models import Notification

logger = logging.getLogger('backend')

class NotificationService:
    """
    通知服务类
    处理通知相关的业务逻辑
    """

    def create_notification(self, recipient, notification_type, title, message, sender=None, content_type=None, object_id=None):
        """
        创建通知

        Args:
            recipient: 接收者
            notification_type: 通知类型
            title: 标题
            message: 消息
            sender: 发送者
            content_type: 内容类型
            object_id: 对象ID

        Returns:
            Notification: 创建的通知
        """
        try:
            # 创建通知
            notification = Notification(
                id=uuid.uuid4(),
                recipient=recipient,
                notification_type=notification_type,
                title=title,
                message=message,
                sender=sender,
                content_type=content_type,
                object_id=object_id,
                is_read=False,
                created_at=timezone.now()
            )

            # 保存通知
            notification.save()

            return notification
        except Exception as e:
            logger.error(f"创建通知失败: {e}")
            raise

    def mark_as_read(self, notification_id, user):
        """
        标记通知为已读

        Args:
            notification_id: 通知ID
            user: 用户对象

        Returns:
            Notification: 更新的通知
        """
        try:
            # 获取通知
            notification = Notification.objects.get(id=notification_id, recipient=user)

            # 标记为已读
            notification.is_read = True
            notification.save()

            return notification
        except Notification.DoesNotExist:
            logger.error(f"通知不存在: {notification_id}")
            raise
        except Exception as e:
            logger.error(f"标记通知为已读失败: {e}")
            raise

    def mark_all_as_read(self, user):
        """
        标记所有通知为已读

        Args:
            user: 用户对象

        Returns:
            int: 更新数量
        """
        try:
            # 更新所有未读通知
            count = Notification.objects.filter(
                recipient=user,
                is_read=False
            ).update(is_read=True)

            return count
        except Exception as e:
            logger.error(f"标记所有通知为已读失败: {e}")
            raise

    def delete_notification(self, notification_id, user):
        """
        删除通知

        Args:
            notification_id: 通知ID
            user: 用户对象

        Returns:
            bool: 是否成功
        """
        try:
            # 删除通知
            count, _ = Notification.objects.filter(
                id=notification_id,
                recipient=user
            ).delete()

            return count > 0
        except Exception as e:
            logger.error(f"删除通知失败: {e}")
            raise

    def get_notifications(self, user, unread_only=False, page=1, page_size=20):
        """
        获取通知列表

        Args:
            user: 用户对象
            unread_only: 是否只获取未读通知
            page: 页码
            page_size: 每页大小

        Returns:
            tuple: (通知列表, 总数)
        """
        try:
            # 构建查询条件
            queryset = Notification.objects.filter(recipient=user)

            if unread_only:
                queryset = queryset.filter(is_read=False)

            # 获取总数
            total = queryset.count()

            # 分页
            start = (page - 1) * page_size
            end = start + page_size

            # 排序并获取结果
            notifications = queryset.order_by('-created_at')[start:end]

            return notifications, total
        except Exception as e:
            logger.error(f"获取通知列表失败: {e}")
            raise

    def get_unread_count(self, user):
        """
        获取未读通知数量

        Args:
            user: 用户对象

        Returns:
            int: 未读通知数量
        """
        try:
            # 获取未读通知数量
            count = Notification.objects.filter(
                recipient=user,
                is_read=False
            ).count()

            return count
        except Exception as e:
            logger.error(f"获取未读通知数量失败: {e}")
            raise
