"""
知识边模型
"""

from django.db import models
from django.contrib.auth import get_user_model
from common.models import UserOwnedModel, PublicModel

User = get_user_model()

class KnowledgeEdge(UserOwnedModel, PublicModel):
    """
    知识边模型
    知识图谱中的连接关系
    """
    EDGE_TYPES = (
        ('related', '相关'),
        ('cause', '因果'),
        ('include', '包含'),
        ('reference', '引用'),
        ('prerequisite', '前置'),
        ('similar', '相似'),
        ('opposite', '相反'),
        ('custom', '自定义'),
    )
    
    source = models.ForeignKey(
        'knowledge_graph.KnowledgeNode',
        on_delete=models.CASCADE,
        related_name='outgoing_edges',
        verbose_name='源节点'
    )
    target = models.ForeignKey(
        'knowledge_graph.KnowledgeNode',
        on_delete=models.CASCADE,
        related_name='incoming_edges',
        verbose_name='目标节点'
    )
    type = models.CharField(max_length=20, choices=EDGE_TYPES, default='related', verbose_name='连接类型')
    label = models.CharField(max_length=100, blank=True, null=True, verbose_name='标签')
    description = models.TextField(blank=True, null=True, verbose_name='描述')
    weight = models.FloatField(default=1.0, verbose_name='权重')
    color = models.CharField(max_length=20, blank=True, null=True, verbose_name='颜色')
    properties = models.JSONField(default=dict, blank=True, verbose_name='属性')
    
    class Meta:
        verbose_name = '知识边'
        verbose_name_plural = '知识边'
        ordering = ['-created_at']
        unique_together = ('source', 'target', 'type')
        indexes = [
            models.Index(fields=['user', 'type']),
            models.Index(fields=['source', 'target']),
            models.Index(fields=['is_public']),
        ]
    
    def __str__(self):
        return f"{self.source.title} -> {self.get_type_display()} -> {self.target.title}"
    
    def save(self, *args, **kwargs):
        """保存前确保源节点和目标节点不同"""
        if self.source == self.target:
            raise ValueError("源节点和目标节点不能相同")
        super().save(*args, **kwargs)
