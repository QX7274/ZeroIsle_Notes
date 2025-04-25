"""
提示词模板序列化器
"""

from rest_framework import serializers
from ai_assistant.models import PromptTemplate
from users.serializers import UserSerializer

class PromptTemplateSerializer(serializers.ModelSerializer):
    """提示词模板基础序列化器"""
    class Meta:
        model = PromptTemplate
        fields = [
            'id', 'title', 'description', 'content',
            'category', 'tags', 'variables', 'usage_count',
            'is_public', 'is_featured', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'variables', 'usage_count', 'is_featured', 'created_at', 'updated_at']

class PromptTemplateListSerializer(serializers.ModelSerializer):
    """提示词模板列表序列化器"""
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    user = UserSerializer(read_only=True)
    
    class Meta:
        model = PromptTemplate
        fields = [
            'id', 'title', 'description', 'category',
            'category_display', 'tags', 'usage_count',
            'is_public', 'is_featured', 'user', 'created_at'
        ]
        read_only_fields = ['id', 'usage_count', 'is_featured', 'created_at']

class PromptTemplateDetailSerializer(serializers.ModelSerializer):
    """提示词模板详情序列化器"""
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    user = UserSerializer(read_only=True)
    
    class Meta:
        model = PromptTemplate
        fields = [
            'id', 'title', 'description', 'content',
            'category', 'category_display', 'tags', 'variables',
            'usage_count', 'is_public', 'is_featured',
            'user', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'variables', 'usage_count', 'is_featured', 'created_at', 'updated_at']
