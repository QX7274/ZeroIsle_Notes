"""
提醒通知序列化器
"""

from rest_framework import serializers
from reminder.mongodb_models import ReminderNotification
from reminder.serializers.reminder import ReminderSerializer

class ReminderNotificationSerializer(serializers.Serializer):
    """提醒通知序列化器"""
    id = serializers.CharField(read_only=True)
    reminder = ReminderSerializer(read_only=True)
    scheduled_time = serializers.DateTimeField()
    status = serializers.ChoiceField(choices=ReminderNotification.STATUS_CHOICES)
    status_display = serializers.SerializerMethodField()
    sent_time = serializers.DateTimeField(required=False, allow_null=True)
    error_message = serializers.CharField(required=False, allow_blank=True)
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)

    def get_status_display(self, obj):
        """获取状态显示名称"""
        return dict(ReminderNotification.STATUS_CHOICES).get(obj.status, '')
