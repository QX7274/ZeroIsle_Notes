from django.db import models
from .concept import Concept

class Entity(models.Model):
    """
    知识图谱实体模型
    
    Attributes:
        name (CharField): 实体名称
        description (TextField): 实体描述
        concept (ForeignKey): 关联的知识概念
        properties (JSONField): 实体扩展属性
    """
    name = models.CharField(max_length=255, verbose_name='实体名称')
    description = models.TextField(verbose_name='实体描述')
    concept = models.ForeignKey(
        Concept,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name='关联概念'
    )
    properties = models.JSONField(default=dict, verbose_name='扩展属性')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'knowledge_entities'
        verbose_name = '知识实体'
        verbose_name_plural = verbose_name

    def __str__(self):
        return self.name