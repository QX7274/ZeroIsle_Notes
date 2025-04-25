"""
对话模型
"""

from django.db import models
from django.contrib.auth import get_user_model
from common.models import UserOwnedModel, SoftDeleteModel

User = get_user_model()

class Conversation(UserOwnedModel, SoftDeleteModel):
    """
    对话模型
    存储用户与AI助手的对话
    """
    title = models.CharField(max_length=255, verbose_name='标题')
    description = models.TextField(blank=True, null=True, verbose_name='描述')
    model = models.CharField(max_length=50, default='gpt-3.5-turbo', verbose_name='模型')
    system_prompt = models.TextField(blank=True, null=True, verbose_name='系统提示词')
    temperature = models.FloatField(default=0.7, verbose_name='温度')
    max_tokens = models.IntegerField(default=2000, verbose_name='最大令牌数')
    is_pinned = models.BooleanField(default=False, verbose_name='是否置顶')
    last_message_at = models.DateTimeField(auto_now=True, verbose_name='最后消息时间')
    
    class Meta:
        verbose_name = '对话'
        verbose_name_plural = '对话'
        ordering = ['-last_message_at']
        indexes = [
            models.Index(fields=['user', 'is_deleted']),
            models.Index(fields=['user', 'is_pinned']),
            models.Index(fields=['last_message_at']),
        ]
    
    def __str__(self):
        return self.title or f"对话 {self.id}"
    
    @property
    def message_count(self):
        """消息数量"""
        return self.messages.count()
    
    @property
    def total_tokens(self):
        """总令牌数"""
        return self.messages.aggregate(total=models.Sum('tokens'))['total'] or 0
    
    def add_message(self, role, content, tokens=None):
        """
        添加消息
        
        Args:
            role: 角色 (user/assistant/system)
            content: 内容
            tokens: 令牌数
            
        Returns:
            Message: 创建的消息
        """
        return Message.objects.create(
            conversation=self,
            role=role,
            content=content,
            tokens=tokens
        )

class Message(models.Model):
    """
    消息模型
    存储对话中的单条消息
    """
    ROLE_CHOICES = (
        ('user', '用户'),
        ('assistant', '助手'),
        ('system', '系统'),
    )
    
    conversation = models.ForeignKey(
        Conversation,
        on_delete=models.CASCADE,
        related_name='messages',
        verbose_name='对话'
    )
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, verbose_name='角色')
    content = models.TextField(verbose_name='内容')
    tokens = models.IntegerField(default=0, verbose_name='令牌数')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    
    class Meta:
        verbose_name = '消息'
        verbose_name_plural = '消息'
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['conversation', 'role']),
            models.Index(fields=['created_at']),
        ]
    
    def __str__(self):
        return f"{self.get_role_display()}: {self.content[:50]}..."
