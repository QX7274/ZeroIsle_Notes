"""
通知序列化器
"""

from rest_framework import serializers
from community.mongodb_models import Notification
from users.serializers import UserSerializer

class NotificationSerializer(serializers.Serializer):
    """通知序列化器"""
    id = serializers.CharField(read_only=True)
    recipient = UserSerializer(read_only=True)
    sender = UserSerializer(read_only=True)
    notification_type = serializers.CharField(read_only=True)
    notification_type_display = serializers.SerializerMethodField()
    title = serializers.CharField(read_only=True)
    message = serializers.CharField(read_only=True)
    content_type = serializers.CharField(read_only=True)
    content_type_name = serializers.SerializerMethodField()
    object_id = serializers.CharField(read_only=True)
    is_read = serializers.BooleanField(default=False)
    created_at = serializers.DateTimeField(read_only=True)

    def get_notification_type_display(self, obj):
        """获取通知类型显示名称"""
        return dict(Notification.TYPE_CHOICES).get(obj.notification_type, '')

    def get_content_type_name(self, obj):
        """获取内容类型名称"""
        return obj.content_type.lower() if obj.content_type else ''
