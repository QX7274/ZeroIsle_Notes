"""
提醒模块序列化器
"""

from rest_framework import serializers
from .models import Reminder, ReminderNotification


class ReminderSerializer(serializers.ModelSerializer):
    """
    提醒序列化器
    """
    username = serializers.SerializerMethodField()
    note_title = serializers.SerializerMethodField()
    status_display = serializers.SerializerMethodField()
    is_overdue = serializers.SerializerMethodField()
    
    class Meta:
        model = Reminder
        fields = [
            'id', 'user', 'username', 'note', 'note_title',
            'title', 'content', 'reminder_time', 'status',
            'status_display', 'created_at', 'updated_at', 'is_overdue'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_username(self, obj):
        """
        获取用户名
        """
        return obj.user.username
    
    def get_note_title(self, obj):
        """
        获取笔记标题
        """
        if obj.note:
            return obj.note.title
        return None
    
    def get_status_display(self, obj):
        """
        获取状态显示名称
        """
        return obj.get_status_display()
    
    def get_is_overdue(self, obj):
        """
        判断是否已过期
        """
        return obj.is_overdue


class ReminderNotificationSerializer(serializers.ModelSerializer):
    """
    提醒通知序列化器
    """
    reminder_title = serializers.SerializerMethodField()
    status_display = serializers.SerializerMethodField()
    
    class Meta:
        model = ReminderNotification
        fields = [
            'id', 'reminder', 'reminder_title', 'status',
            'status_display', 'sent_at', 'error_message',
            'created_at'
        ]
        read_only_fields = ['id', 'created_at']
    
    def get_reminder_title(self, obj):
        """
        获取提醒标题
        """
        return obj.reminder.title
    
    def get_status_display(self, obj):
        """
        获取状态显示名称
        """
        return obj.get_status_display()
