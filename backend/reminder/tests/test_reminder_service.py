"""
提醒服务测试
测试 ReminderService 的业务逻辑
"""

import unittest
from datetime import timedelta
from django.test import TestCase
from django.utils import timezone
from mongoengine import connect, disconnect
from reminder.mongodb_models import Reminder, ReminderNotification
from reminder.services.reminder_service import ReminderService
from users.mongodb_models import User
import uuid


class ReminderServiceTestCase(TestCase):
    """提醒服务测试用例"""

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

    def tearDown(self):
        """每个测试后的清理"""
        ReminderNotification.objects.delete()
        Reminder.objects.delete()
        User.objects.delete()

    def test_create_reminder(self):
        """测试创建提醒"""
        data = {
            'title': '测试提醒',
            'description': '这是一个测试提醒',
            'due_date': timezone.now() + timedelta(days=1),
            'priority': 'high',
            'frequency': 'once',
            'category': 'work',
            'color': '#FF5733',
            'tags': 'test,important'
        }

        reminder = ReminderService.create_reminder(self.user, data)

        self.assertIsNotNone(reminder)
        self.assertEqual(reminder.title, data['title'])
        self.assertEqual(reminder.description, data['description'])
        self.assertEqual(reminder.priority, data['priority'])
        self.assertEqual(reminder.category, data['category'])
        self.assertEqual(reminder.color, data['color'])
        self.assertEqual(reminder.tags, data['tags'])
        self.assertEqual(reminder.user, self.user)

        # 验证通知已创建
        notifications = ReminderNotification.objects.filter(reminder=reminder)
        self.assertGreater(notifications.count(), 0)

    def test_create_reminder_with_defaults(self):
        """测试使用默认值创建提醒"""
        data = {
            'title': '简单提醒',
            'due_date': timezone.now() + timedelta(days=1)
        }

        reminder = ReminderService.create_reminder(self.user, data)

        self.assertEqual(reminder.priority, 'medium')
        self.assertEqual(reminder.frequency, 'once')
        self.assertEqual(reminder.category, 'other')
        self.assertEqual(reminder.color, '#3498db')
        self.assertTrue(reminder.is_enabled)

    def test_update_reminder(self):
        """测试更新提醒"""
        # 创建提醒
        data = {
            'title': '原始提醒',
            'due_date': timezone.now() + timedelta(days=1),
            'priority': 'low'
        }
        reminder = ReminderService.create_reminder(self.user, data)

        # 更新提醒
        update_data = {
            'title': '更新后的提醒',
            'priority': 'high',
            'description': '添加描述'
        }
        updated_reminder = ReminderService.update_reminder(reminder, update_data)

        self.assertEqual(updated_reminder.title, update_data['title'])
        self.assertEqual(updated_reminder.priority, update_data['priority'])
        self.assertEqual(updated_reminder.description, update_data['description'])

    def test_update_reminder_reschedule_notifications(self):
        """测试更新提醒时重新安排通知"""
        # 创建提醒
        data = {
            'title': '测试提醒',
            'due_date': timezone.now() + timedelta(days=1),
            'frequency': 'once'
        }
        reminder = ReminderService.create_reminder(self.user, data)

        # 获取原始通知数量
        original_notifications = ReminderNotification.objects.filter(
            reminder=reminder,
            status='pending'
        ).count()

        # 更新到期时间（应该重新安排通知）
        update_data = {
            'due_date': timezone.now() + timedelta(days=2)
        }
        ReminderService.update_reminder(reminder, update_data)

        # 验证旧通知已取消
        cancelled_notifications = ReminderNotification.objects.filter(
            reminder=reminder,
            status='cancelled'
        ).count()
        self.assertEqual(cancelled_notifications, original_notifications)

        # 验证新通知已创建
        pending_notifications = ReminderNotification.objects.filter(
            reminder=reminder,
            status='pending'
        ).count()
        self.assertGreater(pending_notifications, 0)

    def test_delete_reminder(self):
        """测试删除提醒"""
        # 创建提醒
        data = {
            'title': '待删除提醒',
            'due_date': timezone.now() + timedelta(days=1)
        }
        reminder = ReminderService.create_reminder(self.user, data)
        reminder_id = reminder.id

        # 删除提醒
        result = ReminderService.delete_reminder(reminder)

        self.assertTrue(result)

        # 验证提醒已删除
        with self.assertRaises(Reminder.DoesNotExist):
            Reminder.objects.get(id=reminder_id)

        # 验证通知已取消
        cancelled_notifications = ReminderNotification.objects.filter(
            status='cancelled'
        ).count()
        self.assertGreater(cancelled_notifications, 0)

    def test_get_upcoming_reminders(self):
        """测试获取即将到期的提醒"""
        # 创建多个提醒
        # 1. 明天到期
        data1 = {
            'title': '明天到期',
            'due_date': timezone.now() + timedelta(days=1)
        }
        ReminderService.create_reminder(self.user, data1)

        # 2. 3天后到期
        data2 = {
            'title': '3天后到期',
            'due_date': timezone.now() + timedelta(days=3)
        }
        ReminderService.create_reminder(self.user, data2)

        # 3. 10天后到期（超出默认范围）
        data3 = {
            'title': '10天后到期',
            'due_date': timezone.now() + timedelta(days=10)
        }
        ReminderService.create_reminder(self.user, data3)

        # 4. 已过期
        data4 = {
            'title': '已过期',
            'due_date': timezone.now() - timedelta(days=1)
        }
        ReminderService.create_reminder(self.user, data4)

        # 获取未来7天的提醒
        upcoming = ReminderService.get_upcoming_reminders(self.user, days=7)

        self.assertEqual(upcoming.count(), 2)

    def test_get_overdue_reminders(self):
        """测试获取已过期的提醒"""
        # 创建多个提醒
        # 1. 已过期
        data1 = {
            'title': '过期1天',
            'due_date': timezone.now() - timedelta(days=1)
        }
        ReminderService.create_reminder(self.user, data1)

        # 2. 已过期
        data2 = {
            'title': '过期3天',
            'due_date': timezone.now() - timedelta(days=3)
        }
        ReminderService.create_reminder(self.user, data2)

        # 3. 未过期
        data3 = {
            'title': '未过期',
            'due_date': timezone.now() + timedelta(days=1)
        }
        ReminderService.create_reminder(self.user, data3)

        # 4. 已完成（不应包含）
        data4 = {
            'title': '已完成',
            'due_date': timezone.now() - timedelta(days=2),
            'is_completed': True
        }
        reminder4 = Reminder(
            user=self.user,
            title=data4['title'],
            due_date=data4['due_date'],
            is_completed=True
        )
        reminder4.save()

        # 获取已过期的提醒
        overdue = ReminderService.get_overdue_reminders(self.user)

        self.assertEqual(overdue.count(), 2)

    def test_schedule_notification_for_once_reminder(self):
        """测试为一次性提醒安排通知"""
        data = {
            'title': '一次性提醒',
            'due_date': timezone.now() + timedelta(hours=2),
            'frequency': 'once'
        }
        reminder = ReminderService.create_reminder(self.user, data)

        # 验证通知已创建
        notifications = ReminderNotification.objects.filter(
            reminder=reminder,
            status='pending'
        )
        self.assertEqual(notifications.count(), 1)
        self.assertEqual(notifications.first().scheduled_time, reminder.due_date)

    def test_schedule_notification_for_daily_reminder(self):
        """测试为每日提醒安排通知"""
        data = {
            'title': '每日提醒',
            'due_date': timezone.now() + timedelta(hours=2),
            'frequency': 'daily'
        }
        reminder = ReminderService.create_reminder(self.user, data)

        # 验证通知已创建
        notifications = ReminderNotification.objects.filter(
            reminder=reminder,
            status='pending'
        )
        self.assertGreater(notifications.count(), 0)

    def test_update_notifications_when_disabled(self):
        """测试禁用提醒时取消通知"""
        # 创建提醒
        data = {
            'title': '测试提醒',
            'due_date': timezone.now() + timedelta(days=1)
        }
        reminder = ReminderService.create_reminder(self.user, data)

        # 禁用提醒
        update_data = {'is_enabled': False}
        ReminderService.update_reminder(reminder, update_data)

        # 验证通知已取消
        pending_notifications = ReminderNotification.objects.filter(
            reminder=reminder,
            status='pending'
        ).count()
        self.assertEqual(pending_notifications, 0)

    def test_update_notifications_when_completed(self):
        """测试完成提醒时取消通知"""
        # 创建提醒
        data = {
            'title': '测试提醒',
            'due_date': timezone.now() + timedelta(days=1)
        }
        reminder = ReminderService.create_reminder(self.user, data)

        # 完成提醒
        update_data = {'is_completed': True}
        ReminderService.update_reminder(reminder, update_data)

        # 验证通知已取消
        pending_notifications = ReminderNotification.objects.filter(
            reminder=reminder,
            status='pending'
        ).count()
        self.assertEqual(pending_notifications, 0)

    def test_create_reminder_with_repeat_end_date(self):
        """测试创建带重复结束日期的提醒"""
        data = {
            'title': '重复提醒',
            'due_date': timezone.now() + timedelta(days=1),
            'frequency': 'daily',
            'repeat_end_date': timezone.now() + timedelta(days=7)
        }
        reminder = ReminderService.create_reminder(self.user, data)

        self.assertIsNotNone(reminder.repeat_end_date)
        self.assertEqual(reminder.repeat_end_date, data['repeat_end_date'])


if __name__ == '__main__':
    unittest.main()

