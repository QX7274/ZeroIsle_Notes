"""
说话人序列化器
"""

from rest_framework import serializers
from voice_recognition.mongodb_models import Speaker
from users.serializers import UserSerializer

class SpeakerSerializer(serializers.ModelSerializer):
    """说话人序列化器"""
    user = UserSerializer(read_only=True)

    class Meta:
        model = Speaker
        fields = [
            'id', 'user', 'name', 'description',
            'voice_profile', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'user', 'created_at', 'updated_at']
