# 网络服务目录

本目录包含与网络状态和连接相关的服务。

## 文件列表

- **networkService.js**: 网络服务，提供网络状态监测、连接类型检测等功能

## 使用方法

```javascript
import { networkService } from '../services/network';

// 检查网络连接
networkService.isConnected().then(isConnected => {
  console.log('是否连接网络:', isConnected);
});

// 获取网络类型
networkService.getConnectionType().then(type => {
  console.log('网络连接类型:', type);
});

// 监听网络状态变化
const unsubscribe = networkService.addConnectionChangeListener(state => {
  console.log('网络状态变化:', state);
});

// 取消监听
unsubscribe();
```
