"""
通知序列化器
"""

from rest_framework import serializers
from notification.mongodb_models import Notification


class NotificationSerializer(serializers.Serializer):
    """
    通知序列化器
    """
    id = serializers.UUIDField(read_only=True)
    recipient = serializers.UUIDField(source='recipient.id', read_only=True)
    username = serializers.CharField(source='recipient.username', read_only=True)
    sender = serializers.UUIDField(source='sender.id', read_only=True, allow_null=True)
    sender_username = serializers.CharField(source='sender.username', read_only=True, allow_null=True)
    title = serializers.CharField(max_length=255)
    message = serializers.CharField()
    notification_type = serializers.CharField(max_length=20)
    is_read = serializers.BooleanField(default=False)
    is_sent = serializers.BooleanField(default=False)
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)

    # 兼容旧版API
    user = serializers.UUIDField(source='recipient.id', read_only=True)
    content = serializers.CharField(source='message')
    related_id = serializers.SerializerMethodField()
    related_type = serializers.SerializerMethodField()
    notification_type_display = serializers.SerializerMethodField()

    def get_related_id(self, obj):
        """
        获取关联对象ID
        """
        if obj.related_object:
            return str(obj.related_object.id)
        return None

    def get_related_type(self, obj):
        """
        获取关联对象类型
        """
        if obj.related_object:
            return obj.related_object._class_name
        return None

    def get_notification_type_display(self, obj):
        """
        获取通知类型显示名称
        """
        type_map = {
            'system': '系统通知',
            'note': '笔记通知',
            'comment': '评论通知',
            'share': '分享通知',
            'collaboration': '协作通知',
            'reminder': '提醒通知',
            'like': '点赞通知',
            'reply': '回复通知',
            'follow': '关注通知',
            'mention': '提及通知',
        }
        return type_map.get(obj.notification_type, obj.notification_type)
