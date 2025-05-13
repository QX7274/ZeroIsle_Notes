# 上传服务

本目录包含零屿笔记应用的上传服务，用于提供数据和文件上传功能。

## 文件列表

- **uploadService.js**: 上传服务，提供数据和文件上传功能
- **index.js**: 上传服务索引

## 功能说明

上传服务提供以下功能：

1. **数据上传**: 将本地数据上传到服务器
2. **文件上传**: 将本地文件上传到服务器
3. **上传队列管理**: 管理上传队列，支持离线添加、在线上传
4. **上传进度跟踪**: 跟踪文件上传进度
5. **上传错误处理**: 处理上传过程中的错误，支持重试机制

## 使用方法

```javascript
import { uploadService } from '../services/upload';

// 上传数据
uploadService.uploadData('notes', '123', { title: '测试笔记', content: '内容' }, true).then(result => {
  if (result.success) {
    console.log('数据上传成功');
  } else {
    console.log('数据上传失败:', result.message);
  }
});

// 上传文件
uploadService.uploadFile('/path/to/file.jpg', 'notes', '123', { type: 'image' }, progress => {
  console.log(`上传进度: ${progress}%`);
}).then(result => {
  if (result.success) {
    console.log('文件上传成功');
  } else {
    console.log('文件上传失败:', result.message);
  }
});

// 获取上传队列
uploadService.getUploadQueue().then(queue => {
  console.log(`上传队列中有 ${queue.length} 项`);
});

// 处理上传队列
uploadService.processUploadQueue().then(result => {
  console.log(`处理完成，成功: ${result.succeeded}，失败: ${result.failed}`);
});

// 清空上传队列
uploadService.clearUploadQueue().then(success => {
  console.log('上传队列已清空');
});

// 从上传队列中移除项目
uploadService.removeFromUploadQueue('item_id').then(success => {
  console.log('项目已从上传队列中移除');
});
```

## 离线支持

上传服务支持离线操作，当网络不可用时，上传请求会被添加到上传队列中，并在网络恢复后自动处理。

## 依赖关系

- **网络服务**: 检测网络状态
- **存储服务**: 存储上传队列
- **API服务**: 发送上传请求

## 注意事项

1. 上传大文件时，建议使用`uploadFile`方法并提供进度回调函数
2. 上传敏感数据时，确保使用HTTPS连接
3. 上传队列中的项目会在应用重启后保留
4. 上传失败的项目会自动重试，最多重试3次
