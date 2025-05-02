from rest_framework import serializers
from .models import AdminOperationLog, SystemLog, LogExportHistory

class AdminOperationLogSerializer(serializers.ModelSerializer):
    """管理员操作日志序列化器"""
    action_display = serializers.CharField(source='get_action_display', read_only=True)

    class Meta:
        model = AdminOperationLog
        fields = '__all__'
        read_only_fields = ['id', 'operation_time']

class SystemLogSerializer(serializers.ModelSerializer):
    """系统日志序列化器"""
    level_display = serializers.CharField(source='get_level_display', read_only=True)

    class Meta:
        model = SystemLog
        fields = '__all__'
        read_only_fields = ['id', 'timestamp']


class LogExportHistorySerializer(serializers.ModelSerializer):
    """日志导出历史记录序列化器"""
    log_type_display = serializers.SerializerMethodField()
    format_display = serializers.SerializerMethodField()

    class Meta:
        model = LogExportHistory
        fields = '__all__'
        read_only_fields = ['id', 'created_at']

    def get_log_type_display(self, obj):
        """获取日志类型显示名称"""
        log_type_map = {
            'system': '系统日志',
            'admin': '管理员日志'
        }
        return log_type_map.get(obj.log_type, obj.log_type)

    def get_format_display(self, obj):
        """获取格式显示名称"""
        format_map = {
            'csv': 'CSV',
            'json': 'JSON',
            'excel': 'Excel'
        }
        return format_map.get(obj.format, obj.format)
