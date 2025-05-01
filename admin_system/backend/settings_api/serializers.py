from rest_framework import serializers
from .models import SystemSetting, Announcement, SystemBackup

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


class SystemBackupSerializer(serializers.ModelSerializer):
    """系统备份序列化器"""
    file_size_display = serializers.SerializerMethodField()
    backup_type_display = serializers.SerializerMethodField()
    status_display = serializers.SerializerMethodField()

    class Meta:
        model = SystemBackup
        fields = '__all__'
        read_only_fields = ['id', 'file_size', 'file_size_display', 'status_display', 'backup_type_display', 'created_at', 'completed_at']

    def get_file_size_display(self, obj):
        return obj.get_file_size_display()

    def get_backup_type_display(self, obj):
        return dict(SystemBackup.BACKUP_TYPES).get(obj.backup_type, obj.backup_type)

    def get_status_display(self, obj):
        return dict(SystemBackup.STATUS_CHOICES).get(obj.status, obj.status)


class SystemBackupListSerializer(serializers.ModelSerializer):
    """系统备份列表序列化器"""
    file_size_display = serializers.SerializerMethodField()
    backup_type_display = serializers.SerializerMethodField()
    status_display = serializers.SerializerMethodField()

    class Meta:
        model = SystemBackup
        fields = ['id', 'name', 'backup_type', 'backup_type_display', 'status', 'status_display', 'file_size', 'file_size_display', 'is_auto', 'created_by', 'created_at', 'completed_at']

    def get_file_size_display(self, obj):
        return obj.get_file_size_display()

    def get_backup_type_display(self, obj):
        return dict(SystemBackup.BACKUP_TYPES).get(obj.backup_type, obj.backup_type)

    def get_status_display(self, obj):
        return dict(SystemBackup.STATUS_CHOICES).get(obj.status, obj.status)
