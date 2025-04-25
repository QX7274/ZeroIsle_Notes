"""
音频文件模型
"""

import os
from django.db import models
from django.contrib.auth import get_user_model
from common.models import UserOwnedModel, SoftDeleteModel

User = get_user_model()

def audio_file_path(instance, filename):
    """
    确定音频文件的存储路径
    
    Args:
        instance: AudioFile实例
        filename: 原始文件名
    
    Returns:
        str: 存储路径
    """
    # 获取文件扩展名
    ext = filename.split('.')[-1]
    # 使用用户ID和时间戳创建唯一文件名
    filename = f"{instance.user.id}_{instance.created_at.strftime('%Y%m%d%H%M%S')}.{ext}"
    # 返回存储路径
    return os.path.join('audio_files', str(instance.user.id), filename)

class AudioFile(UserOwnedModel, SoftDeleteModel):
    """
    音频文件模型
    存储用户上传的音频文件
    """
    AUDIO_TYPE_CHOICES = (
        ('recording', '录音'),
        ('upload', '上传'),
        ('url', 'URL'),
    )
    
    file = models.FileField(upload_to=audio_file_path, verbose_name='文件')
    file_name = models.CharField(max_length=255, verbose_name='文件名')
    file_size = models.IntegerField(verbose_name='文件大小(字节)')
    file_type = models.CharField(max_length=50, verbose_name='文件类型')
    duration = models.FloatField(default=0, verbose_name='时长(秒)')
    audio_type = models.CharField(max_length=20, choices=AUDIO_TYPE_CHOICES, default='upload', verbose_name='音频类型')
    source_url = models.URLField(blank=True, null=True, verbose_name='源URL')
    is_processed = models.BooleanField(default=False, verbose_name='是否已处理')
    
    class Meta:
        verbose_name = '音频文件'
        verbose_name_plural = '音频文件'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'is_deleted']),
            models.Index(fields=['is_processed']),
        ]
    
    def __str__(self):
        return self.file_name
    
    def delete(self, *args, **kwargs):
        """
        重写删除方法，同时删除文件
        """
        # 软删除记录
        super().delete(*args, **kwargs)
        
        # 如果需要硬删除文件
        if kwargs.get('delete_file', False):
            if self.file:
                if os.path.isfile(self.file.path):
                    os.remove(self.file.path)
    
    def hard_delete(self, delete_file=True):
        """
        硬删除方法，同时删除文件
        """
        # 删除文件
        if delete_file and self.file:
            if os.path.isfile(self.file.path):
                os.remove(self.file.path)
        
        # 硬删除记录
        super().hard_delete()
