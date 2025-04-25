"""
反馈序列化器
"""

from rest_framework import serializers
from ai_assistant.models import Feedback
from users.serializers import UserSerializer

class FeedbackSerializer(serializers.ModelSerializer):
    """反馈序列化器"""
    user = UserSerializer(read_only=True)
    rating_display = serializers.CharField(source='get_rating_display', read_only=True)
    
    class Meta:
        model = Feedback
        fields = [
            'id', 'user', 'message', 'rating',
            'rating_display', 'comment', 'created_at'
        ]
        read_only_fields = ['id', 'user', 'created_at']
