# 画布模块

本目录包含零屿笔记应用的画布功能相关服务，用于提供无限画布、思维导图和流程图等可视化内容的创建和管理。

## 目录结构

- **models/**: 数据模型
  - **canvas.py**: 画布模型，存储画布基本信息
  - **canvas_element.py**: 画布元素模型，节点、文本等
  - **canvas_connection.py**: 画布连接模型，元素间连线
  - **canvas_layer.py**: 画布图层模型，管理元素层级
  - **canvas_version.py**: 画布版本模型，版本历史
- **serializers/**: 序列化器
  - **canvas.py**: 画布序列化器
  - **canvas_element.py**: 画布元素序列化器
  - **canvas_connection.py**: 画布连接序列化器
  - **canvas_layer.py**: 画布图层序列化器
  - **canvas_version.py**: 画布版本序列化器
- **views/**: 视图
  - **canvas.py**: 画布视图，画布CRUD操作
  - **canvas_element.py**: 画布元素视图
  - **canvas_connection.py**: 画布连接视图
  - **canvas_layer.py**: 画布图层视图
  - **canvas_version.py**: 画布版本视图
  - **canvas_export.py**: 画布导出视图
  - **canvas_import.py**: 画布导入视图
- **services/**: 业务逻辑
  - **canvas_service.py**: 画布服务，画布核心逻辑
  - **canvas_element_service.py**: 元素服务
  - **canvas_connection_service.py**: 连接服务
  - **canvas_layer_service.py**: 图层服务
  - **canvas_version_service.py**: 版本服务
  - **export_service.py**: 导出服务
  - **import_service.py**: 导入服务
- **utils/**: 工具函数
  - **canvas_utils.py**: 画布工具函数
  - **svg_utils.py**: SVG处理工具
  - **layout_utils.py**: 布局算法工具

## 主要功能

### 无限画布

画布模块提供无限画布功能，支持以下特性：

- **画布创建**: 创建新的无限画布
- **画布编辑**: 编辑现有画布的内容和属性
- **画布删除**: 删除不再需要的画布
- **画布查询**: 查询和筛选画布
- **画布共享**: 与其他用户共享画布
- **画布导入导出**: 支持多种格式的导入导出

### 元素管理

画布模块提供元素管理功能，支持以下特性：

- **元素创建**: 创建各种类型的元素（文本、形状、图片等）
- **元素编辑**: 编辑元素的属性和内容
- **元素删除**: 删除不再需要的元素
- **元素查询**: 查询和筛选元素
- **元素定位**: 设置元素的位置和大小
- **元素样式**: 设置元素的样式（颜色、边框、阴影等）
- **元素分组**: 将多个元素组合为一个组

### 连接管理

画布模块提供连接管理功能，支持以下特性：

- **连接创建**: 创建元素之间的连接
- **连接编辑**: 编辑连接的属性和样式
- **连接删除**: 删除不再需要的连接
- **连接查询**: 查询和筛选连接
- **连接类型**: 支持多种连接类型（直线、曲线、箭头等）
- **连接样式**: 设置连接的样式（颜色、粗细、虚线等）
- **连接标签**: 为连接添加标签文本

### 图层管理

画布模块提供图层管理功能，支持以下特性：

- **图层创建**: 创建新的图层
- **图层编辑**: 编辑图层的属性和设置
- **图层删除**: 删除不再需要的图层
- **图层排序**: 调整图层的顺序
- **图层可见性**: 控制图层的显示和隐藏
- **图层锁定**: 锁定图层防止编辑
- **图层分组**: 将多个图层组合为一个组

### 版本控制

画布模块提供版本控制功能，支持以下特性：

- **版本创建**: 创建画布的版本快照
- **版本查看**: 查看历史版本
- **版本恢复**: 恢复到之前的版本
- **版本比较**: 比较不同版本之间的差异
- **自动保存**: 定期自动保存画布内容
- **版本注释**: 为版本添加注释，说明修改内容
- **版本清理**: 清理过旧或不需要的版本

### 导入导出

画布模块提供导入导出功能，支持以下特性：

- **导出格式**: 支持多种导出格式（PNG、SVG、PDF等）
- **导入格式**: 支持多种导入格式（SVG、JSON等）
- **选择性导出**: 选择性导出画布内容（特定区域或图层）
- **高分辨率导出**: 支持高分辨率图像导出
- **批量导出**: 批量导出多个画布
- **模板导入**: 从模板导入画布内容
- **外部源导入**: 从外部源（如Figma、Miro等）导入内容

## API端点

画布模块提供以下主要API端点：

- **画布API**:
  - `GET /api/canvas/canvases/`: 获取画布列表
  - `POST /api/canvas/canvases/`: 创建新画布
  - `GET /api/canvas/canvases/{id}/`: 获取特定画布详情
  - `PUT /api/canvas/canvases/{id}/`: 更新画布
  - `DELETE /api/canvas/canvases/{id}/`: 删除画布
  - `POST /api/canvas/canvases/{id}/share/`: 共享画布
  - `GET /api/canvas/canvases/{id}/export/{format}/`: 导出画布
  - `POST /api/canvas/canvases/import/`: 导入画布

- **元素API**:
  - `GET /api/canvas/elements/`: 获取元素列表
  - `POST /api/canvas/elements/`: 创建新元素
  - `GET /api/canvas/elements/{id}/`: 获取特定元素详情
  - `PUT /api/canvas/elements/{id}/`: 更新元素
  - `DELETE /api/canvas/elements/{id}/`: 删除元素
  - `POST /api/canvas/elements/batch/`: 批量操作元素

- **连接API**:
  - `GET /api/canvas/connections/`: 获取连接列表
  - `POST /api/canvas/connections/`: 创建新连接
  - `GET /api/canvas/connections/{id}/`: 获取特定连接详情
  - `PUT /api/canvas/connections/{id}/`: 更新连接
  - `DELETE /api/canvas/connections/{id}/`: 删除连接

- **图层API**:
  - `GET /api/canvas/layers/`: 获取图层列表
  - `POST /api/canvas/layers/`: 创建新图层
  - `GET /api/canvas/layers/{id}/`: 获取特定图层详情
  - `PUT /api/canvas/layers/{id}/`: 更新图层
  - `DELETE /api/canvas/layers/{id}/`: 删除图层
  - `PUT /api/canvas/layers/reorder/`: 重新排序图层

- **版本API**:
  - `GET /api/canvas/canvases/{id}/versions/`: 获取画布版本历史
  - `POST /api/canvas/canvases/{id}/versions/`: 创建新版本
  - `GET /api/canvas/canvases/{id}/versions/{version_id}/`: 获取特定版本详情
  - `POST /api/canvas/canvases/{id}/versions/{version_id}/restore/`: 恢复到特定版本

## 数据模型

### 画布模型 (Canvas)

```python
class Canvas(Document):
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4())
    user = ReferenceField(User, required=True)
    name = StringField(max_length=255, required=True)
    description = StringField()
    width = FloatField(default=5000.0)
    height = FloatField(default=5000.0)
    background_color = StringField(max_length=20, default="#FFFFFF")
    background_image = StringField()
    grid_enabled = BooleanField(default=True)
    grid_size = IntField(default=20)
    zoom_level = FloatField(default=1.0)
    view_position = DictField(default=lambda: {"x": 0, "y": 0})
    elements = ListField(ReferenceField('CanvasElement'))
    connections = ListField(ReferenceField('CanvasConnection'))
    layers = ListField(ReferenceField('CanvasLayer'))
    is_public = BooleanField(default=False)
    is_template = BooleanField(default=False)
    tags = ListField(StringField(max_length=100))
    thumbnail = StringField()
    created_at = DateTimeField(default=timezone.now)
    updated_at = DateTimeField(default=timezone.now)
```

### 元素模型 (CanvasElement)

```python
class CanvasElement(Document):
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4())
    canvas = ReferenceField(Canvas, required=True)
    layer = ReferenceField('CanvasLayer')
    type = StringField(choices=['text', 'shape', 'image', 'group'], required=True)
    content = StringField()
    position = DictField(required=True)
    size = DictField(required=True)
    rotation = FloatField(default=0.0)
    style = DictField()
    properties = DictField()
    is_locked = BooleanField(default=False)
    is_visible = BooleanField(default=True)
    z_index = IntField(default=0)
    created_at = DateTimeField(default=timezone.now)
    updated_at = DateTimeField(default=timezone.now)
```

### 连接模型 (CanvasConnection)

```python
class CanvasConnection(Document):
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4())
    canvas = ReferenceField(Canvas, required=True)
    layer = ReferenceField('CanvasLayer')
    source = ReferenceField(CanvasElement, required=True)
    target = ReferenceField(CanvasElement, required=True)
    type = StringField(choices=['straight', 'curved', 'orthogonal'], default='straight')
    label = StringField()
    points = ListField(DictField())
    style = DictField()
    is_locked = BooleanField(default=False)
    is_visible = BooleanField(default=True)
    z_index = IntField(default=0)
    created_at = DateTimeField(default=timezone.now)
    updated_at = DateTimeField(default=timezone.now)
```

## 与其他模块的交互

画布模块与以下模块有交互：

- **用户模块**: 管理画布的所有权和访问权限
- **笔记模块**: 将画布内容嵌入到笔记中
- **知识图谱模块**: 可视化知识图谱
- **AI助手模块**: 利用AI能力分析和处理画布内容
- **存储模块**: 管理画布内容和资源的存储

## 注意事项

- **性能优化**: 大型画布可能面临性能挑战，需要优化渲染和数据处理
- **实时协作**: 实现多用户实时协作需要考虑冲突解决和数据同步
- **移动适配**: 确保画布功能在移动设备上也能良好工作
- **资源管理**: 妥善管理画布中的图片等资源，避免过度消耗存储空间
- **版本控制**: 合理管理版本历史，避免存储过多历史版本
- **导出质量**: 确保导出的图像和文档质量满足用户需求
- **用户体验**: 提供直观的界面和操作，降低学习曲线
