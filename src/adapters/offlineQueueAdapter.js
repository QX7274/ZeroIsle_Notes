/**
 * 离线队列模型适配器
 * 用于在前端和后端模型之间进行转换
 */

import { OfflineQueueModel } from '../models';
import { logService } from '../services/utils/logService';

/**
 * 将后端离线队列模型转换为前端离线队列对象
 * @param {Object} queue 后端离线队列模型
 * @returns {Object} 前端离线队列对象
 */
export const toFrontendQueue = (queue) => {
  if (!queue) return null;
  
  try {
    return {
      id: queue._id,
      entityId: queue.entity_id,
      entityType: queue.entity_type,
      operation: queue.operation,
      data: queue.data,
      userId: queue.user_id,
      status: queue.status,
      retryCount: queue.retry_count,
      error: queue.error,
      createdAt: queue.created_at ? new Date(queue.created_at) : new Date(),
      updatedAt: queue.updated_at ? new Date(queue.updated_at) : new Date(),
      syncedAt: queue.synced_at ? new Date(queue.synced_at) : null,
    };
  } catch (error) {
    logService.error('转换离线队列模型失败', error);
    return null;
  }
};

/**
 * 将前端离线队列对象转换为后端离线队列模型
 * @param {Object} queue 前端离线队列对象
 * @returns {Object} 后端离线队列模型
 */
export const toBackendQueue = (queue) => {
  if (!queue) return null;
  
  try {
    return {
      _id: queue.id,
      entity_id: queue.entityId,
      entity_type: queue.entityType,
      operation: queue.operation,
      data: queue.data,
      user_id: queue.userId,
      status: queue.status,
      retry_count: queue.retryCount,
      error: queue.error,
      created_at: queue.createdAt || new Date(),
      updated_at: queue.updatedAt || new Date(),
      synced_at: queue.syncedAt,
    };
  } catch (error) {
    logService.error('转换离线队列对象失败', error);
    return null;
  }
};

/**
 * 创建离线队列项
 * @param {Object} queueData 队列数据
 * @returns {Promise<Object>} 创建的队列项
 */
export const createQueueItem = async (queueData) => {
  try {
    // 准备队列数据
    const now = new Date();
    const queueId = `queue_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    
    const backendQueue = {
      _id: queueId,
      entity_id: queueData.entityId,
      entity_type: queueData.entityType,
      operation: queueData.operation,
      data: queueData.data,
      user_id: queueData.userId,
      status: queueData.status || 'pending',
      retry_count: queueData.retryCount || 0,
      error: queueData.error || null,
      created_at: now,
      updated_at: now,
      synced_at: null,
    };
    
    // 创建队列模型
    const queue = await OfflineQueueModel.create(backendQueue);
    
    // 返回前端队列对象
    return toFrontendQueue(queue);
  } catch (error) {
    logService.error('创建离线队列项失败', error);
    throw error;
  }
};

/**
 * 更新离线队列项
 * @param {string} queueId 队列项ID
 * @param {Object} queueData 队列数据
 * @returns {Promise<Object>} 更新后的队列项
 */
export const updateQueueItem = async (queueId, queueData) => {
  try {
    // 查找队列项
    const queue = await OfflineQueueModel.findById(queueId);
    
    if (!queue) {
      throw new Error(`离线队列项不存在: ${queueId}`);
    }
    
    // 更新队列项属性
    if (queueData.status !== undefined) queue.status = queueData.status;
    if (queueData.retryCount !== undefined) queue.retry_count = queueData.retryCount;
    if (queueData.error !== undefined) queue.error = queueData.error;
    
    // 如果状态为已同步，设置同步时间
    if (queueData.status === 'synced' && !queue.synced_at) {
      queue.synced_at = new Date();
    }
    
    // 更新时间
    queue.updated_at = new Date();
    
    // 保存队列项
    await queue.save();
    
    // 返回前端队列对象
    return toFrontendQueue(queue);
  } catch (error) {
    logService.error(`更新离线队列项失败: ${queueId}`, error);
    throw error;
  }
};

/**
 * 删除离线队列项
 * @param {string} queueId 队列项ID
 * @returns {Promise<boolean>} 是否成功
 */
export const deleteQueueItem = async (queueId) => {
  try {
    // 查找队列项
    const queue = await OfflineQueueModel.findById(queueId);
    
    if (!queue) {
      throw new Error(`离线队列项不存在: ${queueId}`);
    }
    
    // 删除队列项
    await queue.remove();
    
    return true;
  } catch (error) {
    logService.error(`删除离线队列项失败: ${queueId}`, error);
    throw error;
  }
};

/**
 * 获取离线队列项
 * @param {string} queueId 队列项ID
 * @returns {Promise<Object>} 队列项
 */
export const getQueueItem = async (queueId) => {
  try {
    // 查找队列项
    const queue = await OfflineQueueModel.findById(queueId);
    
    if (!queue) {
      throw new Error(`离线队列项不存在: ${queueId}`);
    }
    
    // 返回前端队列对象
    return toFrontendQueue(queue);
  } catch (error) {
    logService.error(`获取离线队列项失败: ${queueId}`, error);
    throw error;
  }
};

/**
 * 获取待同步的队列项列表
 * @param {string} userId 用户ID
 * @param {Object} options 选项
 * @returns {Promise<Array<Object>>} 队列项列表
 */
export const getPendingQueueItems = async (userId, options = {}) => {
  try {
    // 查找待同步的队列项
    const queueItems = await OfflineQueueModel.find({
      user_id: userId,
      status: 'pending',
      ...options,
    });
    
    // 返回前端队列对象列表
    return queueItems.map(toFrontendQueue);
  } catch (error) {
    logService.error(`获取待同步队列项列表失败: ${userId}`, error);
    throw error;
  }
};

/**
 * 标记队列项为已同步
 * @param {string} queueId 队列项ID
 * @returns {Promise<Object>} 更新后的队列项
 */
export const markAsSynced = async (queueId) => {
  try {
    return updateQueueItem(queueId, {
      status: 'synced',
      syncedAt: new Date(),
    });
  } catch (error) {
    logService.error(`标记队列项为已同步失败: ${queueId}`, error);
    throw error;
  }
};

/**
 * 标记队列项为失败
 * @param {string} queueId 队列项ID
 * @param {string} error 错误信息
 * @returns {Promise<Object>} 更新后的队列项
 */
export const markAsFailed = async (queueId, error) => {
  try {
    // 查找队列项
    const queue = await OfflineQueueModel.findById(queueId);
    
    if (!queue) {
      throw new Error(`离线队列项不存在: ${queueId}`);
    }
    
    // 增加重试次数
    const retryCount = queue.retry_count + 1;
    
    // 如果重试次数超过最大值，标记为失败
    const status = retryCount >= 3 ? 'failed' : 'pending';
    
    return updateQueueItem(queueId, {
      status,
      retryCount,
      error,
    });
  } catch (error) {
    logService.error(`标记队列项为失败失败: ${queueId}`, error);
    throw error;
  }
};

/**
 * 清理已同步的队列项
 * @param {string} userId 用户ID
 * @param {number} days 天数
 * @returns {Promise<number>} 清理的数量
 */
export const cleanupSyncedItems = async (userId, days = 7) => {
  try {
    // 计算截止日期
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    // 删除已同步的队列项
    const result = await OfflineQueueModel.deleteMany({
      user_id: userId,
      status: 'synced',
      synced_at: { $lt: cutoffDate },
    });
    
    return result.deletedCount;
  } catch (error) {
    logService.error(`清理已同步队列项失败: ${userId}`, error);
    throw error;
  }
};
