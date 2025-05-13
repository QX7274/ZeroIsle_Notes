# 零屿笔记后端目录结构说明

本文档详细描述了零屿笔记后端的目录结构，包括各个模块的功能和文件组织。

## 总体结构

零屿笔记后端采用模块化设计，每个功能模块都有清晰的目录结构，遵循以下约定：

- `mongodb_models.py`: MongoDB文档模型，使用MongoEngine ODM定义
- `serializers/`: 序列化器，处理数据转换
- `views/`: 视图，处理HTTP请求
- `services/`: 服务层，处理业务逻辑
- `utils/`: 工具函数，提供通用功能
- `tests/`: 单元测试和集成测试

## 核心模块

### backend/

Django项目的核心配置目录，包含全局设置和URL路由。

- `settings/`: 分环境设置
  - `__init__.py`: 设置入口
  - `base.py`: 基础设置，所有环境共享
  - `development.py`: 开发环境特定设置
  - `production.py`: 生产环境特定设置
  - `testing.py`: 测试环境特定设置
- `urls.py`: 全局URL路由配置
- `wsgi.py`: WSGI应用配置，用于生产环境
- `asgi.py`: ASGI应用配置，支持WebSocket
- `celery.py`: Celery任务队列配置
- `routing.py`: WebSocket路由配置
- `mongodb_settings.py`: MongoDB数据库配置

### common/

公共组件和工具，被其他模块共享使用。

- `exceptions.py`: 自定义异常类
- `middleware.py`: 自定义中间件
- `models.py`: 基础模型类
- `pagination.py`: 分页类
- `permissions.py`: 权限类
- `utils.py`: 通用工具函数
- `validators.py`: 数据验证器

## 功能模块

### ai_assistant/

AI助手模块，提供智能对话和内容生成功能。

- `models/`: 数据模型
  - `conversation.py`: 对话模型
  - `feedback.py`: 反馈模型
  - `model_config.py`: 模型配置
  - `prompt_template.py`: 提示模板
  - `usage_record.py`: 使用记录
- `serializers/`: 序列化器
  - `conversation.py`: 对话序列化器
  - `feedback.py`: 反馈序列化器
  - `message.py`: 消息序列化器
  - `model_config.py`: 模型配置序列化器
  - `prompt_template.py`: 提示模板序列化器
  - `usage_record.py`: 使用记录序列化器
- `views/`: 视图
  - `conversation.py`: 对话视图
  - `feedback.py`: 反馈视图
  - `message.py`: 消息视图
  - `model_config.py`: 模型配置视图
  - `prompt_template.py`: 提示模板视图
  - `usage_record.py`: 使用记录视图
- `services/`: 服务
  - `baidu_service.py`: 百度AI服务
  - `conversation_service.py`: 对话服务
  - `openai_service.py`: OpenAI服务
  - `prompt_service.py`: 提示服务
  - `token_counter.py`: Token计数器
  - `xunfei_service.py`: 讯飞AI服务
- `fixtures/`: 初始数据
  - `model_configs.json`: 模型配置数据
  - `prompt_templates.json`: 提示模板数据
- `management/commands/`: 管理命令
  - `load_ai_fixtures.py`: 加载AI初始数据

### canvas/

无限画布模块，支持创建思维导图、流程图等可视化内容。

- `models/`: 数据模型
  - `canvas.py`: 画布模型
  - `canvas_element.py`: 画布元素模型
  - `canvas_connection.py`: 画布连接模型
- `serializers/`: 序列化器
  - `canvas.py`: 画布序列化器
  - `canvas_element.py`: 画布元素序列化器
  - `canvas_connection.py`: 画布连接序列化器
- `views/`: 视图
  - `canvas.py`: 画布视图
  - `canvas_element.py`: 画布元素视图
  - `canvas_connection.py`: 画布连接视图
- `services/`: 服务
  - `canvas_service.py`: 画布服务
  - `canvas_element_service.py`: 画布元素服务
  - `canvas_connection_service.py`: 画布连接服务

### code/

代码执行模块，支持多种编程语言的代码执行、格式化、补全等功能。

- `models/`: 数据模型
  - `code_execution.py`: 代码执行模型
  - `code_snippet.py`: 代码片段模型
- `serializers/`: 序列化器
  - `code_execution.py`: 代码执行序列化器
  - `code_request.py`: 代码请求序列化器
  - `code_snippet.py`: 代码片段序列化器
- `views/`: 视图
  - `code_complete.py`: 代码补全视图
  - `code_detect.py`: 代码检测视图
  - `code_execution.py`: 代码执行视图
  - `code_format.py`: 代码格式化视图
  - `code_lint.py`: 代码检查视图
  - `code_run.py`: 代码运行视图
  - `code_snippet.py`: 代码片段视图
- `services/`: 服务
  - `code_execution_service.py`: 代码执行服务
  - `code_service.py`: 代码服务
  - `code_snippet_service.py`: 代码片段服务
- `utils/`: 工具
  - `languages.py`: 编程语言配置和工具

### community/

社区模块，支持用户交流、分享笔记、点赞、评论等社交功能。

- `models/`: 数据模型
  - `category.py`: 分类模型
  - `comment.py`: 评论模型
  - `follow.py`: 关注模型
  - `like.py`: 点赞模型
  - `notification.py`: 通知模型
  - `post.py`: 帖子模型
  - `tag.py`: 标签模型
- `serializers/`: 序列化器
  - `category.py`: 分类序列化器
  - `comment.py`: 评论序列化器
  - `follow.py`: 关注序列化器
  - `like.py`: 点赞序列化器
  - `notification.py`: 通知序列化器
  - `post.py`: 帖子序列化器
  - `tag.py`: 标签序列化器
- `views/`: 视图
  - `category.py`: 分类视图
  - `comment.py`: 评论视图
  - `follow.py`: 关注视图
  - `like.py`: 点赞视图
  - `notification.py`: 通知视图
  - `post.py`: 帖子视图
  - `tag.py`: 标签视图
- `services/`: 服务
  - `comment_service.py`: 评论服务
  - `follow_service.py`: 关注服务
  - `like_service.py`: 点赞服务
  - `notification_service.py`: 通知服务
  - `post_service.py`: 帖子服务
- `fixtures/`: 初始数据
  - `categories.json`: 分类数据
  - `tags.json`: 标签数据
- `permissions.py`: 社区特定权限

### knowledge_graph/

知识图谱模块，用于构建和管理知识节点和关系，支持知识可视化和智能推荐。

- `models/`: 数据模型
  - `node.py`: 知识节点模型
  - `edge.py`: 知识连接模型
  - `graph.py`: 知识图谱模型
- `serializers/`: 序列化器
  - `node.py`: 知识节点序列化器
  - `edge.py`: 知识连接序列化器
  - `graph.py`: 知识图谱序列化器
- `views/`: 视图
  - `node.py`: 知识节点视图
  - `edge.py`: 知识连接视图
  - `graph.py`: 知识图谱视图
- `services/`: 服务
  - `graph_service.py`: 图谱服务
  - `neo4j_service.py`: Neo4j数据库服务
- `utils/`: 工具
  - `graph_utils.py`: 图谱工具函数

### notes/

笔记模块，支持创建、编辑、删除笔记，以及笔记分类、标签管理等功能。

- `mongodb_models.py`: MongoDB文档模型
  - `Note`: 笔记模型
  - `Category`: 分类模型
  - `Tag`: 标签模型
  - `NoteVersion`: 笔记版本模型
  - `NoteAttachment`: 笔记附件模型
  - `NoteShare`: 笔记分享模型
  - `NoteReminder`: 笔记提醒模型
  - `NoteBackup`: 笔记备份模型
  - `NoteSync`: 笔记同步模型
  - `NoteComment`: 笔记评论模型
  - `NoteCollaboration`: 笔记协作模型
  - `NoteTemplate`: 笔记模板模型
  - `Handwriting`: 手写笔记模型
  - `Annotation`: PDF注释模型
  - `DrawingPath`: 绘图路径模型
  - `OCRModel`: OCR模型
  - `WhisperModel`: Whisper模型
  - `Notification`: 通知模型
- `serializers/`: 序列化器
  - `note.py`: 笔记序列化器
  - `category.py`: 分类序列化器
  - `tag.py`: 标签序列化器
- `views/`: 视图
  - `note.py`: 笔记视图
  - `category.py`: 分类视图
  - `tag.py`: 标签视图
  - `realm_note.py`: Realm笔记视图
- `services/`: 服务
  - `note_service.py`: 笔记服务
  - `export_service.py`: 导出服务
  - `import_service.py`: 导入服务
  - `sync_service.py`: 同步服务
- `tests/`: 测试
  - `test_models.py`: 模型测试
  - `test_views.py`: 视图测试

### reminder/

提醒模块，支持设置提醒、定时通知等功能。

- `models/`: 数据模型
  - `reminder.py`: 提醒模型
  - `reminder_notification.py`: 提醒通知模型
- `serializers/`: 序列化器
  - `reminder.py`: 提醒序列化器
  - `reminder_notification.py`: 提醒通知序列化器
- `views/`: 视图
  - `reminder.py`: 提醒视图
  - `reminder_notification.py`: 提醒通知视图
- `services/`: 服务
  - `reminder_service.py`: 提醒服务
  - `notification_service.py`: 通知服务
- `management/commands/`: 管理命令
  - `process_reminders.py`: 处理提醒通知
- `consumers.py`: WebSocket消费者
- `routing.py`: WebSocket路由
- `tasks.py`: Celery任务

### search/

搜索模块，支持全文搜索、语义搜索、标签搜索等多种搜索方式。

- `models/`: 数据模型
  - `search_index.py`: 搜索索引模型
  - `search_query.py`: 搜索查询模型
  - `search_result.py`: 搜索结果模型
  - `search_suggestion.py`: 搜索建议模型
- `serializers/`: 序列化器
  - `search_index.py`: 搜索索引序列化器
  - `search_query.py`: 搜索查询序列化器
  - `search_result.py`: 搜索结果序列化器
  - `search_suggestion.py`: 搜索建议序列化器
- `views/`: 视图
  - `search.py`: 搜索视图
  - `search_index.py`: 搜索索引视图
  - `search_query.py`: 搜索查询视图
  - `search_suggestion.py`: 搜索建议视图
- `services/`: 服务
  - `indexer_service.py`: 索引服务
  - `search_service.py`: 搜索服务
  - `suggestion_service.py`: 建议服务
  - `vector_service.py`: 向量服务

### users/

用户模块，包括用户注册、登录、个人资料管理等功能。

- `mongodb_models.py`: MongoDB文档模型
  - `User`: 用户模型
  - `UserProfile`: 用户资料模型
  - `UserSettings`: 用户设置模型
  - `UserDevice`: 用户设备模型
  - `VerificationCode`: 验证码模型
  - `ThirdPartyAccount`: 第三方账号模型
- `serializers/`: 序列化器
  - `user.py`: 用户序列化器
  - `auth.py`: 认证序列化器
- `views/`: 视图
  - `auth.py`: 认证视图
- `services/`: 服务
  - `email_service.py`: 邮件服务
  - `sms_service.py`: 短信服务
  - `notification_service.py`: 通知服务

### voice_recognition/

语音识别模块，支持语音转文字、会议记录等功能。

- `models/`: 数据模型
  - `audio_file.py`: 音频文件模型
  - `language.py`: 语言模型
  - `speaker.py`: 说话人模型
  - `transcription.py`: 转录模型
- `serializers/`: 序列化器
  - `audio_file.py`: 音频文件序列化器
  - `language.py`: 语言序列化器
  - `speaker.py`: 说话人序列化器
  - `transcription.py`: 转录序列化器
- `views/`: 视图
  - `audio_file.py`: 音频文件视图
  - `language.py`: 语言视图
  - `speaker.py`: 说话人视图
  - `transcription.py`: 转录视图
- `services/`: 服务
  - `audio_service.py`: 音频服务
  - `baidu_asr_service.py`: 百度语音识别服务
  - `diarization_service.py`: 说话人分离服务
  - `transcription_service.py`: 转录服务
  - `whisper_service.py`: Whisper语音识别服务
  - `xunfei_asr_service.py`: 讯飞语音识别服务
- `fixtures/`: 初始数据
  - `languages.json`: 语言数据
- `management/commands/`: 管理命令
  - `load_voice_fixtures.py`: 加载语音识别初始数据

## 其他目录

### templates/

HTML模板目录，主要用于邮件模板。

- `emails/`: 邮件模板
  - `base.html`: 基础邮件模板
  - `password_changed.html`: 密码修改通知
  - `password_reset.html`: 密码重置邮件
  - `verification_code.html`: 验证码邮件
  - `welcome.html`: 欢迎邮件

### tests/

全局测试目录，包含跨模块的集成测试。

- `test_mongodb.py`: MongoDB连接测试
- `test_user_api.py`: 用户API测试

### media/

媒体文件存储目录，用于存储用户上传的文件。

### static/

静态文件目录，用于存储CSS、JavaScript、图片等静态资源。

## 根目录文件

- `manage.py`: Django管理脚本，用于运行命令
- `requirements.txt`: 项目依赖列表
- `README.md`: 项目说明文档
- `.env.example`: 环境变量示例
- `.gitignore`: Git忽略文件配置
- `DIRECTORY_STRUCTURE.md`: 目录结构说明文档（本文件）
