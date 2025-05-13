# 适配器模式使用指南

本文档描述了在项目中使用适配器模式的目的、实现和最佳实践。

## 什么是适配器模式？

适配器模式是一种结构型设计模式，它允许接口不兼容的对象能够相互协作。在我们的项目中，适配器模式主要用于在前端数据模型和后端数据模型之间进行转换。

## 为什么使用适配器模式？

1. **解耦应用逻辑和数据存储**：适配器将应用的业务逻辑与具体的数据存储实现分离，使得更换数据库变得更加容易。

2. **统一数据格式**：MongoDB 使用的字段命名风格（如 `user_id`、`is_deleted`）与前端 React/Redux 常用的驼峰命名风格（如 `userId`、`isDeleted`）不同，适配器提供了统一的接口。

3. **离线同步支持**：适配器提供了离线同步的功能，当设备离线时，数据操作可以先保存在本地，当设备重新联网时，适配器可以负责将本地更改同步到云端。

4. **数据验证和错误处理**：适配器可以在数据进入数据库前进行验证，确保数据的完整性和一致性，同时统一处理数据操作中的错误。

5. **缓存和性能优化**：适配器可以实现数据缓存，减少对数据库的直接访问，提高应用性能。

## 适配器的结构

每个适配器通常包含以下部分：

1. **转换函数**：将后端模型转换为前端对象，或将前端对象转换为后端模型。
2. **CRUD 操作**：创建、读取、更新和删除数据的方法。
3. **查询方法**：根据不同条件查询数据的方法。
4. **同步方法**：处理数据同步和冲突解决的方法。

## 适配器示例

以下是标签适配器的示例：

```javascript
/**
 * 标签模型适配器
 * 用于在前端和后端模型之间进行转换
 */

import { TagModel } from '../models';
import { logService } from '../services/utils/logService';
import { offlineSyncService } from '../services/offline/offlineSyncService';

/**
 * 将后端标签模型转换为前端标签对象
 * @param {Object} tag 后端标签模型
 * @returns {Object} 前端标签对象
 */
export const toFrontendTag = (tag) => {
  if (!tag) return null;
  
  try {
    return {
      id: tag._id,
      name: tag.name || '',
      color: tag.color || '#CCCCCC',
      count: tag.count || 0,
      isDeleted: tag.is_deleted || false,
      isSynced: tag.is_synced || false,
      createdAt: tag.created_at ? new Date(tag.created_at) : new Date(),
      updatedAt: tag.updated_at ? new Date(tag.updated_at) : new Date(),
      deletedAt: tag.deleted_at ? new Date(tag.deleted_at) : null,
    };
  } catch (error) {
    logService.error('转换标签模型失败', error);
    return null;
  }
};

/**
 * 将前端标签对象转换为后端标签模型
 * @param {Object} tag 前端标签对象
 * @returns {Object} 后端标签模型
 */
export const toBackendTag = (tag) => {
  if (!tag) return null;
  
  try {
    return {
      _id: tag.id,
      name: tag.name || '',
      color: tag.color || '#CCCCCC',
      count: tag.count || 0,
      is_deleted: tag.isDeleted || false,
      is_synced: tag.isSynced || false,
      created_at: tag.createdAt || new Date(),
      updated_at: tag.updatedAt || new Date(),
      deleted_at: tag.deletedAt || null,
    };
  } catch (error) {
    logService.error('转换标签对象失败', error);
    return null;
  }
};

/**
 * 创建标签
 * @param {Object} tagData 标签数据
 * @param {string} userId 用户ID
 * @returns {Promise<Object>} 创建的标签
 */
export const createTag = async (tagData, userId) => {
  try {
    // 准备标签数据
    const now = new Date();
    const tagId = `tag_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    
    const backendTag = {
      _id: tagId,
      name: tagData.name || '',
      color: tagData.color || '#CCCCCC',
      count: 0,
      is_deleted: false,
      is_synced: false,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      user_id: userId,
    };
    
    // 创建标签模型
    const tag = await TagModel.create(backendTag);
    
    // 添加到同步队列
    await offlineSyncService.addToSyncQueue({
      entity_id: tag._id,
      entity_type: 'tag',
      operation: 'create',
      data: tag.toJSON(),
      user_id: userId,
    });
    
    // 返回前端标签对象
    return toFrontendTag(tag);
  } catch (error) {
    logService.error('创建标签失败', error);
    throw error;
  }
};
```

## 如何使用适配器

### 在 API 服务中使用适配器

```javascript
import { tagAdapter } from '../../adapters';
import { networkService } from '../network/networkService';

const tagApi = {
  async getTags(options = {}) {
    try {
      // 检查网络连接
      if (!networkService.isOnline()) {
        // 使用适配器从本地获取标签
        const userId = options.userId || 'current_user';
        const tags = await tagAdapter.getTags(userId, options);
        return { data: tags, success: true, isOffline: true };
      }

      // 使用API客户端从服务器获取标签
      const response = await apiClient.get('/api/v1/tags/', { params: options });
      return response.data;
    } catch (error) {
      // 尝试从本地获取标签作为备份
      try {
        const userId = options.userId || 'current_user';
        const tags = await tagAdapter.getTags(userId, options);
        return { data: tags, success: true, isOffline: true };
      } catch (offlineError) {
        throw error;
      }
    }
  }
};
```

### 在 Redux 切片中使用适配器

```javascript
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import tagApi from '../../services/api/tagApi';

export const fetchTags = createAsyncThunk(
  'tags/fetchTags',
  async (options = {}, { rejectWithValue }) => {
    try {
      const response = await tagApi.getTags(options);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.message || '获取标签列表失败');
    }
  }
);

const tagsSlice = createSlice({
  name: 'tags',
  initialState: {
    tags: [],
    isLoading: false,
    error: null,
    isOffline: false,
  },
  reducers: {
    // ...
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchTags.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchTags.fulfilled, (state, action) => {
        state.isLoading = false;
        state.tags = action.payload;
        
        // 检查是否为离线数据
        if (action.payload.isOffline) {
          state.isOffline = true;
        }
      })
      .addCase(fetchTags.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || '获取标签列表失败';
      });
  },
});
```

## 最佳实践

1. **保持适配器简单**：适配器应该只负责数据转换和基本的 CRUD 操作，不应该包含复杂的业务逻辑。

2. **统一命名约定**：使用一致的命名约定，如 `toFrontendX`、`toBackendX`、`createX`、`updateX`、`deleteX`、`getX` 等。

3. **错误处理**：适当处理错误，并提供有用的错误信息。

4. **日志记录**：记录关键操作和错误，以便调试和监控。

5. **离线支持**：考虑离线场景，确保数据在离线状态下仍然可用。

6. **同步策略**：制定合理的同步策略，处理同步冲突和错误。

7. **性能优化**：优化数据查询和同步性能，避免不必要的数据库操作。

8. **测试**：编写单元测试和集成测试，确保适配器的正确性和稳定性。

## 常见问题

1. **循环依赖**：避免适配器之间的循环依赖，可以使用延迟加载或依赖注入解决。

2. **同步冲突**：处理同步冲突，可以使用乐观锁或冲突解决策略。

3. **性能问题**：优化数据查询和同步性能，可以使用缓存或批量操作。

4. **错误处理**：适当处理错误，可以使用重试机制或回退策略。

5. **数据一致性**：确保数据在本地和云端保持一致，可以使用事务或原子操作。
