from django.contrib import admin
from .models import AdminLog, SystemAnnouncement, SystemSetting, AdminRole, AdminUser, SystemBackup

@admin.register(AdminLog)
class AdminLogAdmin(admin.ModelAdmin):
    list_display = ('admin', 'operation_type', 'operation_detail', 'ip_address', 'created_at')
    list_filter = ('operation_type', 'created_at')
    search_fields = ('admin__username', 'operation_detail', 'ip_address')
    date_hierarchy = 'created_at'
    readonly_fields = ('admin', 'operation_type', 'operation_detail', 'ip_address', 'user_agent', 'created_at')

@admin.register(SystemAnnouncement)
class SystemAnnouncementAdmin(admin.ModelAdmin):
    list_display = ('title', 'status', 'created_by', 'created_at', 'published_at', 'expired_at')
    list_filter = ('status', 'created_at', 'published_at')
    search_fields = ('title', 'content', 'created_by__username')
    date_hierarchy = 'created_at'
    readonly_fields = ('created_by', 'created_at')

@admin.register(SystemSetting)
class SystemSettingAdmin(admin.ModelAdmin):
    list_display = ('key', 'value', 'description', 'updated_at')
    search_fields = ('key', 'value', 'description')
    readonly_fields = ('created_at', 'updated_at')

@admin.register(AdminRole)
class AdminRoleAdmin(admin.ModelAdmin):
    list_display = ('name', 'description', 'created_at', 'updated_at')
    search_fields = ('name', 'description')
    readonly_fields = ('created_at', 'updated_at')

@admin.register(AdminUser)
class AdminUserAdmin(admin.ModelAdmin):
    list_display = ('user', 'role', 'phone', 'is_active', 'last_login_time')
    list_filter = ('role', 'is_active', 'created_at')
    search_fields = ('user__username', 'user__email', 'phone')
    readonly_fields = ('last_login_ip', 'last_login_time', 'created_at', 'updated_at')

@admin.register(SystemBackup)
class SystemBackupAdmin(admin.ModelAdmin):
    list_display = ('name', 'backup_type', 'file_size', 'created_by', 'created_at')
    list_filter = ('backup_type', 'created_at')
    search_fields = ('name', 'created_by__username')
    readonly_fields = ('file_path', 'file_size', 'created_by', 'created_at')
