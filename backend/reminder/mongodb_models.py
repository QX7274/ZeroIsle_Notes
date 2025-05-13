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

    def get_next_occurrence(self):
        """获取下一次提醒时间"""
        if self.is_completed or not self.is_enabled:
            return None

        if self.frequency == 'once':
            return self.due_date

        now = timezone.now()
        if self.due_date > now:
            return self.due_date

        # 计算下一次提醒时间
        from datetime import timedelta, datetime

        # 获取原始时间的时分秒
        original_time = self.due_date.time()

        if self.frequency == 'daily':
            # 计算从原始到期日到现在经过了多少天
            delta = now - self.due_date
            days_passed = delta.days + (1 if delta.seconds > 0 else 0)

            # 计算下一次提醒时间
            next_date = self.due_date + timedelta(days=days_passed)

            # 确保时间部分保持不变
            next_date = datetime.combine(next_date.date(), original_time)
            if timezone.is_aware(self.due_date):
                next_date = timezone.make_aware(next_date)

            return next_date

        elif self.frequency == 'weekly':
            # 计算从原始到期日到现在经过了多少周
            delta = now - self.due_date
            weeks_passed = delta.days // 7 + (1 if delta.days % 7 > 0 or delta.seconds > 0 else 0)

            # 计算下一次提醒时间
            next_date = self.due_date + timedelta(days=weeks_passed * 7)

            # 确保时间部分保持不变
            next_date = datetime.combine(next_date.date(), original_time)
            if timezone.is_aware(self.due_date):
                next_date = timezone.make_aware(next_date)

            return next_date

        elif self.frequency == 'monthly':
            # 获取原始日期的年、月、日
            original_year = self.due_date.year
            original_month = self.due_date.month
            original_day = self.due_date.day

            # 计算从原始到期日到现在经过了多少个月
            months_passed = (now.year - original_year) * 12 + (now.month - original_month)
            if now.day > original_day or (now.day == original_day and now.time() > original_time):
                months_passed += 1

            # 计算下一次提醒的年和月
            next_year = original_year + (original_month + months_passed - 1) // 12
            next_month = (original_month + months_passed - 1) % 12 + 1

            # 处理月份天数不同的情况
            import calendar
            last_day = calendar.monthrange(next_year, next_month)[1]
            next_day = min(original_day, last_day)

            # 创建下一次提醒时间
            next_date = datetime(next_year, next_month, next_day,
                                original_time.hour, original_time.minute,
                                original_time.second, original_time.microsecond)

            if timezone.is_aware(self.due_date):
                next_date = timezone.make_aware(next_date)

            return next_date

        elif self.frequency == 'yearly':
            # 获取原始日期的月、日
            original_month = self.due_date.month
            original_day = self.due_date.day

            # 计算从原始到期日到现在经过了多少年
            years_passed = now.year - self.due_date.year
            if (now.month > original_month or
                (now.month == original_month and now.day > original_day) or
                (now.month == original_month and now.day == original_day and now.time() > original_time)):
                years_passed += 1

            # 处理2月29日的情况
            next_year = self.due_date.year + years_passed
            if original_month == 2 and original_day == 29:
                import calendar
                if not calendar.isleap(next_year):
                    original_day = 28

            # 创建下一次提醒时间
            try:
                next_date = datetime(next_year, original_month, original_day,
                                    original_time.hour, original_time.minute,
                                    original_time.second, original_time.microsecond)

                if timezone.is_aware(self.due_date):
                    next_date = timezone.make_aware(next_date)

                return next_date
            except ValueError:
                # 处理无效日期的情况
                import calendar
                last_day = calendar.monthrange(next_year, original_month)[1]
                next_date = datetime(next_year, original_month, last_day,
                                    original_time.hour, original_time.minute,
                                    original_time.second, original_time.microsecond)

                if timezone.is_aware(self.due_date):
                    next_date = timezone.make_aware(next_date)

                return next_date
        else:
            return None

class ReminderNotification(Document):
    """
    提醒通知文档模型
    """
    STATUS_CHOICES = (
        ('pending', '待发送'),
        ('sent', '已发送'),
        ('failed', '发送失败'),
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
            {'fields': ['created_at']}
        ],
        'ordering': ['scheduled_time']
    }

    def __str__(self):
        return f"{self.reminder.title} - {self.status}"

    def save(self, *args, **kwargs):
        """保存前更新更新时间"""
        self.updated_at = timezone.now()
        return super().save(*args, **kwargs)
