# 存储服务目录

本目录包含与本地存储相关的服务。

## 文件列表

- **storageService.js**: 存储服务，提供本地数据存储功能，基于AsyncStorage

## 使用方法

```javascript
import { storageService } from '../services/storage';

// 存储数据
storageService.setItem('key', 'value').then(() => {
  console.log('数据存储成功');
});

// 获取数据
storageService.getItem('key').then(value => {
  console.log(value);
});

// 删除数据
storageService.removeItem('key').then(() => {
  console.log('数据删除成功');
});
```
