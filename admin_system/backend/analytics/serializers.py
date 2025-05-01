from rest_framework import serializers
from .models import AnalyticsReport, DashboardWidget, ReportTemplate

class AnalyticsReportSerializer(serializers.ModelSerializer):
    """分析报表序列化器"""
    class Meta:
        model = AnalyticsReport
        fields = '__all__'

class AnalyticsReportListSerializer(serializers.ModelSerializer):
    """分析报表列表序列化器"""
    report_type_display = serializers.SerializerMethodField()
    
    class Meta:
        model = AnalyticsReport
        fields = ['id', 'title', 'description', 'report_type', 'report_type_display', 'created_by', 'created_at']
    
    def get_report_type_display(self, obj):
        return dict(AnalyticsReport.REPORT_TYPES).get(obj.report_type, obj.report_type)

class DashboardWidgetSerializer(serializers.ModelSerializer):
    """仪表盘小部件序列化器"""
    class Meta:
        model = DashboardWidget
        fields = '__all__'

class DashboardWidgetListSerializer(serializers.ModelSerializer):
    """仪表盘小部件列表序列化器"""
    widget_type_display = serializers.SerializerMethodField()
    
    class Meta:
        model = DashboardWidget
        fields = ['id', 'title', 'widget_type', 'widget_type_display', 'data_source', 'position', 'created_by']
    
    def get_widget_type_display(self, obj):
        return dict(DashboardWidget.WIDGET_TYPES).get(obj.widget_type, obj.widget_type)

class ReportTemplateSerializer(serializers.ModelSerializer):
    """报表模板序列化器"""
    class Meta:
        model = ReportTemplate
        fields = '__all__'

class ReportTemplateListSerializer(serializers.ModelSerializer):
    """报表模板列表序列化器"""
    template_type_display = serializers.SerializerMethodField()
    
    class Meta:
        model = ReportTemplate
        fields = ['id', 'title', 'description', 'template_type', 'template_type_display', 'is_system', 'created_by', 'created_at']
    
    def get_template_type_display(self, obj):
        return dict(ReportTemplate.REPORT_TYPES).get(obj.template_type, obj.template_type)
