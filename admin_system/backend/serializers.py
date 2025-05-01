from rest_framework import serializers
from django.contrib.auth.models import User
from .models import AdminLog, SystemAnnouncement, SystemSetting, AdminRole, AdminUser, SystemBackup

class UserSerializer(serializers.ModelSerializer):
    """用户序列化器"""
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'is_active', 'date_joined', 'last_login']
        read_only_fields = ['date_joined', 'last_login']

class AdminLogSerializer(serializers.ModelSerializer):
    """管理员日志序列化器"""
    admin_username = serializers.CharField(source='admin.username', read_only=True)
    
    class Meta:
        model = AdminLog
        fields = ['id', 'admin', 'admin_username', 'operation_type', 'operation_detail', 'ip_address', 'user_agent', 'created_at']
        read_only_fields = ['created_at']

class SystemAnnouncementSerializer(serializers.ModelSerializer):
    """系统公告序列化器"""
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)
    
    class Meta:
        model = SystemAnnouncement
        fields = ['id', 'title', 'content', 'status', 'created_by', 'created_by_username', 'created_at', 'published_at', 'expired_at']
        read_only_fields = ['created_at', 'created_by']

class SystemSettingSerializer(serializers.ModelSerializer):
    """系统设置序列化器"""
    class Meta:
        model = SystemSetting
        fields = ['id', 'key', 'value', 'description', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']

class AdminRoleSerializer(serializers.ModelSerializer):
    """管理员角色序列化器"""
    class Meta:
        model = AdminRole
        fields = ['id', 'name', 'description', 'permissions', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']

class AdminUserSerializer(serializers.ModelSerializer):
    """管理员用户序列化器"""
    username = serializers.CharField(source='user.username', read_only=True)
    email = serializers.CharField(source='user.email', read_only=True)
    role_name = serializers.CharField(source='role.name', read_only=True)
    
    class Meta:
        model = AdminUser
        fields = ['id', 'user', 'username', 'email', 'role', 'role_name', 'avatar', 'phone', 'last_login_ip', 'last_login_time', 'is_active', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at', 'last_login_ip', 'last_login_time']

class SystemBackupSerializer(serializers.ModelSerializer):
    """系统备份序列化器"""
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)
    
    class Meta:
        model = SystemBackup
        fields = ['id', 'name', 'file_path', 'file_size', 'backup_type', 'created_by', 'created_by_username', 'created_at']
        read_only_fields = ['created_at', 'created_by']

class DashboardStatsSerializer(serializers.Serializer):
    """仪表盘统计数据序列化器"""
    total_users = serializers.IntegerField()
    total_notes = serializers.IntegerField()
    total_tags = serializers.IntegerField()
    total_comments = serializers.IntegerField()
    today_new_users = serializers.IntegerField()
    today_new_notes = serializers.IntegerField()
    user_growth_data = serializers.DictField()
    user_activity_data = serializers.DictField()
    content_distribution = serializers.DictField()
    system_status = serializers.DictField()
    recent_users = serializers.ListField()
