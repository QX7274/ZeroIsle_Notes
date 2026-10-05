from mongoengine import BooleanField, DateTimeField, DictField, Document, IntField, StringField
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

    # 跨系统主键（主应用 _id 的字符串形式，用于对账与同步）
    external_id = StringField(required=False, verbose_name='外部ID', unique=False)

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
        'indexes': [
            'external_id',
            'admin_username',
            'module',
            'action',
            'operation_time'
        ],
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

    # 跨系统主键（主应用 _id 的字符串形式）
    external_id = StringField(required=False, verbose_name='外部ID', unique=False)

    level = StringField(max_length=20, choices=LEVEL_CHOICES, required=True, verbose_name='日志级别')
    source = StringField(max_length=50, required=True, verbose_name='来源')
    message = StringField(required=True, verbose_name='日志消息')
    timestamp = DateTimeField(default=timezone.now, verbose_name='时间戳')

    meta = {
        'collection': 'system_logs',
        'ordering': ['-timestamp'],
        'indexes': [
            'external_id',
            'level',
            'source',
            'timestamp'
        ],
        'verbose_name': '系统日志',
        'verbose_name_plural': '系统日志'
    }

    def __str__(self):
        level_display = dict(self.LEVEL_CHOICES).get(self.level, self.level)
        return f"{level_display} - {self.source} - {self.timestamp}"


class LogExportHistory(Document):
    """日志导出历史记录"""
    FORMAT_CHOICES = (
        ('csv', 'CSV'),
        ('json', 'JSON'),
        ('excel', 'Excel'),
    )

    log_type = StringField(max_length=20, required=True, choices=[('system', '系统日志'), ('admin', '管理员日志')], verbose_name='日志类型')
    format = StringField(max_length=10, required=True, choices=FORMAT_CHOICES, verbose_name='导出格式')
    file_name = StringField(max_length=255, required=True, verbose_name='文件名')
    file_size = IntField(required=False, verbose_name='文件大小(字节)')
    record_count = IntField(required=False, default=0, verbose_name='记录数量')
    filter_params = DictField(required=False, verbose_name='筛选参数')
    created_by = StringField(max_length=150, required=True, verbose_name='创建者')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    download_url = StringField(required=False, verbose_name='下载链接')

    meta = {
        'collection': 'log_export_history',
        'ordering': ['-created_at'],
        'verbose_name': '日志导出历史',
        'verbose_name_plural': '日志导出历史'
    }

    def __str__(self):
        return f"{self.log_type} - {self.format} - {self.created_at}"


class LogBackup(Document):
    """日志备份记录。

    为什么新增：前端「日志导出」页（/logs/export，已挂载）会调用
    `getLogBackups()` -> `GET /logs/backup/`、`POST /logs/backup/`、
    `DELETE /logs/backup/{id}/`、`GET /logs/backup/{id}/download/`，
    但后端**此前完全没有这些路由**（logs/urls.py 只注册了 admin-logs、
    system-logs、export-history）。该页面因此一直报"获取备份列表失败"。

    说明：真正的备份文件生成涉及日志归档与存储，属于运维范畴；
    这里实现的是**备份记录的管理闭环**（创建记录、列表、删除、取得下载地址），
    与既有 LogExportHistory 的口径一致，也不谎称已经产出真实归档文件 ——
    download_url 在未生成文件时为空，前端据此提示。
    """
    log_type = StringField(max_length=20, required=True, default='all', verbose_name='日志类型')
    name = StringField(max_length=255, required=True, verbose_name='备份名称')
    description = StringField(max_length=500, required=False, verbose_name='备注')
    include_all = BooleanField(default=False, verbose_name='是否包含全部日志')
    start_time = StringField(max_length=32, required=False, verbose_name='起始时间')
    end_time = StringField(max_length=32, required=False, verbose_name='结束时间')
    record_count = IntField(default=0, verbose_name='记录数量')
    file_size = StringField(max_length=32, required=False, verbose_name='文件大小')
    download_url = StringField(max_length=500, required=False, verbose_name='下载地址')
    status = StringField(max_length=20, default='ready', verbose_name='状态')
    created_by = StringField(max_length=150, required=False, verbose_name='创建者')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')

    meta = {
        'collection': 'log_backups',
        'ordering': ['-created_at'],
        'verbose_name': '日志备份',
        'verbose_name_plural': '日志备份',
    }

    def __str__(self):
        return f"{self.name} ({self.log_type})"
