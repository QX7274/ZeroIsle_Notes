"""
知识节点模型
"""

from django.db import models
from django.contrib.auth import get_user_model
from common.models import UserOwnedModel, PublicModel

User = get_user_model()

class KnowledgeNode(UserOwnedModel, PublicModel):
    """
    知识节点模型
    知识图谱中的基本节点
    """
    NODE_TYPES = (
        ('note', '笔记'),
        ('tag', '标签'),
        ('category', '分类'),
        ('concept', '概念'),
        ('entity', '实体'),
        ('question', '问题'),
        ('answer', '答案'),
        ('custom', '自定义'),
    )
    
    title = models.CharField(max_length=255, verbose_name='标题')
    description = models.TextField(blank=True, null=True, verbose_name='描述')
    type = models.CharField(max_length=20, choices=NODE_TYPES, default='concept', verbose_name='节点类型')
    note = models.ForeignKey(
        'notes.Note',
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='knowledge_nodes',
        verbose_name='关联笔记'
    )
    x = models.FloatField(default=0, verbose_name='X坐标')
    y = models.FloatField(default=0, verbose_name='Y坐标')
    color = models.CharField(max_length=20, blank=True, null=True, verbose_name='颜色')
    size = models.IntegerField(default=20, verbose_name='大小')
    icon = models.CharField(max_length=50, blank=True, null=True, verbose_name='图标')
    properties = models.JSONField(default=dict, blank=True, verbose_name='属性')
    
    class Meta:
        verbose_name = '知识节点'
        verbose_name_plural = '知识节点'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'type']),
            models.Index(fields=['title']),
            models.Index(fields=['is_public']),
        ]
    
    def __str__(self):
        return self.title
    
    def get_related_nodes(self):
        """获取相关节点"""
        from .edge import KnowledgeEdge
        
        # 获取所有与当前节点相关的边
        outgoing_edges = KnowledgeEdge.objects.filter(source=self)
        incoming_edges = KnowledgeEdge.objects.filter(target=self)
        
        # 获取相关节点
        related_nodes = set()
        for edge in outgoing_edges:
            related_nodes.add(edge.target)
        for edge in incoming_edges:
            related_nodes.add(edge.source)
            
        return list(related_nodes)
    
    def get_node_degree(self):
        """获取节点度数（连接数）"""
        from .edge import KnowledgeEdge
        
        outgoing_count = KnowledgeEdge.objects.filter(source=self).count()
        incoming_count = KnowledgeEdge.objects.filter(target=self).count()
        
        return outgoing_count + incoming_count
