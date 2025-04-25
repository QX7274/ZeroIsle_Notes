"""
使用记录序列化器
"""

from rest_framework import serializers
from ai_assistant.models import UsageRecord
from users.serializers import UserSerializer

class UsageRecordSerializer(serializers.ModelSerializer):
    """使用记录序列化器"""
    user = UserSerializer(read_only=True)
    
    class Meta:
        model = UsageRecord
        fields = [
            'id', 'user', 'model', 'provider', 'conversation',
            'prompt_tokens', 'completion_tokens', 'total_tokens',
            'cost', 'created_at'
        ]
        read_only_fields = ['id', 'user', 'created_at']
