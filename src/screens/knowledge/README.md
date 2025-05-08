# 知识图谱模块

本目录包含零屿笔记应用的知识图谱功能相关屏幕组件。知识图谱模块允许用户构建和可视化知识节点之间的关系，进行知识管理和分析。

## 文件结构

- **index.js**: 知识图谱模块导出文件，集中导出所有知识图谱相关屏幕
- **KnowledgeGraphScreen.js**: 知识图谱主屏幕，显示用户的知识图谱
- **NodeDetailScreen.js**: 节点详情屏幕，显示知识节点的详细信息
- **HandwritingRecognitionScreen.js**: 手写识别屏幕，用于识别手写内容并添加到知识图谱
- **KnowledgeAnalysisScreen.js**: 知识分析屏幕，用于分析知识结构和关系
- **EdgeEditScreen.js**: 边编辑屏幕，用于编辑知识节点之间的关系

## 主要功能

### 知识图谱主屏幕 (KnowledgeGraphScreen)

知识图谱主屏幕是用户进入知识图谱功能的入口，主要功能包括：

- 可视化显示用户的知识图谱，包括节点和关系
- 支持缩放、平移和节点拖拽
- 提供节点搜索和筛选功能
- 支持添加新节点和关系
- 提供知识分析入口

### 节点详情屏幕 (NodeDetailScreen)

节点详情屏幕用于显示知识节点的详细信息，主要功能包括：

- 显示节点基本信息（名称、描述、创建时间等）
- 显示节点关联的笔记和文件
- 显示节点的入边和出边（关系）
- 支持编辑节点信息
- 支持添加和删除关系

### 手写识别屏幕 (HandwritingRecognitionScreen)

手写识别屏幕用于识别手写内容并添加到知识图谱，主要功能包括：

- 手写输入区域
- 实时手写识别
- 识别结果编辑
- 将识别结果添加为知识节点或关系

### 知识分析屏幕 (KnowledgeAnalysisScreen)

知识分析屏幕用于分析知识结构和关系，主要功能包括：

- 显示知识图谱的结构分析结果
- 显示中心节点和重要关系
- 支持路径查找和可视化
- 支持相关概念推荐
- 支持自动分类和标签生成

### 边编辑屏幕 (EdgeEditScreen)

边编辑屏幕用于编辑知识节点之间的关系，主要功能包括：

- 设置关系类型
- 设置关系属性
- 设置关系方向（单向/双向）
- 设置关系权重

## 使用的组件

知识图谱模块使用了以下主要组件：

- **GraphVisualization**: 图谱可视化组件，用于可视化展示知识图谱
- **NodeDetail**: 节点详情组件，用于显示知识节点的详细信息
- **EdgeEditor**: 边编辑器组件，用于编辑知识节点之间的关系
- **PathVisualization**: 路径可视化组件，用于可视化展示节点之间的路径
- **StructureAnalysis**: 结构分析组件，用于显示知识图谱的结构分析结果
- **RelatedConceptsView**: 相关概念视图组件，用于显示相关概念
- **AutoClassification**: 自动分类组件，用于自动分类和标签生成
- **KnowledgeGraphBuilder**: 知识图谱构建器组件，用于从笔记构建知识图谱

## 与其他模块的交互

知识图谱模块与以下模块有交互：

- **笔记模块**: 支持从笔记中提取知识点和关系
- **AI助手模块**: 提供智能分析和推荐功能
- **搜索模块**: 支持知识图谱内容的搜索

## API交互

知识图谱模块主要与以下API端点交互：

- **GET /api/knowledge-graph**: 获取用户的知识图谱
- **GET /api/knowledge-graph/nodes**: 获取知识节点列表
- **GET /api/knowledge-graph/nodes/:id**: 获取知识节点详情
- **POST /api/knowledge-graph/nodes**: 创建新知识节点
- **PUT /api/knowledge-graph/nodes/:id**: 更新知识节点
- **DELETE /api/knowledge-graph/nodes/:id**: 删除知识节点
- **GET /api/knowledge-graph/edges**: 获取知识边列表
- **POST /api/knowledge-graph/edges**: 创建新知识边
- **PUT /api/knowledge-graph/edges/:id**: 更新知识边
- **DELETE /api/knowledge-graph/edges/:id**: 删除知识边
- **GET /api/knowledge-graph/analyze**: 分析知识图谱结构
- **GET /api/knowledge-graph/find-path**: 查找节点之间的路径

## 状态管理

知识图谱模块的状态主要通过Redux进行管理，相关的状态切片包括：

- **knowledgeGraphSlice**: 管理知识图谱相关状态，如节点列表、边列表、当前查看的节点等
