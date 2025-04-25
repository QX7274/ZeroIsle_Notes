"""
知识图谱模型
"""

from django.db import models
from django.contrib.auth import get_user_model
from common.models import UserOwnedModel, PublicModel

User = get_user_model()

class KnowledgeGraph(UserOwnedModel, PublicModel):
    """
    知识图谱模型
    用户创建的知识图谱
    """
    name = models.CharField(max_length=255, verbose_name='名称')
    description = models.TextField(blank=True, null=True, verbose_name='描述')
    nodes = models.ManyToManyField(
        'knowledge_graph.KnowledgeNode',
        related_name='graphs',
        blank=True,
        verbose_name='节点'
    )
    edges = models.ManyToManyField(
        'knowledge_graph.KnowledgeEdge',
        related_name='graphs',
        blank=True,
        verbose_name='边'
    )
    settings = models.JSONField(default=dict, blank=True, verbose_name='设置')
    thumbnail = models.ImageField(upload_to='graph_thumbnails/', blank=True, null=True, verbose_name='缩略图')
    
    class Meta:
        verbose_name = '知识图谱'
        verbose_name_plural = '知识图谱'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'name']),
            models.Index(fields=['is_public']),
        ]
    
    def __str__(self):
        return self.name
    
    @property
    def node_count(self):
        """节点数量"""
        return self.nodes.count()
    
    @property
    def edge_count(self):
        """边数量"""
        return self.edges.count()
    
    def get_central_nodes(self, limit=5):
        """
        获取中心节点
        根据连接数（度数）排序
        """
        from django.db.models import Count
        
        return self.nodes.annotate(
            degree=Count('outgoing_edges') + Count('incoming_edges')
        ).order_by('-degree')[:limit]
