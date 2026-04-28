"""
知识库MongoDB模型
"""

import uuid
from mongoengine import (
    Document, EmbeddedDocument,
    StringField, UUIDField, ReferenceField, ListField,
    DictField, BooleanField, DateTimeField, IntField, EmbeddedDocumentField
)
from django.utils import timezone


class KnowledgeBase(Document):
    """
    知识库模型
    表示一个独立的知识库实例
    """
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4())
    name = StringField(max_length=255, required=True)
    description = StringField()
    owner = ReferenceField('User', required=True)
    
    # 知识库类型
    type = StringField(
        choices=['personal', 'project', 'team', 'public'],
        default='personal'
    )
    
    # 知识库设置
    settings = DictField(default=dict)
    
    # 统计信息
    node_count = IntField(default=0)
    edge_count = IntField(default=0)
    note_count = IntField(default=0)
    
    # 可见性和权限
    is_public = BooleanField(default=False)
    members = ListField(EmbeddedDocumentField('KnowledgeBaseMember'))
    
    # 图标和封面
    icon = StringField()
    cover_image = StringField()
    
    # 标签
    tags = ListField(StringField(max_length=100))
    
    # 状态
    is_archived = BooleanField(default=False)
    is_deleted = BooleanField(default=False)
    
    # 时间戳
    created_at = DateTimeField(default=timezone.now)
    updated_at = DateTimeField(default=timezone.now)
    
    meta = {
        'collection': 'knowledge_bases',
        'indexes': [
            'owner',
            'type',
            'is_public',
            'is_deleted',
            'created_at',
            'updated_at'
        ]
    }
    
    def __str__(self):
        return f"{self.name} ({self.type})"


class KnowledgeBaseMember(EmbeddedDocument):
    """
    知识库成员
    嵌入在知识库中的成员信息
    """
    user = ReferenceField('User', required=True)
    role = StringField(
        choices=['owner', 'admin', 'editor', 'viewer'],
        default='viewer'
    )
    permissions = ListField(StringField())
    joined_at = DateTimeField(default=timezone.now)


class KnowledgeBaseSnapshot(Document):
    """
    知识库快照
    用于版本控制和回滚
    """
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4())
    knowledge_base = ReferenceField(KnowledgeBase, required=True)
    name = StringField(max_length=255)
    description = StringField()
    
    # 快照数据
    snapshot_data = DictField()
    
    # 统计信息
    node_count = IntField(default=0)
    edge_count = IntField(default=0)
    
    # 创建信息
    created_by = ReferenceField('User', required=True)
    created_at = DateTimeField(default=timezone.now)
    
    meta = {
        'collection': 'knowledge_base_snapshots',
        'indexes': [
            'knowledge_base',
            'created_at'
        ]
    }


class KnowledgeBaseImport(Document):
    """
    知识库导入记录
    记录从外部源导入知识的历史
    """
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4())
    knowledge_base = ReferenceField(KnowledgeBase, required=True)
    user = ReferenceField('User', required=True)
    
    # 导入源信息
    source_type = StringField(
        choices=['file', 'url', 'api', 'other'],
        required=True
    )
    source_name = StringField()
    source_url = StringField()
    
    # 导入状态
    status = StringField(
        choices=['pending', 'processing', 'completed', 'failed'],
        default='pending'
    )
    
    # 导入结果
    nodes_created = IntField(default=0)
    edges_created = IntField(default=0)
    error_message = StringField()
    
    # 时间戳
    started_at = DateTimeField(default=timezone.now)
    completed_at = DateTimeField()
    
    meta = {
        'collection': 'knowledge_base_imports',
        'indexes': [
            'knowledge_base',
            'user',
            'status',
            'started_at'
        ]
    }


class KnowledgeBaseQuery(Document):
    """
    知识库查询记录
    记录用户对知识库的问答查询
    """
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4())
    knowledge_base = ReferenceField(KnowledgeBase, required=True)
    user = ReferenceField('User', required=True)
    
    # 查询内容
    question = StringField(required=True)
    answer = StringField()
    
    # 相关节点
    related_nodes = ListField(ReferenceField('KnowledgeNode'))
    
    # 查询质量评分
    rating = IntField(min_value=1, max_value=5)
    feedback = StringField()
    
    # 时间戳
    created_at = DateTimeField(default=timezone.now)
    
    meta = {
        'collection': 'knowledge_base_queries',
        'indexes': [
            'knowledge_base',
            'user',
            'created_at'
        ]
    }

