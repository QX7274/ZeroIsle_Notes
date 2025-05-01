from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone

class AdminLog(models.Model):
    """管理员操作日志"""
    OPERATION_TYPES = (
        ('CREATE', '创建'),
        ('UPDATE', '更新'),
        ('DELETE', '删除'),
        ('LOGIN', '登录'),
        ('LOGOUT', '登出'),
        ('OTHER', '其他'),
    )
    
    admin = models.ForeignKey(User, on_delete=models.CASCADE, related_name='admin_logs', verbose_name='管理员')
    operation_type = models.CharField(max_length=20, choices=OPERATION_TYPES, verbose_name='操作类型')
    operation_detail = models.TextField(verbose_name='操作详情')
    ip_address = models.GenericIPAddressField(verbose_name='IP地址', null=True, blank=True)
    user_agent = models.TextField(verbose_name='用户代理', null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now, verbose_name='创建时间')
    
    class Meta:
        verbose_name = '管理员日志'
        verbose_name_plural = '管理员日志'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.admin.username} - {self.get_operation_type_display()} - {self.created_at}"

class SystemAnnouncement(models.Model):
    """系统公告"""
    STATUS_CHOICES = (
        ('DRAFT', '草稿'),
        ('PUBLISHED', '已发布'),
        ('EXPIRED', '已过期'),
    )
    
    title = models.CharField(max_length=200, verbose_name='标题')
    content = models.TextField(verbose_name='内容')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='DRAFT', verbose_name='状态')
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='announcements', verbose_name='创建者')
    created_at = models.DateTimeField(default=timezone.now, verbose_name='创建时间')
    published_at = models.DateTimeField(null=True, blank=True, verbose_name='发布时间')
    expired_at = models.DateTimeField(null=True, blank=True, verbose_name='过期时间')
    
    class Meta:
        verbose_name = '系统公告'
        verbose_name_plural = '系统公告'
        ordering = ['-created_at']
    
    def __str__(self):
        return self.title

class SystemSetting(models.Model):
    """系统设置"""
    key = models.CharField(max_length=100, unique=True, verbose_name='键')
    value = models.TextField(verbose_name='值')
    description = models.TextField(null=True, blank=True, verbose_name='描述')
    created_at = models.DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')
    
    class Meta:
        verbose_name = '系统设置'
        verbose_name_plural = '系统设置'
        ordering = ['key']
    
    def __str__(self):
        return self.key

class AdminRole(models.Model):
    """管理员角色"""
    name = models.CharField(max_length=100, unique=True, verbose_name='角色名称')
    description = models.TextField(null=True, blank=True, verbose_name='描述')
    permissions = models.JSONField(default=dict, verbose_name='权限')
    created_at = models.DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')
    
    class Meta:
        verbose_name = '管理员角色'
        verbose_name_plural = '管理员角色'
        ordering = ['name']
    
    def __str__(self):
        return self.name

class AdminUser(models.Model):
    """管理员用户"""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='admin_profile', verbose_name='用户')
    role = models.ForeignKey(AdminRole, on_delete=models.SET_NULL, null=True, related_name='admin_users', verbose_name='角色')
    avatar = models.URLField(null=True, blank=True, verbose_name='头像')
    phone = models.CharField(max_length=20, null=True, blank=True, verbose_name='手机号')
    last_login_ip = models.GenericIPAddressField(null=True, blank=True, verbose_name='最后登录IP')
    last_login_time = models.DateTimeField(null=True, blank=True, verbose_name='最后登录时间')
    is_active = models.BooleanField(default=True, verbose_name='是否激活')
    created_at = models.DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')
    
    class Meta:
        verbose_name = '管理员用户'
        verbose_name_plural = '管理员用户'
        ordering = ['-created_at']
    
    def __str__(self):
        return self.user.username

class SystemBackup(models.Model):
    """系统备份"""
    name = models.CharField(max_length=200, verbose_name='备份名称')
    file_path = models.CharField(max_length=500, verbose_name='文件路径')
    file_size = models.BigIntegerField(verbose_name='文件大小(字节)')
    backup_type = models.CharField(max_length=50, verbose_name='备份类型')
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='backups', verbose_name='创建者')
    created_at = models.DateTimeField(default=timezone.now, verbose_name='创建时间')
    
    class Meta:
        verbose_name = '系统备份'
        verbose_name_plural = '系统备份'
        ordering = ['-created_at']
    
    def __str__(self):
        return self.name
