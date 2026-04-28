# 代码模块

本目录包含零屿笔记应用的代码功能相关服务，用于提供代码执行、格式化、补全等功能，支持多种编程语言。

## 目录结构

- **models/**: 数据模型
  - **code_execution.py**: 代码执行模型，执行记录
  - **code_snippet.py**: 代码片段模型，代码存储
  - **language.py**: 编程语言模型，支持的语言
  - **environment.py**: 执行环境模型，运行环境
- **serializers/**: 序列化器
  - **code_execution.py**: 代码执行序列化器
  - **code_request.py**: 代码请求序列化器
  - **code_snippet.py**: 代码片段序列化器
  - **language.py**: 编程语言序列化器
  - **environment.py**: 执行环境序列化器
- **views/**: 视图
  - **code_complete.py**: 代码补全视图
  - **code_detect.py**: 代码检测视图
  - **code_execution.py**: 代码执行视图
  - **code_format.py**: 代码格式化视图
  - **code_lint.py**: 代码检查视图
  - **code_run.py**: 代码运行视图
  - **code_snippet.py**: 代码片段视图
  - **language.py**: 编程语言视图
  - **environment.py**: 执行环境视图
- **services/**: 业务逻辑
  - **code_execution_service.py**: 代码执行服务
  - **code_service.py**: 代码服务，核心功能
  - **code_snippet_service.py**: 代码片段服务
  - **language_service.py**: 编程语言服务
  - **environment_service.py**: 执行环境服务
  - **formatter_service.py**: 格式化服务
  - **linter_service.py**: 代码检查服务
  - **completion_service.py**: 代码补全服务
  - **sandbox_service.py**: 沙箱服务，安全执行
- **utils/**: 工具函数
  - **languages.py**: 编程语言配置和工具
  - **sandbox.py**: 沙箱工具，隔离执行
  - **formatters.py**: 格式化工具
  - **linters.py**: 代码检查工具
  - **security.py**: 安全工具，防止恶意代码
- **fixtures/**: 初始数据
  - **languages.json**: 编程语言数据
  - **environments.json**: 执行环境数据
- **management/commands/**: 管理命令
  - **setup_code_environments.py**: 设置代码执行环境

## 主要功能

### 代码执行

代码模块提供代码执行功能，支持以下特性：

- **多语言支持**: 支持多种编程语言（Python、JavaScript、Java等）
- **安全执行**: 在沙箱环境中安全执行代码
- **资源限制**: 限制执行时间、内存使用等资源
- **输入输出**: 支持标准输入和输出
- **执行历史**: 记录代码执行历史
- **并发执行**: 支持多个代码片段并发执行
- **环境配置**: 支持自定义执行环境

### 代码格式化

代码模块提供代码格式化功能，支持以下特性：

- **多语言格式化**: 支持多种编程语言的格式化
- **自定义规则**: 支持自定义格式化规则
- **实时格式化**: 支持实时格式化
- **批量格式化**: 支持批量格式化多个文件
- **格式化预览**: 预览格式化结果
- **格式化配置**: 支持导入导出格式化配置
- **格式化建议**: 提供格式化建议

### 代码补全

代码模块提供代码补全功能，支持以下特性：

- **智能补全**: 基于上下文的智能代码补全
- **多语言支持**: 支持多种编程语言的补全
- **API补全**: 自动补全API调用
- **导入补全**: 自动补全导入语句
- **函数补全**: 自动补全函数参数和返回值
- **代码片段**: 支持常用代码片段的补全
- **自定义补全**: 支持自定义补全规则

### 代码检查

代码模块提供代码检查功能，支持以下特性：

- **语法检查**: 检查代码语法错误
- **风格检查**: 检查代码风格问题
- **性能检查**: 检查代码性能问题
- **安全检查**: 检查代码安全漏洞
- **最佳实践**: 检查是否符合最佳实践
- **自定义规则**: 支持自定义检查规则
- **检查报告**: 生成详细的检查报告

### 代码片段管理

代码模块提供代码片段管理功能，支持以下特性：

- **片段创建**: 创建和保存代码片段
- **片段分类**: 对代码片段进行分类
- **片段标签**: 为代码片段添加标签
- **片段搜索**: 搜索代码片段
- **片段分享**: 分享代码片段给其他用户
- **片段版本**: 管理代码片段的版本历史
- **片段导入导出**: 导入导出代码片段

## API端点

代码模块提供以下主要API端点：

- **代码执行API**:
  - `POST /api/code/run/`: 执行代码
  - `GET /api/code/executions/`: 获取执行历史
  - `GET /api/code/executions/{id}/`: 获取特定执行详情
  - `DELETE /api/code/executions/{id}/`: 删除执行记录
  - `GET /api/code/environments/`: 获取可用执行环境

- **代码格式化API**:
  - `POST /api/code/format/`: 格式化代码
  - `GET /api/code/formatters/`: 获取可用格式化器
  - `POST /api/code/format/preview/`: 预览格式化结果
  - `POST /api/code/format/batch/`: 批量格式化代码

- **代码补全API**:
  - `POST /api/code/complete/`: 获取代码补全建议
  - `GET /api/code/snippets/`: 获取代码片段
  - `POST /api/code/complete/context/`: 基于上下文补全代码

- **代码检查API**:
  - `POST /api/code/lint/`: 检查代码
  - `GET /api/code/linters/`: 获取可用代码检查器
  - `POST /api/code/lint/fix/`: 自动修复代码问题
  - `POST /api/code/lint/batch/`: 批量检查代码

- **代码片段API**:
  - `GET /api/code/snippets/`: 获取代码片段列表
  - `POST /api/code/snippets/`: 创建新代码片段
  - `GET /api/code/snippets/{id}/`: 获取特定代码片段详情
  - `PUT /api/code/snippets/{id}/`: 更新代码片段
  - `DELETE /api/code/snippets/{id}/`: 删除代码片段
  - `POST /api/code/snippets/{id}/share/`: 分享代码片段
  - `GET /api/code/snippets/search/`: 搜索代码片段

- **编程语言API**:
  - `GET /api/code/languages/`: 获取支持的编程语言
  - `GET /api/code/languages/{id}/`: 获取特定语言详情
  - `GET /api/code/languages/{id}/features/`: 获取语言支持的功能

## 数据模型

### 代码片段模型 (CodeSnippet)

```python
class CodeSnippet(Document):
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4())
    user = ReferenceField(User, required=True)
    title = StringField(max_length=255, required=True)
    code = StringField(required=True)
    language = ReferenceField('Language', required=True)
    description = StringField()
    tags = ListField(StringField(max_length=100))
    is_public = BooleanField(default=False)
    fork_from = ReferenceField('self')
    version = IntField(default=1)
    created_at = DateTimeField(default=timezone.now)
    updated_at = DateTimeField(default=timezone.now)
    metadata = DictField()
```

### 代码执行模型 (CodeExecution)

```python
class CodeExecution(Document):
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4())
    user = ReferenceField(User, required=True)
    snippet = ReferenceField(CodeSnippet)
    code = StringField(required=True)
    language = ReferenceField('Language', required=True)
    environment = ReferenceField('Environment', required=True)
    input = StringField()
    output = StringField()
    error = StringField()
    execution_time = FloatField()  # in milliseconds
    memory_usage = FloatField()  # in MB
    status = StringField(choices=['pending', 'running', 'completed', 'failed'], default='pending')
    created_at = DateTimeField(default=timezone.now)
    completed_at = DateTimeField()
```

### 编程语言模型 (Language)

```python
class Language(Document):
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4())
    name = StringField(max_length=100, required=True)
    code = StringField(max_length=20, required=True, unique=True)
    version = StringField(max_length=20)
    description = StringField()
    file_extensions = ListField(StringField(max_length=20))
    supports_execution = BooleanField(default=True)
    supports_formatting = BooleanField(default=True)
    supports_linting = BooleanField(default=True)
    supports_completion = BooleanField(default=True)
    created_at = DateTimeField(default=timezone.now)
    updated_at = DateTimeField(default=timezone.now)
```

## 与其他模块的交互

代码模块与以下模块有交互：

- **笔记模块**: 将代码片段嵌入到笔记中
- **AI助手模块**: 利用AI能力分析和生成代码
- **用户模块**: 管理用户的代码执行权限和设置
- **存储模块**: 管理代码片段和执行结果的存储
- **通知模块**: 发送代码执行完成的通知

## 配置说明

代码模块需要以下配置：

- **执行环境**: 各编程语言的执行环境配置
- **资源限制**: 代码执行的资源限制设置
- **安全设置**: 代码执行的安全设置
- **格式化器**: 各编程语言的格式化器配置
- **代码检查器**: 各编程语言的代码检查器配置

## 注意事项

- **安全性**: 确保代码执行的安全性，防止恶意代码
- **资源控制**: 合理限制代码执行的资源使用
- **性能优化**: 优化代码执行和分析的性能
- **多语言支持**: 确保对多种编程语言的良好支持
- **沙箱隔离**: 使用沙箱技术隔离代码执行环境
- **错误处理**: 妥善处理代码执行和分析中的错误
- **用户体验**: 提供友好的界面和反馈，降低使用门槛
