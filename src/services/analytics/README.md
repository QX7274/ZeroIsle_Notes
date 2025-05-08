# 分析服务

本目录包含零屿笔记应用的分析服务，用于跟踪和分析用户行为、应用性能和错误信息，帮助改进应用体验。

## 文件结构

- **analyticsService.js**: 分析服务，提供事件跟踪、错误跟踪和用户行为分析功能

## 主要功能

### 分析服务 (analyticsService.js)

分析服务提供以下主要功能：

- **事件跟踪**: 跟踪用户在应用中的各种事件和操作
- **错误跟踪**: 捕获和记录应用中的错误和异常
- **屏幕跟踪**: 跟踪用户访问的屏幕和页面
- **用户行为跟踪**: 分析用户的使用模式和行为
- **用户标识管理**: 设置和清除用户标识，关联用户数据

## 数据结构

事件数据的基本结构如下：

```javascript
{
  eventName: String,     // 事件名称
  params: Object,        // 事件参数
  timestamp: String,     // 时间戳
  deviceInfo: {          // 设备信息
    platform: String,    // 平台（iOS/Android）
    version: String,     // 应用版本
    deviceModel: String, // 设备型号
    osVersion: String    // 操作系统版本
  }
}
```

## 事件类型

分析服务支持跟踪以下类型的事件：

- **用户事件**: 用户登录、注册、退出等
- **内容事件**: 创建笔记、编辑笔记、删除笔记等
- **功能事件**: 使用特定功能、开启/关闭功能等
- **性能事件**: 加载时间、响应时间、崩溃等
- **导航事件**: 屏幕访问、页面切换等

## 数据发送机制

分析服务采用批量发送机制，将事件数据缓存在内存中，当满足以下条件之一时发送到服务器：

- 缓存的事件数量达到阈值（默认10条）
- 应用进入后台或关闭
- 用户登录或退出
- 手动调用发送方法

## 隐私保护

分析服务遵循以下隐私保护原则：

- 用户可以选择退出数据收集
- 不收集个人敏感信息
- 数据匿名化处理
- 遵循相关数据保护法规

## 与其他服务的交互

分析服务与以下服务有交互：

- **API服务**: 用于将收集的数据发送到后端
- **网络服务**: 检测网络状态，决定数据发送时机
- **存储服务**: 在必要时缓存分析数据

## 使用方法

```javascript
import analyticsService from '../../services/analytics/analyticsService';

// 跟踪事件
analyticsService.trackEvent('button_click', {
  buttonName: 'create_note',
  screenName: 'home'
});

// 跟踪错误
try {
  // 可能出错的代码
} catch (error) {
  analyticsService.trackError(error, {
    action: 'save_note',
    noteId: '12345'
  });
}

// 跟踪屏幕
analyticsService.trackScreen('NoteDetailScreen', {
  noteId: '12345',
  source: 'home_screen'
});

// 跟踪用户行为
analyticsService.trackUserAction('share_note', {
  noteId: '12345',
  platform: 'wechat'
});

// 设置用户标识
analyticsService.setUserId('user123', {
  userType: 'premium',
  registrationDate: '2023-01-01'
});

// 清除用户标识
analyticsService.clearUserId();
```

## 预定义事件

分析服务预定义了一系列常用事件，可以通过`analyticsService.events`访问：

```javascript
// 使用预定义事件
analyticsService.trackEvent(analyticsService.events.NOTE_CREATED, {
  noteType: 'text',
  categoryId: '123'
});
```

## 注意事项

- 在跟踪事件时，应避免包含敏感个人信息
- 对于大量生成的事件，应考虑采样或聚合，避免过多数据
- 在低网络或离线状态下，事件数据会缓存并在网络恢复后发送
