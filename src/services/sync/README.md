# 同步服务

本目录包含零屿笔记应用的同步服务，用于在本地MongoDB Realm数据库和云端MongoDB Atlas之间同步数据。

## 文件列表

- **syncService.js**: 同步服务，提供数据同步功能
- **syncEvents.js**: 同步事件常量，定义同步服务使用的事件类型
- **syncUtils.js**: 同步工具函数，提供同步相关的工具函数
- **index.js**: 同步服务索引

## 功能说明

同步服务提供以下功能：

1. **数据同步**: 在本地数据库和云端数据库之间同步数据
2. **增量同步**: 只同步自上次同步以来发生变化的数据
3. **冲突解决**: 解决本地和云端数据冲突
4. **离线队列**: 在离线状态下将操作存入队列，在网络恢复后执行
5. **同步状态管理**: 管理同步状态和进度
6. **错误处理**: 处理同步过程中的错误

## 同步策略

当前的同步策略是：

1. **本地优先**: 数据首先保存在本地，然后在有网络连接时同步到云端
2. **关键信息同步**: 只同步关键用户信息，其他数据保存在本地
3. **手动上传**: 提供手动上传功能，用户可以选择上传数据到云端
4. **自动同步**: 在网络恢复时自动同步关键用户信息

## 使用方法

```javascript
import { syncService, SYNC_EVENTS, syncUtils } from '../../services/sync';

// 初始化同步服务
async function initializeSync() {
  try {
    await syncService.initialize();
    console.log('同步服务初始化成功');
    return true;
  } catch (error) {
    console.error('同步服务初始化失败:', error);
    return false;
  }
}

// 手动触发同步
async function syncData() {
  try {
    const result = await syncService.sync();
    console.log('同步结果:', result);
    return result;
  } catch (error) {
    console.error('同步失败:', error);
    return { success: false, error };
  }
}

// 获取同步状态
function getSyncStatus() {
  const status = syncService.getSyncStatus();
  console.log('同步状态:', status);
  return status;
}

// 获取格式化的同步状态
function getFormattedSyncStatus() {
  const formattedStatus = syncService.getFormattedSyncStatus();
  console.log('同步状态:', formattedStatus); // 例如："5分钟前同步"
  return formattedStatus;
}

// 添加离线操作
async function addOfflineOperation() {
  try {
    const operationId = await syncService.addOfflineOperation(
      'update',
      'notes',
      '123',
      { title: '更新的笔记标题' }
    );
    console.log('离线操作已添加:', operationId);
    return operationId;
  } catch (error) {
    console.error('添加离线操作失败:', error);
    return null;
  }
}

// 获取离线队列
async function getOfflineQueue() {
  const queue = await syncService.getOfflineQueue();
  console.log('离线队列:', queue);
  return queue;
}

// 清空离线队列
async function clearOfflineQueue() {
  const success = await syncService.clearOfflineQueue();
  console.log('清空离线队列:', success ? '成功' : '失败');
  return success;
}

// 设置自动同步间隔
function setAutoSyncInterval(minutes) {
  syncService.setAutoSyncInterval(minutes);
  console.log(`自动同步间隔已设置为 ${minutes} 分钟`);
}

// 监听同步事件
function listenToSyncEvents() {
  // 监听同步开始
  const removeStartListener = syncService.addListener(SYNC_EVENTS.SYNC_STARTED, (data) => {
    console.log('同步开始:', data.timestamp);
  });

  // 监听同步完成
  const removeCompleteListener = syncService.addListener(SYNC_EVENTS.SYNC_COMPLETED, (data) => {
    console.log('同步完成:', data);
  });

  // 监听同步失败
  const removeErrorListener = syncService.addListener(SYNC_EVENTS.SYNC_FAILED, (error) => {
    console.error('同步错误:', error);
  });

  // 监听离线操作添加
  const removeOperationListener = syncService.addListener(SYNC_EVENTS.OFFLINE_OPERATION_ADDED, (data) => {
    console.log('离线操作已添加:', data);
  });

  // 返回取消监听的函数
  return () => {
    removeStartListener();
    removeCompleteListener();
    removeErrorListener();
    removeOperationListener();
  };
}

// 使用同步工具函数
function useSyncUtils() {
  // 计算两个对象之间的差异
  const oldObj = { name: 'John', age: 30 };
  const newObj = { name: 'John', age: 31, city: 'New York' };
  const diff = syncUtils.calculateDiff(oldObj, newObj);
  console.log('对象差异:', diff); // { age: 31, city: 'New York' }

  // 合并对象，处理冲突
  const localObj = { name: 'John', age: 31, updated_at: '2023-01-01T00:00:00Z' };
  const remoteObj = { name: 'Johnny', city: 'New York', updated_at: '2023-01-02T00:00:00Z' };
  const merged = syncUtils.mergeWithConflictResolution(localObj, remoteObj, { strategy: 'newer' });
  console.log('合并结果:', merged); // 远程对象优先，因为更新时间更新

  // 过滤对象，只保留指定字段
  const user = { id: 1, name: 'John', email: 'john@example.com', password: 'secret', token: '123' };
  const filteredUser = syncUtils.filterFields(user, ['id', 'name', 'email']);
  console.log('过滤后的用户:', filteredUser); // { id: 1, name: 'John', email: 'john@example.com' }
}
```

## 与其他服务的交互

同步服务与以下服务有交互：

- **网络服务**: 检测网络状态，决定同步策略
- **存储服务**: 提供本地数据存储功能
- **API服务**: 与后端API通信
- **上传服务**: 提供数据上传功能

## 注意事项

1. 同步操作可能是耗时的，应考虑在后台线程中执行
2. 同步操作应处理网络异常和冲突情况
3. 同步策略应考虑用户的数据使用偏好
4. 提供同步状态的视觉反馈，让用户了解当前状态
5. 考虑数据安全性，确保敏感数据的安全传输
