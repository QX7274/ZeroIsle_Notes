# MongoDB 同步实现指南

本文档描述了零屿笔记应用的 MongoDB 同步实现方案。

## 概述

零屿笔记应用使用自定义的同步实现，而不是使用 MongoDB Realm 的自动同步功能。这种方式提供了更灵活的控制，减少了对第三方服务的依赖，并且更容易与现有系统集成。

## 同步架构

同步架构包括以下组件：

1. **离线队列**：使用 `OfflineQueue` 存储离线操作，包括实体ID、操作类型、数据等信息。
2. **网络监听**：使用 `networkService` 监听网络状态变化，当网络恢复时触发同步。
3. **同步服务**：使用 `offlineSyncService` 处理同步逻辑，包括添加到队列、同步队列、处理冲突等。
4. **数据服务**：使用 `dataService` 提供统一的数据访问接口，封装 MongoDB 和 Realm 操作。
5. **适配器**：使用各种适配器（如 `noteAdapter`、`tagAdapter` 等）处理数据转换和本地存储。

## 同步流程

### 1. 离线操作

当用户在离线状态下执行操作（如创建笔记、更新分类等）时：

1. 操作首先保存在本地 Realm 数据库中
2. 操作被添加到离线队列中，标记为待同步
3. 用户界面立即更新，显示操作结果

```javascript
// 示例：创建笔记
async function createNote(noteData) {
  // 保存到本地
  const note = await dataService.create('notes', noteData);
  
  // 添加到同步队列
  await offlineSyncService.addToSyncQueue({
    entity_id: note._id,
    entity_type: 'notes',
    operation: 'create',
    data: note,
    user_id: note.user_id,
  });
  
  return note;
}
```

### 2. 网络恢复

当网络恢复时：

1. `networkService` 检测到网络恢复，触发 `online` 事件
2. `offlineSyncService` 监听到 `online` 事件，开始同步队列
3. 同步队列中的操作按照创建时间顺序依次同步到服务器

```javascript
// 网络监听
networkService.addListener(NETWORK_EVENTS.ONLINE, () => {
  // 网络恢复，开始同步
  offlineSyncService.syncQueue();
});
```

### 3. 同步队列

同步队列的处理流程：

1. 获取所有待同步的操作
2. 按照创建时间顺序依次处理每个操作
3. 根据操作类型（创建、更新、删除）执行相应的同步操作
4. 如果同步成功，标记操作为已同步
5. 如果同步失败，标记操作为失败，记录错误信息

```javascript
// 同步队列
async function syncQueue() {
  // 获取待同步的操作
  const pendingItems = await OfflineQueue.findPending();
  
  // 依次处理每个操作
  for (const item of pendingItems) {
    try {
      // 标记为同步中
      await item.markAsSyncing();
      
      // 同步操作
      await syncItem(item);
      
      // 标记为已同步
      await item.markAsSynced();
    } catch (error) {
      // 标记为失败
      await item.markAsFailed(error.message);
    }
  }
}
```

### 4. 冲突解决

当本地更改与服务器更改冲突时：

1. 检测冲突（如服务器版本比本地版本更新）
2. 根据冲突解决策略处理冲突
   - 客户端优先：本地更改覆盖服务器更改
   - 服务器优先：服务器更改覆盖本地更改
   - 合并：尝试合并本地和服务器的更改
3. 更新本地数据和同步状态

```javascript
// 冲突解决
async function resolveConflict(localData, serverData, strategy = 'clientWins') {
  switch (strategy) {
    case 'clientWins':
      // 本地更改覆盖服务器更改
      return localData;
    
    case 'serverWins':
      // 服务器更改覆盖本地更改
      return serverData;
    
    case 'merge':
      // 合并本地和服务器的更改
      return {
        ...serverData,
        ...localData,
        updated_at: new Date(),
      };
    
    default:
      return localData;
  }
}
```

## 同步服务 API

### offlineSyncService

```javascript
// 初始化同步服务
await offlineSyncService.initialize();

// 添加到同步队列
await offlineSyncService.addToSyncQueue({
  entity_id: 'note_123',
  entity_type: 'notes',
  operation: 'update',
  data: { title: '新标题' },
  user_id: 'user_123',
});

// 同步队列
await offlineSyncService.syncQueue();

// 获取同步队列
const queue = await offlineSyncService.getQueue();

// 清空同步队列
await offlineSyncService.clearQueue();

// 重试失败的队列项
await offlineSyncService.retryFailedItems();

// 监听同步事件
offlineSyncService.addListener(SYNC_EVENTS.SYNC_COMPLETED, (result) => {
  console.log('同步完成', result);
});
```

### dataService

```javascript
// 初始化数据服务
await dataService.initialize();

// 创建文档
const note = await dataService.create('notes', {
  title: '新笔记',
  content: '笔记内容',
});

// 更新文档
await dataService.update('notes', note._id, {
  title: '更新的标题',
});

// 删除文档
await dataService.delete('notes', note._id);

// 查询文档
const notes = await dataService.find('notes', { category_id: 'category_123' });

// 同步数据
await dataService.sync('notes');
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

## 结论

自定义的 MongoDB 同步实现提供了更灵活的控制和更好的用户体验，适合零屿笔记应用的需求。通过离线队列、网络监听、同步服务和数据服务的组合，实现了可靠的数据同步和冲突解决。
