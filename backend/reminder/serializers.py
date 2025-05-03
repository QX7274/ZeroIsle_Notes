"""
提醒模块序列化器
"""

from rest_framework import serializers
from .mongodb_models import Reminder, ReminderNotification
from .models import Reminder as DjangoReminder


class ReminderSerializer(serializers.Serializer):
    """
    提醒序列化器
    使用MongoDB模型
    """
    id = serializers.UUIDField(read_only=True)
    user = serializers.UUIDField(source='user.id', read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)
    note = serializers.UUIDField(source='note.id', read_only=True, allow_null=True)
    note_title = serializers.CharField(source='note.title', read_only=True, allow_null=True)
    title = serializers.CharField(required=True, max_length=200)
    description = serializers.CharField(required=False, allow_blank=True)
    due_date = serializers.DateTimeField(required=True)
    priority = serializers.ChoiceField(
        choices=['low', 'medium', 'high'],
        default='medium',
        required=False
    )
    frequency = serializers.ChoiceField(
        choices=['once', 'daily', 'weekly', 'monthly', 'yearly'],
        default='once',
        required=False
    )
    is_completed = serializers.BooleanField(default=False, required=False)
    is_enabled = serializers.BooleanField(default=True, required=False)
    completed_at = serializers.DateTimeField(read_only=True, allow_null=True)
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)
    is_overdue = serializers.BooleanField(read_only=True)

    # 日历集成相关字段
    calendar_event_id = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    calendar_id = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    repeat_end_date = serializers.DateTimeField(required=False, allow_null=True)
    category = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    color = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    tags = serializers.CharField(required=False, allow_null=True, allow_blank=True)

    # 兼容旧版API的字段
    content = serializers.CharField(source='description', required=False, allow_blank=True)
    reminder_time = serializers.DateTimeField(source='due_date', required=False)
    status = serializers.SerializerMethodField()
    status_display = serializers.SerializerMethodField()

    def get_status(self, obj):
        """
        获取状态（兼容旧版API）
        """
        if obj.is_completed:
            return 'completed'
        return 'pending'

    def get_status_display(self, obj):
        """
        获取状态显示名称（兼容旧版API）
        """
        if obj.is_completed:
            return '已完成'
        return '待处理'


class ReminderNotificationSerializer(serializers.Serializer):
    """
    提醒通知序列化器
    使用MongoDB模型
    """
    id = serializers.UUIDField(read_only=True)
    reminder = serializers.UUIDField(source='reminder.id', read_only=True)
    reminder_title = serializers.CharField(source='reminder.title', read_only=True)
    status = serializers.ChoiceField(
        choices=['pending', 'sent', 'failed'],
        read_only=True
    )
    status_display = serializers.SerializerMethodField()
    scheduled_time = serializers.DateTimeField(read_only=True)
    sent_time = serializers.DateTimeField(read_only=True, allow_null=True)
    error_message = serializers.CharField(read_only=True, allow_null=True, allow_blank=True)
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)

    # 兼容旧版API的字段
    sent_at = serializers.DateTimeField(source='sent_time', read_only=True)

    def get_status_display(self, obj):
        """
        获取状态显示名称
        """
        status_map = {
            'pending': '待发送',
            'sent': '已发送',
            'failed': '发送失败'
        }
        return status_map.get(obj.status, obj.status)


class ReminderCalendarIntegrationSerializer(serializers.Serializer):
    """
    提醒日历集成序列化器
    """
    calendar_event_id = serializers.CharField(required=False, allow_null=True)
    calendar_id = serializers.CharField(required=False, allow_null=True)


class DjangoReminderSerializer(serializers.ModelSerializer):
    """
    Django提醒序列化器
    使用Django ORM模型
    """
    class Meta:
        model = DjangoReminder
        fields = '__all__'
        read_only_fields = ('id', 'user', 'created_at', 'updated_at')


class CalendarEventSerializer(serializers.Serializer):
    """
    日历事件序列化器
    """
    id = serializers.CharField()
    title = serializers.CharField()
    notes = serializers.CharField(required=False, allow_blank=True)
    startDate = serializers.DateTimeField()
    endDate = serializers.DateTimeField()
    allDay = serializers.BooleanField(default=False)
    location = serializers.CharField(required=False, allow_blank=True)
    url = serializers.URLField(required=False, allow_blank=True)
    recurrenceRule = serializers.DictField(required=False)


class CalendarSerializer(serializers.Serializer):
    """
    日历序列化器
    """
    id = serializers.CharField()
    title = serializers.CharField()
    color = serializers.CharField(required=False)
    entityType = serializers.CharField()
    source = serializers.DictField()
    name = serializers.CharField()
    ownerAccount = serializers.CharField(required=False, allow_blank=True)
    allowsModifications = serializers.BooleanField(default=True)
    allowedAvailabilities = serializers.ListField(child=serializers.CharField(), required=False)
    isPrimary = serializers.BooleanField(default=False, required=False)
    supportsAvailability = serializers.BooleanField(default=False, required=False)
