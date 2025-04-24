from django.db import models
from django.contrib.auth.models import User
from notes.models import Note


class KnowledgeNode(models.Model):
    """
    知识图谱节点模型
    """
    NODE_TYPES = (
        ('note', '笔记'),
        ('tag', '标签'),
        ('category', '分类'),
        ('concept', '概念'),
    )
    
    id = models.AutoField(primary_key=True)
    title = models.CharField(max_length=255, verbose_name='标题')
    description = models.TextField(blank=True, null=True, verbose_name='描述')
    type = models.CharField(max_length=20, choices=NODE_TYPES, default='concept', verbose_name='节点类型')
    note = models.ForeignKey(Note, on_delete=models.CASCADE, blank=True, null=True, related_name='knowledge_nodes', verbose_name='关联笔记')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='knowledge_nodes', verbose_name='创建用户')
    x = models.FloatField(default=0, verbose_name='X坐标')
    y = models.FloatField(default=0, verbose_name='Y坐标')
    color = models.CharField(max_length=20, blank=True, null=True, verbose_name='颜色')
    size = models.IntegerField(default=20, verbose_name='大小')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')
    
    class Meta:
        verbose_name = '知识节点'
        verbose_name_plural = '知识节点'
        ordering = ['-created_at']
    
    def __str__(self):
        return self.title


class KnowledgeEdge(models.Model):
    """
    知识图谱连接模型
    """
    EDGE_TYPES = (
        ('related', '相关'),
        ('cause', '因果'),
        ('include', '包含'),
        ('reference', '引用'),
        ('custom', '自定义'),
    )
    
    id = models.AutoField(primary_key=True)
    source = models.ForeignKey(KnowledgeNode, on_delete=models.CASCADE, related_name='outgoing_edges', verbose_name='源节点')
    target = models.ForeignKey(KnowledgeNode, on_delete=models.CASCADE, related_name='incoming_edges', verbose_name='目标节点')
    type = models.CharField(max_length=20, choices=EDGE_TYPES, default='related', verbose_name='连接类型')
    label = models.CharField(max_length=100, blank=True, null=True, verbose_name='标签')
    description = models.TextField(blank=True, null=True, verbose_name='描述')
    weight = models.FloatField(default=1.0, verbose_name='权重')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='knowledge_edges', verbose_name='创建用户')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')
    
    class Meta:
        verbose_name = '知识连接'
        verbose_name_plural = '知识连接'
        ordering = ['-created_at']
        unique_together = ('source', 'target', 'type')
    
    def __str__(self):
        return f'{self.source.title} -> {self.target.title}'