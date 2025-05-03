"""
思维导图模型
"""

import uuid
from django.db import models
from django.utils import timezone
from users.models import User

class MindMap(models.Model):
    """思维导图模型"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='mind_maps')
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    is_public = models.BooleanField(default=False)
    is_deleted = models.BooleanField(default=False)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)
    
    # 关联笔记（可选）
    note = models.ForeignKey('notes.Note', on_delete=models.SET_NULL, null=True, blank=True, related_name='mind_maps')
    
    # 思维导图数据（JSON格式）
    data = models.JSONField(default=dict)
    
    # 布局设置
    layout_type = models.CharField(max_length=50, default='tree')  # tree, radial, horizontal, vertical
    theme = models.CharField(max_length=50, default='default')
    
    class Meta:
        db_table = 'mind_map'
        ordering = ['-updated_at']
        
    def __str__(self):
        return self.title

class MindMapNode(models.Model):
    """思维导图节点模型"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    mind_map = models.ForeignKey(MindMap, on_delete=models.CASCADE, related_name='nodes')
    parent = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='children')
    
    # 节点内容
    title = models.CharField(max_length=255)
    content = models.TextField(blank=True, null=True)
    note = models.TextField(blank=True, null=True)
    
    # 节点样式
    color = models.CharField(max_length=50, blank=True, null=True)
    shape = models.CharField(max_length=50, default='rectangle')  # rectangle, ellipse, diamond
    font_size = models.IntegerField(default=14)
    font_weight = models.CharField(max_length=50, default='normal')  # normal, bold
    
    # 节点位置
    x = models.FloatField(default=0)
    y = models.FloatField(default=0)
    
    # 节点顺序
    order = models.IntegerField(default=0)
    
    # 折叠状态
    is_collapsed = models.BooleanField(default=False)
    
    # 时间戳
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'mind_map_node'
        ordering = ['order']
        
    def __str__(self):
        return self.title

class MindMapEdge(models.Model):
    """思维导图连接线模型"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    mind_map = models.ForeignKey(MindMap, on_delete=models.CASCADE, related_name='edges')
    source = models.ForeignKey(MindMapNode, on_delete=models.CASCADE, related_name='outgoing_edges')
    target = models.ForeignKey(MindMapNode, on_delete=models.CASCADE, related_name='incoming_edges')
    
    # 连接线样式
    style = models.CharField(max_length=50, default='solid')  # solid, dashed, dotted
    color = models.CharField(max_length=50, blank=True, null=True)
    width = models.FloatField(default=1.0)
    
    # 连接线标签
    label = models.CharField(max_length=255, blank=True, null=True)
    
    # 时间戳
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'mind_map_edge'
        
    def __str__(self):
        return f"{self.source.title} -> {self.target.title}"

class MindMapTemplate(models.Model):
    """思维导图模板模型"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    thumbnail = models.ImageField(upload_to='mind_map_templates', blank=True, null=True)
    
    # 模板数据（JSON格式）
    data = models.JSONField(default=dict)
    
    # 模板类型
    type = models.CharField(max_length=50, default='general')  # general, project, study, brainstorm
    
    # 模板布局
    layout_type = models.CharField(max_length=50, default='tree')
    theme = models.CharField(max_length=50, default='default')
    
    # 是否系统默认模板
    is_system = models.BooleanField(default=False)
    
    # 时间戳
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'mind_map_template'
        ordering = ['type', 'title']
        
    def __str__(self):
        return self.title
