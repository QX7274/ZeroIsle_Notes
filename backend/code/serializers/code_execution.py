"""
代码执行序列化器
"""

from rest_framework import serializers
from code.models import CodeExecution
from users.serializers import UserSerializer

class CodeExecutionSerializer(serializers.ModelSerializer):
    """代码执行序列化器"""
    user = UserSerializer(read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    
    class Meta:
        model = CodeExecution
        fields = [
            'id', 'user', 'code', 'language', 'input_data',
            'output', 'error', 'execution_time', 'memory_usage',
            'status', 'status_display', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'output', 'error', 'execution_time', 'memory_usage', 'status', 'created_at', 'updated_at']

class CodeExecutionRequestSerializer(serializers.ModelSerializer):
    """代码执行请求序列化器"""
    class Meta:
        model = CodeExecution
        fields = ['code', 'language', 'input_data']

class CodeExecutionResponseSerializer(serializers.ModelSerializer):
    """代码执行响应序列化器"""
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    
    class Meta:
        model = CodeExecution
        fields = [
            'id', 'output', 'error', 'execution_time',
            'memory_usage', 'status', 'status_display'
        ]
        read_only_fields = ['id', 'output', 'error', 'execution_time', 'memory_usage', 'status', 'status_display']
