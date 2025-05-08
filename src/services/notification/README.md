# 通知服务

本目录包含零屿笔记应用的通知相关服务，用于管理本地通知和推送通知功能。

## 文件结构

- **notificationService.js**: 通知服务，提供本地通知和推送通知功能

## 主要功能

### 通知服务 (notificationService.js)

通知服务提供以下主要功能：

- **本地通知**: 创建和管理本地通知
- **推送通知**: 处理远程推送通知
- **通知权限**: 请求和检查通知权限
- **通知调度**: 调度定时通知和重复通知
- **通知分类**: 管理不同类型的通知
- **通知操作**: 处理通知点击和操作
- **通知设置**: 管理通知设置和偏好

## 通知类型

通知服务支持以下通知类型：

- **提醒通知**: 与提醒和日程相关的通知
- **系统通知**: 与系统状态和更新相关的通知
- **社交通知**: 与社交互动相关的通知（评论、点赞等）
- **内容通知**: 与内容更新相关的通知
- **同步通知**: 与数据同步相关的通知

## 通知优先级

通知服务定义了以下通知优先级：

- **高优先级**: 需要立即注意的重要通知
- **中优先级**: 重要但不紧急的通知
- **低优先级**: 一般信息性通知

## 与其他服务的交互

通知服务与以下服务有交互：

- **提醒服务**: 创建提醒相关通知
- **社区服务**: 创建社交互动通知
- **同步服务**: 创建同步状态通知
- **设置服务**: 管理通知设置和偏好

## 使用方法

```javascript
import { notificationService } from '../../services/notification';

// 请求通知权限
async function requestNotificationPermission() {
  try {
    const granted = await notificationService.requestPermission();
    console.log('通知权限:', granted ? '已授予' : '已拒绝');
    return granted;
  } catch (error) {
    console.error('请求通知权限失败:', error);
    return false;
  }
}

// 创建本地通知
async function createLocalNotification(title, body, options = {}) {
  try {
    const notificationId = await notificationService.scheduleNotification({
      title,
      body,
      data: options.data || {},
      category: options.category || 'default',
      priority: options.priority || 'default',
      trigger: options.trigger || { type: 'immediate' }
    });

    console.log('本地通知已创建:', notificationId);
    return notificationId;
  } catch (error) {
    console.error('创建本地通知失败:', error);
    return null;
  }
}

// 创建定时通知
async function scheduleTimedNotification(title, body, date, options = {}) {
  try {
    const notificationId = await notificationService.scheduleNotification({
      title,
      body,
      data: options.data || {},
      trigger: {
        type: 'date',
        date: date instanceof Date ? date : new Date(date)
      }
    });

    console.log('定时通知已创建:', notificationId, '预定时间:', date);
    return notificationId;
  } catch (error) {
    console.error('创建定时通知失败:', error);
    return null;
  }
}

// 取消通知
async function cancelNotification(notificationId) {
  try {
    await notificationService.cancelNotification(notificationId);
    console.log('通知已取消:', notificationId);
    return true;
  } catch (error) {
    console.error('取消通知失败:', error);
    return false;
  }
}
```

## 注意事项

- 通知权限需要用户授予，应处理权限被拒绝的情况
- 不同平台（iOS/Android）的通知API有差异，需要适配
- 避免发送过多通知，以免打扰用户
- 通知内容应简洁明了，包含必要信息
- 考虑用户的通知偏好，提供通知设置选项
