"""
画布元素模型
"""

import uuid
import json
from django.db import models
from django.utils.translation import gettext_lazy as _

class CanvasElement(models.Model):
    """画布元素模型"""
    ELEMENT_TYPE_CHOICES = (
        ('text', _('文本')),
        ('image', _('图片')),
        ('note', _('笔记')),
        ('file', _('文件')),
        ('shape', _('形状')),
        ('drawing', _('绘图')),
    )
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    canvas = models.ForeignKey('canvas.Canvas', on_delete=models.CASCADE, related_name='elements', verbose_name=_('画布'))
    element_type = models.CharField(_('元素类型'), max_length=20, choices=ELEMENT_TYPE_CHOICES)
    content = models.TextField(_('内容'), blank=True, null=True)
    position_x = models.FloatField(_('X坐标'))
    position_y = models.FloatField(_('Y坐标'))
    width = models.FloatField(_('宽度'), default=100)
    height = models.FloatField(_('高度'), default=100)
    rotation = models.FloatField(_('旋转角度'), default=0)
    z_index = models.IntegerField(_('层级'), default=0)
    style_data = models.TextField(_('样式数据'), blank=True, null=True)
    created_at = models.DateTimeField(_('创建时间'), auto_now_add=True)
    updated_at = models.DateTimeField(_('更新时间'), auto_now=True)
    
    class Meta:
        verbose_name = _('画布元素')
        verbose_name_plural = _('画布元素')
        ordering = ['z_index']
    
    def __str__(self):
        return f"{self.get_element_type_display()} - {self.id}"
    
    def get_style(self):
        """获取样式数据"""
        if self.style_data:
            return json.loads(self.style_data)
        return {}
    
    def set_style(self, style_dict):
        """设置样式数据"""
        self.style_data = json.dumps(style_dict)
