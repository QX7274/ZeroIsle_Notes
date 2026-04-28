"""
提醒模型测试
测试 Reminder 模型的核心功能，特别是 get_next_occurrence 方法
"""

import unittest
from datetime import datetime, timedelta
from django.test import TestCase
from django.utils import timezone
from mongoengine import connect, disconnect
from reminder.mongodb_models import Reminder, ReminderNotification
from users.mongodb_models import User
import uuid


class ReminderModelTestCase(TestCase):
    """提醒模型测试用例"""

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
        Reminder.objects.delete()
        ReminderNotification.objects.delete()
        User.objects.delete()

    def test_get_priority_display(self):
        """测试获取优先级显示名称"""
        reminder = Reminder(
            user=self.user,
            title='测试提醒',
            due_date=timezone.now() + timedelta(days=1),
            priority='high'
        )
        reminder.save()

        self.assertEqual(reminder.get_priority_display(), '高')

    def test_get_frequency_display(self):
        """测试获取频率显示名称"""
        reminder = Reminder(
            user=self.user,
            title='测试提醒',
            due_date=timezone.now() + timedelta(days=1),
            frequency='daily'
        )
        reminder.save()

        self.assertEqual(reminder.get_frequency_display(), '每天')

    def test_get_category_display(self):
        """测试获取分类显示名称"""
        reminder = Reminder(
            user=self.user,
            title='测试提醒',
            due_date=timezone.now() + timedelta(days=1),
            category='work'
        )
        reminder.save()

        self.assertEqual(reminder.get_category_display(), '工作')

    def test_once_frequency_future_date(self):
        """测试一次性提醒（未来时间）"""
        due_date = timezone.now() + timedelta(days=1)
        reminder = Reminder(
            user=self.user,
            title='一次性提醒',
            due_date=due_date,
            frequency='once'
        )
        reminder.save()

        next_occurrence = reminder.get_next_occurrence()
        self.assertEqual(next_occurrence, due_date)

    def test_daily_frequency(self):
        """测试每日提醒"""
        # 设置一个过去的时间
        past_date = timezone.now() - timedelta(days=2)
        reminder = Reminder(
            user=self.user,
            title='每日提醒',
            due_date=past_date,
            frequency='daily'
        )
        reminder.save()

        next_occurrence = reminder.get_next_occurrence()
        self.assertIsNotNone(next_occurrence)
        self.assertGreater(next_occurrence, timezone.now())
        # 验证时间部分保持不变
        self.assertEqual(next_occurrence.time(), past_date.time())

    def test_weekly_frequency(self):
        """测试每周提醒"""
        # 设置一个过去的时间（2周前）
        past_date = timezone.now() - timedelta(weeks=2)
        reminder = Reminder(
            user=self.user,
            title='每周提醒',
            due_date=past_date,
            frequency='weekly'
        )
        reminder.save()

        next_occurrence = reminder.get_next_occurrence()
        self.assertIsNotNone(next_occurrence)
        self.assertGreater(next_occurrence, timezone.now())
        # 验证时间部分保持不变
        self.assertEqual(next_occurrence.time(), past_date.time())

    def test_monthly_frequency(self):
        """测试每月提醒"""
        # 设置一个过去的时间（2个月前）
        past_date = timezone.now() - timedelta(days=60)
        reminder = Reminder(
            user=self.user,
            title='每月提醒',
            due_date=past_date,
            frequency='monthly'
        )
        reminder.save()

        next_occurrence = reminder.get_next_occurrence()
        self.assertIsNotNone(next_occurrence)
        self.assertGreater(next_occurrence, timezone.now())
        # 验证时间部分保持不变
        self.assertEqual(next_occurrence.time(), past_date.time())

    def test_monthly_frequency_month_end(self):
        """测试每月提醒（月底日期）"""
        # 设置 1 月 31 日
        now = timezone.now()
        past_date = timezone.make_aware(datetime(now.year, 1, 31, 10, 0, 0))
        reminder = Reminder(
            user=self.user,
            title='月底提醒',
            due_date=past_date,
            frequency='monthly'
        )
        reminder.save()

        next_occurrence = reminder.get_next_occurrence()
        self.assertIsNotNone(next_occurrence)
        # 2 月没有 31 日，应该调整为 2 月的最后一天
        if next_occurrence.month == 2:
            self.assertIn(next_occurrence.day, [28, 29])

    def test_yearly_frequency(self):
        """测试每年提醒"""
        # 设置一个过去的时间（2年前）
        past_date = timezone.now() - timedelta(days=730)
        reminder = Reminder(
            user=self.user,
            title='每年提醒',
            due_date=past_date,
            frequency='yearly'
        )
        reminder.save()

        next_occurrence = reminder.get_next_occurrence()
        self.assertIsNotNone(next_occurrence)
        self.assertGreater(next_occurrence, timezone.now())
        # 验证月和日保持不变
        self.assertEqual(next_occurrence.month, past_date.month)
        self.assertEqual(next_occurrence.day, past_date.day)

    def test_yearly_frequency_leap_year(self):
        """测试每年提醒（闰年 2 月 29 日）"""
        # 设置 2020 年 2 月 29 日（闰年）
        leap_date = timezone.make_aware(datetime(2020, 2, 29, 10, 0, 0))
        reminder = Reminder(
            user=self.user,
            title='闰年提醒',
            due_date=leap_date,
            frequency='yearly'
        )
        reminder.save()

        next_occurrence = reminder.get_next_occurrence()
        self.assertIsNotNone(next_occurrence)
        # 如果下一年不是闰年，应该调整为 2 月 28 日
        if next_occurrence.year % 4 != 0 or (next_occurrence.year % 100 == 0 and next_occurrence.year % 400 != 0):
            self.assertEqual(next_occurrence.day, 28)
        else:
            self.assertEqual(next_occurrence.day, 29)

    def test_repeat_end_date_daily(self):
        """测试重复结束日期（每日）"""
        past_date = timezone.now() - timedelta(days=2)
        end_date = timezone.now() + timedelta(days=1)
        reminder = Reminder(
            user=self.user,
            title='有结束日期的每日提醒',
            due_date=past_date,
            frequency='daily',
            repeat_end_date=end_date
        )
        reminder.save()

        next_occurrence = reminder.get_next_occurrence()
        # 应该返回一个未来的时间，但不超过 end_date
        if next_occurrence:
            self.assertLessEqual(next_occurrence, end_date)

    def test_repeat_end_date_exceeded(self):
        """测试重复结束日期已过期"""
        past_date = timezone.now() - timedelta(days=10)
        end_date = timezone.now() - timedelta(days=1)
        reminder = Reminder(
            user=self.user,
            title='结束日期已过的提醒',
            due_date=past_date,
            frequency='daily',
            repeat_end_date=end_date
        )
        reminder.save()

        next_occurrence = reminder.get_next_occurrence()
        # 应该返回 None，因为已经超过结束日期
        self.assertIsNone(next_occurrence)

    def test_completed_reminder(self):
        """测试已完成的提醒"""
        reminder = Reminder(
            user=self.user,
            title='已完成的提醒',
            due_date=timezone.now() + timedelta(days=1),
            is_completed=True
        )
        reminder.save()

        next_occurrence = reminder.get_next_occurrence()
        self.assertIsNone(next_occurrence)

    def test_disabled_reminder(self):
        """测试已禁用的提醒"""
        reminder = Reminder(
            user=self.user,
            title='已禁用的提醒',
            due_date=timezone.now() + timedelta(days=1),
            is_enabled=False
        )
        reminder.save()

        next_occurrence = reminder.get_next_occurrence()
        self.assertIsNone(next_occurrence)

    def test_is_overdue(self):
        """测试是否过期"""
        # 过期的提醒
        overdue_reminder = Reminder(
            user=self.user,
            title='过期提醒',
            due_date=timezone.now() - timedelta(days=1),
            is_completed=False
        )
        overdue_reminder.save()
        self.assertTrue(overdue_reminder.is_overdue)

        # 未过期的提醒
        future_reminder = Reminder(
            user=self.user,
            title='未来提醒',
            due_date=timezone.now() + timedelta(days=1),
            is_completed=False
        )
        future_reminder.save()
        self.assertFalse(future_reminder.is_overdue)

        # 已完成的提醒（即使过期也不算）
        completed_reminder = Reminder(
            user=self.user,
            title='已完成提醒',
            due_date=timezone.now() - timedelta(days=1),
            is_completed=True
        )
        completed_reminder.save()
        self.assertFalse(completed_reminder.is_overdue)

    def test_complete_reminder(self):
        """测试完成提醒"""
        reminder = Reminder(
            user=self.user,
            title='待完成提醒',
            due_date=timezone.now() + timedelta(days=1)
        )
        reminder.save()

        self.assertFalse(reminder.is_completed)
        self.assertIsNone(reminder.completed_at)

        reminder.complete()

        self.assertTrue(reminder.is_completed)
        self.assertIsNotNone(reminder.completed_at)


if __name__ == '__main__':
    unittest.main()

