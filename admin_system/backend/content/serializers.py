from rest_framework import serializers
from .models import NoteCategory, Tag, ContentReport

class NoteCategorySerializer(serializers.ModelSerializer):
    """笔记分类序列化器"""
    class Meta:
        model = NoteCategory
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']

class TagSerializer(serializers.ModelSerializer):
    """标签序列化器"""
    class Meta:
        model = Tag
        fields = '__all__'
        read_only_fields = ['id', 'created_at']

class ContentReportSerializer(serializers.ModelSerializer):
    """内容举报序列化器"""
    class Meta:
        model = ContentReport
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']

class ContentReportListSerializer(serializers.ModelSerializer):
    """内容举报列表序列化器"""
    reason_display = serializers.CharField(source='get_reason_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    
    class Meta:
        model = ContentReport
        fields = ['id', 'content_id', 'content_type', 'reporter_id', 'reason', 'reason_display', 'status', 'status_display', 'created_at']

class ContentReportUpdateSerializer(serializers.ModelSerializer):
    """内容举报更新序列化器"""
    class Meta:
        model = ContentReport
        fields = ['status', 'admin_comment']
