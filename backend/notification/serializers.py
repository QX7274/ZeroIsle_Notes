"""
通知序列化器
"""

from rest_framework import serializers
from .mongodb_models import Notification

class NotificationSerializer(serializers.Serializer):
    """通知序列化器"""
    id = serializers.UUIDField(read_only=True)
    recipient_id = serializers.UUIDField(source='recipient.id', read_only=True)
    recipient_username = serializers.CharField(source='recipient.username', read_only=True)
    sender_id = serializers.UUIDField(source='sender.id', read_only=True, allow_null=True)
    sender_username = serializers.CharField(source='sender.username', read_only=True, allow_null=True)
    notification_type = serializers.CharField(read_only=True)
    title = serializers.CharField(read_only=True)
    message = serializers.CharField(read_only=True)
    is_read = serializers.BooleanField(read_only=True)
    is_sent = serializers.BooleanField(read_only=True)
    read_at = serializers.DateTimeField(read_only=True)
    sent_at = serializers.DateTimeField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)
    
    # 关联对象信息
    related_object_id = serializers.SerializerMethodField()
    related_object_type = serializers.SerializerMethodField()
    
    def get_related_object_id(self, obj):
        """获取关联对象ID"""
        if obj.related_object:
            return str(obj.related_object.id)
        return None
    
    def get_related_object_type(self, obj):
        """获取关联对象类型"""
        if obj.related_object:
            return obj.related_object._class_name
        return None
