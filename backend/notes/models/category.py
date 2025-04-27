from django.db import models

class Category(models.Model):
    name = models.CharField('分类名称', max_length=50)
    description = models.TextField('描述', blank=True)
    created_at = models.DateTimeField('创建时间', auto_now_add=True)

    class Meta:
        verbose_name = '笔记分类'
        verbose_name_plural = verbose_name

    def __str__(self):
        return self.name