"""
提醒模块定时任务
"""

from celery import shared_task
from django.utils import timezone
from .models import Reminder, ReminderNotification
from .mongodb_models import Reminder as MongoReminder, ReminderNotification as MongoReminderNotification
from datetime import timedelta
import logging
from .services.notification_service import NotificationService
from .services.reminder_service import ReminderService

logger = logging.getLogger(__name__)

@shared_task
def check_reminders():
    """检查并创建提醒通知"""
    now = timezone.now()
    # 获取所有启用的提醒
    reminders = Reminder.objects.filter(
        is_enabled=True,
        due_date__gte=now,
        due_date__lte=now + timedelta(minutes=5)
    )

    for reminder in reminders:
        # 创建通知
        ReminderNotification.objects.create(
            reminder=reminder,
            notification_time=reminder.due_date,
            notification_type='in_app'
        )
        logger.info(f"Created notification for reminder {reminder.id}")

@shared_task
def send_reminder_notifications():
    """发送提醒通知"""
    try:
        # 使用旧模型
        now = timezone.now()
        notifications = ReminderNotification.objects.filter(
            is_sent=False,
            notification_time__lte=now
        )

        sent_count = 0
        for notification in notifications:
            try:
                # 这里可以添加发送通知的逻辑
                # 例如：发送推送通知、邮件等
                notification.is_sent = True
                notification.save()
                sent_count += 1
                logger.info(f"发送通知 {notification.id}")
            except Exception as e:
                logger.error(f"发送通知 {notification.id} 失败: {e}")

        # 使用MongoDB模型和通知服务
        notification_service = NotificationService()
        mongo_sent_count, mongo_error_count = notification_service.process_pending_notifications()

        logger.info(f"发送提醒通知完成，旧模型: {sent_count}，MongoDB: {mongo_sent_count}，失败: {mongo_error_count}")
        return sent_count + mongo_sent_count
    except Exception as e:
        logger.error(f"发送提醒通知失败: {e}")
        return 0

@shared_task
def generate_recurring_reminders():
    """生成重复提醒"""
    try:
        # 使用提醒服务
        reminder_service = ReminderService()
        generated_count = reminder_service.generate_recurring_reminders()

        logger.info(f"生成重复提醒完成，共生成 {generated_count} 个")
        return generated_count
    except Exception as e:
        logger.error(f"生成重复提醒失败: {e}")
        return 0

@shared_task
def clean_old_notifications():
    """清理旧通知"""
    try:
        # 清理旧的通知
        now = timezone.now()
        thirty_days_ago = now - timedelta(days=30)

        # 清理旧模型
        old_notifications = ReminderNotification.objects.filter(
            is_sent=True,
            notification_time__lt=thirty_days_ago
        )
        old_count = old_notifications.count()
        old_notifications.delete()

        # 清理MongoDB模型
        notification_service = NotificationService()
        mongo_count = notification_service.clean_old_notifications()

        logger.info(f"清理旧通知完成，旧模型: {old_count}，MongoDB: {mongo_count}")
        return old_count + mongo_count
    except Exception as e:
        logger.error(f"清理旧通知失败: {e}")
        return 0

@shared_task
def send_daily_summary():
    """发送每日提醒摘要"""
    try:
        # 使用提醒服务
        reminder_service = ReminderService()
        sent_count = reminder_service.send_daily_summary()

        logger.info(f"发送每日提醒摘要完成，共发送 {sent_count} 个")
        return sent_count
    except Exception as e:
        logger.error(f"发送每日提醒摘要失败: {e}")
        return 0