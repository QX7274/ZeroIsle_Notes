"""
代码执行序列化器
"""

from rest_framework import serializers

from code.mongodb_models import CodeExecution
from users.serializers.mongo_auth import MongoUserSerializer


class CodeExecutionSerializer(serializers.Serializer):
    """Mongo 代码执行序列化器"""

    id = serializers.CharField(read_only=True)
    user = MongoUserSerializer(read_only=True)
    code = serializers.CharField()
    language = serializers.CharField(max_length=50)
    input_data = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    output = serializers.CharField(read_only=True, allow_blank=True)
    error = serializers.CharField(read_only=True, allow_blank=True)
    execution_time = serializers.FloatField(read_only=True)
    memory_usage = serializers.FloatField(read_only=True)
    status = serializers.CharField(read_only=True)
    status_display = serializers.SerializerMethodField()
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)

    def get_status_display(self, obj):
        status_map = dict(getattr(obj, 'STATUS_CHOICES', ()))
        return status_map.get(getattr(obj, 'status', ''), getattr(obj, 'status', ''))


class CodeExecutionRequestSerializer(serializers.Serializer):
    """代码执行请求序列化器"""

    code = serializers.CharField()
    language = serializers.CharField(max_length=50)
    input_data = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    input = serializers.CharField(required=False, allow_blank=True, allow_null=True)

    def validate(self, attrs):
        if 'input_data' not in attrs and 'input' in attrs:
            attrs['input_data'] = attrs.get('input')
        return attrs


class CodeExecutionResponseSerializer(serializers.Serializer):
    """代码执行响应序列化器"""

    id = serializers.CharField(read_only=True)
    output = serializers.CharField(read_only=True, allow_blank=True)
    error = serializers.CharField(read_only=True, allow_blank=True)
    execution_time = serializers.FloatField(read_only=True)
    memory_usage = serializers.FloatField(read_only=True)
    status = serializers.CharField(read_only=True)
    status_display = serializers.SerializerMethodField()

    def get_status_display(self, obj):
        status_map = dict(getattr(CodeExecution, 'STATUS_CHOICES', ()))
        return status_map.get(getattr(obj, 'status', ''), getattr(obj, 'status', ''))

