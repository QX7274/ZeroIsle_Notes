"""
通知序列化器
"""

from rest_framework import serializers
from notes.models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    """
    通知序列化器
    """
    username = serializers.SerializerMethodField()
    notification_type_display = serializers.SerializerMethodField()
    
    class Meta:
        model = Notification
        fields = [
            'id', 'user', 'username', 'title', 'content',
            'notification_type', 'notification_type_display',
            'related_id', 'related_type', 'created_at', 'is_read'
        ]
        read_only_fields = ['id', 'created_at']
    
    def get_username(self, obj):
        """
        获取用户名
        """
        return obj.user.username
    
    def get_notification_type_display(self, obj):
        """
        获取通知类型显示名称
        """
        return obj.get_notification_type_display()
