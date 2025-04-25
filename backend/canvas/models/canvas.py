"""
画布模型
"""

import uuid
from django.db import models
from django.utils.translation import gettext_lazy as _
from users.models import User

class Canvas(models.Model):
    """画布模型"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(_('标题'), max_length=200)
    description = models.TextField(_('描述'), blank=True, null=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='canvases', verbose_name=_('用户'))
    is_public = models.BooleanField(_('是否公开'), default=False)
    view_count = models.IntegerField(_('查看次数'), default=0)
    created_at = models.DateTimeField(_('创建时间'), auto_now_add=True)
    updated_at = models.DateTimeField(_('更新时间'), auto_now=True)
    
    class Meta:
        verbose_name = _('画布')
        verbose_name_plural = _('画布')
        ordering = ['-updated_at']
    
    def __str__(self):
        return self.title
