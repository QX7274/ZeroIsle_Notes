/**
 * ✅ 增量保存服务
 * 实现笔画数据的增量保存，减少全量更新开销
 */

import { memoryManager } from './MemoryManager';

/**
 * 增量保存配置
 */
const INCREMENTAL_SAVE_CONFIG = {
  BATCH_SIZE: 10, // 批量保存大小
  SAVE_INTERVAL: 5000, // 5秒保存间隔
  MAX_PENDING_CHANGES: 50, // 最大待保存变更数
  COMPRESSION_THRESHOLD: 1024, // 1KB压缩阈值
};

/**
 * 变更类型枚举
 */
export const CHANGE_TYPE = {
  ADD_STROKE: 'add_stroke',
  UPDATE_STROKE: 'update_stroke',
  DELETE_STROKE: 'delete_stroke',
  ADD_PAGE: 'add_page',
  UPDATE_PAGE: 'update_page',
  DELETE_PAGE: 'delete_page',
};

/**
 * 增量保存服务类
 */
export class IncrementalSaveService {
  constructor() {
    this.pendingChanges = new Map();
    this.saveTimer = null;
    this.isSaving = false;
    this.lastSaveTime = 0;
    this.saveCallbacks = new Map();
  }

  /**
   * 添加变更到待保存队列
   */
  addChange(changeId, changeType, data, options = {}) {
    const change = {
      id: changeId,
      type: changeType,
      data: this.compressChangeData(data),
      timestamp: Date.now(),
      priority: options.priority || 'normal',
      critical: options.critical || false,
      metadata: options.metadata || {},
    };

    this.pendingChanges.set(changeId, change);

    // 检查是否需要立即保存
    if (change.critical || this.pendingChanges.size >= INCREMENTAL_SAVE_CONFIG.MAX_PENDING_CHANGES) {
      this.scheduleImmediateSave();
    } else {
      this.scheduleSave();
    }
  }

  /**
   * 压缩变更数据
   */
  compressChangeData(data) {
    if (typeof data === 'string' && data.length > INCREMENTAL_SAVE_CONFIG.COMPRESSION_THRESHOLD) {
      return memoryManager.compressData(data);
    }
    return data;
  }

  /**
   * 解压变更数据
   */
  decompressChangeData(data) {
    if (typeof data === 'string' && this.isCompressed(data)) {
      return memoryManager.decompressData(data);
    }
    return data;
  }

  /**
   * 检查数据是否被压缩
   */
  isCompressed(data) {
    // 简单的压缩标识检查
    return typeof data === 'string' && /^\d+[a-zA-Z]/.test(data);
  }

  /**
   * 安排保存
   */
  scheduleSave() {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }

    this.saveTimer = setTimeout(() => {
      this.performSave();
    }, INCREMENTAL_SAVE_CONFIG.SAVE_INTERVAL);
  }

  /**
   * 安排立即保存
   */
  scheduleImmediateSave() {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }

    // 立即保存
    this.performSave();
  }

  /**
   * 执行保存
   */
  async performSave() {
    if (this.isSaving || this.pendingChanges.size === 0) {
      return;
    }

    this.isSaving = true;

    try {
      // 获取待保存的变更
      const changes = Array.from(this.pendingChanges.values());

      // 按优先级排序
      changes.sort((a, b) => {
        const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });

      // 批量处理变更
      const batches = this.createBatches(changes);

      for (const batch of batches) {
        await this.processBatch(batch);
      }

      // 清理已保存的变更
      this.clearSavedChanges(changes);

      this.lastSaveTime = Date.now();

      console.log(`💾 [IncrementalSave] 成功保存 ${changes.length} 个变更`);

    } catch (error) {
      console.error('❌ [IncrementalSave] 保存失败:', error);

      // 保存失败时，将变更标记为需要重试
      this.markChangesForRetry();

    } finally {
      this.isSaving = false;
    }
  }

  /**
   * 创建批次
   */
  createBatches(changes) {
    const batches = [];

    for (let i = 0; i < changes.length; i += INCREMENTAL_SAVE_CONFIG.BATCH_SIZE) {
      batches.push(changes.slice(i, i + INCREMENTAL_SAVE_CONFIG.BATCH_SIZE));
    }

    return batches;
  }

  /**
   * 处理批次
   */
  async processBatch(batch) {
    // 按变更类型分组
    const groupedChanges = this.groupChangesByType(batch);

    // 处理每种类型的变更
    for (const [changeType, changes] of groupedChanges) {
      await this.processChangesByType(changeType, changes);
    }
  }

  /**
   * 按类型分组变更
   */
  groupChangesByType(changes) {
    const grouped = new Map();

    changes.forEach(change => {
      if (!grouped.has(change.type)) {
        grouped.set(change.type, []);
      }
      grouped.get(change.type).push(change);
    });

    return grouped;
  }

  /**
   * 按类型处理变更
   */
  async processChangesByType(changeType, changes) {
    switch (changeType) {
      case CHANGE_TYPE.ADD_STROKE:
        await this.processAddStrokes(changes);
        break;

      case CHANGE_TYPE.UPDATE_STROKE:
        await this.processUpdateStrokes(changes);
        break;

      case CHANGE_TYPE.DELETE_STROKE:
        await this.processDeleteStrokes(changes);
        break;

      case CHANGE_TYPE.ADD_PAGE:
        await this.processAddPages(changes);
        break;

      case CHANGE_TYPE.UPDATE_PAGE:
        await this.processUpdatePages(changes);
        break;

      case CHANGE_TYPE.DELETE_PAGE:
        await this.processDeletePages(changes);
        break;

      default:
        console.warn(`未知的变更类型: ${changeType}`);
    }
  }

  /**
   * 处理添加笔画
   */
  async processAddStrokes(changes) {
    for (const change of changes) {
      const strokeData = this.decompressChangeData(change.data);

      // 调用保存回调
      const callback = this.saveCallbacks.get('addStroke');
      if (callback) {
        await callback(strokeData, change.metadata);
      }
    }
  }

  /**
   * 处理更新笔画
   */
  async processUpdateStrokes(changes) {
    for (const change of changes) {
      const strokeData = this.decompressChangeData(change.data);

      // 调用保存回调
      const callback = this.saveCallbacks.get('updateStroke');
      if (callback) {
        await callback(strokeData, change.metadata);
      }
    }
  }

  /**
   * 处理删除笔画
   */
  async processDeleteStrokes(changes) {
    for (const change of changes) {
      const strokeId = change.data;

      // 调用保存回调
      const callback = this.saveCallbacks.get('deleteStroke');
      if (callback) {
        await callback(strokeId, change.metadata);
      }
    }
  }

  /**
   * 处理添加页面
   */
  async processAddPages(changes) {
    for (const change of changes) {
      const pageData = this.decompressChangeData(change.data);

      // 调用保存回调
      const callback = this.saveCallbacks.get('addPage');
      if (callback) {
        await callback(pageData, change.metadata);
      }
    }
  }

  /**
   * 处理更新页面
   */
  async processUpdatePages(changes) {
    for (const change of changes) {
      const pageData = this.decompressChangeData(change.data);

      // 调用保存回调
      const callback = this.saveCallbacks.get('updatePage');
      if (callback) {
        await callback(pageData, change.metadata);
      }
    }
  }

  /**
   * 处理删除页面
   */
  async processDeletePages(changes) {
    for (const change of changes) {
      const pageId = change.data;

      // 调用保存回调
      const callback = this.saveCallbacks.get('deletePage');
      if (callback) {
        await callback(pageId, change.metadata);
      }
    }
  }

  /**
   * 清理已保存的变更
   */
  clearSavedChanges(changes) {
    changes.forEach(change => {
      this.pendingChanges.delete(change.id);
    });
  }

  /**
   * 标记变更需要重试
   */
  markChangesForRetry() {
    this.pendingChanges.forEach(change => {
      change.retryCount = (change.retryCount || 0) + 1;
      change.lastRetryTime = Date.now();
    });
  }

  /**
   * 注册保存回调
   */
  registerSaveCallback(type, callback) {
    this.saveCallbacks.set(type, callback);
  }

  /**
   * 取消注册保存回调
   */
  unregisterSaveCallback(type) {
    this.saveCallbacks.delete(type);
  }

  /**
   * 获取待保存变更数量
   */
  getPendingChangesCount() {
    return this.pendingChanges.size;
  }

  /**
   * 获取待保存变更详情
   */
  getPendingChanges() {
    return Array.from(this.pendingChanges.values());
  }

  /**
   * 强制保存所有待保存的变更
   */
  async forceSave() {
    if (this.pendingChanges.size === 0) {
      return;
    }

    await this.performSave();
  }

  /**
   * 清理所有待保存的变更
   */
  clearPendingChanges() {
    this.pendingChanges.clear();
    console.log('🧹 [IncrementalSave] 清理所有待保存变更');
  }

  /**
   * 销毁服务
   */
  destroy() {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }

    this.clearPendingChanges();
    this.saveCallbacks.clear();
  }
}

// 创建全局增量保存服务实例
const incrementalSaveService = new IncrementalSaveService();

module.exports = incrementalSaveService;
module.exports.default = incrementalSaveService;
module.exports.incrementalSaveService = incrementalSaveService;
module.exports.IncrementalSaveService = IncrementalSaveService;

export default IncrementalSaveService;
