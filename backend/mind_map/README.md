# 思维导图模块

本目录包含零屿笔记应用的思维导图功能相关服务，用于创建、管理和生成思维导图，帮助用户组织和可视化知识结构。

## 目录结构

- **models/**: 数据模型
  - **mind_map.py**: 思维导图模型，存储思维导图基本信息
  - **mind_map_node.py**: 节点模型，思维导图节点
  - **mind_map_edge.py**: 边模型，节点间连接
  - **mind_map_template.py**: 模板模型，预设模板
- **serializers/**: 序列化器
  - **mind_map.py**: 思维导图序列化器
  - **mind_map_node.py**: 节点序列化器
  - **mind_map_edge.py**: 边序列化器
  - **mind_map_template.py**: 模板序列化器
- **views/**: 视图
  - **mind_map_views.py**: 思维导图视图，CRUD操作
  - **template_views.py**: 模板视图，模板管理
  - **generator_views.py**: 生成器视图，自动生成思维导图
  - **export_views.py**: 导出视图，导出思维导图
  - **import_views.py**: 导入视图，导入思维导图
- **services/**: 业务逻辑
  - **mind_map_service.py**: 思维导图服务，核心逻辑
  - **generator_service.py**: 生成器服务，自动生成思维导图
  - **layout_service.py**: 布局服务，计算节点布局
  - **export_service.py**: 导出服务，导出不同格式
  - **import_service.py**: 导入服务，导入不同格式
  - **ai_service.py**: AI服务，智能生成和优化
- **utils/**: 工具函数
  - **layout_utils.py**: 布局工具，布局算法
  - **export_utils.py**: 导出工具，格式转换
  - **import_utils.py**: 导入工具，解析导入
  - **ai_utils.py**: AI工具，AI生成辅助
- **fixtures/**: 初始数据
  - **templates.json**: 模板数据，预设思维导图模板

## 主要功能

### 思维导图管理

思维导图模块提供思维导图管理功能，支持以下特性：

- **思维导图创建**: 创建新的思维导图
- **思维导图编辑**: 编辑现有思维导图的内容和属性
- **思维导图删除**: 删除不再需要的思维导图
- **思维导图查询**: 查询和筛选思维导图
- **思维导图共享**: 与其他用户共享思维导图
- **思维导图版本**: 管理思维导图的版本历史
- **思维导图统计**: 提供思维导图相关的统计信息

### 节点和连接管理

思维导图模块提供节点和连接管理功能，支持以下特性：

- **节点创建**: 创建思维导图节点
- **节点编辑**: 编辑节点的内容和属性
- **节点删除**: 删除不再需要的节点
- **节点移动**: 调整节点的位置
- **连接创建**: 创建节点之间的连接
- **连接编辑**: 编辑连接的属性和样式
- **连接删除**: 删除不再需要的连接
- **批量操作**: 批量处理节点和连接

### 模板管理

思维导图模块提供模板管理功能，支持以下特性：

- **模板创建**: 创建思维导图模板
- **模板使用**: 使用模板创建思维导图
- **模板分类**: 对模板进行分类管理
- **模板共享**: 共享模板给其他用户
- **系统模板**: 提供系统预设的模板
- **模板导入导出**: 导入导出模板
- **模板预览**: 预览模板效果

### 自动生成

思维导图模块提供自动生成功能，支持以下特性：

- **从文本生成**: 从文本内容自动生成思维导图
- **从笔记生成**: 从笔记内容自动生成思维导图
- **从大纲生成**: 从大纲结构自动生成思维导图
- **节点扩展**: 自动扩展现有节点
- **结构优化**: 优化思维导图结构
- **内容丰富**: 丰富节点内容
- **智能建议**: 提供节点和连接建议

### 布局管理

思维导图模块提供布局管理功能，支持以下特性：

- **树形布局**: 传统树形思维导图布局
- **辐射布局**: 以中心节点向外辐射的布局
- **水平布局**: 水平方向展开的布局
- **垂直布局**: 垂直方向展开的布局
- **自由布局**: 自由放置节点的布局
- **自动布局**: 自动计算最佳布局
- **布局调整**: 手动微调布局

### 导入导出

思维导图模块提供导入导出功能，支持以下特性：

- **导出格式**: 支持多种导出格式（PNG、SVG、PDF、JSON等）
- **导入格式**: 支持多种导入格式（XMind、FreeMind、JSON等）
- **高清导出**: 支持高分辨率图像导出
- **选择性导出**: 选择性导出思维导图内容
- **批量导出**: 批量导出多个思维导图
- **导出设置**: 自定义导出参数
- **导入解析**: 解析导入文件，提取内容和结构

## API端点

思维导图模块提供以下主要API端点：

- **思维导图API**:
  - `GET /api/mind-map/`: 获取思维导图列表
  - `POST /api/mind-map/`: 创建新思维导图
  - `GET /api/mind-map/{id}/`: 获取特定思维导图详情
  - `PUT /api/mind-map/{id}/`: 更新思维导图
  - `DELETE /api/mind-map/{id}/`: 删除思维导图
  - `POST /api/mind-map/{id}/share/`: 共享思维导图
  - `GET /api/mind-map/{id}/versions/`: 获取思维导图版本历史
  - `GET /api/mind-map/stats/`: 获取思维导图统计信息

- **节点API**:
  - `GET /api/mind-map/nodes/`: 获取节点列表
  - `POST /api/mind-map/nodes/`: 创建新节点
  - `GET /api/mind-map/nodes/{id}/`: 获取特定节点详情
  - `PUT /api/mind-map/nodes/{id}/`: 更新节点
  - `DELETE /api/mind-map/nodes/{id}/`: 删除节点
  - `POST /api/mind-map/nodes/batch/`: 批量操作节点

- **边API**:
  - `GET /api/mind-map/edges/`: 获取边列表
  - `POST /api/mind-map/edges/`: 创建新边
  - `GET /api/mind-map/edges/{id}/`: 获取特定边详情
  - `PUT /api/mind-map/edges/{id}/`: 更新边
  - `DELETE /api/mind-map/edges/{id}/`: 删除边
  - `POST /api/mind-map/edges/batch/`: 批量操作边

- **模板API**:
  - `GET /api/mind-map/templates/`: 获取模板列表
  - `POST /api/mind-map/templates/`: 创建新模板
  - `GET /api/mind-map/templates/{id}/`: 获取特定模板详情
  - `PUT /api/mind-map/templates/{id}/`: 更新模板
  - `DELETE /api/mind-map/templates/{id}/`: 删除模板
  - `GET /api/mind-map/templates/categories/`: 获取模板分类

- **生成器API**:
  - `POST /api/mind-map/generator/generate/text/`: 从文本生成思维导图
  - `POST /api/mind-map/generator/generate/note/{note_id}/`: 从笔记生成思维导图
  - `POST /api/mind-map/generator/expand-node/`: 扩展节点
  - `POST /api/mind-map/generator/optimize/`: 优化思维导图
  - `POST /api/mind-map/generator/to-outline/`: 转换为大纲
  - `POST /api/mind-map/generator/export/`: 导出思维导图

## 数据模型

### 思维导图模型 (MindMap)

```python
class MindMap(Document):
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4())
    user = ReferenceField(User, required=True)
    title = StringField(max_length=255, required=True)
    description = StringField()
    nodes = ListField(ReferenceField('MindMapNode'))
    edges = ListField(ReferenceField('MindMapEdge'))
    note_id = StringField()  # 关联的笔记ID（可选）
    layout_type = StringField(choices=['tree', 'radial', 'horizontal', 'vertical', 'free'], default='tree')
    theme = StringField(default='default')
    properties = DictField()
    is_public = BooleanField(default=False)
    is_deleted = BooleanField(default=False)
    created_at = DateTimeField(default=timezone.now)
    updated_at = DateTimeField(default=timezone.now)
```

### 节点模型 (MindMapNode)

```python
class MindMapNode(Document):
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4())
    mind_map = ReferenceField(MindMap, required=True)
    parent = ReferenceField('self')
    text = StringField(required=True)
    note = StringField()
    position = DictField()
    style = DictField()
    properties = DictField()
    is_root = BooleanField(default=False)
    is_collapsed = BooleanField(default=False)
    created_at = DateTimeField(default=timezone.now)
    updated_at = DateTimeField(default=timezone.now)
```

### 边模型 (MindMapEdge)

```python
class MindMapEdge(Document):
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4())
    mind_map = ReferenceField(MindMap, required=True)
    source = ReferenceField(MindMapNode, required=True)
    target = ReferenceField(MindMapNode, required=True)
    label = StringField()
    style = DictField()
    properties = DictField()
    created_at = DateTimeField(default=timezone.now)
    updated_at = DateTimeField(default=timezone.now)
```

## 与其他模块的交互

思维导图模块与以下模块有交互：

- **笔记模块**: 从笔记生成思维导图，将思维导图保存为笔记
- **知识图谱模块**: 与知识图谱共享数据，提供知识可视化
- **AI助手模块**: 利用AI能力生成和优化思维导图
- **用户模块**: 管理思维导图的所有权和访问权限
- **存储模块**: 管理思维导图内容和资源的存储

## 注意事项

- **性能优化**: 大型思维导图可能面临性能挑战，需要优化渲染和数据处理
- **布局算法**: 确保布局算法能够处理各种复杂的思维导图结构
- **AI生成质量**: 持续优化AI生成的思维导图质量和相关性
- **导入兼容性**: 确保与主流思维导图工具的导入兼容性
- **导出质量**: 确保导出的图像和文档质量满足用户需求
- **移动适配**: 确保思维导图功能在移动设备上也能良好工作
- **用户体验**: 提供直观的界面和操作，降低学习曲线
