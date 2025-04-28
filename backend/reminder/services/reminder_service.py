"""
提醒服务
"""

import logging
from django.utils import timezone
from datetime import timedelta
from reminder.mongodb_models import Reminder, ReminderNotification
import uuid

logger = logging.getLogger('backend')

class ReminderService:
    """
    提醒服务类
    处理提醒相关的业务逻辑
    """

    @classmethod
    def create_reminder(cls, user, data):
        """
        创建提醒

        Args:
            user: 用户对象
            data: 提醒数据

        Returns:
            Reminder: 创建的提醒
        """
        try:
            # 创建提醒
            reminder = Reminder(
                id=uuid.uuid4(),
                user=user,
                title=data.get('title'),
                description=data.get('description', ''),
                due_date=data.get('due_date'),
                priority=data.get('priority', 'medium'),
                frequency=data.get('frequency', 'once'),
                is_enabled=data.get('is_enabled', True),
                note=data.get('note'),
                created_at=timezone.now(),
                updated_at=timezone.now()
            )
            reminder.save()

            # 创建通知
            cls._schedule_notification(reminder)

            return reminder
        except Exception as e:
            logger.error(f"创建提醒失败: {e}")
            raise

    @classmethod
    def update_reminder(cls, reminder, data):
        """
        更新提醒

        Args:
            reminder: 提醒对象
            data: 提醒数据

        Returns:
            Reminder: 更新的提醒
        """
        try:
            # 检查是否更新了时间或频率
            reschedule = False
            if 'due_date' in data or 'frequency' in data or 'is_enabled' in data:
                reschedule = True

            # 更新提醒字段
            for field in ['title', 'description', 'due_date', 'priority', 'frequency', 'is_completed', 'is_enabled', 'note']:
                if field in data:
                    setattr(reminder, field, data[field])

            reminder.updated_at = timezone.now()
            reminder.save()

            # 如果需要，重新安排通知
            if reschedule:
                # 删除未发送的通知
                ReminderNotification.objects.filter(
                    reminder=reminder,
                    status='pending'
                ).update(
                    status='cancelled',
                    updated_at=timezone.now()
                )

                # 如果提醒未完成且已启用，创建新通知
                if not reminder.is_completed and reminder.is_enabled:
                    cls._schedule_notification(reminder)

            return reminder
        except Exception as e:
            logger.error(f"更新提醒失败: {e}")
            raise

    @classmethod
    def delete_reminder(cls, reminder):
        """
        删除提醒

        Args:
            reminder: 提醒对象

        Returns:
            bool: 是否成功
        """
        try:
            # 删除提醒的所有通知
            ReminderNotification.objects.filter(reminder=reminder).update(
                status='cancelled',
                updated_at=timezone.now()
            )

            # 删除提醒
            reminder.delete()

            return True
        except Exception as e:
            logger.error(f"删除提醒失败: {e}")
            raise

    @classmethod
    def get_upcoming_reminders(cls, user, days=7):
        """
        获取即将到期的提醒

        Args:
            user: 用户对象
            days: 天数

        Returns:
            QuerySet: 提醒查询集
        """
        try:
            now = timezone.now()
            end_date = now + timedelta(days=days)

            # 获取未完成且已启用的提醒
            reminders = Reminder.objects.filter(
                user=user,
                is_completed=False,
                is_enabled=True,
                due_date__gte=now,
                due_date__lte=end_date
            ).order_by('due_date')

            return reminders
        except Exception as e:
            logger.error(f"获取即将到期的提醒失败: {e}")
            raise

    @classmethod
    def get_overdue_reminders(cls, user):
        """
        获取已过期的提醒

        Args:
            user: 用户对象

        Returns:
            QuerySet: 提醒查询集
        """
        try:
            now = timezone.now()

            # 获取未完成且已过期的提醒
            reminders = Reminder.objects.filter(
                user=user,
                is_completed=False,
                due_date__lt=now
            ).order_by('due_date')

            return reminders
        except Exception as e:
            logger.error(f"获取已过期的提醒失败: {e}")
            raise

    @classmethod
    def _schedule_notification(cls, reminder):
        """
        安排提醒通知

        Args:
            reminder: 提醒对象

        Returns:
            ReminderNotification: 创建的通知
        """
        try:
            # 获取下一次提醒时间
            next_time = reminder.get_next_occurrence()
            if not next_time:
                return None

            # 创建通知
            notification = ReminderNotification(
                id=uuid.uuid4(),
                reminder=reminder,
                scheduled_time=next_time,
                status='pending',
                created_at=timezone.now(),
                updated_at=timezone.now()
            )
            notification.save()

            return notification
        except Exception as e:
            logger.error(f"安排提醒通知失败: {e}")
            return None

    @classmethod
    def schedule_notifications(cls, reminder):
        """
        安排提醒通知

        Args:
            reminder: 提醒对象

        Returns:
            list: 创建的通知列表
        """
        return [cls._schedule_notification(reminder)]

    @classmethod
    def update_notifications(cls, reminder):
        """
        更新提醒通知

        Args:
            reminder: 提醒对象

        Returns:
            list: 更新的通知列表
        """
        # 取消未发送的通知
        ReminderNotification.objects.filter(
            reminder=reminder,
            status='pending'
        ).update(
            status='cancelled',
            updated_at=timezone.now()
        )

        # 如果提醒未完成且已启用，创建新通知
        if not reminder.is_completed and reminder.is_enabled:
            return [cls._schedule_notification(reminder)]

        return []

    @classmethod
    def delete_notifications(cls, reminder):
        """
        删除提醒通知

        Args:
            reminder: 提醒对象

        Returns:
            int: 删除的通知数量
        """
        # 取消所有通知
        result = ReminderNotification.objects.filter(
            reminder=reminder
        ).update(
            status='cancelled',
            updated_at=timezone.now()
        )

        return result
