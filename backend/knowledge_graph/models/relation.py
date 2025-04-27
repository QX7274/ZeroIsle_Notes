from django.db import models
from .entity import Entity

class Relation(models.Model):
    """
    知识图谱关系模型
    
    Attributes:
        source (ForeignKey): 起始实体
        target (ForeignKey): 目标实体
        relation_type (CharField): 关系类型
        weight (FloatField): 关系权重
    """
    source = models.ForeignKey(
        Entity,
        on_delete=models.CASCADE,
        related_name='outgoing_relations',
        verbose_name='起始实体'
    )
    target = models.ForeignKey(
        Entity,
        on_delete=models.CASCADE,
        related_name='incoming_relations',
        verbose_name='目标实体'
    )
    relation_type = models.CharField(max_length=50, verbose_name='关系类型')
    weight = models.FloatField(default=1.0, verbose_name='关系权重')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'knowledge_relations'
        verbose_name = '知识关系'
        verbose_name_plural = verbose_name
        indexes = [
            models.Index(fields=['source', 'target'], name='relation_index'),
        ]

    def __str__(self):
        return f'{self.source} → {self.target} ({self.relation_type})'