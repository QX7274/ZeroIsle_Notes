"""
知识图谱模块MongoDB文档模型
使用MongoEngine ODM定义MongoDB文档模型
"""

from mongoengine import Document, StringField, DateTimeField, BooleanField, IntField, FloatField
from mongoengine import UUIDField, ReferenceField, ListField, DictField, URLField, EmbeddedDocument, EmbeddedDocumentField
from django.utils import timezone
import uuid
from users.mongodb_models import User
from notes.mongodb_models import Note

class KnowledgeNode(Document):
    """
    知识节点文档模型
    """
    NODE_TYPES = (
        ('note', '笔记'),
        ('tag', '标签'),
        ('category', '分类'),
        ('concept', '概念'),
        ('entity', '实体'),
        ('question', '问题'),
        ('answer', '答案'),
        ('custom', '自定义'),
    )
    
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4(), verbose_name='节点ID')
    user = ReferenceField(User, required=True, verbose_name='用户')
    title = StringField(max_length=255, required=True, verbose_name='标题')
    description = StringField(verbose_name='描述')
    type = StringField(max_length=20, choices=NODE_TYPES, default='concept', verbose_name='节点类型')
    note = ReferenceField(Note, verbose_name='关联笔记')
    x = FloatField(default=0, verbose_name='X坐标')
    y = FloatField(default=0, verbose_name='Y坐标')
    color = StringField(max_length=20, verbose_name='颜色')
    size = IntField(default=20, verbose_name='大小')
    icon = StringField(max_length=50, verbose_name='图标')
    properties = DictField(verbose_name='属性')
    is_public = BooleanField(default=False, verbose_name='是否公开')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')
    
    meta = {
        'collection': 'knowledge_nodes',
        'indexes': [
            {'fields': ['user']},
            {'fields': ['type']},
            {'fields': ['title']},
            {'fields': ['is_public']},
            {'fields': ['created_at']},
            {'fields': ['updated_at']}
        ],
        'ordering': ['-created_at']
    }
    
    def __str__(self):
        return self.title
    
    def save(self, *args, **kwargs):
        """保存前更新更新时间"""
        self.updated_at = timezone.now()
        return super().save(*args, **kwargs)

class KnowledgeEdge(Document):
    """
    知识边文档模型
    """
    EDGE_TYPES = (
        ('related', '相关'),
        ('cause', '因果'),
        ('include', '包含'),
        ('reference', '引用'),
        ('prerequisite', '前置'),
        ('similar', '相似'),
        ('opposite', '相反'),
        ('custom', '自定义'),
    )
    
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4(), verbose_name='边ID')
    user = ReferenceField(User, required=True, verbose_name='用户')
    source = ReferenceField(KnowledgeNode, required=True, verbose_name='源节点')
    target = ReferenceField(KnowledgeNode, required=True, verbose_name='目标节点')
    type = StringField(max_length=20, choices=EDGE_TYPES, default='related', verbose_name='连接类型')
    label = StringField(max_length=100, verbose_name='标签')
    description = StringField(verbose_name='描述')
    weight = FloatField(default=1.0, verbose_name='权重')
    color = StringField(max_length=20, verbose_name='颜色')
    properties = DictField(verbose_name='属性')
    is_public = BooleanField(default=False, verbose_name='是否公开')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')
    
    meta = {
        'collection': 'knowledge_edges',
        'indexes': [
            {'fields': ['user']},
            {'fields': ['source']},
            {'fields': ['target']},
            {'fields': ['type']},
            {'fields': ['is_public']},
            {'fields': ['created_at']},
            {'fields': ['updated_at']}
        ],
        'ordering': ['-created_at']
    }
    
    def __str__(self):
        return f"{self.source.title} -> {self.type} -> {self.target.title}"
    
    def save(self, *args, **kwargs):
        """保存前更新更新时间"""
        if self.source == self.target:
            raise ValueError("源节点和目标节点不能相同")
        self.updated_at = timezone.now()
        return super().save(*args, **kwargs)

class KnowledgeGraph(Document):
    """
    知识图谱文档模型
    """
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4(), verbose_name='图谱ID')
    user = ReferenceField(User, required=True, verbose_name='用户')
    name = StringField(max_length=255, required=True, verbose_name='名称')
    description = StringField(verbose_name='描述')
    nodes = ListField(ReferenceField(KnowledgeNode), verbose_name='节点')
    edges = ListField(ReferenceField(KnowledgeEdge), verbose_name='边')
    settings = DictField(verbose_name='设置')
    thumbnail = StringField(verbose_name='缩略图路径')
    is_public = BooleanField(default=False, verbose_name='是否公开')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')
    
    meta = {
        'collection': 'knowledge_graphs',
        'indexes': [
            {'fields': ['user']},
            {'fields': ['name']},
            {'fields': ['is_public']},
            {'fields': ['created_at']},
            {'fields': ['updated_at']}
        ],
        'ordering': ['-created_at']
    }
    
    def __str__(self):
        return self.name
    
    def save(self, *args, **kwargs):
        """保存前更新更新时间"""
        self.updated_at = timezone.now()
        return super().save(*args, **kwargs)
    
    @property
    def node_count(self):
        """节点数量"""
        return len(self.nodes)
    
    @property
    def edge_count(self):
        """边数量"""
        return len(self.edges)

class Concept(Document):
    """
    概念文档模型
    """
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4(), verbose_name='概念ID')
    name = StringField(max_length=255, required=True, verbose_name='概念名称')
    description = StringField(verbose_name='概念描述')
    parent = ReferenceField('self', verbose_name='父级概念')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')
    
    meta = {
        'collection': 'concepts',
        'indexes': [
            {'fields': ['name']},
            {'fields': ['parent']},
            {'fields': ['created_at']}
        ],
        'ordering': ['name']
    }
    
    def __str__(self):
        return self.name
    
    def save(self, *args, **kwargs):
        """保存前更新更新时间"""
        self.updated_at = timezone.now()
        return super().save(*args, **kwargs)

class Entity(Document):
    """
    实体文档模型
    """
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4(), verbose_name='实体ID')
    name = StringField(max_length=255, required=True, verbose_name='实体名称')
    description = StringField(verbose_name='实体描述')
    concept = ReferenceField(Concept, verbose_name='关联概念')
    properties = DictField(verbose_name='扩展属性')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')
    
    meta = {
        'collection': 'entities',
        'indexes': [
            {'fields': ['name']},
            {'fields': ['concept']},
            {'fields': ['created_at']}
        ],
        'ordering': ['name']
    }
    
    def __str__(self):
        return self.name
    
    def save(self, *args, **kwargs):
        """保存前更新更新时间"""
        self.updated_at = timezone.now()
        return super().save(*args, **kwargs)

class Relation(Document):
    """
    关系文档模型
    """
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4(), verbose_name='关系ID')
    source = ReferenceField(Entity, required=True, verbose_name='起始实体')
    target = ReferenceField(Entity, required=True, verbose_name='目标实体')
    relation_type = StringField(max_length=50, required=True, verbose_name='关系类型')
    weight = FloatField(default=1.0, verbose_name='关系权重')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')
    
    meta = {
        'collection': 'relations',
        'indexes': [
            {'fields': ['source']},
            {'fields': ['target']},
            {'fields': ['relation_type']},
            {'fields': ['created_at']}
        ],
        'ordering': ['-created_at']
    }
    
    def __str__(self):
        return f"{self.source.name} → {self.target.name} ({self.relation_type})"
    
    def save(self, *args, **kwargs):
        """保存前更新更新时间"""
        self.updated_at = timezone.now()
        return super().save(*args, **kwargs)
