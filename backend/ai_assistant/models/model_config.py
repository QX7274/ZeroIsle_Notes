"""
模型配置模型
"""

from django.db import models

class ModelConfig(models.Model):
    """
    模型配置模型
    存储可用的AI模型配置
    """
    name = models.CharField(max_length=50, unique=True, verbose_name='名称')
    provider = models.CharField(max_length=50, verbose_name='提供商')
    description = models.TextField(blank=True, null=True, verbose_name='描述')
    max_tokens = models.IntegerField(verbose_name='最大令牌数')
    token_limit = models.IntegerField(verbose_name='令牌限制')
    default_temperature = models.FloatField(default=0.7, verbose_name='默认温度')
    supports_functions = models.BooleanField(default=False, verbose_name='支持函数调用')
    supports_vision = models.BooleanField(default=False, verbose_name='支持视觉')
    price_per_1k_tokens_input = models.DecimalField(
        max_digits=10, 
        decimal_places=6, 
        verbose_name='输入每千令牌价格'
    )
    price_per_1k_tokens_output = models.DecimalField(
        max_digits=10, 
        decimal_places=6, 
        verbose_name='输出每千令牌价格'
    )
    is_active = models.BooleanField(default=True, verbose_name='是否激活')
    is_default = models.BooleanField(default=False, verbose_name='是否默认')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')
    
    class Meta:
        verbose_name = '模型配置'
        verbose_name_plural = '模型配置'
        ordering = ['provider', 'name']
        indexes = [
            models.Index(fields=['provider', 'name']),
            models.Index(fields=['is_active']),
        ]
    
    def __str__(self):
        return f"{self.provider} - {self.name}"
    
    def save(self, *args, **kwargs):
        """保存时确保只有一个默认模型"""
        if self.is_default:
            # 将其他模型设置为非默认
            ModelConfig.objects.filter(is_default=True).exclude(pk=self.pk).update(is_default=False)
        super().save(*args, **kwargs)
    
    @classmethod
    def get_default(cls):
        """获取默认模型"""
        try:
            return cls.objects.get(is_default=True, is_active=True)
        except cls.DoesNotExist:
            # 如果没有默认模型，返回第一个激活的模型
            return cls.objects.filter(is_active=True).first()
