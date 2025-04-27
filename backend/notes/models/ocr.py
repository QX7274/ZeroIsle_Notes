"""
OCR模型
用于实现OCR功能
"""

from django.db import models
from django.utils import timezone
from django.contrib.auth import get_user_model

User = get_user_model()


class OCRModel(models.Model):
    """
    OCR模型
    存储OCR模型信息
    """
    MODEL_TYPE_CHOICES = (
        ('general', '通用模型'),
        ('handwriting', '手写体模型'),
        ('formula', '公式模型'),
        ('table', '表格模型'),
        ('custom', '自定义模型'),
    )
    
    name = models.CharField(max_length=255, verbose_name="模型名称")
    model_type = models.CharField(max_length=20, choices=MODEL_TYPE_CHOICES, default='general', verbose_name="模型类型")
    version = models.CharField(max_length=50, verbose_name="版本")
    description = models.TextField(blank=True, null=True, verbose_name="描述")
    file_path = models.CharField(max_length=255, verbose_name="文件路径")
    created_at = models.DateTimeField(default=timezone.now, verbose_name="创建时间")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="更新时间")
    is_active = models.BooleanField(default=True, verbose_name="是否激活")
    
    class Meta:
        verbose_name = "OCR模型"
        verbose_name_plural = "OCR模型"
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.name} - {self.version}"


class OCRTrainingData(models.Model):
    """
    OCR训练数据
    存储OCR训练数据信息
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='ocr_training_data', verbose_name="用户")
    model = models.ForeignKey(OCRModel, on_delete=models.CASCADE, related_name='training_data', verbose_name="模型")
    image = models.ImageField(upload_to='ocr/training/', verbose_name="图片")
    text = models.TextField(verbose_name="文本")
    created_at = models.DateTimeField(default=timezone.now, verbose_name="创建时间")
    is_verified = models.BooleanField(default=False, verbose_name="是否已验证")
    
    class Meta:
        verbose_name = "OCR训练数据"
        verbose_name_plural = "OCR训练数据"
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.user.username} - {self.model.name}"
