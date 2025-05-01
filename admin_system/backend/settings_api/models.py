from mongoengine import Document, StringField, DateTimeField, IntField, BooleanField, DictField, FileField
from django.utils import timezone
import os

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


class SystemBackup(Document):
    """系统备份"""
    BACKUP_TYPES = (
        ('full', '完整备份'),
        ('data', '数据备份'),
        ('settings', '设置备份'),
        ('user', '用户备份'),
        ('content', '内容备份'),
    )

    STATUS_CHOICES = (
        ('pending', '等待中'),
        ('running', '进行中'),
        ('completed', '已完成'),
        ('failed', '失败'),
    )

    name = StringField(max_length=100, required=True, verbose_name='备份名称')
    description = StringField(max_length=255, required=False, verbose_name='备份描述')
    backup_type = StringField(max_length=20, choices=BACKUP_TYPES, default='full', verbose_name='备份类型')
    status = StringField(max_length=20, choices=STATUS_CHOICES, default='pending', verbose_name='状态')
    file_path = StringField(max_length=255, required=False, verbose_name='文件路径')
    file_size = IntField(default=0, verbose_name='文件大小(字节)')
    backup_data = DictField(required=False, verbose_name='备份数据')
    is_auto = BooleanField(default=False, verbose_name='是否自动备份')
    created_by = StringField(max_length=50, required=True, verbose_name='创建者')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    completed_at = DateTimeField(required=False, verbose_name='完成时间')

    meta = {
        'collection': 'system_backups',
        'ordering': ['-created_at'],
        'verbose_name': '系统备份',
        'verbose_name_plural': '系统备份'
    }

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if self.status == 'completed' and not self.completed_at:
            self.completed_at = timezone.now()
        return super(SystemBackup, self).save(*args, **kwargs)

    def get_file_size_display(self):
        """获取文件大小的可读表示"""
        size = self.file_size
        for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
            if size < 1024.0:
                return f"{size:.2f} {unit}"
            size /= 1024.0
        return f"{size:.2f} PB"

    def delete(self, *args, **kwargs):
        """删除备份文件"""
        if self.file_path and os.path.exists(self.file_path):
            try:
                os.remove(self.file_path)
            except Exception as e:
                print(f"删除备份文件失败: {str(e)}")
        return super(SystemBackup, self).delete(*args, **kwargs)
