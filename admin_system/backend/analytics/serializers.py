from rest_framework import serializers
from common.serializers import MongoDocumentSerializer
from .models import AnalyticsReport, DashboardWidget, ReportTemplate

class AnalyticsReportSerializer(MongoDocumentSerializer):
    """分析报表序列化器"""
    class Meta:
        model = AnalyticsReport
        fields = '__all__'

class AnalyticsReportListSerializer(MongoDocumentSerializer):
    """分析报表列表序列化器"""
    report_type_display = serializers.SerializerMethodField()
    
    class Meta:
        model = AnalyticsReport
        fields = ['id', 'title', 'description', 'report_type', 'report_type_display', 'created_by', 'created_at']
    
    def get_report_type_display(self, obj):
        return dict(AnalyticsReport.REPORT_TYPES).get(obj.report_type, obj.report_type)

class DashboardWidgetSerializer(MongoDocumentSerializer):
    """仪表盘小部件序列化器"""
    class Meta:
        model = DashboardWidget
        fields = '__all__'

class DashboardWidgetListSerializer(MongoDocumentSerializer):
    """仪表盘小部件列表序列化器"""
    widget_type_display = serializers.SerializerMethodField()
    
    class Meta:
        model = DashboardWidget
        fields = ['id', 'title', 'widget_type', 'widget_type_display', 'data_source', 'position', 'created_by']
    
    def get_widget_type_display(self, obj):
        return dict(DashboardWidget.WIDGET_TYPES).get(obj.widget_type, obj.widget_type)

class ReportTemplateSerializer(MongoDocumentSerializer):
    """报表模板序列化器"""
    class Meta:
        model = ReportTemplate
        fields = '__all__'

class ReportTemplateListSerializer(MongoDocumentSerializer):
    """报表模板列表序列化器"""
    template_type_display = serializers.SerializerMethodField()
    
    class Meta:
        model = ReportTemplate
        fields = ['id', 'title', 'description', 'template_type', 'template_type_display', 'is_system', 'created_by', 'created_at']
    
    def get_template_type_display(self, obj):
        # 修正：REPORT_TYPES 定义在 AnalyticsReport 上，不在 ReportTemplate 上。
        # 原写法 ReportTemplate.REPORT_TYPES 会抛
        #   AttributeError: type object 'ReportTemplate' has no attribute 'REPORT_TYPES'
        # 而它位于 SerializerMethodField 内，因此**该接口每次请求都 500**。
        # 模型层 template_type 的 choices 用的也是 AnalyticsReport.REPORT_TYPES
        # （见 analytics/models.py:81），此处与之对齐。
        return dict(AnalyticsReport.REPORT_TYPES).get(
            obj.template_type, obj.template_type
        )
