from mongoengine import Document, StringField, DateTimeField
from django.utils import timezone

class AdminOperationLog(Document):
    """管理员操作日志"""
    ACTION_CHOICES = (
        ('create', '创建'),
        ('update', '更新'),
        ('delete', '删除'),
        ('query', '查询'),
        ('export', '导出'),
        ('import', '导入'),
        ('other', '其他'),
    )

    admin_username = StringField(max_length=150, required=True, verbose_name='管理员用户名')
    ip_address = StringField(required=True, verbose_name='IP地址')
    module = StringField(max_length=50, required=True, verbose_name='操作模块')
    action = StringField(max_length=20, choices=ACTION_CHOICES, required=True, verbose_name='操作类型')
    resource_id = StringField(max_length=50, required=False, verbose_name='资源ID')
    description = StringField(required=True, verbose_name='操作描述')
    operation_time = DateTimeField(default=timezone.now, verbose_name='操作时间')

    meta = {
        'collection': 'admin_operation_logs',
        'ordering': ['-operation_time'],
        'verbose_name': '管理员操作日志',
        'verbose_name_plural': '管理员操作日志'
    }

    def __str__(self):
        action_display = dict(self.ACTION_CHOICES).get(self.action, self.action)
        return f"{self.admin_username} - {action_display} - {self.operation_time}"

class SystemLog(Document):
    """系统日志"""
    LEVEL_CHOICES = (
        ('info', '信息'),
        ('warning', '警告'),
        ('error', '错误'),
        ('critical', '严重'),
    )

    level = StringField(max_length=20, choices=LEVEL_CHOICES, required=True, verbose_name='日志级别')
    source = StringField(max_length=50, required=True, verbose_name='来源')
    message = StringField(required=True, verbose_name='日志消息')
    timestamp = DateTimeField(default=timezone.now, verbose_name='时间戳')

    meta = {
        'collection': 'system_logs',
        'ordering': ['-timestamp'],
        'verbose_name': '系统日志',
        'verbose_name_plural': '系统日志'
    }

    def __str__(self):
        level_display = dict(self.LEVEL_CHOICES).get(self.level, self.level)
        return f"{level_display} - {self.source} - {self.timestamp}"
