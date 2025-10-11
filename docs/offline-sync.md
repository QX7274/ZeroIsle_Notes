# 离线同步服务使用指南

本文档描述了离线同步服务的设计、实现和使用方法。

## 什么是离线同步服务？

离线同步服务是一个用于处理数据同步和冲突解决的服务，它允许应用在离线状态下继续工作，并在网络恢复时将本地更改同步到云端。

## 为什么需要离线同步服务？

1. **离线工作**：用户可以在没有网络连接的情况下继续使用应用。
2. **数据一致性**：确保本地数据和云端数据保持一致。
3. **用户体验**：提供无缝的用户体验，无论是在线还是离线。
4. **数据安全**：防止数据丢失，确保所有更改都能同步到云端。

## 离线同步服务的架构

离线同步服务由以下组件组成：

1. **离线队列**：存储离线操作的队列。
2. **同步服务**：负责同步数据的服务。
3. **网络服务**：监控网络状态的服务。
4. **事件发射器**：发布和订阅事件的组件。

## 离线队列

离线队列用于存储离线操作，每个队列项包含以下信息：

```javascript
{
  _id: String,              // 唯一标识符
  entity_id: String,        // 实体ID
  entity_type: String,      // 实体类型
  operation: String,        // 操作类型
  data: Object,             // 操作数据
  user_id: String,          // 用户ID
  status: String,           // 状态
  retry_count: Number,      // 重试次数
  error: String,            // 错误信息
  created_at: Date,         // 创建时间
  updated_at: Date,         // 更新时间
  synced_at: Date           // 同步时间
}
```

## 同步服务

同步服务负责同步数据，它提供以下方法：

```javascript
/**
 * 添加到同步队列
 * @param {Object} item 同步项
 * @returns {Promise<Object>} 添加的同步项
 */
async addToSyncQueue(item) {
  // ...
}

/**
 * 同步队列
 * @returns {Promise<boolean>} 是否成功
 */
async syncQueue() {
  // ...
}

/**
 * 获取同步队列
 * @param {Object} options 选项
 * @returns {Promise<Array<Object>>} 同步队列
 */
async getQueue(options = {}) {
  // ...
}

/**
 * 清空同步队列
 * @returns {Promise<boolean>} 是否成功
 */
async clearQueue() {
  // ...
}
```

## 网络服务

网络服务负责监控网络状态，它提供以下方法：

```javascript
/**
 * 是否在线
 * @returns {boolean} 是否在线
 */
isOnline() {
  // ...
}

/**
 * 获取连接类型
 * @returns {string} 连接类型
 */
getConnectionType() {
  // ...
}

/**
 * 获取连接质量
 * @returns {string} 连接质量
 */
getConnectionQualityLevel() {
  // ...
}

/**
 * 添加网络状态变化监听器
 * @param {string} event 事件名称
 * @param {Function} listener 监听器
 * @returns {Function} 移除监听器的函数
 */
addListener(event, listener) {
  // ...
}
```

## 事件发射器

事件发射器用于发布和订阅事件，它提供以下方法：

```javascript
/**
 * 发射事件
 * @param {string} event 事件名称
 * @param {...any} args 事件参数
 * @returns {boolean} 是否有监听器处理了事件
 */
emit(event, ...args) {
  // ...
}

/**
 * 添加事件监听器
 * @param {string} event 事件名称
 * @param {Function} listener 监听器函数
 * @returns {EventEmitter} 事件发射器
 */
addListener(event, listener) {
  // ...
}

/**
 * 移除事件监听器
 * @param {string} event 事件名称
 * @param {Function} listener 监听器函数
 * @returns {EventEmitter} 事件发射器
 */
removeListener(event, listener) {
  // ...
}
```

## 如何使用离线同步服务

### 初始化离线同步服务

```javascript
import { offlineSyncService } from '../services/offline/offlineSyncService';

// 初始化离线同步服务
offlineSyncService.initialize();
```

### 添加到同步队列

```javascript
import { offlineSyncService } from '../services/offline/offlineSyncService';

// 添加到同步队列
await offlineSyncService.addToSyncQueue({
  entity_id: 'note_123',
  entity_type: 'note',
  operation: 'update',
  data: { title: '新标题', content: '新内容' },
  user_id: 'user_123',
});
```

### 手动同步队列

```javascript
import { offlineSyncService } from '../services/offline/offlineSyncService';

// 手动同步队列
await offlineSyncService.syncQueue();
```

### 监听同步事件

```javascript
import { offlineSyncService, SYNC_EVENTS } from '../services/offline/offlineSyncService';

// 监听同步开始事件
const removeStartListener = offlineSyncService.addListener(SYNC_EVENTS.SYNC_STARTED, () => {
  console.log('同步开始');
});

// 监听同步完成事件
const removeCompletedListener = offlineSyncService.addListener(SYNC_EVENTS.SYNC_COMPLETED, (result) => {
  console.log('同步完成', result);
});

// 监听同步失败事件
const removeFailedListener = offlineSyncService.addListener(SYNC_EVENTS.SYNC_FAILED, (error) => {
  console.error('同步失败', error);
});

// 监听同步进度事件
const removeProgressListener = offlineSyncService.addListener(SYNC_EVENTS.SYNC_PROGRESS, (progress) => {
  console.log('同步进度', progress);
});

// 移除监听器
removeStartListener();
removeCompletedListener();
removeFailedListener();
removeProgressListener();
```

### 在适配器中使用离线同步服务

```javascript
import { offlineSyncService } from '../services/offline/offlineSyncService';

/**
 * 创建笔记
 * @param {Object} noteData 笔记数据
 * @param {string} userId 用户ID
 * @returns {Promise<Object>} 创建的笔记
 */
export const createNote = async (noteData, userId) => {
  try {
    // 准备笔记数据
    const now = new Date();
    const noteId = `note_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    
    const backendNote = {
      _id: noteId,
      title: noteData.title || '',
      content: noteData.content || '',
      // ...
    };
    
    // 创建笔记模型
    const note = await Note.create(backendNote);
    
    // 添加到同步队列
    await offlineSyncService.addToSyncQueue({
      entity_id: note._id,
      entity_type: 'note',
      operation: 'create',
      data: note.toJSON(),
      user_id: userId,
    });
    
    // 返回前端笔记对象
    return toFrontendNote(note);
  } catch (error) {
    logService.error('创建笔记失败', error);
    throw error;
  }
};
```

### 在 API 服务中使用离线同步服务

```javascript
import { networkService } from '../network/networkService';
import { offlineSyncService } from '../offline/offlineSyncService';

const noteApi = {
  async createNote(data) {
    try {
      // 检查网络连接
      if (!networkService.isOnline()) {
        // 使用适配器在本地创建笔记
        const userId = data.userId || 'current_user';
        const note = await noteAdapter.createNote(data, userId);
        return { data: note, success: true, isOffline: true };
      }

      // 使用API客户端在服务器创建笔记
      const response = await apiClient.post('/api/v1/notes/', data);
      
      // 同步到本地
      try {
        const userId = data.userId || 'current_user';
        await noteAdapter.createNote({
          ...response.data,
          _id: response.data.id,
          user_id: userId,
        }, userId);
      } catch (syncError) {
        logService.warn('同步笔记到本地失败', syncError);
      }
      
      return response.data;
    } catch (error) {
      logService.error('创建笔记失败', error);
      
      // 尝试在本地创建笔记作为备份
      try {
        const userId = data.userId || 'current_user';
        const note = await noteAdapter.createNote(data, userId);
        return { data: note, success: true, isOffline: true };
      } catch (offlineError) {
        logService.error('在本地创建笔记失败', offlineError);
        throw error;
      }
    }
  }
};
```

## 最佳实践

1. **优先本地操作**：优先在本地执行操作，然后再同步到云端，这样可以提供更好的用户体验。

2. **自动同步**：在网络恢复时自动同步数据，不需要用户手动触发。

3. **冲突解决**：制定合理的冲突解决策略，处理同步冲突。

4. **重试机制**：对于同步失败的操作，实现重试机制，确保数据最终一致性。

5. **用户反馈**：提供同步状态的用户反馈，让用户知道数据是否已同步。

6. **批量同步**：实现批量同步，减少网络请求次数，提高性能。

7. **增量同步**：实现增量同步，只同步变更的数据，减少数据传输量。

8. **压缩数据**：压缩同步数据，减少数据传输量，提高性能。

9. **安全性**：确保数据同步的安全性，防止数据泄露和篡改。

10. **监控和日志**：监控同步过程，记录同步日志，便于调试和问题排查。

## 常见问题

1. **同步冲突**：当本地和云端同时修改同一数据时，可能会发生冲突。解决方法是使用乐观锁或冲突解决策略。

2. **网络不稳定**：网络不稳定可能导致同步失败。解决方法是实现重试机制和断点续传。

3. **数据一致性**：确保本地和云端数据一致性。解决方法是使用事务或原子操作。

4. **性能问题**：同步大量数据可能导致性能问题。解决方法是实现批量同步和增量同步。

5. **存储限制**：本地存储空间有限，可能无法存储所有数据。解决方法是实现数据清理策略。

6. **安全性**：数据同步可能存在安全风险。解决方法是使用加密和身份验证。

7. **用户体验**：同步过程可能影响用户体验。解决方法是在后台同步数据，不阻塞用户操作。
