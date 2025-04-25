"""
提醒序列化器
"""

from rest_framework import serializers
from reminder.models import Reminder
from users.serializers import UserSerializer

class ReminderSerializer(serializers.ModelSerializer):
    """提醒基础序列化器"""
    class Meta:
        model = Reminder
        fields = [
            'id', 'title', 'description', 'due_date',
            'priority', 'frequency', 'is_completed', 'is_enabled',
            'note', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

class ReminderListSerializer(serializers.ModelSerializer):
    """提醒列表序列化器"""
    priority_display = serializers.CharField(source='get_priority_display', read_only=True)
    frequency_display = serializers.CharField(source='get_frequency_display', read_only=True)
    is_overdue = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = Reminder
        fields = [
            'id', 'title', 'due_date', 'priority', 'priority_display',
            'frequency', 'frequency_display', 'is_completed', 'is_enabled',
            'is_overdue', 'created_at'
        ]
        read_only_fields = ['id', 'priority_display', 'frequency_display', 'is_overdue', 'created_at']

class ReminderDetailSerializer(serializers.ModelSerializer):
    """提醒详情序列化器"""
    user = UserSerializer(read_only=True)
    priority_display = serializers.CharField(source='get_priority_display', read_only=True)
    frequency_display = serializers.CharField(source='get_frequency_display', read_only=True)
    is_overdue = serializers.BooleanField(read_only=True)
    next_occurrence = serializers.DateTimeField(source='get_next_occurrence', read_only=True)
    
    class Meta:
        model = Reminder
        fields = [
            'id', 'user', 'title', 'description', 'due_date',
            'priority', 'priority_display', 'frequency', 'frequency_display',
            'is_completed', 'is_enabled', 'is_overdue', 'next_occurrence',
            'note', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'user', 'priority_display', 'frequency_display', 'is_overdue', 'next_occurrence', 'created_at', 'updated_at']

class ReminderCreateSerializer(serializers.ModelSerializer):
    """提醒创建序列化器"""
    class Meta:
        model = Reminder
        fields = [
            'title', 'description', 'due_date',
            'priority', 'frequency', 'is_enabled', 'note'
        ]
    
    def create(self, validated_data):
        """创建提醒"""
        user = self.context['request'].user
        reminder = Reminder.objects.create(user=user, **validated_data)
        return reminder

class ReminderUpdateSerializer(serializers.ModelSerializer):
    """提醒更新序列化器"""
    class Meta:
        model = Reminder
        fields = [
            'title', 'description', 'due_date',
            'priority', 'frequency', 'is_completed', 'is_enabled', 'note'
        ]
