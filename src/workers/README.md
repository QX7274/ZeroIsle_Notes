# Web Workers 模块

本目录包含零屿笔记应用的 Web Workers 相关文件，用于在后台线程执行计算密集型任务，避免阻塞主线程，提高应用性能和响应性。

## 概述

Web Workers 是一种在后台线程中运行脚本的技术，可以执行耗时的计算任务而不会阻塞用户界面。在零屿笔记应用中，我们使用 Web Workers 处理以下任务：

1. 文本分析和处理
2. 搜索索引构建和查询
3. 数据同步和处理

## 文件结构

- **index.js**: Web Workers 模块导出文件
- **textAnalysisWorker.js**: 文本分析 Worker，用于分析文本内容、提取关键词等
- **searchIndexWorker.js**: 搜索索引 Worker，用于构建和查询全文搜索索引
- **syncWorker.js**: 数据同步 Worker，用于处理数据同步任务

## 使用方法

### 创建 Worker

```javascript
import { createWorker } from '../workers';

// 创建文本分析 Worker
const textWorker = createWorker('./textAnalysisWorker.js');

// 创建文本分析 Worker
const textAnalysisWorker = createWorker('textAnalysis');

// 创建搜索索引 Worker
const searchIndexWorker = createWorker('searchIndex');
```

### 发送消息给 Worker

```javascript
// 发送消息给图像处理 Worker
imageWorker.postMessage({
  type: 'PROCESS_IMAGE',
  payload: {
    uri: imageUri,
    options: {
      resize: true,
      width: 800,
      height: 600,
      format: 'jpeg',
      quality: 0.8
    }
  }
});

// 发送消息给文本分析 Worker
textAnalysisWorker.postMessage({
  type: 'ANALYZE_TEXT',
  payload: {
    text: '这是一段需要分析的文本内容...',
    options: {
      extractKeywords: true,
      extractEntities: true,
      language: 'zh-CN'
    }
  }
});
```

### 接收 Worker 的响应

```javascript
// 接收 Worker 的响应
imageWorker.onmessage = (event) => {
  const { type, payload, error } = event.data;

  if (error) {
    console.error('Worker 错误:', error);
    return;
  }

  switch (type) {
    case 'PROCESS_RESULT':
      console.log('处理结果:', payload);
      // 处理结果
      break;
    case 'PROGRESS':
      console.log('处理进度:', payload.progress);
      // 更新进度指示器
      break;
    default:
      console.warn('未知的消息类型:', type);
  }
};

// 处理 Worker 错误
imageWorker.onerror = (error) => {
  console.error('Worker 错误:', error);
};
```

### 终止 Worker

```javascript
// 终止 Worker
imageWorker.terminate();
```

## 注意事项

1. **数据传输**: Worker 和主线程之间的数据传输是通过序列化和反序列化完成的，这可能会影响性能。对于大型数据，考虑使用 `SharedArrayBuffer` 或 `TransferableObjects`。

2. **错误处理**: 确保在 Worker 中捕获所有可能的错误，并将它们传回主线程。

3. **状态管理**: Worker 是独立的线程，不共享主线程的状态。如果需要共享状态，必须通过消息传递。

4. **兼容性**: 确保目标平台支持 Web Workers。在 React Native 中，可能需要使用特定的库来模拟 Web Workers。

5. **资源管理**: 不再需要 Worker 时，记得调用 `terminate()` 方法释放资源。

6. **调试**: Worker 的调试可能比较困难，建议添加详细的日志记录。

7. **加载时机**: 考虑何时创建 Worker。可以在应用启动时预先创建，或者在需要时懒加载。

## 性能优化

1. **消息批处理**: 将多个小消息合并为一个大消息，减少消息传递的开销。

2. **使用 TransferableObjects**: 对于大型数据（如 ArrayBuffer），使用 `transferList` 参数避免复制。

3. **Worker 池**: 创建 Worker 池管理多个 Worker 实例，避免频繁创建和销毁 Worker。

4. **任务分割**: 将大型任务分割成小块，分批处理，避免长时间阻塞 Worker。

5. **缓存结果**: 缓存常用计算结果，避免重复计算。
