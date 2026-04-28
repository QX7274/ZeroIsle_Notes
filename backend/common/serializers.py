"""
通用序列化器
"""

from rest_framework_mongoengine import serializers as mongo_serializers
from .mongodb_models import AsyncTask

class AsyncTaskSerializer(mongo_serializers.DocumentSerializer):
    """
    序列化通用的 AsyncTask 模型。
    """
    class Meta:
        model = AsyncTask
        fields = (
            'id', 
            'task_type', 
            'status', 
            'progress', 
            'result', 
            'error_details', 
            'created_at', 
            'updated_at'
        )
        read_only_fields = fields
