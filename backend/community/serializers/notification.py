"""
通知序列化器
"""

from rest_framework import serializers
from community.models import Notification
from users.serializers import UserSerializer

class NotificationSerializer(serializers.ModelSerializer):
    """通知序列化器"""
    recipient = UserSerializer(read_only=True)
    sender = UserSerializer(read_only=True)
    notification_type_display = serializers.CharField(source='get_notification_type_display', read_only=True)
    content_type_name = serializers.CharField(source='content_type.model', read_only=True)
    
    class Meta:
        model = Notification
        fields = [
            'id', 'recipient', 'sender', 'notification_type',
            'notification_type_display', 'title', 'message',
            'content_type', 'content_type_name', 'object_id',
            'is_read', 'created_at'
        ]
        read_only_fields = ['id', 'recipient', 'sender', 'notification_type', 'notification_type_display', 'title', 'message', 'content_type', 'content_type_name', 'object_id', 'created_at']
