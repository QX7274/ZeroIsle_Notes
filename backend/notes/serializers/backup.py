"""
笔记备份序列化器
"""

from rest_framework import serializers
from notes.models import NoteBackup


class NoteBackupSerializer(serializers.ModelSerializer):
    """
    笔记备份序列化器
    """
    username = serializers.SerializerMethodField()
    file_size_display = serializers.SerializerMethodField()
    backup_type_display = serializers.SerializerMethodField()
    
    class Meta:
        model = NoteBackup
        fields = [
            'id', 'user', 'username', 'backup_name', 'backup_type',
            'backup_type_display', 'backup_file', 'file_size',
            'file_size_display', 'notes_count', 'created_at',
            'description', 'is_encrypted'
        ]
        read_only_fields = ['id', 'created_at', 'file_size', 'notes_count']
    
    def get_username(self, obj):
        """
        获取用户名
        """
        return obj.user.username
    
    def get_file_size_display(self, obj):
        """
        获取格式化的文件大小
        """
        return obj.file_size_display
    
    def get_backup_type_display(self, obj):
        """
        获取备份类型显示名称
        """
        return obj.get_backup_type_display()
