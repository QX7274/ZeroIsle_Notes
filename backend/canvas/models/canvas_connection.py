"""
画布连接模型
"""

import uuid
import json
from django.db import models
from django.utils.translation import gettext_lazy as _

class CanvasConnection(models.Model):
    """画布元素连接模型"""
    CONNECTION_TYPE_CHOICES = (
        ('line', _('直线')),
        ('arrow', _('箭头')),
        ('curve', _('曲线')),
    )
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    canvas = models.ForeignKey('canvas.Canvas', on_delete=models.CASCADE, related_name='connections', verbose_name=_('画布'))
    source = models.ForeignKey('canvas.CanvasElement', on_delete=models.CASCADE, related_name='outgoing_connections', verbose_name=_('源元素'))
    target = models.ForeignKey('canvas.CanvasElement', on_delete=models.CASCADE, related_name='incoming_connections', verbose_name=_('目标元素'))
    connection_type = models.CharField(_('连接类型'), max_length=20, choices=CONNECTION_TYPE_CHOICES, default='line')
    label = models.CharField(_('标签'), max_length=100, blank=True, null=True)
    style_data = models.TextField(_('样式数据'), blank=True, null=True)
    path_data = models.TextField(_('路径数据'), blank=True, null=True)
    created_at = models.DateTimeField(_('创建时间'), auto_now_add=True)
    updated_at = models.DateTimeField(_('更新时间'), auto_now=True)
    
    class Meta:
        verbose_name = _('画布连接')
        verbose_name_plural = _('画布连接')
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.source.id} -> {self.target.id}"
    
    def get_style(self):
        """获取样式数据"""
        if self.style_data:
            return json.loads(self.style_data)
        return {}
    
    def set_style(self, style_dict):
        """设置样式数据"""
        self.style_data = json.dumps(style_dict)
