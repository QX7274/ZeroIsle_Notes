# 零屿笔记AI服务目录

本目录包含零屿笔记应用的AI相关服务，包括文本分析、翻译、思维导图生成等。

## 目录结构

### 服务文件

- **index.js**: AI服务导出文件，集中导出所有AI服务
- **aiService.js**: 核心AI服务，提供聊天、语音转写、图像分析等功能
- **textAnalysis.js**: 文本分析服务，提供文本摘要、关键词提取、情感分析等功能
- **translationService.js**: 翻译服务，提供文本翻译功能
- **mindMapService.js**: 思维导图服务，提供思维导图生成和处理功能

## 使用方法

### 导入AI服务

```javascript
// 导入所有AI服务
import { textAnalysisService, translationService, mindMapService, aiService } from '../services/ai';

// 使用AI服务
const summary = await textAnalysisService.summarizeText(text);
const translatedText = await translationService.translateText(text, 'en', 'zh-CN');
const mindMap = await mindMapService.generateFromText(text);
const chatResponse = await aiService.chat(prompt);
```

### 导入特定AI服务

```javascript
// 导入特定AI服务
import textAnalysisService from '../services/ai/textAnalysis';
import translationService from '../services/ai/translationService';

// 使用AI服务
const keywords = await textAnalysisService.extractKeywords(text);
const language = await translationService.detectLanguage(text);
```

## AI服务开发规范

1. AI服务应该是单例的，使用工厂模式或单例模式创建
2. AI服务应该有清晰的职责划分，遵循单一职责原则
3. AI服务应该有良好的错误处理机制
4. AI服务应该有良好的日志记录机制
5. AI服务应该有良好的性能优化
6. AI服务应该有良好的可测试性
7. AI服务应该有良好的可维护性
8. AI服务应该有良好的可扩展性
9. AI服务应该有良好的文档
10. AI服务应该有良好的版本控制

## AI服务依赖关系

- **aiService**: 依赖于网络服务和存储服务
- **textAnalysisService**: 依赖于aiService和API服务
- **translationService**: 依赖于API服务
- **mindMapService**: 依赖于API服务和分析服务
