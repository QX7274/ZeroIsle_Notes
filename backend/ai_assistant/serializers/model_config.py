"""
模型配置序列化器
"""

from rest_framework import serializers
from ai_assistant.models import ModelConfig

class ModelConfigSerializer(serializers.ModelSerializer):
    """模型配置序列化器"""
    class Meta:
        model = ModelConfig
        fields = [
            'id', 'name', 'provider', 'description',
            'max_tokens', 'token_limit', 'default_temperature',
            'supports_functions', 'supports_vision',
            'price_per_1k_tokens_input', 'price_per_1k_tokens_output',
            'is_active', 'is_default', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
