"""
提醒通知序列化器
"""

from rest_framework import serializers
from reminder.models import ReminderNotification
from reminder.serializers.reminder import ReminderSerializer

class ReminderNotificationSerializer(serializers.ModelSerializer):
    """提醒通知序列化器"""
    reminder = ReminderSerializer(read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    
    class Meta:
        model = ReminderNotification
        fields = [
            'id', 'reminder', 'scheduled_time', 'status',
            'status_display', 'sent_time', 'error_message',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'reminder', 'status_display', 'created_at', 'updated_at']
