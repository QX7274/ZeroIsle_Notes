# 存储服务目录

本目录包含与数据存储相关的服务。项目使用MongoDB Realm作为本地存储，不再使用SQLite、AsyncStorage或直接连接MongoDB。

## 文件列表

- **storageService.js**: 统一存储服务，提供基于MongoDB Realm的数据存储和同步功能
- **realmStorageService.js**: Realm存储服务，提供基于MongoDB Realm的本地存储功能
- **offlineDataService.js**: 离线数据服务，提供基于MongoDB Realm的离线数据存储和同步功能

## MongoDB Realm配置

项目使用MongoDB Realm作为本地存储，并使用MongoDB Atlas作为云数据库服务：

- **连接 URL**: `mongodb+srv://qianxin7274:<password>@cluster0.lo5ybvq.mongodb.net/`
- **数据库名**: `ZeroIsle_Notes`

## 使用方法

```javascript
import { storageService, realmStorageService } from '../services/storage';

// 使用storageService
// 设置项目
storageService.setItem('user_info', { name: 'value' }).then(success => {
  console.log('数据保存' + (success ? '成功' : '失败'));
});

// 获取项目
storageService.getItem('user_info').then(data => {
  console.log(data);
});

// 使用realmStorageService
// 设置项目
realmStorageService.setItem('settings', { theme: 'dark' }).then(success => {
  console.log('设置保存' + (success ? '成功' : '失败'));
});

// 获取项目
realmStorageService.getItem('settings').then(data => {
  console.log(data);
});

// 删除项目
storageService.removeItem('user_info').then(success => {
  console.log('数据删除' + (success ? '成功' : '失败'));
});

// 上传数据
storageService.uploadData('notes', '123', { title: '测试笔记', content: '内容' }).then(result => {
  if (result.success) {
    console.log('数据上传成功');
  } else {
    console.log('数据上传失败:', result.message);
  }
});
```

## 离线支持

系统支持离线操作，当网络不可用时，数据会存储在本地Realm数据库中，并在网络恢复后自动同步关键用户信息到MongoDB Atlas。

```javascript
import { offlineDataService } from '../services/storage';

// 初始化离线数据服务
offlineDataService.initialize().then(() => {
  console.log('离线数据服务初始化完成');
});

// 添加离线操作到同步队列
offlineDataService.addToSyncQueue('create', 'notes', '123', { title: '离线笔记', content: '内容' });

// 手动触发同步
offlineDataService.syncData().then(() => {
  console.log('数据同步完成');
});
```

## 上传服务

项目提供了专门的上传服务，用于将本地数据上传到服务器。

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
```
