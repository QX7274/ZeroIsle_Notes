"""
代码请求序列化器
"""

from rest_framework import serializers

class CodeRequestSerializer(serializers.Serializer):
    """代码请求序列化器"""
    code = serializers.CharField()
    language = serializers.CharField()
    input = serializers.CharField(required=False, allow_blank=True)

class CodeResponseSerializer(serializers.Serializer):
    """代码响应序列化器"""
    output = serializers.CharField()
    error = serializers.CharField(required=False, allow_blank=True)
    execution_time = serializers.FloatField()
    memory_usage = serializers.FloatField()

class CodeDetectRequestSerializer(serializers.Serializer):
    """代码检测请求序列化器"""
    code = serializers.CharField()
    language = serializers.CharField(required=False, allow_blank=True)

class CodeDetectResponseSerializer(serializers.Serializer):
    """代码检测响应序列化器"""
    language = serializers.CharField()
    confidence = serializers.FloatField()
    alternatives = serializers.ListField(child=serializers.DictField())

class CodeCompleteRequestSerializer(serializers.Serializer):
    """代码补全请求序列化器"""
    code = serializers.CharField()
    language = serializers.CharField()
    cursor_position = serializers.IntegerField(required=False)
    max_suggestions = serializers.IntegerField(required=False, default=5)

class CodeCompleteResponseSerializer(serializers.Serializer):
    """代码补全响应序列化器"""
    completions = serializers.ListField(child=serializers.DictField())
    language = serializers.CharField()

class CodeFormatRequestSerializer(serializers.Serializer):
    """代码格式化请求序列化器"""
    code = serializers.CharField()
    language = serializers.CharField()
    style = serializers.CharField(required=False, allow_blank=True)

class CodeFormatResponseSerializer(serializers.Serializer):
    """代码格式化响应序列化器"""
    formatted_code = serializers.CharField()
    language = serializers.CharField()
    changes = serializers.IntegerField()

class CodeLintRequestSerializer(serializers.Serializer):
    """代码检查请求序列化器"""
    code = serializers.CharField()
    language = serializers.CharField()
    rules = serializers.ListField(child=serializers.CharField(), required=False)

class CodeLintResponseSerializer(serializers.Serializer):
    """代码检查响应序列化器"""
    issues = serializers.ListField(child=serializers.DictField())
    language = serializers.CharField()
    total_issues = serializers.IntegerField()
