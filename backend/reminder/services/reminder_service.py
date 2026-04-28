"""
提醒服务
"""

import logging
from django.utils import timezone
from datetime import timedelta
from mongoengine.queryset.visitor import Q
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
                category=data.get('category', 'other'),
                color=data.get('color', '#3498db'),
                tags=data.get('tags', ''),
                is_enabled=data.get('is_enabled', True),
                note=data.get('note'),
                repeat_end_date=data.get('repeat_end_date'),
                created_at=timezone.now(),
                updated_at=timezone.now()
            )
            reminder.save()

            # 创建通知
            cls._schedule_notification(reminder)

            logger.info(f"成功创建提醒: {reminder.title} (ID: {reminder.id})")
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
            for field in ['title', 'description', 'due_date', 'priority', 'frequency',
                         'category', 'color', 'tags', 'is_completed', 'is_enabled',
                         'note', 'repeat_end_date']:
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

            logger.info(f"成功更新提醒: {reminder.title} (ID: {reminder.id})")
            return reminder
        except Exception as e:
            logger.error(f"更新提醒失败: {e}")
            raise

    @classmethod
    def complete_occurrence(cls, reminder, occurrence_date):
        """
        完成一个重复提醒的特定实例。

        Args:
            reminder (Reminder): 提醒对象。
            occurrence_date (datetime): 要完成的实例的原始发生日期。

        Returns:
            Reminder: 更新后的提醒对象。
        """
        from reminder.mongodb_models import ReminderException

        exception = ReminderException(
            original_occurrence_date=occurrence_date,
            status='completed'
        )
        reminder.update(push__exceptions=exception)
        reminder.reload()
        logger.info(f"已完成提醒 '{reminder.title}' 的实例 {occurrence_date.date()}。")
        return reminder

    @classmethod
    def cancel_occurrence(cls, reminder, occurrence_date):
        """
        取消一个重复提醒的特定实例。
        """
        from reminder.mongodb_models import ReminderException
        exception = ReminderException(
            original_occurrence_date=occurrence_date,
            status='cancelled'
        )
        reminder.update(push__exceptions=exception)
        reminder.reload()
        logger.info(f"已取消提醒 '{reminder.title}' 的实例 {occurrence_date.date()}。")
        return reminder

    @classmethod
    def reschedule_occurrence(cls, reminder, occurrence_date, new_due_date):
        """
        重新安排一个重复提醒的特定实例。
        """
        from reminder.mongodb_models import ReminderException
        exception = ReminderException(
            original_occurrence_date=occurrence_date,
            status='rescheduled',
            new_due_date=new_due_date
        )
        reminder.update(push__exceptions=exception)
        reminder.reload()
        logger.info(f"已将提醒 '{reminder.title}' 的实例从 {occurrence_date.date()} 延期至 {new_due_date.date()}。")
        return reminder

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
            reminder_title = reminder.title
            reminder_id = reminder.id
            reminder.delete()

            logger.info(f"成功删除提醒: {reminder_title} (ID: {reminder_id})")
            return True
        except Exception as e:
            logger.error(f"删除提醒失败: {e}")
            raise

    @classmethod
    @classmethod
    def get_occurrences(cls, user, start_date, end_date):
        """
        获取指定时间范围内的所有提醒实例，处理重复和例外情况。
        """
        # 1. 获取所有可能在该时间范围内发生的提醒
        reminders = Reminder.objects.filter(
            (Q(frequency='once', due_date__gte=start_date, due_date__lte=end_date) |
             (Q(frequency__ne='once') & (Q(repeat_end_date__gte=start_date) | Q(repeat_end_date=None)))) &
            Q(user=user) &
            Q(is_enabled=True)
        )

        occurrences = []
        for reminder in reminders:
            # 处理非重复提醒
            if reminder.frequency == 'once':
                # 检查例外
                is_excepted = any(exc.original_occurrence_date.date() == reminder.due_date.date() and exc.status in ['completed', 'cancelled'] for exc in reminder.exceptions)
                if not is_excepted:
                    occurrences.append(reminder)
                continue

            # 2. 计算重复提醒的实例
            next_occurrence = reminder.due_date
            while next_occurrence and next_occurrence <= end_date:
                # 只处理在时间窗口内的实例
                if next_occurrence >= start_date:
                    # 检查此实例是否有例外
                    exception = next((exc for exc in reminder.exceptions if exc.original_occurrence_date.date() == next_occurrence.date()), None)

                    if exception:
                        if exception.status == 'rescheduled' and exception.new_due_date and start_date <= exception.new_due_date <= end_date:
                            # 创建一个临时实例用于延期
                            rescheduled_occurrence = reminder.to_mongo().to_dict()
                            rescheduled_occurrence['due_date'] = exception.new_due_date
                            rescheduled_occurrence['is_rescheduled'] = True
                            occurrences.append(rescheduled_occurrence)
                        # 如果是 completed 或 cancelled，则跳过
                    else:
                        # 创建一个临时实例
                        occurrence = reminder.to_mongo().to_dict()
                        occurrence['due_date'] = next_occurrence
                        occurrences.append(occurrence)

                # 获取下一个实例
                current_occurrence = next_occurrence
                next_occurrence = reminder.get_next_occurrence(after=current_occurrence)
                if not next_occurrence or next_occurrence == current_occurrence: # 防止死循环
                    break

        # 按时间排序
        occurrences.sort(key=lambda x: x['due_date'])
        return occurrences

    @classmethod
    def get_upcoming_reminders(cls, user, days=7):
        """
        获取即将到期的提醒实例。

        Args:
            user: 用户对象
            days: 天数

        Returns:
            list: 提醒实例列表
        """
        try:
            now = timezone.now()
            end_date = now + timedelta(days=days)
            return cls.get_occurrences(user, now, end_date)
        except Exception as e:
            logger.error(f"获取即将到期的提醒失败: {e}")
            raise

    @classmethod
    def get_overdue_reminders(cls, user):
        """
        获取已过期的提醒实例。

        Args:
            user: 用户对象

        Returns:
            list: 提醒实例列表
        """
        try:
            now = timezone.now()
            # 从一个较早的时间点开始查找，以捕获所有过去的提醒
            start_date = now - timedelta(days=365*5) # 假设查询过去5年内的过期提醒
            return cls.get_occurrences(user, start_date, now)
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
