"""
提醒模块序列化器定义文件
"""
from rest_framework import serializers

class ReminderCalendarIntegrationSerializer(serializers.Serializer):
    """
    提醒日历集成序列化器
    """
    calendar_event_id = serializers.CharField(required=False, allow_null=True)
    calendar_id = serializers.CharField(required=False, allow_null=True)