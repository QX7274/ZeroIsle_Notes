"""
OCR序列化器
"""

from rest_framework import serializers
from notes.models import OCRModel, OCRTrainingData


class OCRModelSerializer(serializers.ModelSerializer):
    """
    OCR模型序列化器
    """
    model_type_display = serializers.SerializerMethodField()
    
    class Meta:
        model = OCRModel
        fields = [
            'id', 'name', 'model_type', 'model_type_display',
            'version', 'description', 'file_path',
            'created_at', 'updated_at', 'is_active'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_model_type_display(self, obj):
        """
        获取模型类型显示名称
        """
        return obj.get_model_type_display()


class OCRTrainingDataSerializer(serializers.ModelSerializer):
    """
    OCR训练数据序列化器
    """
    username = serializers.SerializerMethodField()
    model_name = serializers.SerializerMethodField()
    
    class Meta:
        model = OCRTrainingData
        fields = [
            'id', 'user', 'username', 'model', 'model_name',
            'image', 'text', 'created_at', 'is_verified'
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
