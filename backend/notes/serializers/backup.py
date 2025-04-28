"""
笔记备份序列化器
"""

from rest_framework import serializers
from notes.mongodb_models import NoteBackup


class NoteBackupSerializer(serializers.Serializer):
    """
    笔记备份序列化器
    """
    id = serializers.UUIDField(read_only=True)
    user = serializers.UUIDField(source='user.id', read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)
    file_name = serializers.CharField(max_length=255, required=True)
    backup_file = serializers.FileField(required=True)
    backup_type = serializers.ChoiceField(choices=['manual', 'auto'], default='manual')
    backup_type_display = serializers.SerializerMethodField()
    file_size = serializers.IntegerField(read_only=True)
    file_size_display = serializers.SerializerMethodField()
    notes_count = serializers.IntegerField(read_only=True)
    description = serializers.CharField(max_length=500, required=False, allow_blank=True)
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)
    is_deleted = serializers.BooleanField(default=False, read_only=True)

    def get_file_size_display(self, obj):
        """
        获取格式化的文件大小
        """
        if not obj.file_size:
            return '0 B'

        size = obj.file_size
        for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
            if size < 1024.0:
                return f"{size:.2f} {unit}"
            size /= 1024.0
        return f"{size:.2f} PB"

    def get_backup_type_display(self, obj):
        """
        获取备份类型显示名称
        """
        type_map = {
            'manual': '手动备份',
            'auto': '自动备份'
        }
        return type_map.get(obj.backup_type, obj.backup_type)

    def create(self, validated_data):
        """
        创建备份
        """
        from django.utils import timezone
        import uuid

        user = self.context['request'].user

        backup = NoteBackup(
            id=uuid.uuid4(),
            user=user,
            file_name=validated_data.get('file_name'),
            backup_type=validated_data.get('backup_type', 'manual'),
            description=validated_data.get('description', ''),
            created_at=timezone.now(),
            updated_at=timezone.now()
        )

        # 处理文件上传
        backup_file = validated_data.get('backup_file')
        if backup_file:
            backup.backup_file.put(backup_file, content_type=backup_file.content_type)
            backup.file_size = backup_file.size

        backup.save()
        return backup
