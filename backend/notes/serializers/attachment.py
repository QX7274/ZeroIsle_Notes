"""
笔记附件序列化器
"""

from rest_framework import serializers
from notes.models import NoteAttachment


class NoteAttachmentSerializer(serializers.ModelSerializer):
    """
    笔记附件序列化器
    """
    file_size_display = serializers.SerializerMethodField()
    file_type_display = serializers.SerializerMethodField()
    
    class Meta:
        model = NoteAttachment
        fields = [
            'id', 'note', 'file', 'file_name', 'file_type', 'file_size',
            'file_size_display', 'file_type_display', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'file_size', 'file_type', 'created_at', 'updated_at']
    
    def get_file_size_display(self, obj):
        """
        格式化文件大小显示
        """
        size = obj.file_size
        if size < 1024:
            return f"{size} B"
        elif size < 1024 * 1024:
            return f"{size/1024:.1f} KB"
        elif size < 1024 * 1024 * 1024:
            return f"{size/(1024*1024):.1f} MB"
        else:
            return f"{size/(1024*1024*1024):.1f} GB"
    
    def get_file_type_display(self, obj):
        """
        获取文件类型显示名称
        """
        file_type = obj.file_type.lower()
        
        # 图片类型
        if file_type in ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg']:
            return '图片'
        # 文档类型
        elif file_type in ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'pdf', 'txt', 'md']:
            return '文档'
        # 音频类型
        elif file_type in ['mp3', 'wav', 'ogg', 'flac', 'aac']:
            return '音频'
        # 视频类型
        elif file_type in ['mp4', 'avi', 'mov', 'wmv', 'flv', 'mkv']:
            return '视频'
        # 压缩文件
        elif file_type in ['zip', 'rar', '7z', 'tar', 'gz']:
            return '压缩文件'
        # 其他类型
        else:
            return '其他'
