from mongoengine import Document, StringField, DateTimeField, DictField, BooleanField
from django.utils import timezone

class AnalyticsReport(Document):
    """分析报表模型"""
    REPORT_TYPES = (
        ('user', '用户分析'),
        ('content', '内容分析'),
        ('system', '系统分析'),
        ('custom', '自定义分析'),
    )

    title = StringField(max_length=100, required=True, verbose_name='报表标题')
    description = StringField(required=False, verbose_name='报表描述')
    report_type = StringField(max_length=20, choices=REPORT_TYPES, required=True, verbose_name='报表类型')
    parameters = DictField(default={}, verbose_name='报表参数')
    result_data = DictField(default={}, verbose_name='报表数据')
    created_by = StringField(max_length=50, required=True, verbose_name='创建者')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')

    meta = {
        'collection': 'analytics_reports',
        'ordering': ['-created_at'],
        'verbose_name': '分析报表',
        'verbose_name_plural': '分析报表'
    }

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        self.updated_at = timezone.now()
        return super(AnalyticsReport, self).save(*args, **kwargs)

class DashboardWidget(Document):
    """仪表盘小部件模型"""
    WIDGET_TYPES = (
        ('line_chart', '折线图'),
        ('bar_chart', '柱状图'),
        ('pie_chart', '饼图'),
        ('table', '表格'),
        ('counter', '计数器'),
        ('gauge', '仪表盘'),
        ('card', '卡片'),
    )

    title = StringField(max_length=100, required=True, verbose_name='小部件标题')
    widget_type = StringField(max_length=20, choices=WIDGET_TYPES, required=True, verbose_name='小部件类型')
    data_source = StringField(max_length=100, required=True, verbose_name='数据源')
    parameters = DictField(default={}, verbose_name='小部件参数')
    position = DictField(default={}, verbose_name='位置信息')
    created_by = StringField(max_length=50, required=True, verbose_name='创建者')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')

    meta = {
        'collection': 'dashboard_widgets',
        'ordering': ['position'],
        'verbose_name': '仪表盘小部件',
        'verbose_name_plural': '仪表盘小部件'
    }

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        self.updated_at = timezone.now()
        return super(DashboardWidget, self).save(*args, **kwargs)

class ReportTemplate(Document):
    """报表模板模型"""
    title = StringField(max_length=100, required=True, verbose_name='模板标题')
    description = StringField(required=False, verbose_name='模板描述')
    template_type = StringField(max_length=20, choices=AnalyticsReport.REPORT_TYPES, required=True, verbose_name='模板类型')
    template_config = DictField(default={}, verbose_name='模板配置')
    is_system = BooleanField(default=False, verbose_name='是否系统模板')
    created_by = StringField(max_length=50, required=True, verbose_name='创建者')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')

    meta = {
        'collection': 'report_templates',
        'ordering': ['-created_at'],
        'verbose_name': '报表模板',
        'verbose_name_plural': '报表模板'
    }

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        self.updated_at = timezone.now()
        return super(ReportTemplate, self).save(*args, **kwargs)
