# 零屿笔记后端服务

零屿笔记后端服务是基于Django和Django REST Framework开发的RESTful API服务，为零屿笔记移动应用提供数据支持。本项目采用模块化设计，每个功能模块都有清晰的职责划分，便于维护和扩展。

## 技术栈

- **Django 4.2.7**: Web框架，提供ORM、认证、路由等核心功能
- **Django REST Framework 3.14**: RESTful API框架，用于构建API接口
- **MongoDB**: 主数据库，通过djongo适配器连接，存储笔记、用户数据等
- **Neo4j**: 图数据库，用于构建和查询知识图谱
- **Redis**: 缓存和消息队列，提高应用性能和可靠性
- **Celery**: 异步任务处理，用于处理耗时操作和定时任务
- **Channels**: WebSocket支持，实现实时通信功能
- **JWT**: 用户认证，提供安全的API访问机制
- **Swagger/ReDoc**: API文档生成工具，自动生成交互式API文档
- **Elasticsearch**: 全文搜索引擎，提供高效的搜索功能
- **Sentence Transformers**: 语义搜索，支持基于向量的相似度搜索

## 目录结构

```
backend/
├── ai_assistant/           # AI助手模块（智能对话和内容生成）
│   ├── models/             # 数据模型
│   │   ├── conversation.py # 对话模型（存储用户与AI的对话）
│   │   ├── feedback.py     # 反馈模型（用户对AI回复的评价）
│   │   ├── model_config.py # 模型配置（AI模型参数设置）
│   │   ├── prompt_template.py # 提示模板（预设的AI提示）
│   │   ├── usage_record.py # 使用记录（跟踪API调用）
│   │   └── embedding.py    # 嵌入模型（向量表示）
│   ├── serializers/        # 序列化器
│   │   ├── conversation.py # 对话序列化器
│   │   ├── feedback.py     # 反馈序列化器
│   │   ├── message.py      # 消息序列化器
│   │   ├── model_config.py # 模型配置序列化器
│   │   └── prompt_template.py # 提示模板序列化器
│   ├── views/              # 视图
│   │   ├── conversation.py # 对话视图（处理对话请求）
│   │   ├── feedback.py     # 反馈视图（处理用户反馈）
│   │   ├── message.py      # 消息视图（单条消息操作）
│   │   ├── model_config.py # 模型配置视图（AI模型设置）
│   │   └── embedding.py    # 嵌入视图（生成文本嵌入）
│   ├── services/           # 业务逻辑
│   │   ├── baidu_service.py # 百度AI服务（接入百度AI能力）
│   │   ├── conversation_service.py # 对话服务（核心对话逻辑）
│   │   ├── openai_service.py # OpenAI服务（GPT接口调用）
│   │   ├── prompt_service.py # 提示服务（提示词处理）
│   │   ├── token_counter.py # Token计数器（计算API消耗）
│   │   ├── embedding_service.py # 嵌入服务（文本向量化）
│   │   └── anthropic_service.py # Anthropic服务（Claude接口调用）
│   └── fixtures/           # 初始数据
│       ├── model_configs.json # 模型配置数据
│       └── prompt_templates.json # 提示模板数据
├── backend/                # Django项目配置
│   ├── settings/           # 分环境设置
│   │   ├── __init__.py     # 设置入口
│   │   ├── base.py         # 基础设置（所有环境共享）
│   │   ├── development.py  # 开发环境设置（调试模式）
│   │   ├── production.py   # 生产环境设置（性能优化）
│   │   └── testing.py      # 测试环境设置（测试配置）
│   ├── urls.py             # URL路由配置（全局URL映射）
│   ├── wsgi.py             # WSGI配置（Web服务器网关接口）
│   ├── asgi.py             # ASGI配置（异步服务器网关接口）
│   ├── celery.py           # Celery配置（任务队列设置）
│   ├── middleware.py       # 全局中间件（请求/响应处理）
│   ├── routing.py          # WebSocket路由（实时通信）
│   └── logging.py          # 日志配置（应用日志设置）
├── canvas/                 # 无限画布模块（思维导图和流程图）
│   ├── models/             # 数据模型
│   │   ├── canvas.py       # 画布模型（存储画布基本信息）
│   │   ├── canvas_element.py # 画布元素模型（节点、文本等）
│   │   └── canvas_connection.py # 画布连接模型（元素间连线）
│   ├── serializers/        # 序列化器
│   │   ├── canvas.py       # 画布序列化器
│   │   ├── canvas_element.py # 画布元素序列化器
│   │   └── canvas_connection.py # 画布连接序列化器
│   ├── views/              # 视图
│   │   ├── canvas.py       # 画布视图（画布CRUD操作）
│   │   ├── canvas_element.py # 画布元素视图
│   │   └── canvas_connection.py # 画布连接视图
│   └── services/           # 业务逻辑
│       ├── canvas_service.py # 画布服务（画布核心逻辑）
│       ├── canvas_element_service.py # 元素服务
│       └── canvas_connection_service.py # 连接服务
├── code/                   # 代码执行模块（多语言代码运行）
│   ├── models/             # 数据模型
│   │   ├── code_execution.py # 代码执行模型（执行记录）
│   │   └── code_snippet.py # 代码片段模型（代码存储）
│   ├── serializers/        # 序列化器
│   │   ├── code_execution.py # 代码执行序列化器
│   │   ├── code_request.py # 代码请求序列化器
│   │   └── code_snippet.py # 代码片段序列化器
│   ├── views/              # 视图
│   │   ├── code_complete.py # 代码补全视图（智能补全）
│   │   ├── code_detect.py  # 代码检测视图（语言检测）
│   │   ├── code_execution.py # 代码执行视图（运行代码）
│   │   ├── code_format.py  # 代码格式化视图（美化代码）
│   │   ├── code_lint.py    # 代码检查视图（语法检查）
│   │   └── code_run.py     # 代码运行视图（简单执行）
│   ├── services/           # 业务逻辑
│   │   ├── code_execution_service.py # 代码执行服务
│   │   ├── code_service.py # 代码服务（通用代码处理）
│   │   └── code_snippet_service.py # 代码片段服务
│   └── utils/              # 工具函数
│       └── languages.py    # 语言工具（支持的编程语言配置）
├── common/                 # 公共组件和工具（跨模块共享）
│   ├── middleware.py       # 自定义中间件（请求/响应处理）
│   ├── permissions.py      # 权限类（访问控制）
│   ├── exceptions.py       # 异常处理（自定义错误）
│   ├── models.py           # 基础模型（模型基类）
│   ├── pagination.py       # 分页类（结果集分页）
│   ├── validators.py       # 验证器（数据验证）
│   └── utils.py            # 工具函数（通用功能）
├── community/              # 社区功能模块（用户交流和分享）
│   ├── models/             # 数据模型
│   │   ├── category.py     # 分类模型（内容分类）
│   │   ├── comment.py      # 评论模型（用户评论）
│   │   ├── follow.py       # 关注模型（用户关系）
│   │   ├── like.py         # 点赞模型（内容互动）
│   │   ├── notification.py # 通知模型（用户通知）
│   │   ├── post.py         # 帖子模型（用户发布内容）
│   │   └── tag.py          # 标签模型（内容标签）
│   ├── serializers/        # 序列化器
│   │   ├── category.py     # 分类序列化器
│   │   ├── comment.py      # 评论序列化器
│   │   ├── follow.py       # 关注序列化器
│   │   ├── like.py         # 点赞序列化器
│   │   ├── notification.py # 通知序列化器
│   │   ├── post.py         # 帖子序列化器
│   │   └── tag.py          # 标签序列化器
│   ├── views/              # 视图
│   │   ├── category.py     # 分类视图
│   │   ├── comment.py      # 评论视图
│   │   ├── follow.py       # 关注视图
│   │   ├── like.py         # 点赞视图
│   │   ├── notification.py # 通知视图
│   │   ├── post.py         # 帖子视图
│   │   └── tag.py          # 标签视图
│   ├── services/           # 业务逻辑
│   │   ├── comment_service.py # 评论服务
│   │   ├── follow_service.py # 关注服务
│   │   ├── like_service.py # 点赞服务
│   │   ├── notification_service.py # 通知服务
│   │   └── post_service.py # 帖子服务
│   └── fixtures/           # 初始数据
│       ├── categories.json # 分类数据
│       └── tags.json       # 标签数据
├── knowledge_graph/        # 知识图谱模块（知识关系可视化）
│   ├── models/             # 数据模型
│   │   ├── node.py         # 节点模型（知识点）
│   │   ├── edge.py         # 边模型（知识关系）
│   │   └── graph.py        # 图谱模型（整体图谱）
│   ├── serializers/        # 序列化器
│   │   ├── node.py         # 节点序列化器
│   │   ├── edge.py         # 边序列化器
│   │   └── graph.py        # 图谱序列化器
│   ├── views/              # 视图
│   │   ├── node.py         # 节点视图
│   │   ├── edge.py         # 边视图
│   │   └── graph.py        # 图谱视图（整体操作）
│   ├── services/           # 业务逻辑
│   │   ├── graph_service.py # 图谱服务（图谱操作）
│   │   └── neo4j_service.py # Neo4j服务（图数据库交互）
│   └── utils/              # 工具函数
│       └── graph_utils.py  # 图谱工具（算法和辅助函数）
├── media/                  # 媒体文件存储（用户上传文件）
├── notes/                  # 笔记核心模块（笔记管理）
│   ├── models/             # 数据模型
│   │   ├── note.py         # 笔记模型（核心笔记数据）
│   │   ├── note_category.py # 笔记分类模型
│   │   ├── note_tag.py     # 笔记标签模型
│   │   └── note_version.py # 笔记版本模型（历史记录）
│   ├── serializers/        # 序列化器
│   │   ├── note.py         # 笔记序列化器
│   │   ├── note_category.py # 笔记分类序列化器
│   │   ├── note_tag.py     # 笔记标签序列化器
│   │   └── note_version.py # 笔记版本序列化器
│   ├── views/              # 视图
│   │   ├── note.py         # 笔记视图（CRUD操作）
│   │   ├── note_category.py # 笔记分类视图
│   │   ├── note_tag.py     # 笔记标签视图
│   │   └── note_version.py # 笔记版本视图
│   ├── services/           # 业务逻辑
│   │   ├── note_service.py # 笔记服务（核心业务逻辑）
│   │   ├── export_service.py # 导出服务（导出不同格式）
│   │   └── import_service.py # 导入服务（导入不同格式）
│   └── tests/              # 测试
│       ├── test_models.py  # 模型测试
│       └── test_views.py   # 视图测试
├── reminder/               # 提醒功能模块（定时提醒）
│   ├── models/             # 数据模型
│   │   ├── reminder.py     # 提醒模型（提醒设置）
│   │   └── reminder_notification.py # 提醒通知模型（通知记录）
│   ├── serializers/        # 序列化器
│   │   ├── reminder.py     # 提醒序列化器
│   │   └── reminder_notification.py # 提醒通知序列化器
│   ├── views/              # 视图
│   │   ├── reminder.py     # 提醒视图
│   │   └── reminder_notification.py # 提醒通知视图
│   ├── services/           # 业务逻辑
│   │   ├── reminder_service.py # 提醒服务（提醒管理）
│   │   └── notification_service.py # 通知服务（发送通知）
│   └── management/         # 管理命令
│       └── commands/       # 自定义命令
│           └── process_reminders.py # 处理提醒命令（定时任务）
├── search/                 # 搜索功能模块（全文和语义搜索）
│   ├── models/             # 数据模型
│   │   ├── search_index.py # 搜索索引模型（索引记录）
│   │   ├── search_query.py # 搜索查询模型（查询历史）
│   │   ├── search_result.py # 搜索结果模型（结果缓存）
│   │   ├── search_synonym.py # 搜索同义词模型（同义词管理）
│   │   └── search_filter.py # 搜索过滤器模型（过滤条件）
│   ├── serializers/        # 序列化器
│   │   ├── search_index.py # 搜索索引序列化器
│   │   ├── search_query.py # 搜索查询序列化器
│   │   ├── search_result.py # 搜索结果序列化器
│   │   ├── search_synonym.py # 搜索同义词序列化器
│   │   └── search_filter.py # 搜索过滤器序列化器
│   ├── views/              # 视图
│   │   ├── search.py       # 搜索视图（搜索入口）
│   │   ├── search_index.py # 搜索索引视图（索引管理）
│   │   ├── search_query.py # 搜索查询视图（查询历史）
│   │   ├── search_synonym.py # 搜索同义词视图（同义词管理）
│   │   └── search_filter.py # 搜索过滤器视图（过滤条件管理）
│   ├── services/           # 业务逻辑
│   │   ├── indexer_service.py # 索引服务（建立索引）
│   │   ├── search_service.py # 搜索服务（执行搜索）
│   │   ├── suggestion_service.py # 建议服务（搜索建议）
│   │   ├── vector_service.py # 向量服务（语义搜索）
│   │   ├── elasticsearch_service.py # Elasticsearch服务（全文搜索）
│   │   └── synonym_service.py # 同义词服务（同义词管理）
│   └── connectors/         # 搜索连接器
│       ├── elasticsearch_connector.py # ES连接器
│       └── vector_db_connector.py # 向量数据库连接器
├── static/                 # 静态文件（CSS、JS、图片）
├── templates/              # HTML模板
│   └── emails/             # 邮件模板
│       ├── base.html       # 基础邮件模板
│       ├── password_changed.html # 密码修改通知
│       ├── password_reset.html # 密码重置邮件
│       ├── verification_code.html # 验证码邮件
│       └── welcome.html    # 欢迎邮件
├── tests/                  # 全局测试（跨模块测试）
│   ├── test_mongodb.py     # MongoDB连接测试
│   └── test_user_api.py    # 用户API测试
├── users/                  # 用户认证模块（用户管理）
│   ├── models/             # 数据模型
│   │   ├── user.py         # 用户模型（核心用户数据）
│   │   ├── user_profile.py # 用户资料模型（详细信息）
│   │   ├── user_settings.py # 用户设置模型（个性化设置）
│   │   ├── user_device.py  # 用户设备模型（登录设备）
│   │   ├── verification_code.py # 验证码模型（验证码记录）
│   │   └── third_party_account.py # 第三方账号模型（社交登录）
│   ├── serializers/        # 序列化器
│   │   ├── user.py         # 用户序列化器
│   │   └── auth.py         # 认证序列化器（登录注册）
│   ├── views/              # 视图
│   │   └── auth.py         # 认证视图（登录注册）
│   └── services/           # 业务逻辑
│       ├── email_service.py # 邮件服务（发送邮件）
│       ├── sms_service.py  # 短信服务（发送短信）
│       └── notification_service.py # 通知服务（用户通知）
├── voice_recognition/      # 语音识别模块（语音转文字）
│   ├── models/             # 数据模型
│   │   ├── audio_file.py   # 音频文件模型（音频存储）
│   │   ├── language.py     # 语言模型（支持的语言）
│   │   ├── speaker.py      # 说话人模型（说话人识别）
│   │   └── transcription.py # 转录模型（识别结果）
│   ├── serializers/        # 序列化器
│   │   ├── audio_file.py   # 音频文件序列化器
│   │   ├── language.py     # 语言序列化器
│   │   ├── speaker.py      # 说话人序列化器
│   │   └── transcription.py # 转录序列化器
│   ├── views/              # 视图
│   │   ├── audio_file.py   # 音频文件视图
│   │   ├── language.py     # 语言视图
│   │   ├── speaker.py      # 说话人视图
│   │   └── transcription.py # 转录视图
│   ├── services/           # 业务逻辑
│   │   ├── audio_service.py # 音频服务（音频处理）
│   │   ├── baidu_asr_service.py # 百度语音识别服务
│   │   ├── diarization_service.py # 说话人分离服务
│   │   ├── transcription_service.py # 转录服务（核心识别）
│   │   ├── whisper_service.py # Whisper语音识别服务
│   │   └── xunfei_asr_service.py # 讯飞语音识别服务
│   └── fixtures/           # 初始数据
│       └── languages.json  # 语言数据（支持的语言列表）
├── analytics/              # 数据分析模块（用户行为和应用分析）
│   ├── models/             # 数据模型
│   │   ├── user_activity.py # 用户活动模型（用户行为记录）
│   │   ├── app_usage.py    # 应用使用模型（功能使用统计）
│   │   ├── performance.py  # 性能模型（性能指标记录）
│   │   └── error_log.py    # 错误日志模型（错误记录）
│   ├── serializers/        # 序列化器
│   │   ├── user_activity.py # 用户活动序列化器
│   │   ├── app_usage.py    # 应用使用序列化器
│   │   ├── performance.py  # 性能序列化器
│   │   └── error_log.py    # 错误日志序列化器
│   ├── views/              # 视图
│   │   ├── dashboard.py    # 仪表盘视图（数据可视化）
│   │   ├── user_activity.py # 用户活动视图（用户行为分析）
│   │   ├── app_usage.py    # 应用使用视图（功能使用分析）
│   │   └── error_log.py    # 错误日志视图（错误分析）
│   ├── services/           # 业务逻辑
│   │   ├── analytics_service.py # 分析服务（数据分析核心）
│   │   ├── reporting_service.py # 报告服务（生成分析报告）
│   │   ├── tracking_service.py # 跟踪服务（记录用户行为）
│   │   └── export_service.py # 导出服务（导出分析数据）
│   └── tasks/              # 定时任务
│       ├── daily_report.py # 每日报告任务
│       └── data_cleanup.py # 数据清理任务
├── integrations/           # 第三方集成模块（外部服务集成）
│   ├── models/             # 数据模型
│   │   ├── integration.py  # 集成模型（集成配置）
│   │   ├── webhook.py      # Webhook模型（接收外部事件）
│   │   └── api_key.py      # API密钥模型（访问凭证）
│   ├── serializers/        # 序列化器
│   │   ├── integration.py  # 集成序列化器
│   │   ├── webhook.py      # Webhook序列化器
│   │   └── api_key.py      # API密钥序列化器
│   ├── views/              # 视图
│   │   ├── integration.py  # 集成视图（集成管理）
│   │   ├── webhook.py      # Webhook视图（接收外部事件）
│   │   └── api_key.py      # API密钥视图（密钥管理）
│   ├── services/           # 业务逻辑
│   │   ├── github_service.py # GitHub服务（代码仓库集成）
│   │   ├── google_drive_service.py # Google Drive服务（文件存储集成）
│   │   ├── slack_service.py # Slack服务（消息通知集成）
│   │   └── zoom_service.py # Zoom服务（视频会议集成）
│   └── webhooks/           # Webhook处理器
│       ├── github_webhook.py # GitHub Webhook处理器
│       ├── slack_webhook.py # Slack Webhook处理器
│       └── stripe_webhook.py # Stripe Webhook处理器
├── .env.example            # 环境变量示例（配置模板）
├── .gitignore              # Git忽略文件（排除不需要版本控制的文件）
├── DIRECTORY_STRUCTURE.md  # 目录结构说明文档
├── manage.py               # Django管理脚本（命令行工具）
├── requirements.txt        # 依赖列表（项目依赖包）
├── requirements-dev.txt    # 开发环境依赖列表
└── docker-compose.yml      # Docker Compose配置文件
```

## 安装与运行

### 环境要求

- Python 3.8+
- MongoDB 6.0+
- Neo4j 5.0+
- Redis 7.0+
- Elasticsearch 8.0+
- Node.js 16.0+ (用于前端开发)

### 安装步骤

1. **克隆仓库**
   ```bash
   git clone https://github.com/yourusername/zeroislenotes.git
   cd zeroislenotes/backend
   ```

2. **创建虚拟环境**
   ```bash
   python -m venv venv
   source venv/bin/activate  # Windows: venv\Scripts\activate
   ```

3. **安装依赖**
   ```bash
   pip install -r requirements.txt
   ```

4. **配置环境变量**
   ```bash
   cp .env.example .env
   # 编辑.env文件，设置必要的环境变量
   ```

5. **运行开发服务器**
   ```bash
   python manage.py runserver
   ```

### 数据库设置

1. **MongoDB**
   ```bash
   # 确保MongoDB服务已启动
   mongod --dbpath=/path/to/data/db
   ```

2. **Neo4j**
   ```bash
   # 确保Neo4j服务已启动
   neo4j start
   ```

3. **Redis**
   ```bash
   # 确保Redis服务已启动
   redis-server
   ```

## API文档

API文档可通过以下URL访问：

```
http://localhost:8000/swagger/
http://localhost:8000/redoc/
```

## 主要API端点

### 用户认证

- 认证相关: `/api/v1/auth/`
  - 注册: `/api/v1/auth/register/` - POST
  - 登录: `/api/v1/auth/login/` - POST
  - 刷新令牌: `/api/v1/auth/token/refresh/` - POST
  - 用户资料: `/api/v1/auth/profile/` - GET, PUT, PATCH
  - 修改密码: `/api/v1/auth/password/change/` - POST
  - 重置密码: `/api/v1/auth/password/reset/` - POST
  - 验证邮箱: `/api/v1/auth/email/verify/` - POST

### 笔记管理

- 笔记相关: `/api/v1/notes/`
  - 笔记列表/创建: `/api/v1/notes/` - GET, POST
  - 笔记详情/更新/删除: `/api/v1/notes/{id}/` - GET, PUT, PATCH, DELETE
  - 收藏笔记: `/api/v1/notes/{id}/toggle_favorite/` - POST
  - 笔记统计: `/api/v1/notes/stats/` - GET
  - 笔记标签: `/api/v1/notes/tags/` - GET
  - 笔记分类: `/api/v1/notes/categories/` - GET, POST
  - 笔记历史版本: `/api/v1/notes/{id}/history/` - GET
  - 笔记导出: `/api/v1/notes/export/` - POST
  - 笔记导入: `/api/v1/notes/import/` - POST

### 知识图谱

- 知识图谱: `/api/v1/knowledge-graph/`
  - 图谱概览: `/api/v1/knowledge-graph/graph/` - GET
  - 节点管理: `/api/v1/knowledge-graph/nodes/` - GET, POST
  - 节点详情: `/api/v1/knowledge-graph/nodes/{id}/` - GET, PUT, DELETE
  - 边管理: `/api/v1/knowledge-graph/edges/` - GET, POST
  - 边详情: `/api/v1/knowledge-graph/edges/{id}/` - GET, PUT, DELETE
  - 路径查找: `/api/v1/knowledge-graph/graph/find-path/` - POST
  - 图谱分析: `/api/v1/knowledge-graph/graph/analyze/` - GET
  - 标签生成: `/api/v1/knowledge-graph/graph/generate-tags/` - POST

### AI助手

- AI助手: `/api/v1/ai-assistant/`
  - 对话: `/api/v1/ai-assistant/chat/` - POST
  - 笔记摘要: `/api/v1/ai-assistant/summarize/` - POST
  - 内容生成: `/api/v1/ai-assistant/generate/` - POST
  - 文本翻译: `/api/v1/ai-assistant/translate/` - POST
  - 情感分析: `/api/v1/ai-assistant/analyze-sentiment/` - POST

### 代码执行

- 代码执行: `/api/v1/code/`
  - 代码运行: `/api/v1/code/run/` - POST
  - 代码检测: `/api/v1/code/detect/` - POST
  - 代码补全: `/api/v1/code/complete/` - POST
  - 代码格式化: `/api/v1/code/format/` - POST
  - 代码检查: `/api/v1/code/lint/` - POST
  - 代码片段: `/api/v1/code/snippets/` - GET, POST
  - 代码片段详情: `/api/v1/code/snippets/{id}/` - GET, PUT, DELETE

### 语音识别

- 语音识别: `/api/v1/voice-recognition/`
  - 语音转文字: `/api/v1/voice-recognition/transcribe/` - POST
  - 语音命令: `/api/v1/voice-recognition/command/` - POST
  - 会议记录: `/api/v1/voice-recognition/meeting/` - POST

### 搜索

- 搜索: `/api/v1/search/`
  - 全文搜索: `/api/v1/search/` - GET
  - 高级搜索: `/api/v1/search/advanced/` - POST
  - 语义搜索: `/api/v1/search/semantic/` - POST
  - 标签搜索: `/api/v1/search/tags/` - GET
  - 同义词管理: `/api/v1/search/synonyms/` - GET, POST
  - 同义词详情: `/api/v1/search/synonyms/{id}/` - GET, PUT, DELETE
  - 搜索过滤器: `/api/v1/search/filters/` - GET, POST
  - 搜索过滤器详情: `/api/v1/search/filters/{id}/` - GET, PUT, DELETE
  - 搜索建议: `/api/v1/search/suggest/` - GET
  - 热门搜索: `/api/v1/search/trending/` - GET

### 社区

- 社区: `/api/v1/community/`
  - 公开笔记: `/api/v1/community/notes/` - GET
  - 点赞: `/api/v1/community/notes/{id}/like/` - POST
  - 评论: `/api/v1/community/notes/{id}/comments/` - GET, POST
  - 评论详情: `/api/v1/community/comments/{id}/` - GET, PUT, DELETE
  - 用户关注: `/api/v1/community/users/{id}/follow/` - POST
  - 活动流: `/api/v1/community/activity/` - GET

### 提醒

- 提醒: `/api/v1/reminder/`
  - 提醒列表/创建: `/api/v1/reminder/reminders/` - GET, POST
  - 提醒详情: `/api/v1/reminder/reminders/{id}/` - GET, PUT, DELETE
  - 完成提醒: `/api/v1/reminder/reminders/{id}/complete/` - POST
  - 重新打开提醒: `/api/v1/reminder/reminders/{id}/reopen/` - POST
  - 即将到期提醒: `/api/v1/reminder/reminders/upcoming/` - GET
  - 已过期提醒: `/api/v1/reminder/reminders/overdue/` - GET
  - 今日提醒: `/api/v1/reminder/reminders/today/` - GET

### 画布

- 画布: `/api/v1/canvas/`
  - 画布列表/创建: `/api/v1/canvas/canvases/` - GET, POST
  - 画布详情: `/api/v1/canvas/canvases/{id}/` - GET, PUT, DELETE
  - 画布元素: `/api/v1/canvas/elements/` - GET, POST
  - 画布元素详情: `/api/v1/canvas/elements/{id}/` - GET, PUT, DELETE
  - 画布导出: `/api/v1/canvas/canvases/{id}/export/` - GET
  - 画布导入: `/api/v1/canvas/import/` - POST
  - 画布模板: `/api/v1/canvas/templates/` - GET
  - 画布协作: `/api/v1/canvas/canvases/{id}/collaborate/` - POST
  - 画布历史: `/api/v1/canvas/canvases/{id}/history/` - GET

### 数据分析

- 分析: `/api/v1/analytics/`
  - 仪表盘数据: `/api/v1/analytics/dashboard/` - GET
  - 用户活动: `/api/v1/analytics/user-activity/` - GET
  - 应用使用: `/api/v1/analytics/app-usage/` - GET
  - 错误日志: `/api/v1/analytics/error-logs/` - GET
  - 性能指标: `/api/v1/analytics/performance/` - GET
  - 生成报告: `/api/v1/analytics/reports/generate/` - POST
  - 导出数据: `/api/v1/analytics/export/` - POST

### 第三方集成

- 集成: `/api/v1/integrations/`
  - 集成列表/创建: `/api/v1/integrations/` - GET, POST
  - 集成详情: `/api/v1/integrations/{id}/` - GET, PUT, DELETE
  - Webhook管理: `/api/v1/integrations/webhooks/` - GET, POST
  - Webhook详情: `/api/v1/integrations/webhooks/{id}/` - GET, PUT, DELETE
  - API密钥管理: `/api/v1/integrations/api-keys/` - GET, POST
  - API密钥详情: `/api/v1/integrations/api-keys/{id}/` - GET, PUT, DELETE
  - GitHub集成: `/api/v1/integrations/github/` - GET, POST
  - Google Drive集成: `/api/v1/integrations/google-drive/` - GET, POST
  - Slack集成: `/api/v1/integrations/slack/` - GET, POST
  - Zoom集成: `/api/v1/integrations/zoom/` - GET, POST

## 开发指南

### 模块化设计

项目采用模块化设计，每个功能模块都有清晰的目录结构：

- `models/`: 数据模型，定义数据库结构
- `serializers/`: 序列化器，处理数据转换
- `views/`: 视图，处理HTTP请求
- `services/`: 服务层，处理业务逻辑
- `utils/`: 工具函数，提供通用功能
- `tests/`: 单元测试和集成测试

### 代码规范

- 遵循PEP 8 Python代码规范
- 使用类型注解增强代码可读性和可维护性
- 编写详细的文档字符串，说明函数/类的用途、参数和返回值
- 编写单元测试，确保代码质量和可靠性
- 使用有意义的变量名和函数名，提高代码可读性
- 保持函数简短，遵循单一职责原则
- 使用异常处理机制，确保代码健壮性
- 使用日志记录关键操作和错误信息

### 测试

运行测试：

```bash
# 运行所有测试
python manage.py test

# 运行特定应用的测试
python manage.py test notes

# 使用pytest运行测试
pytest
```

### 代码覆盖率

```bash
coverage run --source='.' manage.py test
coverage report
coverage html  # 生成HTML报告
```

## 开发环境配置

### VSCode配置

推荐使用VSCode进行开发，并安装以下扩展：

- Python
- Django
- MongoDB for VS Code
- Neo4j Graph App
- Redis Client
- REST Client
- GitLens
- Docker

### 调试配置

在VSCode中添加以下launch.json配置：

```json
{
    "version": "0.2.0",
    "configurations": [
        {
            "name": "Django",
            "type": "python",
            "request": "launch",
            "program": "${workspaceFolder}/manage.py",
            "args": [
                "runserver",
                "0.0.0.0:8000"
            ],
            "django": true,
            "justMyCode": true
        },
        {
            "name": "Django Shell",
            "type": "python",
            "request": "launch",
            "program": "${workspaceFolder}/manage.py",
            "args": [
                "shell"
            ],
            "django": true,
            "justMyCode": true
        }
    ]
}
```

## 部署

### 使用Gunicorn和Nginx

```bash
# 安装Gunicorn
pip install gunicorn

# 启动Gunicorn
gunicorn backend.wsgi:application --bind 0.0.0.0:8000 --workers 3 --timeout 120
```

### 使用Docker

```bash
# 构建镜像
docker build -t zeroislenotes-backend .

# 运行容器
docker run -p 8000:8000 zeroislenotes-backend
```

### 使用Docker Compose

创建docker-compose.yml文件：

```yaml
version: '3'

services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    depends_on:
      - mongodb
      - redis
      - neo4j
      - elasticsearch
    environment:
      - DJANGO_SETTINGS_MODULE=backend.settings.production
      - MONGODB_URI=mongodb://mongodb:27017/zeroislenotes
      - REDIS_URL=redis://redis:6379/0
      - NEO4J_URI=bolt://neo4j:7687
      - ELASTICSEARCH_URL=http://elasticsearch:9200

  mongodb:
    image: mongo:6.0
    ports:
      - "27017:27017"
    volumes:
      - mongodb_data:/data/db

  neo4j:
    image: neo4j:5.0
    ports:
      - "7474:7474"
      - "7687:7687"
    volumes:
      - neo4j_data:/data
    environment:
      - NEO4J_AUTH=neo4j/password

  redis:
    image: redis:7.0
    ports:
      - "6379:6379"

  elasticsearch:
    image: elasticsearch:8.0.0
    ports:
      - "9200:9200"
      - "9300:9300"
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
    volumes:
      - elasticsearch_data:/usr/share/elasticsearch/data

volumes:
  mongodb_data:
  neo4j_data:
  elasticsearch_data:
```

启动所有服务：

```bash
docker-compose up -d
```

## 贡献指南

1. Fork仓库
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建Pull Request

### 提交规范

提交信息应遵循以下格式：

```
<类型>(<范围>): <描述>

[可选的正文]

[可选的脚注]
```

类型包括：
- `feat`: 新功能
- `fix`: 修复bug
- `docs`: 文档更新
- `style`: 代码风格调整（不影响代码功能）
- `refactor`: 代码重构
- `perf`: 性能优化
- `test`: 添加或修改测试
- `chore`: 构建过程或辅助工具的变动

示例：
```
feat(notes): 添加笔记导出功能

添加了将笔记导出为Markdown、PDF和HTML格式的功能。

Closes #123
```

## 常见问题

### 数据库连接问题

如果遇到MongoDB连接问题，请检查：
1. MongoDB服务是否正在运行
2. 连接字符串是否正确
3. 数据库用户名和密码是否正确
4. 防火墙设置是否允许连接

### 依赖冲突

如果遇到依赖冲突，特别是djongo和Django版本不兼容的问题，可以尝试：
1. 使用虚拟环境隔离依赖
2. 按照requirements.txt中的确切版本安装依赖
3. 如果必要，可以降级Django版本以兼容djongo

## 性能优化

### 数据库优化

- MongoDB索引优化
  - 为常用查询字段创建索引
  - 使用复合索引优化多字段查询
  - 定期执行索引维护

- Neo4j查询优化
  - 使用参数化查询
  - 优化Cypher查询语句
  - 为关键节点属性创建索引

- Redis缓存策略
  - 缓存热点数据
  - 设置合理的过期时间
  - 使用Redis Pipeline减少网络开销

### API性能优化

- 使用分页减少响应数据量
- 实现数据压缩
- 添加适当的缓存头
- 使用异步任务处理耗时操作
- 优化数据库查询，减少N+1问题

### 监控与日志

- 使用Prometheus监控系统性能
- 使用Grafana创建可视化仪表盘
- 集成Sentry进行错误跟踪
- 实现结构化日志记录
- 设置性能基准和告警机制

## 许可证

本项目采用[MIT](LICENSE)许可证。

## 联系方式

如有任何问题或建议，请通过以下方式联系我们：
- 电子邮件：support@zeroislenotes.com
- GitHub Issues：https://github.com/zeroislenotes/backend/issues
- 官方网站：https://www.zeroislenotes.com
- 微信公众号：零屿笔记
