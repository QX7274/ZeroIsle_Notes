"""
提醒通知模型测试
测试 ReminderNotification 模型和状态管理
"""

import unittest
from datetime import timedelta
from django.test import TestCase
from django.utils import timezone
from mongoengine import connect, disconnect
from reminder.mongodb_models import Reminder, ReminderNotification
from users.mongodb_models import User
import uuid


class ReminderNotificationTestCase(TestCase):
    """提醒通知测试用例"""

    @classmethod
    def setUpClass(cls):
        """设置测试环境"""
        disconnect()
        connect('mongoenginetest', host='mongomock://localhost')

    @classmethod
    def tearDownClass(cls):
        """清理测试环境"""
        disconnect()

    def setUp(self):
        """每个测试前的准备"""
        # 创建测试用户
        self.user = User(
            id=uuid.uuid4(),
            username='testuser',
            email='test@example.com'
        )
        self.user.save()

        # 创建测试提醒
        self.reminder = Reminder(
            user=self.user,
            title='测试提醒',
            due_date=timezone.now() + timedelta(days=1)
        )
        self.reminder.save()

    def tearDown(self):
        """每个测试后的清理"""
        ReminderNotification.objects.delete()
        Reminder.objects.delete()
        User.objects.delete()

    def test_create_notification(self):
        """测试创建通知"""
        notification = ReminderNotification(
            reminder=self.reminder,
            scheduled_time=timezone.now() + timedelta(hours=1),
            status='pending'
        )
        notification.save()

        self.assertIsNotNone(notification.id)
        self.assertEqual(notification.status, 'pending')
        self.assertEqual(notification.reminder, self.reminder)

    def test_notification_status_choices(self):
        """测试通知状态选项"""
        # 验证所有状态都在 STATUS_CHOICES 中
        valid_statuses = [choice[0] for choice in ReminderNotification.STATUS_CHOICES]
        
        self.assertIn('pending', valid_statuses)
        self.assertIn('sent', valid_statuses)
        self.assertIn('failed', valid_statuses)
        self.assertIn('cancelled', valid_statuses)  # 新增的状态

    def test_notification_pending_status(self):
        """测试待发送状态"""
        notification = ReminderNotification(
            reminder=self.reminder,
            scheduled_time=timezone.now() + timedelta(hours=1),
            status='pending'
        )
        notification.save()

        self.assertEqual(notification.status, 'pending')
        self.assertIsNone(notification.sent_time)
        self.assertIsNone(notification.error_message)

    def test_notification_sent_status(self):
        """测试已发送状态"""
        notification = ReminderNotification(
            reminder=self.reminder,
            scheduled_time=timezone.now() - timedelta(hours=1),
            status='pending'
        )
        notification.save()

        # 模拟发送成功
        notification.status = 'sent'
        notification.sent_time = timezone.now()
        notification.save()

        self.assertEqual(notification.status, 'sent')
        self.assertIsNotNone(notification.sent_time)

    def test_notification_failed_status(self):
        """测试发送失败状态"""
        notification = ReminderNotification(
            reminder=self.reminder,
            scheduled_time=timezone.now() - timedelta(hours=1),
            status='pending'
        )
        notification.save()

        # 模拟发送失败
        notification.status = 'failed'
        notification.error_message = '发送失败：网络错误'
        notification.save()

        self.assertEqual(notification.status, 'failed')
        self.assertIsNotNone(notification.error_message)

    def test_notification_cancelled_status(self):
        """测试已取消状态"""
        notification = ReminderNotification(
            reminder=self.reminder,
            scheduled_time=timezone.now() + timedelta(hours=1),
            status='pending'
        )
        notification.save()

        # 模拟取消通知
        notification.status = 'cancelled'
        notification.save()

        self.assertEqual(notification.status, 'cancelled')

    def test_query_pending_notifications(self):
        """测试查询待发送通知"""
        # 创建多个不同状态的通知
        now = timezone.now()
        
        # 待发送（已到时间）
        notification1 = ReminderNotification(
            reminder=self.reminder,
            scheduled_time=now - timedelta(minutes=5),
            status='pending'
        )
        notification1.save()

        # 待发送（未到时间）
        notification2 = ReminderNotification(
            reminder=self.reminder,
            scheduled_time=now + timedelta(hours=1),
            status='pending'
        )
        notification2.save()

        # 已发送
        notification3 = ReminderNotification(
            reminder=self.reminder,
            scheduled_time=now - timedelta(hours=1),
            status='sent'
        )
        notification3.save()

        # 已取消
        notification4 = ReminderNotification(
            reminder=self.reminder,
            scheduled_time=now - timedelta(hours=2),
            status='cancelled'
        )
        notification4.save()

        # 查询待发送且已到时间的通知
        pending_notifications = ReminderNotification.objects.filter(
            status='pending',
            scheduled_time__lte=now
        )

        self.assertEqual(pending_notifications.count(), 1)
        self.assertEqual(pending_notifications.first().id, notification1.id)

    def test_query_by_reminder(self):
        """测试按提醒查询通知"""
        # 创建另一个提醒
        another_reminder = Reminder(
            user=self.user,
            title='另一个提醒',
            due_date=timezone.now() + timedelta(days=2)
        )
        another_reminder.save()

        # 为第一个提醒创建通知
        notification1 = ReminderNotification(
            reminder=self.reminder,
            scheduled_time=timezone.now() + timedelta(hours=1),
            status='pending'
        )
        notification1.save()

        # 为第二个提醒创建通知
        notification2 = ReminderNotification(
            reminder=another_reminder,
            scheduled_time=timezone.now() + timedelta(hours=2),
            status='pending'
        )
        notification2.save()

        # 查询第一个提醒的通知
        notifications = ReminderNotification.objects.filter(reminder=self.reminder)
        self.assertEqual(notifications.count(), 1)
        self.assertEqual(notifications.first().id, notification1.id)

    def test_notification_ordering(self):
        """测试通知排序"""
        now = timezone.now()

        # 创建多个通知，时间不同
        notification1 = ReminderNotification(
            reminder=self.reminder,
            scheduled_time=now + timedelta(hours=3),
            status='pending'
        )
        notification1.save()

        notification2 = ReminderNotification(
            reminder=self.reminder,
            scheduled_time=now + timedelta(hours=1),
            status='pending'
        )
        notification2.save()

        notification3 = ReminderNotification(
            reminder=self.reminder,
            scheduled_time=now + timedelta(hours=2),
            status='pending'
        )
        notification3.save()

        # 查询所有通知（应该按 scheduled_time 排序）
        notifications = list(ReminderNotification.objects.all())

        # 验证排序
        self.assertEqual(notifications[0].id, notification2.id)
        self.assertEqual(notifications[1].id, notification3.id)
        self.assertEqual(notifications[2].id, notification1.id)

    def test_update_notification_status(self):
        """测试更新通知状态"""
        notification = ReminderNotification(
            reminder=self.reminder,
            scheduled_time=timezone.now() + timedelta(hours=1),
            status='pending'
        )
        notification.save()

        original_updated_at = notification.updated_at

        # 等待一小段时间
        import time
        time.sleep(0.1)

        # 更新状态
        notification.status = 'sent'
        notification.sent_time = timezone.now()
        notification.save()

        # 验证 updated_at 已更新
        self.assertGreater(notification.updated_at, original_updated_at)

    def test_batch_cancel_notifications(self):
        """测试批量取消通知"""
        # 创建多个待发送通知
        notifications = []
        for i in range(5):
            notification = ReminderNotification(
                reminder=self.reminder,
                scheduled_time=timezone.now() + timedelta(hours=i+1),
                status='pending'
            )
            notification.save()
            notifications.append(notification)

        # 批量取消
        ReminderNotification.objects.filter(
            reminder=self.reminder,
            status='pending'
        ).update(
            status='cancelled',
            updated_at=timezone.now()
        )

        # 验证所有通知都已取消
        cancelled_count = ReminderNotification.objects.filter(
            reminder=self.reminder,
            status='cancelled'
        ).count()

        self.assertEqual(cancelled_count, 5)

    def test_notification_string_representation(self):
        """测试通知的字符串表示"""
        notification = ReminderNotification(
            reminder=self.reminder,
            scheduled_time=timezone.now() + timedelta(hours=1),
            status='pending'
        )
        notification.save()

        str_repr = str(notification)
        self.assertIn(self.reminder.title, str_repr)
        self.assertIn('pending', str_repr)


if __name__ == '__main__':
    unittest.main()

