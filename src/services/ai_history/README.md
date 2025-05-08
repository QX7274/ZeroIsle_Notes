# AI历史服务

本目录包含零屿笔记应用的AI历史记录服务，用于管理和存储用户与AI交互的历史记录。

## 文件结构

- **aiHistoryService.js**: AI历史记录服务，提供AI处理历史记录的存储和管理功能

## 主要功能

### AI历史记录服务 (aiHistoryService.js)

AI历史记录服务提供以下主要功能：

- **初始化服务**: 从本地存储加载历史记录
- **添加历史记录**: 记录用户与AI的交互，包括工具类型、输入和输出
- **获取历史记录**: 获取所有历史记录或按条件筛选
- **清除历史记录**: 清除单条或所有历史记录
- **获取历史记录项**: 获取特定历史记录的详细信息

## 数据结构

AI历史记录项的数据结构如下：

```javascript
{
  id: String,           // 历史记录ID，使用时间戳生成
  tool: String,         // 工具类型，如'chat'、'summarize'、'translate'等
  input: String,        // 输入文本
  output: String,       // 输出结果
  timestamp: Date,      // 时间戳
  metadata: Object      // 可选的元数据，如模型信息、处理时间等
}
```

## 存储机制

AI历史记录使用AsyncStorage进行本地存储，主要存储键为：

- **AI_HISTORY_KEY**: 'ai_processing_history'，存储所有AI处理历史记录

为了避免存储过多数据，服务会限制历史记录的最大数量（默认为50条）。

## 与其他服务的交互

AI历史记录服务与以下服务有交互：

- **分析服务 (analyticsService)**: 用于跟踪历史记录相关的事件和错误
- **存储服务 (storageService)**: 用于持久化存储历史记录

## 使用方法

```javascript
import { aiHistoryService } from '../../services/ai_history/aiHistoryService';

// 初始化服务
await aiHistoryService.init();

// 添加历史记录
await aiHistoryService.addHistory({
  tool: 'chat',
  input: '你好，请介绍一下自己',
  output: '我是零屿笔记的AI助手，很高兴为您服务...',
  timestamp: new Date()
});

// 获取所有历史记录
const allHistory = await aiHistoryService.getHistory();

// 获取特定工具的历史记录
const chatHistory = await aiHistoryService.getHistory('chat');

// 获取特定历史记录项
const historyItem = await aiHistoryService.getHistoryItem('1234567890');

// 清除特定历史记录
await aiHistoryService.clearHistory('1234567890');

// 清除所有历史记录
await aiHistoryService.clearHistory();
```

## 注意事项

- 历史记录服务会在应用启动时自动初始化，但在使用前最好先调用`ensureInitialized()`方法确保初始化完成
- 历史记录默认按时间倒序排列，最新的记录在最前面
- 为了保护用户隐私，应提供清除历史记录的选项，并在适当的时候（如用户退出登录时）自动清除敏感历史记录
