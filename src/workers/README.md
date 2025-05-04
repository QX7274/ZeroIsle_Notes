# Web Workers

本目录包含应用中使用的Web Workers，用于在后台线程执行耗时操作，避免阻塞主线程。

## Workers列表

### imageProcessor.js

图像处理Worker，用于在后台线程处理图像数据。

## 使用方法

```javascript
import { createWorker, IMAGE_PROCESSOR_WORKER } from '../workers';

// 创建Worker
const worker = createWorker(IMAGE_PROCESSOR_WORKER);

// 发送消息给Worker
worker.postMessage({
  uri: imageUri,
});

// 接收Worker的消息
worker.onmessage = (e) => {
  const processedData = e.data;
  // 处理结果
};

// 处理Worker错误
worker.onerror = (error) => {
  console.error('Worker error:', error);
};

// 在不需要时终止Worker
worker.terminate();
```
