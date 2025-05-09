# 知识图谱模块

本目录包含零屿笔记应用的知识图谱功能相关服务，用于构建和管理知识点之间的关联，提供知识网络的可视化和分析。

## 目录结构

- **models/**: 数据模型
  - **node.py**: 节点模型，知识点
  - **edge.py**: 边模型，知识关系
  - **graph.py**: 图谱模型，整体图谱
- **serializers/**: 序列化器
  - **node.py**: 节点序列化器
  - **edge.py**: 边序列化器
  - **graph.py**: 图谱序列化器
- **views/**: 视图
  - **node.py**: 节点视图
  - **edge.py**: 边视图
  - **graph.py**: 图谱视图，整体操作
  - **mongo_views.py**: MongoDB视图，使用MongoDB存储
  - **auto_classification_views.py**: 自动分类视图，自动标签和分类
- **services/**: 业务逻辑
  - **graph_service.py**: 图谱服务，图谱操作
  - **neo4j_service.py**: Neo4j服务，图数据库交互
  - **classification_service.py**: 分类服务，自动分类和标签
  - **recommendation_service.py**: 推荐服务，内容推荐
  - **extraction_service.py**: 提取服务，从文本提取知识
- **utils/**: 工具函数
  - **graph_utils.py**: 图谱工具，算法和辅助函数
  - **visualization_utils.py**: 可视化工具，图谱可视化
  - **import_export_utils.py**: 导入导出工具，图谱数据交换

## 主要功能

### 知识图谱管理

知识图谱模块提供知识图谱管理功能，支持以下特性：

- **图谱创建**: 创建新的知识图谱
- **图谱编辑**: 编辑现有知识图谱的属性和设置
- **图谱删除**: 删除不再需要的知识图谱
- **图谱查询**: 查询和筛选知识图谱
- **图谱共享**: 与其他用户共享知识图谱
- **图谱导入导出**: 支持多种格式的导入导出

### 节点管理

知识图谱模块提供节点管理功能，支持以下特性：

- **节点创建**: 创建新的知识节点
- **节点编辑**: 编辑现有节点的属性和内容
- **节点删除**: 删除不再需要的节点
- **节点查询**: 查询和筛选节点
- **节点分类**: 对节点进行分类
- **节点标签**: 为节点添加标签
- **节点链接**: 将节点链接到笔记或外部资源

### 关系管理

知识图谱模块提供关系管理功能，支持以下特性：

- **关系创建**: 创建节点之间的关系
- **关系编辑**: 编辑现有关系的属性和类型
- **关系删除**: 删除不再需要的关系
- **关系查询**: 查询和筛选关系
- **关系类型**: 支持多种关系类型，如"包含"、"相关"、"前提"等
- **关系权重**: 设置关系的重要性或强度
- **双向关系**: 支持双向关系的创建和管理

### 图谱分析

知识图谱模块提供图谱分析功能，支持以下特性：

- **路径分析**: 查找节点之间的路径
- **中心性分析**: 识别图谱中的关键节点
- **社区检测**: 发现知识点的聚类和社区
- **相似度分析**: 计算节点之间的相似度
- **知识推荐**: 基于图谱结构推荐相关知识
- **知识缺口识别**: 识别知识图谱中的缺口和不完整部分
- **学习路径生成**: 生成个性化的学习路径

### 自动知识提取

知识图谱模块提供自动知识提取功能，支持以下特性：

- **实体提取**: 从文本中提取实体
- **关系提取**: 从文本中提取实体间的关系
- **概念提取**: 从文本中提取概念和术语
- **自动分类**: 自动对知识点进行分类
- **自动标签**: 自动为知识点生成标签
- **知识整合**: 将新提取的知识整合到现有图谱中
- **冲突解决**: 解决知识整合过程中的冲突

### 图谱可视化

知识图谱模块提供图谱可视化功能，支持以下特性：

- **交互式可视化**: 支持缩放、平移、点击等交互操作
- **布局算法**: 支持多种图布局算法
- **节点样式**: 自定义节点的颜色、大小、形状等
- **边样式**: 自定义边的颜色、粗细、样式等
- **过滤器**: 根据属性过滤显示的节点和边
- **聚焦视图**: 聚焦于特定节点及其相关节点
- **导出图像**: 将可视化结果导出为图像

## API端点

知识图谱模块提供以下主要API端点：

- **图谱API**:
  - `GET /api/knowledge-graph/graphs/`: 获取图谱列表
  - `POST /api/knowledge-graph/graphs/`: 创建新图谱
  - `GET /api/knowledge-graph/graphs/{id}/`: 获取特定图谱详情
  - `PUT /api/knowledge-graph/graphs/{id}/`: 更新图谱
  - `DELETE /api/knowledge-graph/graphs/{id}/`: 删除图谱
  - `POST /api/knowledge-graph/graphs/{id}/share/`: 共享图谱
  - `GET /api/knowledge-graph/graphs/{id}/export/{format}/`: 导出图谱
  - `POST /api/knowledge-graph/graphs/import/`: 导入图谱

- **节点API**:
  - `GET /api/knowledge-graph/nodes/`: 获取节点列表
  - `POST /api/knowledge-graph/nodes/`: 创建新节点
  - `GET /api/knowledge-graph/nodes/{id}/`: 获取特定节点详情
  - `PUT /api/knowledge-graph/nodes/{id}/`: 更新节点
  - `DELETE /api/knowledge-graph/nodes/{id}/`: 删除节点
  - `GET /api/knowledge-graph/nodes/{id}/related/`: 获取相关节点

- **边API**:
  - `GET /api/knowledge-graph/edges/`: 获取边列表
  - `POST /api/knowledge-graph/edges/`: 创建新边
  - `GET /api/knowledge-graph/edges/{id}/`: 获取特定边详情
  - `PUT /api/knowledge-graph/edges/{id}/`: 更新边
  - `DELETE /api/knowledge-graph/edges/{id}/`: 删除边

- **分析API**:
  - `POST /api/knowledge-graph/analyze/path/`: 路径分析
  - `POST /api/knowledge-graph/analyze/centrality/`: 中心性分析
  - `POST /api/knowledge-graph/analyze/community/`: 社区检测
  - `POST /api/knowledge-graph/analyze/similarity/`: 相似度分析
  - `POST /api/knowledge-graph/analyze/recommend/`: 知识推荐
  - `POST /api/knowledge-graph/analyze/gaps/`: 知识缺口识别
  - `POST /api/knowledge-graph/analyze/learning-path/`: 学习路径生成

- **提取API**:
  - `POST /api/knowledge-graph/extract/entities/`: 实体提取
  - `POST /api/knowledge-graph/extract/relations/`: 关系提取
  - `POST /api/knowledge-graph/extract/concepts/`: 概念提取
  - `POST /api/knowledge-graph/extract/from-text/`: 从文本提取知识
  - `POST /api/knowledge-graph/extract/from-note/`: 从笔记提取知识
  - `POST /api/knowledge-graph/extract/auto-tag/`: 自动标签生成

- **可视化API**:
  - `GET /api/knowledge-graph/visualize/{id}/`: 获取图谱可视化数据
  - `POST /api/knowledge-graph/visualize/{id}/filter/`: 过滤可视化数据
  - `GET /api/knowledge-graph/visualize/{id}/focus/{node_id}/`: 获取聚焦视图
  - `GET /api/knowledge-graph/visualize/{id}/image/`: 获取图谱图像

## 数据模型

### 图谱模型 (KnowledgeGraph)

```python
class KnowledgeGraph(Document):
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4())
    user = ReferenceField(User, required=True)
    name = StringField(max_length=255, required=True)
    description = StringField()
    nodes = ListField(ReferenceField('KnowledgeNode'))
    edges = ListField(ReferenceField('KnowledgeEdge'))
    settings = DictField()
    thumbnail = StringField()
    is_public = BooleanField(default=False)
    created_at = DateTimeField(default=timezone.now)
    updated_at = DateTimeField(default=timezone.now)
```

### 节点模型 (KnowledgeNode)

```python
class KnowledgeNode(Document):
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4())
    user = ReferenceField(User, required=True)
    graph = ReferenceField(KnowledgeGraph)
    name = StringField(max_length=255, required=True)
    description = StringField()
    content = StringField()
    type = StringField(choices=['concept', 'entity', 'event', 'process', 'other'])
    tags = ListField(StringField(max_length=100))
    properties = DictField()
    references = ListField(DictField())
    position = DictField()
    is_deleted = BooleanField(default=False)
    created_at = DateTimeField(default=timezone.now)
    updated_at = DateTimeField(default=timezone.now)
```

### 边模型 (KnowledgeEdge)

```python
class KnowledgeEdge(Document):
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4())
    user = ReferenceField(User, required=True)
    graph = ReferenceField(KnowledgeGraph)
    source = ReferenceField(KnowledgeNode, required=True)
    target = ReferenceField(KnowledgeNode, required=True)
    type = StringField(choices=['includes', 'related', 'prerequisite', 'causes', 'other'])
    label = StringField(max_length=255)
    description = StringField()
    weight = FloatField(default=1.0)
    properties = DictField()
    is_deleted = BooleanField(default=False)
    created_at = DateTimeField(default=timezone.now)
    updated_at = DateTimeField(default=timezone.now)
```

## 与其他模块的交互

知识图谱模块与以下模块有交互：

- **笔记模块**: 从笔记中提取知识，将节点链接到笔记
- **AI助手模块**: 利用AI能力进行知识提取和分析
- **搜索模块**: 提供基于图谱的语义搜索功能
- **用户模块**: 管理图谱的访问权限和共享
- **标签模块**: 共享标签系统，保持一致性

## 配置说明

知识图谱模块需要以下配置：

- **Neo4j配置**: Neo4j图数据库的连接信息
- **MongoDB配置**: MongoDB数据库的连接信息
- **AI服务配置**: 用于知识提取的AI服务配置
- **可视化配置**: 图谱可视化的默认设置
- **分析算法配置**: 图分析算法的参数设置

## 注意事项

- **性能优化**: 大型图谱可能面临性能挑战，需要优化查询和渲染
- **数据一致性**: 确保MongoDB和Neo4j中的数据保持一致
- **用户体验**: 提供直观的界面，降低知识图谱使用的门槛
- **错误处理**: 妥善处理图谱操作中的错误，提供友好的错误提示
- **数据备份**: 定期备份图谱数据，防止数据丢失
- **隐私保护**: 保护用户的知识图谱数据，遵循相关法规
- **扩展性**: 设计良好的API，便于未来功能扩展
