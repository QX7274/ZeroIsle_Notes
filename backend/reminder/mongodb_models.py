"""
提醒模块MongoDB文档模型
使用MongoEngine ODM定义MongoDB文档模型
"""

from mongoengine import Document, StringField, DateTimeField, BooleanField, IntField, FloatField
from mongoengine import UUIDField, ReferenceField, ListField, DictField, URLField, EmbeddedDocument, EmbeddedDocumentField
from django.utils import timezone
import uuid
from users.mongodb_models import User
# 避免循环导入
# 在运行时导入Note
Note = None

class ReminderException(EmbeddedDocument):
    """
    记录重复提醒的例外情况
    """
    STATUS_CHOICES = ('completed', 'cancelled', 'rescheduled')

    original_occurrence_date = DateTimeField(required=True, verbose_name='原始发生时间')
    status = StringField(choices=STATUS_CHOICES, required=True, verbose_name='例外状态')
    new_due_date = DateTimeField(verbose_name='新的到期时间') # For rescheduled status
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')


class Reminder(Document):
    """
    提醒文档模型
    """
    PRIORITY_CHOICES = (
        ('low', '低'),
        ('medium', '中'),
        ('high', '高'),
    )

    FREQUENCY_CHOICES = (
        ('once', '一次'),
        ('daily', '每天'),
        ('weekly', '每周'),
        ('monthly', '每月'),
        ('yearly', '每年'),
    )

    CATEGORY_CHOICES = (
        ('work', '工作'),
        ('study', '学习'),
        ('personal', '个人'),
        ('health', '健康'),
        ('finance', '财务'),
        ('social', '社交'),
        ('other', '其他'),
    )

    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4(), verbose_name='提醒ID')
    user = ReferenceField(User, required=True, verbose_name='用户')
    title = StringField(max_length=200, required=True, verbose_name='标题')
    description = StringField(verbose_name='描述')
    due_date = DateTimeField(required=True, verbose_name='到期时间')
    priority = StringField(max_length=10, choices=PRIORITY_CHOICES, default='medium', verbose_name='优先级')
    frequency = StringField(max_length=10, choices=FREQUENCY_CHOICES, default='once', verbose_name='频率')
    category = StringField(max_length=20, choices=CATEGORY_CHOICES, default='other', verbose_name='分类')
    color = StringField(max_length=7, default='#3498db', verbose_name='颜色')
    tags = StringField(verbose_name='标签', default='')
    is_completed = BooleanField(default=False, verbose_name='是否完成')
    is_enabled = BooleanField(default=True, verbose_name='是否启用')
    note = ReferenceField('notes.mongodb_models.Note', verbose_name='关联笔记')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')
    completed_at = DateTimeField(verbose_name='完成时间')
    repeat_end_date = DateTimeField(verbose_name='重复结束时间')

    # 日历集成相关字段
    calendar_event_id = StringField(verbose_name='日历事件ID')
    calendar_id = StringField(verbose_name='日历ID')
    last_sync_time = DateTimeField(verbose_name='最后同步时间')
    exceptions = ListField(EmbeddedDocumentField(ReminderException), verbose_name='例外情况')

    meta = {
        'collection': 'reminders',
        'indexes': [
            {'fields': ['user']},
            {'fields': ['due_date']},
            {'fields': ['is_completed']},
            {'fields': ['is_enabled']},
            {'fields': ['priority']},
            {'fields': ['category']},
            {'fields': ['tags']},
            {'fields': ['frequency']},
            {'fields': ['created_at']},
            {'fields': ['user', 'category']},
            {'fields': ['user', 'is_completed']},
            {'fields': ['user', 'due_date']},
            {'fields': ['user', 'is_completed', 'due_date']},
            {'fields': ['calendar_event_id']},
            {'fields': ['calendar_id']},
            {'fields': ['user', 'calendar_id']}
        ],
        'ordering': ['due_date', '-priority']
    }

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        """保存前更新更新时间"""
        self.updated_at = timezone.now()
        return super().save(*args, **kwargs)

    @property
    def is_overdue(self):
        """是否已过期"""
        return self.due_date < timezone.now() and not self.is_completed

    def complete(self):
        """完成提醒"""
        self.is_completed = True
        self.completed_at = timezone.now()
        self.save()

    def get_priority_display(self):
        """获取优先级显示名称"""
        return dict(self.PRIORITY_CHOICES).get(self.priority, '')

    def get_frequency_display(self):
        """获取频率显示名称"""
        return dict(self.FREQUENCY_CHOICES).get(self.frequency, '')

    def get_category_display(self):
        """获取分类显示名称"""
        return dict(self.CATEGORY_CHOICES).get(self.category, '')

    def get_next_occurrence(self, after=None):
        """
        获取下一次提醒时间，支持从指定时间点开始计算。

        Args:
            after (datetime, optional): 从此时间点之后查找。如果为None，则从当前时间开始。

        Returns:
            datetime: 下一次提醒时间，如果没有则返回None。
        """
        if self.is_completed or not self.is_enabled:
            return None

        from datetime import timedelta, datetime
        import calendar

        ref_date = after or timezone.now()

        # 对于非重复提醒，如果其 due_date 在 ref_date 之后，则返回它，否则无后续
        if self.frequency == 'once':
            return self.due_date if self.due_date > ref_date else None

        # 如果起始日期就在未来，直接返回
        if not after and self.due_date > ref_date:
            return self.due_date

        # 从 'after' 或 'due_date' 中较晚的一个开始计算，以避免遗漏
        start_calc_date = max(self.due_date, ref_date)
        original_time = self.due_date.time()
        next_date = None

        if self.frequency == 'daily':
            # 找到严格在 start_calc_date 之后的那一天
            if start_calc_date.time() >= original_time:
                next_calc_day = start_calc_date.date() + timedelta(days=1)
            else:
                next_calc_day = start_calc_date.date()
            next_date = datetime.combine(next_calc_day, original_time, tzinfo=self.due_date.tzinfo)

        elif self.frequency == 'weekly':
            days_ahead = self.due_date.weekday() - start_calc_date.weekday()
            if days_ahead < 0 or (days_ahead == 0 and start_calc_date.time() >= original_time):
                days_ahead += 7
            next_date = start_calc_date + timedelta(days=days_ahead)
            next_date = datetime.combine(next_date.date(), original_time, tzinfo=self.due_date.tzinfo)

        elif self.frequency == 'monthly':
            year, month = start_calc_date.year, start_calc_date.month
            day = self.due_date.day

            if start_calc_date.day > day or (start_calc_date.day == day and start_calc_date.time() >= original_time):
                month += 1
                if month > 12:
                    month = 1
                    year += 1

            while True:
                last_day_of_month = calendar.monthrange(year, month)[1]
                actual_day = min(day, last_day_of_month)
                try:
                    next_date = datetime(year, month, actual_day, original_time.hour, original_time.minute, original_time.second, tzinfo=self.due_date.tzinfo)
                    if next_date > start_calc_date:
                        break
                except ValueError: # Should not happen with min()
                    pass
                month += 1
                if month > 12:
                    month = 1
                    year += 1

        elif self.frequency == 'yearly':
            year = start_calc_date.year
            month = self.due_date.month
            day = self.due_date.day

            if start_calc_date.month > month or \
               (start_calc_date.month == month and start_calc_date.day > day) or \
               (start_calc_date.month == month and start_calc_date.day == day and start_calc_date.time() >= original_time):
                year += 1

            while True:
                try:
                    # 处理闰年2月29日
                    actual_day = day
                    if month == 2 and day == 29 and not calendar.isleap(year):
                        actual_day = 28
                    next_date = datetime(year, month, actual_day, original_time.hour, original_time.minute, original_time.second, tzinfo=self.due_date.tzinfo)
                    if next_date > start_calc_date:
                        break
                except ValueError:
                    pass # Should not happen
                year += 1

        # 检查是否超过重复结束日期
        if next_date and self.repeat_end_date and next_date > self.repeat_end_date:
            return None

        return next_date

class ReminderNotification(Document):
    """
    提醒通知文档模型
    """
    STATUS_CHOICES = (
        ('pending', '待发送'),
        ('sent', '已发送'),
        ('failed', '发送失败'),
        ('cancelled', '已取消'),
    )

    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4(), verbose_name='通知ID')
    reminder = ReferenceField(Reminder, required=True, verbose_name='提醒')
    scheduled_time = DateTimeField(required=True, verbose_name='计划发送时间')
    status = StringField(max_length=10, choices=STATUS_CHOICES, default='pending', verbose_name='状态')
    sent_time = DateTimeField(verbose_name='发送时间')
    error_message = StringField(verbose_name='错误信息')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')

    meta = {
        'collection': 'reminder_notifications',
        'indexes': [
            {'fields': ['reminder']},
            {'fields': ['scheduled_time']},
            {'fields': ['status']},
            {'fields': ['created_at']},
            {'fields': ['status', 'scheduled_time']}  # Compound index for batch processing
        ],
        'ordering': ['scheduled_time']
    }

    def __str__(self):
        return f"{self.reminder.title} - {self.status}"

    def save(self, *args, **kwargs):
        """保存前更新更新时间"""
        self.updated_at = timezone.now()
        return super().save(*args, **kwargs)
