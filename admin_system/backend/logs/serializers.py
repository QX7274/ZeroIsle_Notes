from rest_framework import serializers
from .models import AdminOperationLog, SystemLog

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
