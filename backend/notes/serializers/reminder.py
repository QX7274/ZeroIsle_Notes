"""
笔记提醒序列化器
"""

from rest_framework import serializers
from django.utils import timezone
from notes.mongodb_models import NoteReminder


class NoteReminderSerializer(serializers.Serializer):
    """
    笔记提醒序列化器
    """
    id = serializers.UUIDField(read_only=True)
    note = serializers.UUIDField(source='note.id')
    note_title = serializers.CharField(source='note.title', read_only=True)
    user = serializers.UUIDField(source='user.id', read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)
    title = serializers.CharField(max_length=255)
    content = serializers.CharField(required=False, allow_blank=True)
    reminder_time = serializers.DateTimeField()
    reminder_type = serializers.ChoiceField(
        choices=['once', 'daily', 'weekly', 'monthly', 'yearly'],
        default='once'
    )
    status = serializers.ChoiceField(
        choices=['pending', 'completed', 'cancelled'],
        default='pending'
    )
    is_read = serializers.BooleanField(default=False)
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)

    # 计算字段
    reminder_type_display = serializers.SerializerMethodField()
    status_display = serializers.SerializerMethodField()
    is_overdue = serializers.SerializerMethodField()

    def get_reminder_type_display(self, obj):
        """
        获取提醒类型显示名称
        """
        type_map = {
            'once': '一次性',
            'daily': '每天',
            'weekly': '每周',
            'monthly': '每月',
            'yearly': '每年'
        }
        return type_map.get(obj.reminder_type, obj.reminder_type)

    def get_status_display(self, obj):
        """
        获取状态显示名称
        """
        status_map = {
            'pending': '待处理',
            'completed': '已完成',
            'cancelled': '已取消'
        }
        return status_map.get(obj.status, obj.status)

    def get_is_overdue(self, obj):
        """
        判断是否已过期
        """
        return obj.reminder_time < timezone.now() and obj.status == 'pending'
