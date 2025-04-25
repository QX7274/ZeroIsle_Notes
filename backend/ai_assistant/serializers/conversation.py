"""
对话序列化器
"""

from rest_framework import serializers
from ai_assistant.models import Conversation, Message
from users.serializers import UserSerializer

class ConversationSerializer(serializers.ModelSerializer):
    """对话基础序列化器"""
    class Meta:
        model = Conversation
        fields = [
            'id', 'title', 'description', 'model', 'system_prompt',
            'temperature', 'max_tokens', 'is_pinned',
            'created_at', 'updated_at', 'last_message_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'last_message_at']

class ConversationListSerializer(serializers.ModelSerializer):
    """对话列表序列化器"""
    message_count = serializers.IntegerField(read_only=True)
    last_message = serializers.SerializerMethodField()
    
    class Meta:
        model = Conversation
        fields = [
            'id', 'title', 'model', 'is_pinned',
            'created_at', 'last_message_at', 'message_count', 'last_message'
        ]
        read_only_fields = ['id', 'created_at', 'last_message_at', 'message_count']
    
    def get_last_message(self, obj):
        """获取最后一条消息"""
        last_message = obj.messages.order_by('-created_at').first()
        if last_message:
            return {
                'role': last_message.role,
                'content': last_message.content[:100] + ('...' if len(last_message.content) > 100 else ''),
                'created_at': last_message.created_at
            }
        return None

class ConversationDetailSerializer(serializers.ModelSerializer):
    """对话详情序列化器"""
    user = UserSerializer(read_only=True)
    messages = serializers.SerializerMethodField()
    message_count = serializers.IntegerField(read_only=True)
    
    class Meta:
        model = Conversation
        fields = [
            'id', 'title', 'description', 'model', 'system_prompt',
            'temperature', 'max_tokens', 'is_pinned',
            'created_at', 'updated_at', 'last_message_at',
            'user', 'messages', 'message_count'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'last_message_at', 'user', 'messages', 'message_count']
    
    def get_messages(self, obj):
        """获取消息列表"""
        from .message import MessageSerializer
        messages = obj.messages.all()
        return MessageSerializer(messages, many=True).data
