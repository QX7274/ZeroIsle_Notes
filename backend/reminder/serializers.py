"""提醒系统序列化器"""

from rest_framework import serializers
from .models import Reminder, ReminderNotification
from notes.serializers import NoteSerializer
from django.utils import timezone


class ReminderNotificationSerializer(serializers.ModelSerializer):
    """
    提醒通知序列化器
    """
    class Meta:
        model = ReminderNotification
        fields = ('id', 'notification_time', 'is_sent', 'created_at', 'updated_at')
        read_only_fields = ('id', 'created_at', 'updated_at')


class ReminderSerializer(serializers.ModelSerializer):
    """
    提醒序列化器
    """
    notifications = ReminderNotificationSerializer(many=True, read_only=True)
    note_detail = NoteSerializer(source='note', read_only=True)
    
    class Meta:
        model = Reminder
        fields = ('id', 'title', 'description', 'user', 'due_date', 'frequency',
                 'is_completed', 'created_at', 'updated_at')
        read_only_fields = ('user', 'created_at', 'updated_at')

    def validate_due_date(self, value):
        if value < serializers.DateTimeField().to_internal_value('now'):
            raise serializers.ValidationError("到期时间不能早于当前时间")
        return value


class ReminderCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Reminder
        fields = ('title', 'content', 'due_date', 'frequency', 'is_enabled')

    def validate_due_date(self, value):
        if value < timezone.now():
            raise serializers.ValidationError('到期时间不能早于当前时间')
        return value