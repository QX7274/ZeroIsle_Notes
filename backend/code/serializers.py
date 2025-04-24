from rest_framework import serializers

class CodeRequestSerializer(serializers.Serializer):
    code = serializers.CharField()
    language = serializers.CharField()
    input = serializers.CharField(required=False, allow_blank=True)

class CodeResponseSerializer(serializers.Serializer):
    output = serializers.CharField()
    error = serializers.CharField(required=False, allow_blank=True)
    execution_time = serializers.FloatField()
    memory_usage = serializers.FloatField() 