"""
Whisper模型
用于实现语音识别功能
"""

from django.db import models
from django.utils import timezone
from django.contrib.auth import get_user_model

User = get_user_model()


class WhisperModel(models.Model):
    """
    Whisper模型
    存储Whisper模型信息
    """
    MODEL_SIZE_CHOICES = (
        ('tiny', '超小型'),
        ('base', '基础型'),
        ('small', '小型'),
        ('medium', '中型'),
        ('large', '大型'),
    )
    
    name = models.CharField(max_length=255, verbose_name="模型名称")
    model_size = models.CharField(max_length=10, choices=MODEL_SIZE_CHOICES, default='base', verbose_name="模型大小")
    version = models.CharField(max_length=50, verbose_name="版本")
    description = models.TextField(blank=True, null=True, verbose_name="描述")
    file_path = models.CharField(max_length=255, verbose_name="文件路径")
    created_at = models.DateTimeField(default=timezone.now, verbose_name="创建时间")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="更新时间")
    is_active = models.BooleanField(default=True, verbose_name="是否激活")
    
    class Meta:
        verbose_name = "Whisper模型"
        verbose_name_plural = "Whisper模型"
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.name} - {self.version}"


class WhisperTrainingData(models.Model):
    """
    Whisper训练数据
    存储Whisper训练数据信息
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='whisper_training_data', verbose_name="用户")
    model = models.ForeignKey(WhisperModel, on_delete=models.CASCADE, related_name='training_data', verbose_name="模型")
    audio = models.FileField(upload_to='whisper/training/', verbose_name="音频")
    text = models.TextField(verbose_name="文本")
    language = models.CharField(max_length=10, default='zh', verbose_name="语言")
    created_at = models.DateTimeField(default=timezone.now, verbose_name="创建时间")
    is_verified = models.BooleanField(default=False, verbose_name="是否已验证")
    
    class Meta:
        verbose_name = "Whisper训练数据"
        verbose_name_plural = "Whisper训练数据"
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.user.username} - {self.model.name}"
