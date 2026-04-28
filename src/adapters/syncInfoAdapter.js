/**
 * 同步信息模型适配器
 * 用于在前端和后端模型之间进行转换
 */

import { SyncInfo } from '../models';
import realmService from '../services/database/realmService';
import { logService } from '../utils/logService';

/**
 * 将后端同步信息模型转换为前端同步信息对象
 * @param {Object} syncInfo 后端同步信息模型
 * @returns {Object} 前端同步信息对象
 */
export const toFrontendSyncInfo = (syncInfo) => {
  if (!syncInfo) {return null;}

  try {
    return {
      id: syncInfo._id,
      entityId: syncInfo.entity_id,
      entityType: syncInfo.entity_type,
      userId: syncInfo.user_id,
      operation: syncInfo.operation,
      status: syncInfo.status,
      retryCount: syncInfo.retry_count,
      error: syncInfo.error,
      deviceId: syncInfo.device_id,
      priority: syncInfo.priority,
      createdAt: syncInfo.created_at ? new Date(syncInfo.created_at) : new Date(),
      updatedAt: syncInfo.updated_at ? new Date(syncInfo.updated_at) : new Date(),
      syncedAt: syncInfo.synced_at ? new Date(syncInfo.synced_at) : null,
    };
  } catch (error) {
    logService.error('转换同步信息模型失败', error);
    return null;
  }
};

/**
 * 将前端同步信息对象转换为后端同步信息模型
 * @param {Object} syncInfo 前端同步信息对象
 * @returns {Object} 后端同步信息模型
 */
export const toBackendSyncInfo = (syncInfo) => {
  if (!syncInfo) {return null;}

  try {
    return {
      _id: syncInfo.id,
      entity_id: syncInfo.entityId,
      entity_type: syncInfo.entityType,
      user_id: syncInfo.userId,
      operation: syncInfo.operation,
      status: syncInfo.status,
      retry_count: syncInfo.retryCount,
      error: syncInfo.error,
      device_id: syncInfo.deviceId,
      priority: syncInfo.priority,
      created_at: syncInfo.createdAt || new Date(),
      updated_at: syncInfo.updatedAt || new Date(),
      synced_at: syncInfo.syncedAt,
    };
  } catch (error) {
    logService.error('转换同步信息对象失败', error);
    return null;
  }
};

/**
 * 创建同步信息
 * @param {Object} syncInfoData 同步信息数据
 * @returns {Promise<Object>} 创建的同步信息
 */
export const createSyncInfo = async (syncInfoData) => {
  try {
    // 准备同步信息数据
    const now = new Date();
    const syncInfoId = realmService.createObjectId();

    const backendSyncInfo = {
      _id: syncInfoId,
      entity_id: syncInfoData.entityId,
      entity_type: syncInfoData.entityType,
      user_id: syncInfoData.userId,
      operation: syncInfoData.operation,
      status: syncInfoData.status || 'pending',
      retry_count: syncInfoData.retryCount || 0,
      error: syncInfoData.error || null,
      device_id: syncInfoData.deviceId,
      priority: syncInfoData.priority || 0,
      created_at: now,
      updated_at: now,
      synced_at: null,
    };

    // 创建同步信息模型
    const realm = await realmService.getRealm();
    let syncInfo;
    realm.write(() => {
      syncInfo = realm.create('SyncInfo', backendSyncInfo);
    });

    // 返回前端同步信息对象
    return toFrontendSyncInfo(syncInfo);
  } catch (error) {
    logService.error('创建同步信息失败', error);
    throw error;
  }
};

/**
 * 更新同步信息
 * @param {string} syncInfoId 同步信息ID
 * @param {Object} syncInfoData 同步信息数据
 * @returns {Promise<Object>} 更新后的同步信息
 */
export const updateSyncInfo = async (syncInfoId, syncInfoData) => {
  try {
    // 查找同步信息
    const realm = await realmService.getRealm();
    const syncInfo = realm.objectForPrimaryKey('SyncInfo', syncInfoId);

    if (!syncInfo) {
      throw new Error(`同步信息不存在: ${syncInfoId}`);
    }

    // 更新同步信息属性
    if (syncInfoData.status !== undefined) {syncInfo.status = syncInfoData.status;}
    if (syncInfoData.retryCount !== undefined) {syncInfo.retry_count = syncInfoData.retryCount;}
    if (syncInfoData.error !== undefined) {syncInfo.error = syncInfoData.error;}
    if (syncInfoData.priority !== undefined) {syncInfo.priority = syncInfoData.priority;}

    // 如果状态为已同步，设置同步时间
    if (syncInfoData.status === 'synced' && !syncInfo.synced_at) {
      syncInfo.synced_at = new Date();
    }

    // 更新时间
    syncInfo.updated_at = new Date();

    // 保存同步信息
    await syncInfo.save();

    // 返回前端同步信息对象
    return toFrontendSyncInfo(syncInfo);
  } catch (error) {
    logService.error(`更新同步信息失败: ${syncInfoId}`, error);
    throw error;
  }
};

/**
 * 获取同步信息
 * @param {string} syncInfoId 同步信息ID
 * @returns {Promise<Object>} 同步信息
 */
export const getSyncInfo = async (syncInfoId) => {
  try {
    // 查找同步信息
    const realm = await realmService.getRealm();
    const syncInfo = realm.objectForPrimaryKey('SyncInfo', syncInfoId);

    if (!syncInfo) {
      throw new Error(`同步信息不存在: ${syncInfoId}`);
    }

    // 返回前端同步信息对象
    return toFrontendSyncInfo(syncInfo);
  } catch (error) {
    logService.error(`获取同步信息失败: ${syncInfoId}`, error);
    throw error;
  }
};

/**
 * 获取实体的同步信息
 * @param {string} entityId 实体ID
 * @param {string} entityType 实体类型
 * @returns {Promise<Object>} 同步信息
 */
export const getEntitySyncInfo = async (entityId, entityType) => {
  try {
    // 查找同步信息
    const realm = await realmService.getRealm();
    const syncInfo = realm.objects('SyncInfo').filtered(`entity_id = "${entityId}" AND entity_type = "${entityType}"`)[0];

    if (!syncInfo) {
      return null;
    }

    // 返回前端同步信息对象
    return toFrontendSyncInfo(syncInfo);
  } catch (error) {
    logService.error(`获取实体同步信息失败: ${entityId}`, error);
    throw error;
  }
};

/**
 * 获取待同步的信息列表
 * @param {string} userId 用户ID
 * @param {Object} options 选项
 * @returns {Promise<Array<Object>>} 同步信息列表
 */
export const getPendingSyncInfo = async (userId, options = {}) => {
  try {
    // 查找待同步的信息
    const realm = await realmService.getRealm();
    let syncInfoList = realm.objects('SyncInfo').filtered(`user_id = "${userId}" AND status = "pending"`);

    // 应用排序
    if (options.sortBy) {
      syncInfoList = syncInfoList.sorted(options.sortBy, options.sortOrder === 'desc');
    }

    // 应用分页
    if (options.limit) {
      syncInfoList = syncInfoList.slice(0, options.limit);
    }

    // 返回前端同步信息对象列表
    return syncInfoList.map(toFrontendSyncInfo);
  } catch (error) {
    logService.error(`获取待同步信息列表失败: ${userId}`, error);
    throw error;
  }
};

/**
 * 标记同步信息为已同步
 * @param {string} syncInfoId 同步信息ID
 * @returns {Promise<Object>} 更新后的同步信息
 */
export const markAsSynced = async (syncInfoId) => {
  try {
    return updateSyncInfo(syncInfoId, {
      status: 'synced',
      syncedAt: new Date(),
    });
  } catch (error) {
    logService.error(`标记同步信息为已同步失败: ${syncInfoId}`, error);
    throw error;
  }
};

/**
 * 标记同步信息为失败
 * @param {string} syncInfoId 同步信息ID
 * @param {string} error 错误信息
 * @returns {Promise<Object>} 更新后的同步信息
 */
export const markAsFailed = async (syncInfoId, error) => {
  try {
    // 查找同步信息
    const realm = await realmService.getRealm();
    const syncInfo = realm.objectForPrimaryKey('SyncInfo', syncInfoId);

    if (!syncInfo) {
      throw new Error(`同步信息不存在: ${syncInfoId}`);
    }

    // 增加重试次数
    const retryCount = syncInfo.retry_count + 1;

    // 如果重试次数超过最大值，标记为失败
    const status = retryCount >= 3 ? 'failed' : 'pending';

    return updateSyncInfo(syncInfoId, {
      status,
      retryCount,
      error,
    });
  } catch (error) {
    logService.error(`标记同步信息为失败失败: ${syncInfoId}`, error);
    throw error;
  }
};

/**
 * 清理已同步的信息
 * @param {string} userId 用户ID
 * @param {number} days 天数
 * @returns {Promise<number>} 清理的数量
 */
export const cleanupSyncedInfo = async (userId, days = 7) => {
  try {
    // 计算截止日期
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    // 删除已同步的信息
    const realm = await realmService.getRealm();
    let result = 0;
    realm.write(() => {
      const itemsToDelete = realm.objects('SyncInfo').filtered(`user_id = "${userId}" AND status = "synced" AND synced_at < $0`, cutoffDate);
      result = itemsToDelete.length;
      realm.delete(itemsToDelete);
    });

    return result.deletedCount;
  } catch (error) {
    logService.error(`清理已同步信息失败: ${userId}`, error);
    throw error;
  }
};
