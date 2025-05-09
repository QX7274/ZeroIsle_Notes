# 语音识别模块

本目录包含零屿笔记应用的语音识别功能相关服务，用于提供语音转文字、实时转写和语音命令等功能。

## 目录结构

- **models/**: 数据模型
  - **audio_file.py**: 音频文件模型，音频存储
  - **language.py**: 语言模型，支持的语言
  - **speaker.py**: 说话人模型，说话人识别
  - **transcription.py**: 转录模型，识别结果
  - **session.py**: 会话模型，实时转写会话
  - **command.py**: 命令模型，语音命令
- **serializers/**: 序列化器
  - **audio_file.py**: 音频文件序列化器
  - **language.py**: 语言序列化器
  - **speaker.py**: 说话人序列化器
  - **transcription.py**: 转录序列化器
  - **session.py**: 会话序列化器
  - **command.py**: 命令序列化器
- **views/**: 视图
  - **audio_file.py**: 音频文件视图
  - **language.py**: 语言视图
  - **speaker.py**: 说话人视图
  - **transcription.py**: 转录视图
  - **offline_model.py**: 离线模型视图
  - **diarization.py**: 说话人分离视图
  - **speaker_management.py**: 说话人管理视图
  - **realtime_transcription.py**: 实时转写视图
  - **voice_command.py**: 语音命令视图
- **services/**: 业务逻辑
  - **audio_service.py**: 音频服务，音频处理
  - **baidu_asr_service.py**: 百度语音识别服务
  - **diarization_service.py**: 说话人分离服务
  - **transcription_service.py**: 转录服务，核心识别
  - **whisper_service.py**: Whisper语音识别服务
  - **xunfei_asr_service.py**: 讯飞语音识别服务
  - **text_processing_service.py**: 文本处理服务
  - **voice_command_service.py**: 语音命令服务
  - **speaker_recognition_service.py**: 说话人识别服务
  - **realtime_transcription_service.py**: 实时转写服务
- **fixtures/**: 初始数据
  - **languages.json**: 语言数据，支持的语言列表
  - **commands.json**: 命令数据，预设语音命令
- **management/commands/**: 管理命令
  - **load_voice_fixtures.py**: 加载语音识别初始数据
  - **download_models.py**: 下载离线模型

## 主要功能

### 语音转文字

语音识别模块提供语音转文字功能，支持以下特性：

- **音频文件转写**: 将上传的音频文件转写为文本
- **多语言支持**: 支持多种语言和方言的识别
- **多引擎支持**: 集成多种语音识别引擎（Whisper、百度、讯飞等）
- **离线识别**: 支持离线模式下的语音识别
- **批量处理**: 支持批量处理多个音频文件
- **格式转换**: 自动处理不同的音频格式
- **结果优化**: 对识别结果进行后处理和优化

### 实时转写

语音识别模块提供实时转写功能，支持以下特性：

- **流式识别**: 实时处理音频流，边说边转写
- **低延迟**: 优化识别延迟，提供更好的实时体验
- **会话管理**: 管理转写会话的创建和结束
- **中间结果**: 提供识别的中间结果，实时显示
- **自动分段**: 自动检测语音段落，进行分段处理
- **噪音过滤**: 过滤背景噪音，提高识别准确率
- **长时间转写**: 支持长时间的连续转写

### 说话人分离

语音识别模块提供说话人分离功能，支持以下特性：

- **多人对话**: 识别多人对话中的不同说话人
- **说话人标记**: 为转写结果添加说话人标记
- **说话人聚类**: 自动聚类相同说话人的语音片段
- **说话人管理**: 管理和编辑说话人信息
- **说话人合并**: 合并错误分离的相同说话人
- **说话人重命名**: 为说话人添加自定义名称
- **说话人统计**: 统计各说话人的发言时长和次数

### 语音命令

语音识别模块提供语音命令功能，支持以下特性：

- **命令识别**: 识别预设的语音命令
- **自定义命令**: 支持用户自定义语音命令
- **命令执行**: 执行识别到的命令对应的操作
- **上下文感知**: 根据当前上下文处理命令
- **命令反馈**: 提供命令执行的反馈
- **命令学习**: 学习用户的命令习惯，提高识别准确率
- **离线命令**: 支持离线模式下的基本命令识别

### 离线模型管理

语音识别模块提供离线模型管理功能，支持以下特性：

- **模型下载**: 下载离线识别模型
- **模型更新**: 更新已下载的模型
- **模型删除**: 删除不再需要的模型
- **模型切换**: 在不同模型之间切换
- **模型状态**: 查看模型的下载和使用状态
- **模型配置**: 配置模型的参数和设置
- **存储管理**: 管理模型占用的存储空间

## API端点

语音识别模块提供以下主要API端点：

- **转写API**:
  - `POST /api/voice-recognition/transcribe/`: 转写音频文件
  - `GET /api/voice-recognition/transcriptions/`: 获取转写历史
  - `GET /api/voice-recognition/transcriptions/{id}/`: 获取特定转写详情
  - `DELETE /api/voice-recognition/transcriptions/{id}/`: 删除转写记录
  - `POST /api/voice-recognition/generate-meeting-summary/`: 生成会议纪要

- **实时转写API**:
  - `POST /api/voice-recognition/realtime/create-session/`: 创建实时转写会话
  - `POST /api/voice-recognition/realtime/add-chunk/`: 添加音频数据块
  - `GET /api/voice-recognition/realtime/get-results/`: 获取实时转写结果
  - `POST /api/voice-recognition/realtime/finish-session/`: 结束转写会话
  - `GET /api/voice-recognition/realtime/get-status/`: 获取会话状态

- **说话人分离API**:
  - `POST /api/voice-recognition/diarization/process/`: 处理说话人分离
  - `GET /api/voice-recognition/diarization/status/{id}/`: 获取处理状态
  - `GET /api/voice-recognition/speakers/`: 获取说话人列表
  - `PUT /api/voice-recognition/speakers/{id}/rename/`: 重命名说话人
  - `POST /api/voice-recognition/speakers/merge/`: 合并说话人

- **语音命令API**:
  - `POST /api/voice-recognition/commands/process/`: 处理语音命令
  - `GET /api/voice-recognition/commands/`: 获取可用命令列表
  - `POST /api/voice-recognition/commands/`: 创建自定义命令
  - `PUT /api/voice-recognition/commands/{id}/`: 更新命令
  - `DELETE /api/voice-recognition/commands/{id}/`: 删除命令

- **离线模型API**:
  - `GET /api/voice-recognition/offline-models/status/`: 获取服务状态
  - `GET /api/voice-recognition/offline-models/list/`: 列出可用模型
  - `POST /api/voice-recognition/offline-models/download/`: 下载模型
  - `DELETE /api/voice-recognition/offline-models/delete/`: 删除模型
  - `POST /api/voice-recognition/offline-models/change/`: 切换模型
  - `POST /api/voice-recognition/offline-models/toggle-mode/`: 切换在线/离线模式

## 数据模型

### 音频文件模型 (AudioFile)

```python
class AudioFile(Document):
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4())
    user = ReferenceField(User, required=True)
    file_path = StringField(required=True)
    file_name = StringField(required=True)
    file_size = IntField(required=True)  # in bytes
    duration = FloatField()  # in seconds
    format = StringField()
    sample_rate = IntField()
    channels = IntField()
    bit_depth = IntField()
    created_at = DateTimeField(default=timezone.now)
    metadata = DictField()
```

### 转录模型 (Transcription)

```python
class Transcription(Document):
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4())
    user = ReferenceField(User, required=True)
    audio_file = ReferenceField(AudioFile, required=True)
    text = StringField(required=True)
    language = ReferenceField('Language')
    engine = StringField(choices=['whisper', 'baidu', 'xunfei', 'offline'], required=True)
    confidence = FloatField()
    segments = ListField(DictField())  # time-aligned segments
    speakers = ListField(ReferenceField('Speaker'))  # for diarization
    is_processed = BooleanField(default=False)
    processing_time = FloatField()  # in seconds
    created_at = DateTimeField(default=timezone.now)
    metadata = DictField()
```

### 会话模型 (Session)

```python
class Session(Document):
    id = UUIDField(primary_key=True, default=lambda: uuid.uuid4())
    user = ReferenceField(User, required=True)
    status = StringField(choices=['active', 'paused', 'completed', 'error'], default='active')
    language = ReferenceField('Language')
    engine = StringField(choices=['whisper', 'baidu', 'xunfei', 'offline'], required=True)
    start_time = DateTimeField(default=timezone.now)
    end_time = DateTimeField()
    duration = FloatField()  # in seconds
    chunks_count = IntField(default=0)
    interim_results = ListField(DictField())
    final_result = StringField()
    error_message = StringField()
    metadata = DictField()
```

## 与其他模块的交互

语音识别模块与以下模块有交互：

- **笔记模块**: 将转写结果保存为笔记
- **AI助手模块**: 分析转写内容，提供智能建议
- **用户模块**: 管理用户的语音识别权限和设置
- **存储模块**: 管理音频文件和模型的存储
- **通知模块**: 发送转写完成和处理状态的通知

## 配置说明

语音识别模块需要以下配置：

- **API密钥**: 各语音识别服务提供商的API密钥
- **模型路径**: 离线模型的存储路径
- **音频设置**: 音频处理的默认设置
- **转写设置**: 转写服务的默认参数
- **存储限制**: 音频文件和转写结果的存储限制

## 注意事项

- **隐私保护**: 确保用户音频数据的安全和隐私
- **资源消耗**: 语音识别可能消耗大量计算资源，需要合理配置
- **错误处理**: 妥善处理识别错误和服务不可用的情况
- **多语言支持**: 确保对多语言的良好支持
- **离线功能**: 确保离线模式下的基本功能可用
- **性能优化**: 优化识别速度和准确率
- **用户体验**: 提供友好的界面和反馈，降低使用门槛
