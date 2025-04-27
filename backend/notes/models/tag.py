from django.db import models
from .category import Category

class Tag(models.Model):
    name = models.CharField('标签名称', max_length=50)
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, verbose_name='关联分类')
    created_at = models.DateTimeField('创建时间', auto_now_add=True)

    class Meta:
        verbose_name = '笔记标签'
        verbose_name_plural = verbose_name

    def __str__(self):
        return self.name