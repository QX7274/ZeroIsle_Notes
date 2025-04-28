"""
提醒序列化器
"""

from rest_framework import serializers
from reminder.mongodb_models import Reminder
from users.serializers import UserSerializer
from notes.serializers import NoteSerializer

class ReminderSerializer(serializers.Serializer):
    """提醒基础序列化器"""
    id = serializers.CharField(read_only=True)
    title = serializers.CharField(max_length=200)
    description = serializers.CharField(required=False, allow_blank=True)
    due_date = serializers.DateTimeField()
    priority = serializers.ChoiceField(choices=Reminder.PRIORITY_CHOICES, default='medium')
    frequency = serializers.ChoiceField(choices=Reminder.FREQUENCY_CHOICES, default='once')
    is_completed = serializers.BooleanField(default=False)
    is_enabled = serializers.BooleanField(default=True)
    note = serializers.CharField(required=False, allow_null=True)
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)
    completed_at = serializers.DateTimeField(read_only=True, required=False, allow_null=True)

class ReminderListSerializer(serializers.Serializer):
    """提醒列表序列化器"""
    id = serializers.CharField(read_only=True)
    title = serializers.CharField(max_length=200)
    due_date = serializers.DateTimeField()
    priority = serializers.ChoiceField(choices=Reminder.PRIORITY_CHOICES)
    priority_display = serializers.SerializerMethodField()
    frequency = serializers.ChoiceField(choices=Reminder.FREQUENCY_CHOICES)
    frequency_display = serializers.SerializerMethodField()
    is_completed = serializers.BooleanField()
    is_enabled = serializers.BooleanField()
    is_overdue = serializers.SerializerMethodField()
    created_at = serializers.DateTimeField()

    def get_priority_display(self, obj):
        """获取优先级显示名称"""
        return dict(Reminder.PRIORITY_CHOICES).get(obj.priority, '')

    def get_frequency_display(self, obj):
        """获取频率显示名称"""
        return dict(Reminder.FREQUENCY_CHOICES).get(obj.frequency, '')

    def get_is_overdue(self, obj):
        """是否已过期"""
        return obj.is_overdue

class ReminderDetailSerializer(serializers.Serializer):
    """提醒详情序列化器"""
    id = serializers.CharField(read_only=True)
    user = UserSerializer(read_only=True)
    title = serializers.CharField(max_length=200)
    description = serializers.CharField(required=False, allow_blank=True)
    due_date = serializers.DateTimeField()
    priority = serializers.ChoiceField(choices=Reminder.PRIORITY_CHOICES)
    priority_display = serializers.SerializerMethodField()
    frequency = serializers.ChoiceField(choices=Reminder.FREQUENCY_CHOICES)
    frequency_display = serializers.SerializerMethodField()
    is_completed = serializers.BooleanField()
    is_enabled = serializers.BooleanField()
    is_overdue = serializers.SerializerMethodField()
    next_occurrence = serializers.SerializerMethodField()
    note = serializers.CharField(required=False, allow_null=True)
    created_at = serializers.DateTimeField()
    updated_at = serializers.DateTimeField()
    completed_at = serializers.DateTimeField(required=False, allow_null=True)

    def get_priority_display(self, obj):
        """获取优先级显示名称"""
        return dict(Reminder.PRIORITY_CHOICES).get(obj.priority, '')

    def get_frequency_display(self, obj):
        """获取频率显示名称"""
        return dict(Reminder.FREQUENCY_CHOICES).get(obj.frequency, '')

    def get_is_overdue(self, obj):
        """是否已过期"""
        return obj.is_overdue

    def get_next_occurrence(self, obj):
        """获取下一次提醒时间"""
        return obj.get_next_occurrence()

class ReminderCreateSerializer(serializers.Serializer):
    """提醒创建序列化器"""
    title = serializers.CharField(max_length=200)
    description = serializers.CharField(required=False, allow_blank=True)
    due_date = serializers.DateTimeField()
    priority = serializers.ChoiceField(choices=Reminder.PRIORITY_CHOICES, default='medium')
    frequency = serializers.ChoiceField(choices=Reminder.FREQUENCY_CHOICES, default='once')
    is_enabled = serializers.BooleanField(default=True)
    note = serializers.CharField(required=False, allow_null=True)

    def validate(self, data):
        """验证数据"""
        # 可以添加自定义验证逻辑
        return data

class ReminderUpdateSerializer(serializers.Serializer):
    """提醒更新序列化器"""
    title = serializers.CharField(max_length=200, required=False)
    description = serializers.CharField(required=False, allow_blank=True)
    due_date = serializers.DateTimeField(required=False)
    priority = serializers.ChoiceField(choices=Reminder.PRIORITY_CHOICES, required=False)
    frequency = serializers.ChoiceField(choices=Reminder.FREQUENCY_CHOICES, required=False)
    is_completed = serializers.BooleanField(required=False)
    is_enabled = serializers.BooleanField(required=False)
    note = serializers.CharField(required=False, allow_null=True)

    def validate(self, data):
        """验证数据"""
        # 可以添加自定义验证逻辑
        return data
