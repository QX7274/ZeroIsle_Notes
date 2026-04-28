"""
提醒序列化器
"""

from rest_framework import serializers
from django.utils import timezone
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
    description = serializers.CharField(required=False, allow_blank=True, default='')
    due_date = serializers.DateTimeField()
    priority = serializers.ChoiceField(choices=Reminder.PRIORITY_CHOICES, default='medium')
    frequency = serializers.ChoiceField(choices=Reminder.FREQUENCY_CHOICES, default='once')
    category = serializers.ChoiceField(choices=Reminder.CATEGORY_CHOICES, default='other', required=False)
    color = serializers.CharField(max_length=7, default='#3498db', required=False)
    tags = serializers.CharField(required=False, allow_blank=True, default='')
    is_enabled = serializers.BooleanField(default=True)
    note = serializers.CharField(required=False, allow_null=True)
    repeat_end_date = serializers.DateTimeField(required=False, allow_null=True)

    def validate_due_date(self, value):
        """验证到期时间不能早于当前时间"""
        if value < timezone.now():
            raise serializers.ValidationError("到期时间不能早于当前时间")
        return value

    def validate_repeat_end_date(self, value):
        """验证重复结束时间"""
        if value and value < timezone.now():
            raise serializers.ValidationError("重复结束时间不能早于当前时间")
        return value

    def validate(self, data):
        """验证数据"""
        # 验证重复结束时间必须晚于到期时间
        if data.get('repeat_end_date') and data.get('due_date'):
            if data['repeat_end_date'] <= data['due_date']:
                raise serializers.ValidationError({
                    'repeat_end_date': '重复结束时间必须晚于到期时间'
                })

        # 验证颜色格式
        if 'color' in data and data['color']:
            import re
            if not re.match(r'^#[0-9A-Fa-f]{6}$', data['color']):
                raise serializers.ValidationError({
                    'color': '颜色格式不正确，应为 #RRGGBB 格式'
                })

        return data

class ReminderUpdateSerializer(serializers.Serializer):
    """提醒更新序列化器"""
    title = serializers.CharField(max_length=200, required=False)
    description = serializers.CharField(required=False, allow_blank=True)
    due_date = serializers.DateTimeField(required=False)
    priority = serializers.ChoiceField(choices=Reminder.PRIORITY_CHOICES, required=False)
    frequency = serializers.ChoiceField(choices=Reminder.FREQUENCY_CHOICES, required=False)
    category = serializers.ChoiceField(choices=Reminder.CATEGORY_CHOICES, required=False)
    color = serializers.CharField(max_length=7, required=False)
    tags = serializers.CharField(required=False, allow_blank=True)
    is_completed = serializers.BooleanField(required=False)
    is_enabled = serializers.BooleanField(required=False)
    note = serializers.CharField(required=False, allow_null=True)
    repeat_end_date = serializers.DateTimeField(required=False, allow_null=True)

    def validate_due_date(self, value):
        """验证到期时间"""
        # 更新时允许设置过去的时间（用于修正错误）
        return value

    def validate_color(self, value):
        """验证颜色格式"""
        if value:
            import re
            if not re.match(r'^#[0-9A-Fa-f]{6}$', value):
                raise serializers.ValidationError('颜色格式不正确，应为 #RRGGBB 格式')
        return value

    def validate(self, data):
        """验证数据"""
        # 验证重复结束时间必须晚于到期时间
        if 'repeat_end_date' in data and 'due_date' in data:
            if data.get('repeat_end_date') and data.get('due_date'):
                if data['repeat_end_date'] <= data['due_date']:
                    raise serializers.ValidationError({
                        'repeat_end_date': '重复结束时间必须晚于到期时间'
                    })

        return data
