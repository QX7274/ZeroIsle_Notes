from celery import shared_task
from django.utils import timezone
from .models import Reminder, ReminderNotification
from datetime import timedelta
import logging

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
    now = timezone.now()
    notifications = ReminderNotification.objects.filter(
        is_sent=False,
        notification_time__lte=now
    )
    
    for notification in notifications:
        # 这里可以添加发送通知的逻辑
        # 例如：发送推送通知、邮件等
        notification.is_sent = True
        notification.save()
        logger.info(f"Sent notification {notification.id}") 