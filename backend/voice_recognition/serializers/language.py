"""
语言序列化器
"""

from rest_framework import serializers
from voice_recognition.models import Language

class LanguageSerializer(serializers.ModelSerializer):
    """语言序列化器"""
    class Meta:
        model = Language
        fields = [
            'id', 'code', 'name', 'native_name', 'is_active'
        ]
        read_only_fields = ['id']
