from django.db import models

class Concept(models.Model):
    """
    知识图谱基础概念模型
    
    Attributes:
        name (CharField): 概念名称
        description (TextField): 概念详细描述
        parent (ForeignKey): 父级概念
    """
    name = models.CharField(max_length=255, verbose_name='概念名称')
    description = models.TextField(verbose_name='概念描述')
    parent = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name='父级概念'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'knowledge_concepts'
        verbose_name = '知识概念'
        verbose_name_plural = verbose_name

    def __str__(self):
        return self.name