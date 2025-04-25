"""
提示词模板模型
"""

from django.db import models
from django.contrib.auth import get_user_model
from common.models import UserOwnedModel, PublicModel

User = get_user_model()

class PromptTemplate(UserOwnedModel, PublicModel):
    """
    提示词模板模型
    存储预定义的提示词模板
    """
    CATEGORY_CHOICES = (
        ('writing', '写作'),
        ('translation', '翻译'),
        ('summarization', '摘要'),
        ('coding', '编程'),
        ('creative', '创意'),
        ('academic', '学术'),
        ('business', '商业'),
        ('personal', '个人'),
        ('other', '其他'),
    )
    
    title = models.CharField(max_length=255, verbose_name='标题')
    description = models.TextField(blank=True, null=True, verbose_name='描述')
    content = models.TextField(verbose_name='内容')
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default='other', verbose_name='分类')
    tags = models.CharField(max_length=255, blank=True, null=True, verbose_name='标签')
    variables = models.JSONField(default=list, blank=True, verbose_name='变量')
    usage_count = models.IntegerField(default=0, verbose_name='使用次数')
    is_featured = models.BooleanField(default=False, verbose_name='是否推荐')
    
    class Meta:
        verbose_name = '提示词模板'
        verbose_name_plural = '提示词模板'
        ordering = ['-usage_count', '-created_at']
        indexes = [
            models.Index(fields=['user', 'category']),
            models.Index(fields=['is_public']),
            models.Index(fields=['is_featured']),
        ]
    
    def __str__(self):
        return self.title
    
    def increment_usage(self):
        """增加使用次数"""
        self.usage_count += 1
        self.save(update_fields=['usage_count'])
    
    def render(self, variables):
        """
        渲染模板
        
        Args:
            variables: 变量字典
            
        Returns:
            str: 渲染后的内容
        """
        content = self.content
        
        # 替换变量
        for key, value in variables.items():
            placeholder = f"{{{{{key}}}}}"
            content = content.replace(placeholder, str(value))
        
        return content
