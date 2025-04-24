from rest_framework import serializers
from .models import SystemSetting, Announcement

class SystemSettingSerializer(serializers.ModelSerializer):
    """系统设置序列化器"""
    class Meta:
        model = SystemSetting
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']

class AnnouncementSerializer(serializers.ModelSerializer):
    """系统公告序列化器"""
    class Meta:
        model = Announcement
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']

class AnnouncementListSerializer(serializers.ModelSerializer):
    """系统公告列表序列化器"""
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    
    class Meta:
        model = Announcement
        fields = ['id', 'title', 'status', 'status_display', 'start_time', 'end_time', 'created_by', 'created_at']
