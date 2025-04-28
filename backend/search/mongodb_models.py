"""
搜索模块MongoDB文档模型
使用MongoEngine ODM定义MongoDB文档模型
"""

from mongoengine import Document, StringField, DateTimeField, BooleanField, IntField, FloatField
from mongoengine import UUIDField, ReferenceField, ListField, DictField, URLField, BinaryField
from django.utils import timezone
import uuid
from users.mongodb_models import User

class SearchIndex(Document):
    """
    搜索索引文档模型
    存储可搜索内容的索引
    """
    INDEX_TYPE_CHOICES = (
        ('note', '笔记'),
        ('tag', '标签'),
        ('category', '分类'),
        ('knowledge_node', '知识节点'),
        ('transcription', '转录'),
        ('community_post', '社区帖子'),
        ('community_comment', '社区评论'),
    )
    
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4(), verbose_name='索引ID')
    user = ReferenceField(User, required=True, verbose_name='用户')
    title = StringField(max_length=255, required=True, verbose_name='标题')
    content = StringField(verbose_name='内容')
    keywords = StringField(verbose_name='关键词')
    index_type = StringField(max_length=20, choices=INDEX_TYPE_CHOICES, required=True, verbose_name='索引类型')
    content_type = StringField(required=True, verbose_name='内容类型')  # 'Note', 'Tag', etc.
    object_id = StringField(required=True, verbose_name='对象ID')
    vector = BinaryField(verbose_name='向量表示')  # 存储向量表示，用于语义搜索
    is_public = BooleanField(default=False, verbose_name='是否公开')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')
    
    meta = {
        'collection': 'search_indices',
        'indexes': [
            {'fields': ['user']},
            {'fields': ['index_type']},
            {'fields': ['content_type', 'object_id'], 'unique': True},
            {'fields': ['is_public']},
            {'fields': ['created_at']},
            {'fields': ['updated_at']}
        ],
        'ordering': ['-updated_at']
    }
    
    def __str__(self):
        return f"{self.index_type}: {self.title}"
    
    def save(self, *args, **kwargs):
        """保存前更新更新时间"""
        self.updated_at = timezone.now()
        return super().save(*args, **kwargs)

class SearchQuery(Document):
    """
    搜索查询文档模型
    存储用户的搜索查询历史
    """
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4(), verbose_name='查询ID')
    user = ReferenceField(User, required=True, verbose_name='用户')
    query = StringField(max_length=255, required=True, verbose_name='查询内容')
    filters = DictField(default=dict, verbose_name='过滤条件')
    result_count = IntField(default=0, verbose_name='结果数量')
    execution_time = FloatField(default=0, verbose_name='执行时间(秒)')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    
    meta = {
        'collection': 'search_queries',
        'indexes': [
            {'fields': ['user']},
            {'fields': ['query']},
            {'fields': ['created_at']}
        ],
        'ordering': ['-created_at']
    }
    
    def __str__(self):
        return f"{self.user.username}: {self.query}"

class SearchResult(Document):
    """
    搜索结果文档模型
    存储搜索查询的结果
    """
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4(), verbose_name='结果ID')
    query = ReferenceField(SearchQuery, required=True, verbose_name='查询')
    title = StringField(max_length=255, required=True, verbose_name='标题')
    snippet = StringField(verbose_name='摘要')
    score = FloatField(default=0, verbose_name='相关度分数')
    position = IntField(default=0, verbose_name='位置')
    content_type = StringField(required=True, verbose_name='内容类型')  # 'Note', 'Tag', etc.
    object_id = StringField(required=True, verbose_name='对象ID')
    result_type = StringField(max_length=20, required=True, verbose_name='结果类型')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    
    meta = {
        'collection': 'search_results',
        'indexes': [
            {'fields': ['query']},
            {'fields': ['content_type', 'object_id']},
            {'fields': ['position']}
        ],
        'ordering': ['position']
    }
    
    def __str__(self):
        return f"{self.query.query} - {self.title} ({self.score})"

class SearchSuggestion(Document):
    """
    搜索建议文档模型
    存储搜索建议
    """
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4(), verbose_name='建议ID')
    user = ReferenceField(User, verbose_name='用户')  # 可以为空，表示全局建议
    text = StringField(max_length=255, required=True, verbose_name='建议文本')
    frequency = IntField(default=1, verbose_name='频率')
    is_global = BooleanField(default=False, verbose_name='是否全局')
    last_used = DateTimeField(default=timezone.now, verbose_name='最后使用时间')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    
    meta = {
        'collection': 'search_suggestions',
        'indexes': [
            {'fields': ['user']},
            {'fields': ['text']},
            {'fields': ['is_global']},
            {'fields': ['frequency']},
            {'fields': ['last_used']},
            {'fields': ['user', 'text'], 'unique': True, 'sparse': True}  # 用户建议唯一
        ],
        'ordering': ['-frequency', '-last_used']
    }
    
    def __str__(self):
        if self.user:
            return f"{self.user.username}: {self.text} ({self.frequency})"
        return f"全局: {self.text} ({self.frequency})"
    
    def save(self, *args, **kwargs):
        """保存前更新最后使用时间"""
        self.last_used = timezone.now()
        return super().save(*args, **kwargs)
    
    def increment_frequency(self):
        """增加频率"""
        self.frequency += 1
        self.save()
