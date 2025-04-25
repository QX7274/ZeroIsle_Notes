"""
转录模型
"""

from django.db import models
from django.contrib.auth import get_user_model
from common.models import UserOwnedModel

User = get_user_model()

class Transcription(UserOwnedModel):
    """
    转录模型
    存储音频文件的转录结果
    """
    STATUS_CHOICES = (
        ('pending', '待处理'),
        ('processing', '处理中'),
        ('completed', '已完成'),
        ('failed', '失败'),
    )
    
    MODEL_CHOICES = (
        ('whisper-1', 'OpenAI Whisper'),
        ('whisper-large-v3', 'Whisper Large v3'),
        ('whisper-medium', 'Whisper Medium'),
        ('whisper-small', 'Whisper Small'),
        ('whisper-base', 'Whisper Base'),
        ('xunfei', '讯飞语音识别'),
        ('baidu', '百度语音识别'),
    )
    
    audio_file = models.ForeignKey(
        'voice_recognition.AudioFile',
        on_delete=models.CASCADE,
        related_name='transcriptions',
        verbose_name='音频文件'
    )
    language = models.ForeignKey(
        'voice_recognition.Language',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='transcriptions',
        verbose_name='语言'
    )
    model = models.CharField(max_length=50, choices=MODEL_CHOICES, default='whisper-1', verbose_name='模型')
    text = models.TextField(blank=True, verbose_name='转录文本')
    segments = models.JSONField(default=list, blank=True, verbose_name='分段')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', verbose_name='状态')
    error_message = models.TextField(blank=True, null=True, verbose_name='错误信息')
    duration = models.FloatField(default=0, verbose_name='处理时长(秒)')
    is_speaker_diarization = models.BooleanField(default=False, verbose_name='是否进行说话人分离')
    speakers = models.ManyToManyField(
        'voice_recognition.Speaker',
        related_name='transcriptions',
        blank=True,
        verbose_name='说话人'
    )
    
    class Meta:
        verbose_name = '转录'
        verbose_name_plural = '转录'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'status']),
            models.Index(fields=['audio_file']),
        ]
    
    def __str__(self):
        return f"{self.audio_file.file_name} - {self.get_status_display()}"
    
    @property
    def word_count(self):
        """
        计算字数
        
        Returns:
            int: 字数
        """
        if not self.text:
            return 0
        
        # 中文按字符计算，英文按空格分隔计算
        if self.language and self.language.code.startswith('zh'):
            return len(self.text)
        else:
            return len(self.text.split())
    
    @property
    def is_completed(self):
        """
        检查是否已完成
        
        Returns:
            bool: 是否已完成
        """
        return self.status == 'completed'
