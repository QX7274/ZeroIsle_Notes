"""
消息序列化器
"""

from rest_framework import serializers
from ai_assistant.models import Message

class MessageSerializer(serializers.ModelSerializer):
    """消息序列化器"""
    class Meta:
        model = Message
        fields = [
            'id', 'conversation', 'role', 'content',
            'tokens', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']
