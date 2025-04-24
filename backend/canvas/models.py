"""无限画布模型"""

from django.db import models
from django.utils.translation import gettext_lazy as _
from users.models import User
import uuid
import json


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
    canvas = models.ForeignKey(Canvas, on_delete=models.CASCADE, related_name='elements', verbose_name=_('画布'))
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


class CanvasConnection(models.Model):
    """画布元素连接模型"""
    CONNECTION_TYPE_CHOICES = (
        ('line', _('直线')),
        ('arrow', _('箭头')),
        ('curve', _('曲线')),
    )
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    canvas = models.ForeignKey(Canvas, on_delete=models.CASCADE, related_name='connections', verbose_name=_('画布'))
    source = models.ForeignKey(CanvasElement, on_delete=models.CASCADE, related_name='outgoing_connections', verbose_name=_('源元素'))
    target = models.ForeignKey(CanvasElement, on_delete=models.CASCADE, related_name='incoming_connections', verbose_name=_('目标元素'))
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