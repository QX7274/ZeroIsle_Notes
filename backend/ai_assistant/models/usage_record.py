"""
使用记录模型
"""

from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()

class UsageRecord(models.Model):
    """
    使用记录模型
    记录用户使用AI模型的情况
    """
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='ai_usage_records',
        verbose_name='用户'
    )
    model = models.CharField(max_length=50, verbose_name='模型')
    provider = models.CharField(max_length=50, verbose_name='提供商')
    conversation = models.ForeignKey(
        'ai_assistant.Conversation',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='usage_records',
        verbose_name='对话'
    )
    prompt_tokens = models.IntegerField(default=0, verbose_name='提示令牌数')
    completion_tokens = models.IntegerField(default=0, verbose_name='完成令牌数')
    total_tokens = models.IntegerField(default=0, verbose_name='总令牌数')
    cost = models.DecimalField(max_digits=10, decimal_places=6, default=0, verbose_name='成本')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    
    class Meta:
        verbose_name = '使用记录'
        verbose_name_plural = '使用记录'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'created_at']),
            models.Index(fields=['model']),
        ]
    
    def __str__(self):
        return f"{self.user} - {self.model} - {self.created_at}"
    
    @classmethod
    def create_record(cls, user, model, provider, conversation=None, prompt_tokens=0, completion_tokens=0, cost=0):
        """
        创建使用记录
        
        Args:
            user: 用户对象
            model: 模型名称
            provider: 提供商
            conversation: 对话对象
            prompt_tokens: 提示令牌数
            completion_tokens: 完成令牌数
            cost: 成本
            
        Returns:
            UsageRecord: 创建的使用记录
        """
        total_tokens = prompt_tokens + completion_tokens
        
        return cls.objects.create(
            user=user,
            model=model,
            provider=provider,
            conversation=conversation,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=total_tokens,
            cost=cost
        )
