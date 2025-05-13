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
      color: tag.color,
      count: tag.count || 0,
      isDeleted: tag.is_deleted || false,
      isSynced: tag.is_synced || false,
      createdAt: tag.created_at ? new Date(tag.created_at) : new Date(),
      updatedAt: tag.updated_at ? new Date(tag.updated_at) : new Date(),
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
      color: tag.color,
      count: tag.count || 0,
      is_deleted: tag.isDeleted || false,
      is_synced: tag.isSynced || false,
      created_at: tag.createdAt || new Date(),
      updated_at: tag.updatedAt || new Date(),
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
      color: tagData.color,
      count: tagData.count || 0,
      is_deleted: false,
      is_synced: false,
      created_at: now,
      updated_at: now,
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

/**
 * 更新标签
 * @param {string} tagId 标签ID
 * @param {Object} tagData 标签数据
 * @returns {Promise<Object>} 更新后的标签
 */
export const updateTag = async (tagId, tagData) => {
  try {
    // 查找标签
    const tag = await TagModel.findById(tagId);
    
    if (!tag) {
      throw new Error(`标签不存在: ${tagId}`);
    }
    
    // 更新标签属性
    if (tagData.name !== undefined) tag.name = tagData.name;
    if (tagData.color !== undefined) tag.color = tagData.color;
    if (tagData.count !== undefined) tag.count = tagData.count;
    
    // 更新时间
    tag.updated_at = new Date();
    tag.is_synced = false;
    
    // 保存标签
    await tag.save();
    
    // 添加到同步队列
    await offlineSyncService.addToSyncQueue({
      entity_id: tag._id,
      entity_type: 'tag',
      operation: 'update',
      data: tag.toJSON(),
      user_id: tag.user_id,
    });
    
    // 返回前端标签对象
    return toFrontendTag(tag);
  } catch (error) {
    logService.error(`更新标签失败: ${tagId}`, error);
    throw error;
  }
};

/**
 * 删除标签
 * @param {string} tagId 标签ID
 * @param {boolean} permanent 是否永久删除
 * @returns {Promise<boolean>} 是否成功
 */
export const deleteTag = async (tagId, permanent = false) => {
  try {
    // 查找标签
    const tag = await TagModel.findById(tagId);
    
    if (!tag) {
      throw new Error(`标签不存在: ${tagId}`);
    }
    
    if (permanent) {
      // 永久删除
      await tag.remove({ soft: false });
    } else {
      // 软删除
      tag.is_deleted = true;
      tag.is_synced = false;
      await tag.save();
      
      // 添加到同步队列
      await offlineSyncService.addToSyncQueue({
        entity_id: tag._id,
        entity_type: 'tag',
        operation: 'update',
        data: tag.toJSON(),
        user_id: tag.user_id,
      });
    }
    
    return true;
  } catch (error) {
    logService.error(`删除标签失败: ${tagId}`, error);
    throw error;
  }
};

/**
 * 获取标签列表
 * @param {string} userId 用户ID
 * @param {Object} options 选项
 * @returns {Promise<Array<Object>>} 标签列表
 */
export const getTags = async (userId, options = {}) => {
  try {
    // 查找标签
    const tags = await TagModel.findByUser(userId, options);
    
    // 转换为前端标签对象
    return tags.map(toFrontendTag);
  } catch (error) {
    logService.error('获取标签列表失败', error);
    throw error;
  }
};

/**
 * 获取标签详情
 * @param {string} tagId 标签ID
 * @returns {Promise<Object>} 标签详情
 */
export const getTagById = async (tagId) => {
  try {
    // 查找标签
    const tag = await TagModel.findById(tagId);
    
    if (!tag) {
      throw new Error(`标签不存在: ${tagId}`);
    }
    
    // 转换为前端标签对象
    return toFrontendTag(tag);
  } catch (error) {
    logService.error(`获取标签详情失败: ${tagId}`, error);
    throw error;
  }
};

/**
 * 根据名称获取标签
 * @param {string} name 标签名称
 * @param {string} userId 用户ID
 * @returns {Promise<Object>} 标签详情
 */
export const getTagByName = async (name, userId) => {
  try {
    // 查找标签
    const tag = await TagModel.findByName(name, userId);
    
    // 转换为前端标签对象
    return tag ? toFrontendTag(tag) : null;
  } catch (error) {
    logService.error(`根据名称获取标签失败: ${name}`, error);
    throw error;
  }
};

/**
 * 查找或创建标签
 * @param {string} name 标签名称
 * @param {string} userId 用户ID
 * @param {Object} options 选项
 * @returns {Promise<Object>} 标签详情
 */
export const findOrCreateTag = async (name, userId, options = {}) => {
  try {
    // 查找或创建标签
    const tag = await TagModel.findOrCreate(name, userId, options);
    
    // 添加到同步队列
    await offlineSyncService.addToSyncQueue({
      entity_id: tag._id,
      entity_type: 'tag',
      operation: tag.isNew ? 'create' : 'update',
      data: tag.toJSON(),
      user_id: userId,
    });
    
    // 转换为前端标签对象
    return toFrontendTag(tag);
  } catch (error) {
    logService.error(`查找或创建标签失败: ${name}`, error);
    throw error;
  }
};

/**
 * 批量创建标签
 * @param {Array<string>} names 标签名称数组
 * @param {string} userId 用户ID
 * @returns {Promise<Array<Object>>} 标签列表
 */
export const createBatchTags = async (names, userId) => {
  try {
    // 批量创建标签
    const tags = await TagModel.createBatch(names, userId);
    
    // 添加到同步队列
    for (const tag of tags) {
      await offlineSyncService.addToSyncQueue({
        entity_id: tag._id,
        entity_type: 'tag',
        operation: tag.isNew ? 'create' : 'update',
        data: tag.toJSON(),
        user_id: userId,
      });
    }
    
    // 转换为前端标签对象
    return tags.map(toFrontendTag);
  } catch (error) {
    logService.error('批量创建标签失败', error);
    throw error;
  }
};

/**
 * 获取热门标签
 * @param {string} userId 用户ID
 * @param {number} limit 限制数量
 * @returns {Promise<Array<Object>>} 标签列表
 */
export const getPopularTags = async (userId, limit = 10) => {
  try {
    // 获取热门标签
    const tags = await TagModel.getPopularTags(userId, limit);
    
    // 转换为前端标签对象
    return tags.map(toFrontendTag);
  } catch (error) {
    logService.error('获取热门标签失败', error);
    throw error;
  }
};

/**
 * 更新标签计数
 * @param {string} userId 用户ID
 * @returns {Promise<boolean>} 是否成功
 */
export const updateTagCounts = async (userId) => {
  try {
    // 更新标签计数
    await TagModel.updateTagCounts(userId);
    
    return true;
  } catch (error) {
    logService.error('更新标签计数失败', error);
    throw error;
  }
};
