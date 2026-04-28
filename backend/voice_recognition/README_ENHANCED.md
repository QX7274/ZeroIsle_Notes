# 语音识别和搜索功能增强文档

## 概述

本文档介绍了语音识别、音频转文字、会议纪要生成以及语音/图像搜索功能的增强版本。

## 主要功能

### 1. 增强的语音搜索

#### 功能特点
- 支持多种语音识别引擎（Whisper、讯飞、百度）
- 支持Base64编码的音频数据
- 返回详细的识别信息（置信度、时长、分段等）
- 自动记录搜索历史

#### API端点
```
POST /api/search/voice/
```

#### 请求参数
```json
{
  "audio": "音频文件（multipart/form-data）",
  "audio_base64": "Base64编码的音频数据（可选）",
  "language": "zh",  // 语言代码：zh, en等
  "engine": "whisper",  // 识别引擎：whisper, xunfei, baidu
  "options": {
    "type": ["note", "document"],  // 搜索类型过滤
    "public": true,  // 是否只搜索公开内容
    "page": 1,
    "page_size": 20,
    "use_vector": true  // 是否使用向量搜索
  }
}
```

#### 响应示例
```json
{
  "recognized_text": "搜索关键词",
  "recognition_engine": "whisper",
  "language": "zh",
  "confidence": 0.95,
  "duration": 3.5,
  "segments": [
    {
      "start": 0.0,
      "end": 1.5,
      "text": "搜索"
    },
    {
      "start": 1.5,
      "end": 3.5,
      "text": "关键词"
    }
  ],
  "results": [...],
  "total": 10,
  "page": 1,
  "page_size": 20
}
```

### 2. 增强的图像搜索

#### 功能特点
- 支持多种图像分析任务（描述、OCR、物体识别、分析）
- 支持Base64编码的图像数据
- 支持自定义提示词
- 本地OCR备用方案（pytesseract或PaddleOCR）

#### API端点
```
POST /api/search/image/
```

#### 请求参数
```json
{
  "image": "图像文件（multipart/form-data）",
  "image_base64": "Base64编码的图像数据（可选）",
  "task": "describe",  // 任务类型：describe, extract_text, identify_objects, analyze, search
  "prompt": "自定义提示词（可选）",
  "options": {
    "type": ["note", "document"],
    "public": true,
    "page": 1,
    "page_size": 20,
    "use_vector": true
  }
}
```

#### 响应示例
```json
{
  "image_analysis": {
    "task": "describe",
    "result": "图像描述内容",
    "description": "图像描述内容"
  },
  "search_query": "提取的搜索关键词",
  "results": [...],
  "total": 10,
  "page": 1,
  "page_size": 20
}
```

### 3. 增强的音频转文字

#### 功能特点
- 支持多种识别引擎
- 支持说话人分离
- 支持标点符号和时间戳
- 自动保存到笔记
- 详细的转录结果

#### API端点
```
POST /api/voice-recognition/transcribe/
```

#### 请求参数
```json
{
  "audio": "音频文件（multipart/form-data）",
  "audio_base64": "Base64编码的音频数据（可选）",
  "language": "zh",
  "engine": "whisper",  // whisper, xunfei, baidu
  "enable_diarization": false,  // 是否启用说话人分离
  "enable_punctuation": true,  // 是否启用标点符号
  "enable_timestamp": true,  // 是否启用时间戳
  "note_id": "笔记ID（可选）"  // 自动保存到指定笔记
}
```

#### 响应示例
```json
{
  "id": "转录ID",
  "text": "转录文本",
  "segments": [
    {
      "start": 0.0,
      "end": 2.5,
      "text": "第一句话",
      "speaker": "说话人1"
    }
  ],
  "duration": 120.5,
  "language": "zh",
  "engine": "whisper",
  "has_diarization": false,
  "created_at": "2025-11-11T16:00:00Z"
}
```

### 4. 增强的会议纪要生成

#### 功能特点
- 支持多种摘要类型（详细、简要、行动导向）
- 支持多语言输出
- 提取关键要点、行动项、决策、主题
- 自动保存到笔记
- 包含时间戳信息

#### API端点
```
POST /api/voice-recognition/meeting/
```

#### 请求参数
```json
{
  "text": "会议转录文本",
  "transcription_id": "转录ID（可选）",
  "note_id": "笔记ID（可选）",
  "summary_type": "detailed",  // detailed, brief, action_focused
  "language": "zh",  // zh, en
  "include_timestamps": false
}
```

#### 响应示例
```json
{
  "summary": "会议摘要",
  "key_points": [
    "关键要点1",
    "关键要点2"
  ],
  "action_items": [
    "任务1：负责人A，截止日期2025-11-15",
    "任务2：负责人B，截止日期2025-11-20"
  ],
  "participants": [
    "参会人员1",
    "参会人员2"
  ],
  "decisions": [
    "决策1",
    "决策2"
  ],
  "topics": [
    "讨论主题1",
    "讨论主题2"
  ],
  "full_text": "完整的会议纪要文本",
  "summary_type": "detailed",
  "language": "zh"
}
```

### 5. 实时录音和转录

#### 功能特点
- 支持流式录音
- 实时转录
- 实时会议摘要
- 分块上传音频

#### 开始录音
```
POST /api/voice-recognition/recording/start/
```

请求参数：
```json
{
  "language": "zh",
  "engine": "whisper",
  "enable_realtime": true
}
```

响应：
```json
{
  "session_id": "会话ID",
  "audio_file_id": "音频文件ID",
  "language": "zh",
  "engine": "whisper",
  "enable_realtime": true,
  "status": "recording"
}
```

#### 上传音频片段
```
POST /api/voice-recognition/recording/upload-chunk/
```

请求参数：
```json
{
  "session_id": "会话ID",
  "audio_chunk": "Base64编码的音频片段",
  "chunk_index": 0,
  "is_final": false
}
```

响应：
```json
{
  "session_id": "会话ID",
  "chunk_index": 0,
  "partial_text": "部分转录文本",
  "is_final": false,
  "status": "recording"
}
```

#### 停止录音
```
POST /api/voice-recognition/recording/stop/
```

请求参数：
```json
{
  "session_id": "会话ID",
  "audio": "完整音频文件（可选）",
  "audio_base64": "Base64编码的完整音频（可选）"
}
```

响应：
```json
{
  "session_id": "会话ID",
  "status": "completed",
  "text": "完整转录文本",
  "duration": 120.5,
  "segments": [...]
}
```

#### 生成实时摘要
```
POST /api/voice-recognition/recording/realtime-summary/
```

请求参数：
```json
{
  "session_id": "会话ID",
  "partial_text": "当前转录文本（可选）"
}
```

响应：
```json
{
  "summary": "当前会议摘要",
  "key_points": ["要点1", "要点2"],
  "topics": ["主题1", "主题2"],
  "session_id": "会话ID"
}
```

## 使用示例

### Python客户端示例

```python
import requests
import base64

# 1. 语音搜索
with open('audio.wav', 'rb') as f:
    audio_data = f.read()
    audio_base64 = base64.b64encode(audio_data).decode('utf-8')

response = requests.post(
    'http://localhost:8000/api/search/voice/',
    json={
        'audio_base64': audio_base64,
        'language': 'zh',
        'engine': 'whisper',
        'options': {
            'page': 1,
            'page_size': 20
        }
    },
    headers={'Authorization': 'Bearer YOUR_TOKEN'}
)

result = response.json()
print(f"识别文本: {result['recognized_text']}")
print(f"搜索结果数: {result['total']}")

# 2. 图像搜索
with open('image.jpg', 'rb') as f:
    image_data = f.read()
    image_base64 = base64.b64encode(image_data).decode('utf-8')

response = requests.post(
    'http://localhost:8000/api/search/image/',
    json={
        'image_base64': image_base64,
        'task': 'extract_text',
        'options': {
            'page': 1,
            'page_size': 20
        }
    },
    headers={'Authorization': 'Bearer YOUR_TOKEN'}
)

result = response.json()
print(f"图像分析: {result['image_analysis']['result']}")
print(f"搜索结果数: {result['total']}")

# 3. 音频转文字
response = requests.post(
    'http://localhost:8000/api/voice-recognition/transcribe/',
    json={
        'audio_base64': audio_base64,
        'language': 'zh',
        'engine': 'whisper',
        'enable_diarization': True,
        'enable_timestamp': True
    },
    headers={'Authorization': 'Bearer YOUR_TOKEN'}
)

result = response.json()
print(f"转录文本: {result['text']}")
print(f"时长: {result['duration']}秒")

# 4. 生成会议纪要
response = requests.post(
    'http://localhost:8000/api/voice-recognition/meeting/',
    json={
        'transcription_id': result['id'],
        'summary_type': 'detailed',
        'language': 'zh'
    },
    headers={'Authorization': 'Bearer YOUR_TOKEN'}
)

summary = response.json()
print(f"会议摘要: {summary['summary']}")
print(f"关键要点: {summary['key_points']}")
print(f"行动项: {summary['action_items']}")
```

## 配置说明

### 环境变量

```bash
# OpenAI API配置
OPENAI_API_KEY=your_openai_api_key

# 讯飞API配置
XUNFEI_APP_ID=your_app_id
XUNFEI_API_KEY=your_api_key
XUNFEI_API_SECRET=your_api_secret

# 百度API配置
BAIDU_APP_ID=your_app_id
BAIDU_API_KEY=your_api_key
BAIDU_SECRET_KEY=your_secret_key

# 本地OCR配置
USE_LOCAL_OCR=true  # 启用本地OCR作为备用方案
```

## 注意事项

1. **API密钥安全**：确保API密钥安全存储，不要提交到版本控制系统
2. **文件大小限制**：音频和图像文件建议不超过10MB
3. **并发限制**：注意API调用频率限制
4. **语言支持**：不同引擎支持的语言可能不同
5. **本地OCR**：需要安装pytesseract或PaddleOCR才能使用本地OCR功能

## 故障排除

### 语音识别失败
- 检查音频格式是否支持（推荐WAV格式）
- 检查API密钥是否正确配置
- 检查网络连接

### 图像分析失败
- 检查图像格式是否支持（推荐JPG/PNG格式）
- 如果使用本地OCR，检查相关库是否安装
- 检查图像文件是否损坏

### 会议纪要生成失败
- 检查转录文本是否为空
- 检查OpenAI API配额
- 尝试使用更短的文本或分段处理

## 更新日志

### v2.0.0 (2025-11-11)
- ✨ 新增多引擎语音识别支持
- ✨ 新增增强的图像搜索功能
- ✨ 新增实时录音和转录功能
- ✨ 新增增强的会议纪要生成
- 🔧 优化错误处理和日志记录
- 📝 完善API文档和示例代码

