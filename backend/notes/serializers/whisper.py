"""
Whisper序列化器
"""

from rest_framework import serializers
from notes.models import WhisperModel, WhisperTrainingData


class WhisperModelSerializer(serializers.ModelSerializer):
    """
    Whisper模型序列化器
    """
    model_size_display = serializers.SerializerMethodField()
    
    class Meta:
        model = WhisperModel
        fields = [
            'id', 'name', 'model_size', 'model_size_display',
            'version', 'description', 'file_path',
            'created_at', 'updated_at', 'is_active'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_model_size_display(self, obj):
        """
        获取模型大小显示名称
        """
        return obj.get_model_size_display()


class WhisperTrainingDataSerializer(serializers.ModelSerializer):
    """
    Whisper训练数据序列化器
    """
    username = serializers.SerializerMethodField()
    model_name = serializers.SerializerMethodField()
    
    class Meta:
        model = WhisperTrainingData
        fields = [
            'id', 'user', 'username', 'model', 'model_name',
            'audio', 'text', 'language', 'created_at', 'is_verified'
        ]
        read_only_fields = ['id', 'created_at']
    
    def get_username(self, obj):
        """
        获取用户名
        """
        return obj.user.username
    
    def get_model_name(self, obj):
        """
        获取模型名称
        """
        return obj.model.name
