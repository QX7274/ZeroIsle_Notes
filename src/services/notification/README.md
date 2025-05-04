# 通知服务目录

本目录包含与通知功能相关的服务。

## 文件列表

- **notificationService.js**: 通知服务，提供本地通知和推送通知功能

## 使用方法

```javascript
import { notificationService } from '../services/notification';

// 发送本地通知
notificationService.scheduleNotification({
  title: '提醒',
  message: '别忘了完成任务',
  date: new Date(Date.now() + 1000 * 60 * 60), // 1小时后
});

// 取消通知
notificationService.cancelNotification(notificationId);
```
