"""
通知服务
"""

import logging
from django.utils import timezone
from reminder.models import ReminderNotification

logger = logging.getLogger('backend')

class NotificationService:
    """
    通知服务类
    处理提醒通知的业务逻辑
    """
    
    def send_notification(self, notification):
        """
        发送通知
        
        Args:
            notification: 通知对象
            
        Returns:
            bool: 是否成功
        """
        try:
            # 检查通知状态
            if notification.status != 'pending':
                logger.warning(f"通知已经处理: {notification.id}")
                return False
            
            # 获取提醒
            reminder = notification.reminder
            
            # 检查提醒是否已完成或禁用
            if reminder.is_completed or not reminder.is_enabled:
                notification.status = 'failed'
                notification.error_message = '提醒已完成或禁用'
                notification.save()
                return False
            
            # 发送通知逻辑
            # 这里可以集成不同的通知渠道，如邮件、短信、推送等
            success = self._send_notification_to_user(reminder.user, reminder)
            
            # 更新通知状态
            if success:
                notification.status = 'sent'
                notification.sent_time = timezone.now()
            else:
                notification.status = 'failed'
                notification.error_message = '发送失败'
            
            notification.save()
            
            # 如果是重复提醒，创建下一次通知
            if reminder.frequency != 'once' and not reminder.is_completed:
                self._schedule_next_notification(reminder)
            
            return success
        except Exception as e:
            logger.error(f"发送通知失败: {e}")
            
            # 更新通知状态
            notification.status = 'failed'
            notification.error_message = str(e)
            notification.save()
            
            return False
    
    def process_pending_notifications(self):
        """
        处理待发送的通知
        
        Returns:
            tuple: (成功数量, 失败数量)
        """
        try:
            now = timezone.now()
            
            # 获取待发送的通知
            notifications = ReminderNotification.objects.filter(
                status='pending',
                scheduled_time__lte=now
            )
            
            success_count = 0
            error_count = 0
            
            # 发送通知
            for notification in notifications:
                try:
                    if self.send_notification(notification):
                        success_count += 1
                    else:
                        error_count += 1
                except Exception as e:
                    logger.error(f"处理通知失败: {e}")
                    error_count += 1
            
            return success_count, error_count
        except Exception as e:
            logger.error(f"处理待发送的通知失败: {e}")
            return 0, 0
    
    def _send_notification_to_user(self, user, reminder):
        """
        向用户发送通知
        
        Args:
            user: 用户对象
            reminder: 提醒对象
            
        Returns:
            bool: 是否成功
        """
        try:
            # 这里实现具体的通知发送逻辑
            # 例如，发送邮件、短信、推送等
            
            # 示例：记录日志
            logger.info(f"向用户 {user.username} 发送提醒: {reminder.title}")
            
            # 示例：如果用户有邮箱，发送邮件
            if user.email:
                self._send_email(
                    to_email=user.email,
                    subject=f"提醒: {reminder.title}",
                    message=reminder.description or reminder.title
                )
            
            # 示例：如果集成了推送服务，发送推送
            self._send_push_notification(
                user=user,
                title=reminder.title,
                message=reminder.description or reminder.title
            )
            
            return True
        except Exception as e:
            logger.error(f"向用户发送通知失败: {e}")
            return False
    
    def _send_email(self, to_email, subject, message):
        """
        发送邮件
        
        Args:
            to_email: 收件人邮箱
            subject: 主题
            message: 内容
            
        Returns:
            bool: 是否成功
        """
        try:
            # 这里实现邮件发送逻辑
            # 示例：使用Django的邮件功能
            from django.core.mail import send_mail
            
            send_mail(
                subject=subject,
                message=message,
                from_email=None,  # 使用默认发件人
                recipient_list=[to_email],
                fail_silently=False
            )
            
            return True
        except Exception as e:
            logger.error(f"发送邮件失败: {e}")
            return False
    
    def _send_push_notification(self, user, title, message):
        """
        发送推送通知
        
        Args:
            user: 用户对象
            title: 标题
            message: 内容
            
        Returns:
            bool: 是否成功
        """
        try:
            # 这里实现推送通知逻辑
            # 示例：使用Firebase Cloud Messaging
            # 需要集成相应的推送服务
            
            # 示例：记录日志
            logger.info(f"向用户 {user.username} 发送推送通知: {title}")
            
            return True
        except Exception as e:
            logger.error(f"发送推送通知失败: {e}")
            return False
    
    def _schedule_next_notification(self, reminder):
        """
        安排下一次通知
        
        Args:
            reminder: 提醒对象
            
        Returns:
            ReminderNotification: 创建的通知
        """
        try:
            from reminder.services import ReminderService
            
            reminder_service = ReminderService()
            return reminder_service._schedule_notification(reminder)
        except Exception as e:
            logger.error(f"安排下一次通知失败: {e}")
            return None
