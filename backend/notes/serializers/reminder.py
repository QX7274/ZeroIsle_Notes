"""
笔记提醒序列化器
"""

from rest_framework import serializers
from notes.models import NoteReminder


class NoteReminderSerializer(serializers.ModelSerializer):
    """
    笔记提醒序列化器
    """
    username = serializers.SerializerMethodField()
    note_title = serializers.SerializerMethodField()
    reminder_type_display = serializers.SerializerMethodField()
    status_display = serializers.SerializerMethodField()
    is_overdue = serializers.SerializerMethodField()
    
    class Meta:
        model = NoteReminder
        fields = [
            'id', 'note', 'note_title', 'user', 'username', 'title',
            'content', 'reminder_time', 'reminder_type', 'reminder_type_display',
            'status', 'status_display', 'created_at', 'updated_at',
            'is_read', 'is_overdue'
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
        return obj.note.title
    
    def get_reminder_type_display(self, obj):
        """
        获取提醒类型显示名称
        """
        return obj.get_reminder_type_display()
    
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
