from mongoengine import Document, StringField, DateTimeField, DictField, BooleanField, IntField, ListField
from django.utils import timezone

class SyncRecord(Document):
    """同步记录模型"""
    SYNC_STATUS_CHOICES = (
        ('pending', '等待中'),
        ('in_progress', '同步中'),
        ('completed', '已完成'),
        ('failed', '失败'),
        ('cancelled', '已取消'),
    )
    
    SYNC_TYPE_CHOICES = (
        ('full', '全量同步'),
        ('incremental', '增量同步'),
        ('users', '用户同步'),
        ('notes', '笔记同步'),
        ('categories', '分类同步'),
        ('tags', '标签同步'),
    )
    
    sync_id = StringField(primary_key=True, required=True, verbose_name='同步ID')
    sync_type = StringField(max_length=20, choices=SYNC_TYPE_CHOICES, required=True, verbose_name='同步类型')
    status = StringField(max_length=20, choices=SYNC_STATUS_CHOICES, default='pending', verbose_name='同步状态')
    start_time = DateTimeField(default=timezone.now, verbose_name='开始时间')
    end_time = DateTimeField(verbose_name='结束时间')
    duration = IntField(verbose_name='持续时间(秒)')
    sync_options = DictField(verbose_name='同步选项')
    result_summary = DictField(verbose_name='结果摘要')
    error_message = StringField(verbose_name='错误信息')
    initiated_by = StringField(max_length=100, verbose_name='发起人')
    
    meta = {
        'collection': 'sync_records',
        'ordering': ['-start_time'],
        'indexes': [
            'sync_type',
            'status',
            'start_time',
            'initiated_by'
        ],
        'verbose_name': '同步记录',
        'verbose_name_plural': '同步记录'
    }
    
    def __str__(self):
        return f"{self.sync_id} - {self.sync_type} - {self.status}"

class SyncConfig(Document):
    """同步配置模型"""
    key = StringField(primary_key=True, required=True, verbose_name='配置键')
    value = StringField(required=True, verbose_name='配置值')
    description = StringField(verbose_name='描述')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')
    
    meta = {
        'collection': 'sync_configs',
        'ordering': ['key'],
        'verbose_name': '同步配置',
        'verbose_name_plural': '同步配置'
    }
    
    def __str__(self):
        return self.key

class SyncStatistics(Document):
    """同步统计模型"""
    date = DateTimeField(required=True, verbose_name='日期')
    total_syncs = IntField(default=0, verbose_name='同步总数')
    successful_syncs = IntField(default=0, verbose_name='成功同步数')
    failed_syncs = IntField(default=0, verbose_name='失败同步数')
    sync_duration_avg = IntField(default=0, verbose_name='平均同步时间(秒)')
    sync_types = DictField(verbose_name='同步类型统计')
    data_stats = DictField(verbose_name='数据统计')
    
    meta = {
        'collection': 'sync_statistics',
        'ordering': ['-date'],
        'verbose_name': '同步统计',
        'verbose_name_plural': '同步统计'
    }
    
    def __str__(self):
        return f"同步统计 - {self.date.strftime('%Y-%m-%d')}"
