# 知识库模块

本目录包含零屿笔记应用的知识库功能，旨在为用户提供一个集成化的个人和团队知识管理解决方案。

## 模块定位

知识库模块整合了应用内的知识提取、构建、管理和应用等功能，是实现从“笔记”到“知识”转化的核心引擎。它建立在 `knowledge_graph` 模块的基础之上，并与 `ai_assistant` 模块紧密协作。

## 核心功能

1.  **知识库构建**
    *   **自动构建**：从用户的笔记、文档、网页收藏等多种来源自动提取知识，构建个人知识图谱。
    *   **手动构建**：提供可视化界面，允许用户手动添加、编辑和组织知识节点与关系。
    *   **知识导入**：支持从外部文件（如Markdown、OPML、XMind）或URL导入内容，并自动解析到知识库中。

2.  **知识库管理**
    *   **多库管理**：支持创建和管理多个独立的知识库（如个人知识库、项目知识库、团队知识库）。
    *   **权限控制**：为团队知识库设置精细的成员访问和编辑权限。
    *   **版本与快照**：支持对知识库创建快照，方便版本回溯。

3.  **知识库应用**
    *   **知识问答（Q&A）**：基于知识库内容，提供智能问答功能。AI助手可以理解自然语言问题，并从知识库中寻找和组织答案。
    *   **智能搜索**：提供基于语义的深度搜索，而不仅仅是关键词匹配。
    *   **内容推荐**：根据当前正在浏览或编辑的内容，智能推荐知识库中的相关知识点。
    *   **学习路径规划**：基于知识点的前后置依赖关系，为用户生成个性化的学习路径建议。

4.  **知识库可视化**
    *   提供多种可视化视图（如关系图、树状图、时间线）来探索和理解知识库的结构。

## 目录结构

-   `services/`：核心业务逻辑
    -   `builder_service.py`: 负责知识库的构建和导入。
    -   `management_service.py`: 负责知识库的创建、权限、版本等管理。
    -   `qa_service.py`: 负责实现基于知识库的问答功能。
    -   `application_service.py`: 负责知识推荐、路径规划等应用功能。
-   `views.py`：API接口视图
-   `serializers.py`：数据序列化器
-   `mongodb_models.py`：数据模型（MongoDB）
-   `urls.py`：URL路由配置

## API端点

### 知识库管理

-   `GET /api/knowledge-base/knowledge-bases/` - 获取知识库列表
-   `POST /api/knowledge-base/knowledge-bases/` - 创建新知识库
-   `GET /api/knowledge-base/knowledge-bases/{id}/` - 获取知识库详情
-   `PUT /api/knowledge-base/knowledge-bases/{id}/` - 更新知识库
-   `DELETE /api/knowledge-base/knowledge-bases/{id}/` - 删除知识库

### 知识库构建

-   `POST /api/knowledge-base/knowledge-bases/{id}/build/` - 从笔记构建知识库
    -   请求体：`{"note_ids": [...], "extract_concepts": true}`
-   `POST /api/knowledge-base/knowledge-bases/{id}/import_markdown/` - 从Markdown导入
    -   请求体：`{"content": "...", "source_name": "..."}`

### 知识库问答

-   `POST /api/knowledge-base/knowledge-bases/{id}/ask/` - 向知识库提问
    -   请求体：`{"question": "...", "context_limit": 5}`

### 知识库分析

-   `GET /api/knowledge-base/knowledge-bases/{id}/analyze_gaps/` - 分析知识缺口

## 使用示例

### 1. 创建知识库

```python
import requests

response = requests.post(
    'http://localhost:8000/api/knowledge-base/knowledge-bases/',
    headers={'Authorization': 'Bearer YOUR_TOKEN'},
    json={
        'name': '我的学习知识库',
        'description': '记录学习过程中的知识点',
        'type': 'personal',
        'tags': ['学习', '编程'],
        'is_public': False
    }
)

kb = response.json()
kb_id = kb['id']
```

### 2. 从笔记构建知识库

```python
response = requests.post(
    f'http://localhost:8000/api/knowledge-base/knowledge-bases/{kb_id}/build/',
    headers={'Authorization': 'Bearer YOUR_TOKEN'},
    json={
        'extract_concepts': True
        # 不指定note_ids则使用所有笔记
    }
)

result = response.json()
print(f"处理了 {result['notes_processed']} 个笔记")
print(f"创建了 {result['nodes_created']} 个节点")
print(f"创建了 {result['edges_created']} 条边")
```

### 3. 向知识库提问

```python
response = requests.post(
    f'http://localhost:8000/api/knowledge-base/knowledge-bases/{kb_id}/ask/',
    headers={'Authorization': 'Bearer YOUR_TOKEN'},
    json={
        'question': 'Python中的装饰器是什么？',
        'context_limit': 5
    }
)

result = response.json()
print(f"答案: {result['answer']}")
print(f"相关节点: {result['related_nodes']}")
```

### 4. 从Markdown导入

```python
markdown_content = """
# Python基础

## 数据类型

Python有多种内置数据类型...

## 函数

函数是可重用的代码块...
"""

response = requests.post(
    f'http://localhost:8000/api/knowledge-base/knowledge-bases/{kb_id}/import_markdown/',
    headers={'Authorization': 'Bearer YOUR_TOKEN'},
    json={
        'content': markdown_content,
        'source_name': 'Python学习笔记'
    }
)

result = response.json()
print(f"导入成功，创建了 {result['nodes_created']} 个节点")
```

### 5. 分析知识缺口

```python
response = requests.get(
    f'http://localhost:8000/api/knowledge-base/knowledge-bases/{kb_id}/analyze_gaps/',
    headers={'Authorization': 'Bearer YOUR_TOKEN'}
)

result = response.json()
print(f"孤立节点: {len(result['gaps']['isolated_nodes'])}")
print(f"建议: {result['suggestions']}")
```

## 与其他模块的集成

-   **knowledge_graph**: 知识库底层使用知识图谱模块存储和管理知识节点和关系
-   **notes**: 从笔记中提取知识构建知识库
-   **ai_assistant**: 使用AI助手进行知识提取、问答和推荐
-   **search**: 集成搜索功能，在知识库中快速查找内容

## 未来扩展

1.  **知识库协作**：支持多人实时编辑和协作
2.  **知识库模板**：提供预设的知识库模板（如编程、医学、法律等领域）
3.  **知识库导出**：支持导出为PDF、思维导图等格式
4.  **知识库API**：提供RESTful API供第三方应用集成
5.  **知识库插件**：支持自定义插件扩展知识库功能
