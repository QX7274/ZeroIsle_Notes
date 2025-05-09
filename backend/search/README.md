# 搜索模块

本目录包含零屿笔记应用的搜索功能相关服务，用于提供全文搜索和语义搜索功能，帮助用户快速找到所需内容。

## 目录结构

- **models/**: 数据模型
  - **search_index.py**: 搜索索引模型，索引记录
  - **search_query.py**: 搜索查询模型，查询历史
  - **search_result.py**: 搜索结果模型，结果缓存
  - **search_synonym.py**: 搜索同义词模型，同义词管理
  - **search_filter.py**: 搜索过滤器模型，过滤条件
- **serializers/**: 序列化器
  - **search_index.py**: 搜索索引序列化器
  - **search_query.py**: 搜索查询序列化器
  - **search_result.py**: 搜索结果序列化器
  - **search_synonym.py**: 搜索同义词序列化器
  - **search_filter.py**: 搜索过滤器序列化器
- **views/**: 视图
  - **search.py**: 搜索视图，搜索入口
  - **search_index.py**: 搜索索引视图，索引管理
  - **search_query.py**: 搜索查询视图，查询历史
  - **search_synonym.py**: 搜索同义词视图，同义词管理
  - **search_filter.py**: 搜索过滤器视图，过滤条件管理
  - **suggestion.py**: 搜索建议视图，提供搜索建议
  - **trending.py**: 热门搜索视图，显示热门搜索
- **services/**: 业务逻辑
  - **indexer_service.py**: 索引服务，建立索引
  - **search_service.py**: 搜索服务，执行搜索
  - **suggestion_service.py**: 建议服务，搜索建议
  - **vector_service.py**: 向量服务，语义搜索
  - **elasticsearch_service.py**: Elasticsearch服务，全文搜索
  - **synonym_service.py**: 同义词服务，同义词管理
- **connectors/**: 搜索连接器
  - **elasticsearch_connector.py**: ES连接器
  - **vector_db_connector.py**: 向量数据库连接器
- **utils/**: 工具函数
  - **query_parser.py**: 查询解析器，解析搜索查询
  - **result_formatter.py**: 结果格式化器，格式化搜索结果
  - **relevance_calculator.py**: 相关性计算器，计算结果相关性
  - **highlight_utils.py**: 高亮工具，高亮搜索结果

## 主要功能

### 全文搜索

搜索模块提供全文搜索功能，支持以下特性：

- **基本搜索**: 支持关键词和短语搜索
- **高级搜索**: 支持布尔运算符、通配符、模糊搜索等
- **过滤搜索**: 根据类型、日期、标签等过滤搜索结果
- **排序选项**: 支持多种排序选项（相关性、日期等）
- **分页结果**: 分页返回搜索结果
- **结果高亮**: 高亮显示匹配的关键词
- **搜索建议**: 提供搜索建议和自动完成

### 语义搜索

搜索模块提供语义搜索功能，支持以下特性：

- **向量搜索**: 基于文本向量的相似度搜索
- **概念搜索**: 搜索相关概念，而不仅仅是关键词
- **跨语言搜索**: 支持不同语言之间的搜索
- **相似度排序**: 根据语义相似度排序结果
- **语义聚类**: 对搜索结果进行语义聚类
- **相关内容推荐**: 基于语义相似度推荐相关内容
- **查询扩展**: 自动扩展查询以包含相关概念

### 多模态搜索

搜索模块提供多模态搜索功能，支持以下特性：

- **文本搜索**: 搜索文本内容
- **图像搜索**: 搜索图像内容和图像中的文本
- **语音搜索**: 通过语音输入进行搜索
- **混合搜索**: 组合多种模态进行搜索
- **OCR集成**: 识别图像中的文本进行搜索
- **图像相似度**: 查找视觉上相似的图像
- **跨模态检索**: 使用一种模态搜索另一种模态的内容

### 搜索索引

搜索模块提供搜索索引功能，支持以下特性：

- **索引创建**: 创建和管理搜索索引
- **增量索引**: 支持增量更新索引
- **实时索引**: 实时索引新增和修改的内容
- **索引优化**: 优化索引结构，提高搜索性能
- **索引统计**: 提供索引统计信息
- **索引备份**: 备份和恢复索引
- **索引监控**: 监控索引状态和性能

### 搜索历史和分析

搜索模块提供搜索历史和分析功能，支持以下特性：

- **搜索历史**: 记录和管理用户的搜索历史
- **热门搜索**: 显示热门搜索关键词
- **搜索趋势**: 分析搜索趋势和模式
- **搜索建议**: 基于历史和趋势提供搜索建议
- **个性化搜索**: 根据用户历史个性化搜索结果
- **搜索分析**: 分析搜索行为和结果
- **搜索报告**: 生成搜索使用报告

### 同义词和词典管理

搜索模块提供同义词和词典管理功能，支持以下特性：

- **同义词管理**: 管理搜索同义词
- **停用词管理**: 管理搜索停用词
- **自定义词典**: 支持自定义词典
- **术语扩展**: 自动扩展搜索术语
- **拼写纠正**: 纠正搜索查询中的拼写错误
- **词干提取**: 提取词干，提高搜索匹配率
- **分词优化**: 优化中文分词效果

## API端点

搜索模块提供以下主要API端点：

- **搜索API**:
  - `GET /api/search/`: 基本搜索
  - `POST /api/search/advanced/`: 高级搜索
  - `POST /api/search/semantic/`: 语义搜索
  - `POST /api/search/multimodal/`: 多模态搜索
  - `GET /api/search/suggest/`: 获取搜索建议
  - `GET /api/search/trending/`: 获取热门搜索

- **索引API**:
  - `GET /api/search/indexes/`: 获取索引列表
  - `POST /api/search/indexes/`: 创建新索引
  - `GET /api/search/indexes/{id}/`: 获取特定索引详情
  - `PUT /api/search/indexes/{id}/`: 更新索引
  - `DELETE /api/search/indexes/{id}/`: 删除索引
  - `POST /api/search/indexes/{id}/optimize/`: 优化索引
  - `POST /api/search/indexes/{id}/backup/`: 备份索引
  - `POST /api/search/indexes/{id}/restore/`: 恢复索引

- **历史API**:
  - `GET /api/search/history/`: 获取搜索历史
  - `DELETE /api/search/history/{id}/`: 删除特定搜索历史
  - `DELETE /api/search/history/clear/`: 清除所有搜索历史
  - `GET /api/search/history/stats/`: 获取搜索历史统计

- **同义词API**:
  - `GET /api/search/synonyms/`: 获取同义词列表
  - `POST /api/search/synonyms/`: 创建新同义词
  - `GET /api/search/synonyms/{id}/`: 获取特定同义词详情
  - `PUT /api/search/synonyms/{id}/`: 更新同义词
  - `DELETE /api/search/synonyms/{id}/`: 删除同义词
  - `POST /api/search/synonyms/import/`: 导入同义词
  - `GET /api/search/synonyms/export/`: 导出同义词

- **过滤器API**:
  - `GET /api/search/filters/`: 获取过滤器列表
  - `POST /api/search/filters/`: 创建新过滤器
  - `GET /api/search/filters/{id}/`: 获取特定过滤器详情
  - `PUT /api/search/filters/{id}/`: 更新过滤器
  - `DELETE /api/search/filters/{id}/`: 删除过滤器
  - `GET /api/search/filters/presets/`: 获取预设过滤器

## 数据模型

### 搜索索引模型 (SearchIndex)

```python
class SearchIndex(Document):
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4())
    name = StringField(max_length=100, required=True)
    description = StringField()
    type = StringField(choices=['notes', 'knowledge_graph', 'community', 'all'], required=True)
    status = StringField(choices=['building', 'ready', 'updating', 'error'], default='building')
    document_count = IntField(default=0)
    last_updated = DateTimeField(default=timezone.now)
    settings = DictField()
    error_message = StringField()
    created_at = DateTimeField(default=timezone.now)
    updated_at = DateTimeField(default=timezone.now)
```

### 搜索查询模型 (SearchQuery)

```python
class SearchQuery(Document):
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4())
    user = ReferenceField(User, required=True)
    query_text = StringField(required=True)
    query_type = StringField(choices=['basic', 'advanced', 'semantic', 'multimodal'], default='basic')
    filters = DictField()
    result_count = IntField(default=0)
    execution_time = FloatField()  # in milliseconds
    created_at = DateTimeField(default=timezone.now)
    ip_address = StringField()
    user_agent = StringField()
```

### 搜索同义词模型 (SearchSynonym)

```python
class SearchSynonym(Document):
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4())
    term = StringField(required=True)
    synonyms = ListField(StringField())
    is_bidirectional = BooleanField(default=True)
    created_by = ReferenceField(User)
    created_at = DateTimeField(default=timezone.now)
    updated_at = DateTimeField(default=timezone.now)
```

## 与其他模块的交互

搜索模块与以下模块有交互：

- **笔记模块**: 索引和搜索笔记内容
- **知识图谱模块**: 索引和搜索知识图谱内容
- **社区模块**: 索引和搜索社区内容
- **用户模块**: 管理用户的搜索权限和历史
- **AI助手模块**: 利用AI能力增强搜索功能

## 配置说明

搜索模块需要以下配置：

- **Elasticsearch配置**: Elasticsearch服务器的连接信息
- **向量数据库配置**: 向量数据库的连接信息
- **索引配置**: 索引的设置和映射
- **搜索配置**: 搜索的默认参数和限制
- **分词器配置**: 中文分词器的配置
- **同义词配置**: 同义词的默认设置

## 注意事项

- **性能优化**: 大规模索引和复杂查询可能面临性能挑战，需要优化
- **资源消耗**: 搜索服务可能消耗大量资源，需要合理配置
- **增量索引**: 实现高效的增量索引机制，避免全量重建
- **查询解析**: 妥善处理复杂查询语法，提供友好的错误提示
- **相关性调优**: 调整相关性算法，提高搜索结果质量
- **多语言支持**: 考虑多语言搜索的特殊需求
- **安全性**: 防止注入攻击和敏感信息泄露
- **隐私保护**: 保护用户的搜索历史和个人数据
