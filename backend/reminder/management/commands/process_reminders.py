"""
处理提醒通知命令
"""

import logging
from django.core.management.base import BaseCommand
from reminder.services import NotificationService

logger = logging.getLogger('backend')

class Command(BaseCommand):
    help = '处理待发送的提醒通知'
    
    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='仅显示要处理的通知，不实际发送'
        )
    
    def handle(self, *args, **options):
        dry_run = options.get('dry_run', False)
        
        if dry_run:
            self.stdout.write(self.style.WARNING('执行干运行模式，不会实际发送通知'))
        
        notification_service = NotificationService()
        
        if dry_run:
            # 获取待处理的通知
            from django.utils import timezone
            from reminder.models import ReminderNotification
            
            now = timezone.now()
            notifications = ReminderNotification.objects.filter(
                status='pending',
                scheduled_time__lte=now
            )
            
            self.stdout.write(f"找到 {notifications.count()} 个待处理的通知:")
            
            for notification in notifications:
                reminder = notification.reminder
                self.stdout.write(
                    f"ID: {notification.id}, "
                    f"提醒: {reminder.title}, "
                    f"用户: {reminder.user.username}, "
                    f"计划时间: {notification.scheduled_time}"
                )
        else:
            # 处理通知
            success_count, error_count = notification_service.process_pending_notifications()
            
            self.stdout.write(
                self.style.SUCCESS(f"处理完成: {success_count} 个成功, {error_count} 个失败")
            )
