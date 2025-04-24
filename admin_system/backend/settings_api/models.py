from mongoengine import Document, StringField, DateTimeField
from django.utils import timezone

class SystemSetting(Document):
    """系统设置"""
    key = StringField(max_length=50, unique=True, required=True, verbose_name='设置键')
    value = StringField(required=True, verbose_name='设置值')
    description = StringField(max_length=255, required=False, verbose_name='描述')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')

    meta = {
        'collection': 'system_settings',
        'ordering': ['key'],
        'verbose_name': '系统设置',
        'verbose_name_plural': '系统设置'
    }

    def __str__(self):
        return self.key

    def save(self, *args, **kwargs):
        self.updated_at = timezone.now()
        return super(SystemSetting, self).save(*args, **kwargs)

class Announcement(Document):
    """系统公告"""
    STATUS_CHOICES = (
        ('draft', '草稿'),
        ('published', '已发布'),
        ('expired', '已过期'),
    )

    title = StringField(max_length=100, required=True, verbose_name='公告标题')
    content = StringField(required=True, verbose_name='公告内容')
    status = StringField(max_length=20, choices=STATUS_CHOICES, default='draft', verbose_name='状态')
    start_time = DateTimeField(required=True, verbose_name='开始时间')
    end_time = DateTimeField(required=True, verbose_name='结束时间')
    created_by = StringField(max_length=50, required=True, verbose_name='创建者')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')

    meta = {
        'collection': 'announcements',
        'ordering': ['-created_at'],
        'verbose_name': '系统公告',
        'verbose_name_plural': '系统公告'
    }

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        self.updated_at = timezone.now()
        return super(Announcement, self).save(*args, **kwargs)
