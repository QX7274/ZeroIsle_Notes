"""
异步任务序列化器
"""

from rest_framework import serializers
from .models import AsyncTask

class AsyncTaskSerializer(serializers.ModelSerializer):
    """
    AsyncTask模型的序列化器。
    """
    class Meta:
        model = AsyncTask
        fields = '__all__'
        read_only_fields = ('id', 'task_name', 'user', 'created_at', 'updated_at')
