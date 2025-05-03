"""
思维导图MongoDB模型
"""

import uuid
from datetime import datetime
from mongoengine import Document, EmbeddedDocument, fields

class MindMapNode(EmbeddedDocument):
    """思维导图节点"""
    id = fields.StringField(default=lambda: str(uuid.uuid4()), primary_key=True)
    parent_id = fields.StringField(default=None)
    title = fields.StringField(required=True)
    content = fields.StringField()
    note = fields.StringField()
    
    # 节点样式
    color = fields.StringField()
    shape = fields.StringField(default='rectangle')  # rectangle, ellipse, diamond
    font_size = fields.IntField(default=14)
    font_weight = fields.StringField(default='normal')  # normal, bold
    
    # 节点位置
    x = fields.FloatField(default=0)
    y = fields.FloatField(default=0)
    
    # 节点顺序
    order = fields.IntField(default=0)
    
    # 折叠状态
    is_collapsed = fields.BooleanField(default=False)
    
    # 自定义属性
    properties = fields.DictField()
    
    # 时间戳
    created_at = fields.DateTimeField(default=datetime.now)
    updated_at = fields.DateTimeField(default=datetime.now)

class MindMapEdge(EmbeddedDocument):
    """思维导图连接线"""
    id = fields.StringField(default=lambda: str(uuid.uuid4()), primary_key=True)
    source_id = fields.StringField(required=True)
    target_id = fields.StringField(required=True)
    
    # 连接线样式
    style = fields.StringField(default='solid')  # solid, dashed, dotted
    color = fields.StringField()
    width = fields.FloatField(default=1.0)
    
    # 连接线标签
    label = fields.StringField()
    
    # 自定义属性
    properties = fields.DictField()
    
    # 时间戳
    created_at = fields.DateTimeField(default=datetime.now)
    updated_at = fields.DateTimeField(default=datetime.now)

class MindMap(Document):
    """思维导图"""
    id = fields.StringField(default=lambda: str(uuid.uuid4()), primary_key=True)
    user = fields.ReferenceField('User', required=True)
    title = fields.StringField(required=True)
    description = fields.StringField()
    
    # 思维导图数据
    nodes = fields.EmbeddedDocumentListField(MindMapNode)
    edges = fields.EmbeddedDocumentListField(MindMapEdge)
    
    # 关联笔记（可选）
    note_id = fields.StringField()
    
    # 布局设置
    layout_type = fields.StringField(default='tree')  # tree, radial, horizontal, vertical
    theme = fields.StringField(default='default')
    
    # 自定义属性
    properties = fields.DictField()
    
    # 状态
    is_public = fields.BooleanField(default=False)
    is_deleted = fields.BooleanField(default=False)
    
    # 时间戳
    created_at = fields.DateTimeField(default=datetime.now)
    updated_at = fields.DateTimeField(default=datetime.now)
    
    meta = {
        'collection': 'mind_maps',
        'indexes': [
            'user',
            'note_id',
            'is_deleted',
            'created_at',
            'updated_at'
        ]
    }

class MindMapTemplate(Document):
    """思维导图模板"""
    id = fields.StringField(default=lambda: str(uuid.uuid4()), primary_key=True)
    title = fields.StringField(required=True)
    description = fields.StringField()
    thumbnail_url = fields.StringField()
    
    # 模板数据
    nodes = fields.EmbeddedDocumentListField(MindMapNode)
    edges = fields.EmbeddedDocumentListField(MindMapEdge)
    
    # 模板类型
    type = fields.StringField(default='general')  # general, project, study, brainstorm
    
    # 模板布局
    layout_type = fields.StringField(default='tree')
    theme = fields.StringField(default='default')
    
    # 是否系统默认模板
    is_system = fields.BooleanField(default=False)
    
    # 时间戳
    created_at = fields.DateTimeField(default=datetime.now)
    updated_at = fields.DateTimeField(default=datetime.now)
    
    meta = {
        'collection': 'mind_map_templates',
        'indexes': [
            'type',
            'is_system',
            'created_at'
        ]
    }
