from django.db import models
from django.utils import timezone

class AnalyticsReport(models.Model):
    """分析报表模型"""
    REPORT_TYPES = (
        ('user', '用户分析'),
        ('content', '内容分析'),
        ('system', '系统分析'),
        ('custom', '自定义分析'),
    )
    
    title = models.CharField(max_length=100, verbose_name='报表标题')
    description = models.TextField(blank=True, null=True, verbose_name='报表描述')
    report_type = models.CharField(max_length=20, choices=REPORT_TYPES, verbose_name='报表类型')
    parameters = models.JSONField(default=dict, verbose_name='报表参数')
    result_data = models.JSONField(default=dict, verbose_name='报表数据')
    created_by = models.CharField(max_length=50, verbose_name='创建者')
    created_at = models.DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')
    
    class Meta:
        verbose_name = '分析报表'
        verbose_name_plural = '分析报表'
        ordering = ['-created_at']
    
    def __str__(self):
        return self.title

class DashboardWidget(models.Model):
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
    
    title = models.CharField(max_length=100, verbose_name='小部件标题')
    widget_type = models.CharField(max_length=20, choices=WIDGET_TYPES, verbose_name='小部件类型')
    data_source = models.CharField(max_length=100, verbose_name='数据源')
    parameters = models.JSONField(default=dict, verbose_name='小部件参数')
    position = models.JSONField(default=dict, verbose_name='位置信息')
    created_by = models.CharField(max_length=50, verbose_name='创建者')
    created_at = models.DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')
    
    class Meta:
        verbose_name = '仪表盘小部件'
        verbose_name_plural = '仪表盘小部件'
        ordering = ['position']
    
    def __str__(self):
        return self.title

class ReportTemplate(models.Model):
    """报表模板模型"""
    title = models.CharField(max_length=100, verbose_name='模板标题')
    description = models.TextField(blank=True, null=True, verbose_name='模板描述')
    template_type = models.CharField(max_length=20, choices=AnalyticsReport.REPORT_TYPES, verbose_name='模板类型')
    template_config = models.JSONField(default=dict, verbose_name='模板配置')
    is_system = models.BooleanField(default=False, verbose_name='是否系统模板')
    created_by = models.CharField(max_length=50, verbose_name='创建者')
    created_at = models.DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')
    
    class Meta:
        verbose_name = '报表模板'
        verbose_name_plural = '报表模板'
        ordering = ['-created_at']
    
    def __str__(self):
        return self.title
