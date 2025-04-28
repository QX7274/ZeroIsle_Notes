"""
AI助手模块MongoDB文档模型
使用MongoEngine ODM定义MongoDB文档模型
"""

from mongoengine import Document, StringField, DateTimeField, BooleanField, IntField, FloatField, DecimalField
from mongoengine import UUIDField, ReferenceField, ListField, DictField, URLField, EmbeddedDocument, EmbeddedDocumentField
from django.utils import timezone
import uuid
from users.mongodb_models import User

class ModelConfig(Document):
    """
    模型配置文档模型
    存储可用的AI模型配置
    """
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4(), verbose_name='配置ID')
    name = StringField(max_length=50, required=True, unique=True, verbose_name='名称')
    provider = StringField(max_length=50, required=True, verbose_name='提供商')
    description = StringField(verbose_name='描述')
    max_tokens = IntField(required=True, verbose_name='最大令牌数')
    token_limit = IntField(required=True, verbose_name='令牌限制')
    default_temperature = FloatField(default=0.7, verbose_name='默认温度')
    supports_functions = BooleanField(default=False, verbose_name='支持函数调用')
    supports_vision = BooleanField(default=False, verbose_name='支持视觉')
    price_per_1k_tokens_input = DecimalField(precision=10, rounding='ROUND_HALF_UP', verbose_name='输入每千令牌价格')
    price_per_1k_tokens_output = DecimalField(precision=10, rounding='ROUND_HALF_UP', verbose_name='输出每千令牌价格')
    is_active = BooleanField(default=True, verbose_name='是否激活')
    is_default = BooleanField(default=False, verbose_name='是否默认')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')
    
    meta = {
        'collection': 'ai_model_configs',
        'indexes': [
            {'fields': ['name'], 'unique': True},
            {'fields': ['provider']},
            {'fields': ['is_active']},
            {'fields': ['is_default']}
        ],
        'ordering': ['provider', 'name']
    }
    
    def __str__(self):
        return f"{self.provider} - {self.name}"
    
    def save(self, *args, **kwargs):
        """保存前更新更新时间"""
        self.updated_at = timezone.now()
        
        # 确保只有一个默认模型
        if self.is_default:
            ModelConfig.objects(is_default=True, id__ne=self.id).update(is_default=False)
            
        return super().save(*args, **kwargs)
    
    @classmethod
    def get_default(cls):
        """获取默认模型"""
        try:
            return cls.objects.get(is_default=True, is_active=True)
        except cls.DoesNotExist:
            # 如果没有默认模型，返回第一个激活的模型
            return cls.objects.filter(is_active=True).first()

class Message(EmbeddedDocument):
    """
    消息嵌入文档模型
    存储对话中的单条消息
    """
    ROLE_CHOICES = (
        ('user', '用户'),
        ('assistant', '助手'),
        ('system', '系统'),
    )
    
    id = UUIDField(default=lambda: uuid.uuid4(), verbose_name='消息ID')
    role = StringField(max_length=10, choices=ROLE_CHOICES, required=True, verbose_name='角色')
    content = StringField(required=True, verbose_name='内容')
    tokens = IntField(default=0, verbose_name='令牌数')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    
    def __str__(self):
        return f"{self.role}: {self.content[:50]}"

class Conversation(Document):
    """
    对话文档模型
    存储用户与AI助手的对话
    """
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4(), verbose_name='对话ID')
    user = ReferenceField(User, required=True, verbose_name='用户')
    title = StringField(max_length=255, required=True, verbose_name='标题')
    description = StringField(verbose_name='描述')
    model = StringField(max_length=50, default='gpt-3.5-turbo', verbose_name='模型')
    system_prompt = StringField(verbose_name='系统提示词')
    temperature = FloatField(default=0.7, verbose_name='温度')
    max_tokens = IntField(default=2000, verbose_name='最大令牌数')
    messages = ListField(EmbeddedDocumentField(Message), verbose_name='消息列表')
    is_pinned = BooleanField(default=False, verbose_name='是否置顶')
    is_deleted = BooleanField(default=False, verbose_name='是否删除')
    last_message_at = DateTimeField(default=timezone.now, verbose_name='最后消息时间')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')
    deleted_at = DateTimeField(verbose_name='删除时间')
    
    meta = {
        'collection': 'ai_conversations',
        'indexes': [
            {'fields': ['user']},
            {'fields': ['is_deleted']},
            {'fields': ['is_pinned']},
            {'fields': ['last_message_at']},
            {'fields': ['created_at']}
        ],
        'ordering': ['-last_message_at']
    }
    
    def __str__(self):
        return self.title or f"对话 {self.id}"
    
    def save(self, *args, **kwargs):
        """保存前更新更新时间"""
        self.updated_at = timezone.now()
        return super().save(*args, **kwargs)
    
    def delete(self):
        """软删除"""
        self.is_deleted = True
        self.deleted_at = timezone.now()
        self.save()
    
    def hard_delete(self):
        """硬删除"""
        super().delete()
    
    @property
    def message_count(self):
        """消息数量"""
        return len(self.messages)
    
    @property
    def total_tokens(self):
        """总令牌数"""
        return sum(message.tokens for message in self.messages)
    
    def add_message(self, role, content, tokens=0):
        """
        添加消息
        
        Args:
            role: 角色 (user/assistant/system)
            content: 内容
            tokens: 令牌数
            
        Returns:
            Message: 创建的消息
        """
        message = Message(
            role=role,
            content=content,
            tokens=tokens,
            created_at=timezone.now()
        )
        self.messages.append(message)
        self.last_message_at = timezone.now()
        self.save()
        return message
    
    def get_messages_for_api(self):
        """
        获取用于API调用的消息列表
        
        Returns:
            list: 消息列表
        """
        return [
            {
                'role': message.role,
                'content': message.content
            }
            for message in self.messages
        ]

class PromptTemplate(Document):
    """
    提示模板文档模型
    存储预定义的提示模板
    """
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4(), verbose_name='模板ID')
    name = StringField(max_length=100, required=True, verbose_name='名称')
    description = StringField(verbose_name='描述')
    category = StringField(max_length=50, verbose_name='分类')
    content = StringField(required=True, verbose_name='内容')
    variables = ListField(StringField(), verbose_name='变量列表')
    is_system = BooleanField(default=False, verbose_name='是否系统模板')
    user = ReferenceField(User, verbose_name='用户')  # 如果是用户自定义模板，关联用户
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')
    
    meta = {
        'collection': 'ai_prompt_templates',
        'indexes': [
            {'fields': ['name']},
            {'fields': ['category']},
            {'fields': ['is_system']},
            {'fields': ['user']},
            {'fields': ['created_at']}
        ],
        'ordering': ['category', 'name']
    }
    
    def __str__(self):
        return self.name
    
    def save(self, *args, **kwargs):
        """保存前更新更新时间"""
        self.updated_at = timezone.now()
        return super().save(*args, **kwargs)
    
    def render(self, variables):
        """
        渲染模板
        
        Args:
            variables: 变量字典
            
        Returns:
            str: 渲染后的内容
        """
        content = self.content
        for key, value in variables.items():
            content = content.replace(f"{{{{{key}}}}}", str(value))
        return content

class UsageRecord(Document):
    """
    使用记录文档模型
    存储AI模型使用记录
    """
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4(), verbose_name='记录ID')
    user = ReferenceField(User, required=True, verbose_name='用户')
    conversation = ReferenceField(Conversation, verbose_name='对话')
    model = StringField(max_length=50, required=True, verbose_name='模型')
    prompt_tokens = IntField(default=0, verbose_name='提示令牌数')
    completion_tokens = IntField(default=0, verbose_name='完成令牌数')
    total_tokens = IntField(default=0, verbose_name='总令牌数')
    cost = DecimalField(precision=10, rounding='ROUND_HALF_UP', default=0, verbose_name='成本')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    
    meta = {
        'collection': 'ai_usage_records',
        'indexes': [
            {'fields': ['user']},
            {'fields': ['model']},
            {'fields': ['conversation']},
            {'fields': ['created_at']}
        ],
        'ordering': ['-created_at']
    }
    
    def __str__(self):
        return f"{self.user.username} - {self.model} - {self.total_tokens} tokens"
    
    def calculate_cost(self, model_config=None):
        """
        计算成本
        
        Args:
            model_config: 模型配置对象
            
        Returns:
            Decimal: 成本
        """
        if not model_config:
            try:
                model_config = ModelConfig.objects.get(name=self.model)
            except ModelConfig.DoesNotExist:
                return 0
        
        # 计算成本
        input_cost = (self.prompt_tokens / 1000) * model_config.price_per_1k_tokens_input
        output_cost = (self.completion_tokens / 1000) * model_config.price_per_1k_tokens_output
        
        return input_cost + output_cost

class Feedback(Document):
    """
    反馈文档模型
    存储用户对AI回复的反馈
    """
    RATING_CHOICES = (
        (1, '非常差'),
        (2, '差'),
        (3, '一般'),
        (4, '好'),
        (5, '非常好'),
    )
    
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4(), verbose_name='反馈ID')
    user = ReferenceField(User, required=True, verbose_name='用户')
    conversation = ReferenceField(Conversation, required=True, verbose_name='对话')
    message_id = UUIDField(required=True, verbose_name='消息ID')
    rating = IntField(choices=RATING_CHOICES, required=True, verbose_name='评分')
    comment = StringField(verbose_name='评论')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    
    meta = {
        'collection': 'ai_feedbacks',
        'indexes': [
            {'fields': ['user']},
            {'fields': ['conversation']},
            {'fields': ['message_id']},
            {'fields': ['rating']},
            {'fields': ['created_at']}
        ],
        'ordering': ['-created_at']
    }
    
    def __str__(self):
        return f"{self.user.username} - {self.rating} stars"
