# 文件服务目录

本目录包含与文件操作相关的服务。

## 文件列表

- **fileService.js**: 文件服务，提供文件读写、复制、移动、删除等功能

## 使用方法

```javascript
import { fileService } from '../services/file';

// 读取文件
fileService.readFile('path/to/file').then(content => {
  console.log(content);
});

// 写入文件
fileService.writeFile('path/to/file', 'content').then(() => {
  console.log('文件写入成功');
});
```
