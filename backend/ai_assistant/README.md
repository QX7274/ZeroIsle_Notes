# AI助手模块

本目录包含零屿笔记应用的AI助手功能相关服务，用于提供智能对话、内容生成和分析功能。

## 目录结构

- **mongodb_models.py**: MongoDB文档模型
  - **Conversation**: 对话模型，存储用户与AI的对话
  - **Message**: 消息模型，存储对话中的消息
  - **Feedback**: 反馈模型，用户对AI回复的评价
  - **ModelConfig**: 模型配置，AI模型参数设置
  - **PromptTemplate**: 提示模板，预设的AI提示
  - **UsageRecord**: 使用记录，跟踪API调用
  - **Embedding**: 嵌入模型，向量表示
- **serializers/**: 序列化器
  - **conversation.py**: 对话序列化器
  - **feedback.py**: 反馈序列化器
  - **message.py**: 消息序列化器
  - **model_config.py**: 模型配置序列化器
  - **prompt_template.py**: 提示模板序列化器
- **views/**: 视图
  - **conversation.py**: 对话视图，处理对话请求
  - **feedback.py**: 反馈视图，处理用户反馈
  - **message.py**: 消息视图，单条消息操作
  - **model_config.py**: 模型配置视图，AI模型设置
  - **embedding.py**: 嵌入视图，生成文本嵌入
- **services/**: 业务逻辑
  - **baidu_service.py**: 百度AI服务，接入百度AI能力
  - **conversation_service.py**: 对话服务，核心对话逻辑
  - **openai_service.py**: OpenAI服务，GPT接口调用
  - **prompt_service.py**: 提示服务，提示词处理
  - **token_counter.py**: Token计数器，计算API消耗
  - **embedding_service.py**: 嵌入服务，文本向量化
  - **anthropic_service.py**: Anthropic服务，Claude接口调用
- **fixtures/**: 初始数据
  - **model_configs.json**: 模型配置数据
  - **prompt_templates.json**: 提示模板数据

## 主要功能

### 智能对话

AI助手模块提供智能对话功能，支持以下特性：

- **多轮对话**: 支持上下文感知的多轮对话
- **个性化回复**: 根据用户偏好和历史交互调整回复风格
- **知识库集成**: 结合用户笔记和知识图谱提供更准确的回复
- **多模型支持**: 支持OpenAI、百度、讯飞、Anthropic等多种AI模型
- **流式响应**: 支持流式返回AI回复，提供更好的用户体验
- **对话历史管理**: 保存和管理用户的对话历史
- **对话导出**: 支持将对话导出为不同格式

### 内容生成

AI助手模块提供内容生成功能，支持以下特性：

- **笔记摘要**: 自动生成笔记内容的摘要
- **内容扩写**: 根据简短输入生成详细内容
- **大纲生成**: 为文章或笔记生成结构化大纲
- **标题生成**: 根据内容自动生成合适的标题
- **创意写作**: 提供创意写作辅助，如诗歌、故事等
- **格式转换**: 将内容转换为不同格式，如Markdown、HTML等
- **多语言翻译**: 支持多种语言之间的翻译

### 内容分析

AI助手模块提供内容分析功能，支持以下特性：

- **情感分析**: 分析文本的情感倾向
- **关键词提取**: 从文本中提取关键词和术语
- **实体识别**: 识别文本中的人物、地点、组织等实体
- **主题分类**: 对文本进行主题分类
- **语义相似度**: 计算文本之间的语义相似度
- **文本聚类**: 对大量文本进行聚类分析
- **语言检测**: 自动检测文本的语言

### 用户反馈

AI助手模块提供用户反馈功能，支持以下特性：

- **回复评分**: 用户对AI回复进行评分
- **反馈收集**: 收集用户对AI回复的详细反馈
- **模型优化**: 根据用户反馈优化AI模型
- **问题报告**: 用户报告不当或错误的回复
- **反馈分析**: 分析用户反馈，识别改进点

## API端点

AI助手模块提供以下主要API端点：

- **对话API**:
  - `POST /api/ai-assistant/chat/`: 发送消息并获取AI回复
  - `GET /api/ai-assistant/conversations/`: 获取对话历史列表
  - `GET /api/ai-assistant/conversations/{id}/`: 获取特定对话详情
  - `DELETE /api/ai-assistant/conversations/{id}/`: 删除对话
  - `POST /api/ai-assistant/conversations/{id}/export/`: 导出对话

- **内容生成API**:
  - `POST /api/ai-assistant/generate/summary/`: 生成内容摘要
  - `POST /api/ai-assistant/generate/expand/`: 扩展内容
  - `POST /api/ai-assistant/generate/outline/`: 生成内容大纲
  - `POST /api/ai-assistant/generate/title/`: 生成标题
  - `POST /api/ai-assistant/translate/`: 翻译内容

- **内容分析API**:
  - `POST /api/ai-assistant/analyze/sentiment/`: 情感分析
  - `POST /api/ai-assistant/analyze/keywords/`: 关键词提取
  - `POST /api/ai-assistant/analyze/entities/`: 实体识别
  - `POST /api/ai-assistant/analyze/topics/`: 主题分类
  - `POST /api/ai-assistant/analyze/similarity/`: 计算相似度

- **反馈API**:
  - `POST /api/ai-assistant/feedback/`: 提交反馈
  - `GET /api/ai-assistant/feedback/`: 获取反馈列表
  - `GET /api/ai-assistant/feedback/{id}/`: 获取特定反馈详情

- **配置API**:
  - `GET /api/ai-assistant/models/`: 获取可用模型列表
  - `GET /api/ai-assistant/models/{id}/`: 获取特定模型配置
  - `GET /api/ai-assistant/templates/`: 获取提示模板列表
  - `GET /api/ai-assistant/templates/{id}/`: 获取特定提示模板

## 数据模型

### 对话模型 (Conversation)

```python
class Conversation(Document):
    """
    对话文档模型
    """
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4(), verbose_name='对话ID')
    user = ReferenceField(User, required=True, verbose_name='用户')
    title = StringField(max_length=255, verbose_name='标题')
    messages = ListField(EmbeddedDocumentField('Message'), verbose_name='消息列表')
    model = StringField(max_length=100, verbose_name='模型')
    is_deleted = BooleanField(default=False, verbose_name='是否删除')
    is_favorite = BooleanField(default=False, verbose_name='是否收藏')
    is_pinned = BooleanField(default=False, verbose_name='是否置顶')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')
    deleted_at = DateTimeField(verbose_name='删除时间')
    metadata = DictField(verbose_name='元数据')

    # MongoDB Realm相关字段
    realm_id = StringField(max_length=100, sparse=True, verbose_name='Realm ID')
    realm_partition = StringField(max_length=100, sparse=True, verbose_name='Realm Partition')
    realm_sync_status = StringField(max_length=20, choices=('pending', 'synced', 'error'), default='pending', verbose_name='Realm同步状态')
    realm_last_sync_time = DateTimeField(verbose_name='最后同步时间')
    realm_error_message = StringField(verbose_name='同步错误信息')
```

### 消息模型 (Message)

```python
class Message(EmbeddedDocument):
    """
    消息嵌入文档模型
    """
    id = UUIDField(default=lambda: uuid.uuid4(), verbose_name='消息ID')
    role = StringField(choices=('user', 'assistant', 'system'), required=True, verbose_name='角色')
    content = StringField(required=True, verbose_name='内容')
    timestamp = DateTimeField(default=timezone.now, verbose_name='时间戳')
    tokens = IntField(default=0, verbose_name='Token数量')
    is_deleted = BooleanField(default=False, verbose_name='是否删除')
    metadata = DictField(verbose_name='元数据')
```

### 反馈模型 (Feedback)

```python
class Feedback(Document):
    """
    反馈文档模型
    """
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4(), verbose_name='反馈ID')
    user = ReferenceField(User, required=True, verbose_name='用户')
    conversation = ReferenceField(Conversation, verbose_name='对话')
    message_id = UUIDField(verbose_name='消息ID')
    rating = IntField(min_value=1, max_value=5, verbose_name='评分')
    comment = StringField(verbose_name='评论')
    category = StringField(max_length=50, choices=('helpful', 'not_helpful', 'inappropriate', 'inaccurate', 'other'), verbose_name='分类')
    is_resolved = BooleanField(default=False, verbose_name='是否已解决')
    resolution = StringField(verbose_name='解决方案')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')
    metadata = DictField(verbose_name='元数据')
```

### 模型配置 (ModelConfig)

```python
class ModelConfig(Document):
    """
    模型配置文档模型
    """
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4(), verbose_name='配置ID')
    name = StringField(max_length=100, required=True, verbose_name='名称')
    provider = StringField(max_length=50, choices=('openai', 'anthropic', 'baidu', 'xunfei', 'local'), required=True, verbose_name='提供商')
    model_id = StringField(max_length=100, required=True, verbose_name='模型ID')
    description = StringField(verbose_name='描述')
    parameters = DictField(verbose_name='参数')
    is_active = BooleanField(default=True, verbose_name='是否激活')
    is_default = BooleanField(default=False, verbose_name='是否默认')
    created_at = DateTimeField(default=timezone.now, verbose_name='创建时间')
    updated_at = DateTimeField(default=timezone.now, verbose_name='更新时间')
```

## 与其他模块的交互

AI助手模块与以下模块有交互：

- **用户模块**: 获取用户信息和权限
- **笔记模块**: 访问用户笔记内容，提供相关回复
- **知识图谱模块**: 利用知识图谱提供更准确的回复
- **搜索模块**: 搜索相关内容，辅助回复生成
- **存储模块**: 存储对话历史和用户反馈
- **MongoDB Realm**: 同步对话历史到本地存储，支持离线访问

## 配置说明

AI助手模块需要以下配置：

- **API密钥**: 各AI服务提供商的API密钥
- **模型参数**: 不同模型的参数设置，如温度、最大长度等
- **限流设置**: API调用频率和配额限制
- **默认提示词**: 系统默认的提示词模板
- **向量数据库**: 用于存储和检索文本嵌入的数据库配置

## 使用示例

### 发送对话请求

```python
# 视图函数示例
@api_view(['POST'])
def chat(request):
    user = request.user
    data = request.data

    # 获取请求参数
    message = data.get('message')
    conversation_id = data.get('conversation_id')
    model = data.get('model', 'gpt-3.5-turbo')

    # 调用对话服务
    conversation_service = ConversationService()
    response = conversation_service.process_message(
        user=user,
        message=message,
        conversation_id=conversation_id,
        model=model
    )

    return Response(response)
```

### 生成内容摘要

```python
# 视图函数示例
@api_view(['POST'])
def generate_summary(request):
    user = request.user
    data = request.data

    # 获取请求参数
    text = data.get('text')
    max_length = data.get('max_length', 200)
    model = data.get('model', 'gpt-3.5-turbo')

    # 调用生成服务
    openai_service = OpenAIService()
    summary = openai_service.generate_summary(
        text=text,
        max_length=max_length,
        model=model
    )

    return Response({'summary': summary})
```

## 注意事项

- **API密钥安全**: 确保API密钥安全存储，不要硬编码在代码中
- **错误处理**: 妥善处理API调用错误，提供友好的错误提示
- **内容审核**: 实施内容审核机制，过滤不当内容
- **用户隐私**: 保护用户数据隐私，遵循相关法规
- **成本控制**: 监控API调用成本，实施合理的使用限制
- **模型选择**: 根据任务需求选择合适的模型，平衡性能和成本
- **缓存策略**: 实施合理的缓存策略，减少重复API调用
- **离线支持**: 确保对话历史在MongoDB Realm中正确同步，支持离线访问
- **数据同步**: 处理好本地数据和云端数据的同步冲突
- **存储优化**: 优化对话历史的存储，避免占用过多设备存储空间
