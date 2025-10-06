# 零屿笔记服务目录

本目录包含零屿笔记应用的各种服务，包括API服务、AI服务、文件服务、通知服务等。服务层负责处理应用的业务逻辑和与后端的通信。

## 目录结构

### API服务 (`api/`)
- **apiClient.js**: API客户端，提供统一的API请求客户端，处理请求拦截、响应拦截和错误处理
- **interceptor.js**: API拦截器（已废弃，请使用apiClient.js）
- **authApi.js**: 认证相关API
- **notesApi.js**: 笔记相关API
- **knowledgeGraphApi.js**: 知识图谱相关API
- **aiAssistantApi.js**: AI助手相关API
- **reminderApi.js**: 提醒相关API
- **voiceApi.js**: 语音相关API
- **searchApi.js**: 搜索相关API
- **communityApi.js**: 社区相关API
- **canvasApi.js**: 画布相关API
- **codeApi.js**: 代码相关API
- **userApi.js**: 用户相关API
- **annotationApi.js**: 注释相关API
- **drawingPathApi.js**: 绘图路径相关API
- **index.js**: API服务索引

### AI服务 (`ai/`)
- **voiceRecognition.js**: 语音识别服务
- **textAnalysis.js**: 文本分析服务
- **aiModels.js**: AI模型服务
- **aiService.js**: AI服务
- **index.js**: AI服务索引

### AI历史服务 (`ai_history/`)
- **aiHistoryService.js**: AI历史服务，提供AI对话历史记录管理功能

### 文件服务 (`file/`)
- **fileService.js**: 文件服务，提供文件读写、复制、移动、删除等功能

### 通知服务 (`notification/`)
- **notificationService.js**: 通知服务，提供本地通知和推送通知功能

### 存储服务 (`storage/`)
- **storageService.js**: 存储服务，提供基于MongoDB Realm的本地存储功能，只同步关键用户信息
- **realmStorageService.js**: Realm存储服务，提供基于MongoDB Realm的本地存储功能
- **offlineDataService.js**: 离线数据服务，提供基于MongoDB Realm的离线数据存储和同步功能

### 网络服务 (`network/`)
- **networkService.js**: 网络服务，提供网络状态监测、连接类型检测等功能

### 音频服务 (`audio/`)
- **audioService.js**: 音频服务，提供音频录制、播放、暂停等功能

### 日历服务 (`calendar/`)
- **calendarIntegrationService.js**: 日历集成服务，提供与设备日历集成的功能

### 画布服务 (`canvas/`)
- **canvasService.js**: 画布服务，提供画布绘制、保存、加载等功能

### 代码服务 (`code/`)
- **codeService.js**: 代码服务，提供代码编辑、高亮、运行等功能

### 压缩服务 (`compression/`)
- **compressionService.js**: 压缩服务，提供数据压缩和解压缩功能

### 导出服务 (`export/`)
- **exportService.js**: 导出服务，提供数据导出功能，支持多种格式

### 群组服务 (`group/`)
- **groupService.js**: 群组服务，提供群组管理功能

### 笔记服务 (`note/`)
- **noteAIService.js**: 笔记AI服务，提供笔记内容分析、自动标签生成等功能
- **noteToolbarService.js**: 笔记工具栏服务，提供笔记编辑工具栏功能

### 离线服务 (`offline/`)
- **offlineAIService.js**: 离线AI服务，提供离线模式下的AI功能
- **offlineStorage.js**: 离线存储服务，提供离线数据存储功能

### 提醒服务 (`reminder/`)
- **reminderNotificationService.js**: 提醒通知服务，提供提醒通知功能

### 搜索服务 (`search/`)
- **searchService.js**: 搜索服务，提供全文搜索功能

### 认证服务 (`auth/`)
- **thirdPartyAuth.js**: 第三方认证服务，提供第三方登录功能

### 翻译服务 (`translation/`)
- **translationService.js**: 翻译服务，提供文本翻译功能

### 文本转语音服务 (`tts/`)
- **ttsService.js**: 文本转语音服务，提供将文本转换为语音的功能

### WebRTC服务 (`webrtc/`)
- **webrtcService.js**: WebRTC服务，提供实时音视频通信功能

### WebSocket服务 (`websocket/`)
- **websocket.js**: WebSocket服务，提供实时通信功能

### 上传服务 (`upload/`)
- **uploadService.js**: 上传服务，提供数据和文件上传功能

## 使用方法

### 导入API服务

```javascript
// 导入API服务
import { api } from '../services';

// 使用API服务
api.notes.getAll().then(notes => {
  console.log(notes);
});

// 或者直接导入特定的API服务
import { notesApi } from '../services';

// 使用特定的API服务
notesApi.getAll().then(notes => {
  console.log(notes);
});
```

### 导入其他服务

```javascript
// 导入文件服务
import { fileService } from '../services';

// 使用文件服务
fileService.readFile('path/to/file').then(content => {
  console.log(content);
});
```

## API服务原则

1. 使用Axios进行HTTP请求
2. 统一处理请求和响应拦截
3. 统一处理错误
4. 实现请求缓存和重试机制
5. 支持取消请求
6. 支持请求队列和并发控制
7. 支持离线模式和数据同步
8. 统一处理认证和授权
9. 统一处理数据格式转换
10. 统一处理分页和过滤

## 服务开发规范

1. 服务应该是单例的，使用工厂模式或单例模式创建
2. 服务应该有清晰的职责划分，遵循单一职责原则
3. 服务应该有良好的错误处理机制
4. 服务应该有良好的日志记录机制
5. 服务应该有良好的性能优化
6. 服务应该有良好的可测试性
7. 服务应该有良好的可维护性
8. 服务应该有良好的可扩展性
9. 服务应该有良好的文档
10. 服务应该有良好的版本控制

## 服务依赖关系

- **API服务**: 依赖于网络服务和存储服务
- **AI服务**: 依赖于API服务和文件服务
- **文件服务**: 依赖于存储服务
- **通知服务**: 依赖于API服务和存储服务
- **分析服务**: 依赖于API服务和存储服务
- **存储服务**: 无依赖
- **同步服务**: 依赖于API服务、存储服务和网络服务
- **备份服务**: 依赖于文件服务和存储服务
- **搜索服务**: 依赖于API服务和存储服务
- **翻译服务**: 依赖于API服务
- **群组服务**: 依赖于API服务和存储服务
- **第三方认证服务**: 依赖于API服务和存储服务