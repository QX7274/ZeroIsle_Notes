/**
 * 用户模型适配器
 * 用于在前端和后端模型之间进行转换
 */

import { User } from '../models';
import realmService from '../services/database/realmService';
import { logService } from '../utils/logService';
import { offlineSyncService } from '../services/offline/offlineSyncService';

/**
 * 将后端用户模型转换为前端用户对象
 * @param {Object} user 后端用户模型
 * @returns {Object} 前端用户对象
 */
export const toFrontendUser = (user) => {
  if (!user) return null;
  
  try {
    return {
      id: user._id,
      username: user.username || '',
      email: user.email || '',
      displayName: user.display_name || '',
      avatar: user.avatar || '',
      isActive: user.is_active || false,
      isVerified: user.is_verified || false,
      isDeleted: user.is_deleted || false,
      isSynced: user.is_synced || false,
      createdAt: user.created_at ? new Date(user.created_at) : new Date(),
      updatedAt: user.updated_at ? new Date(user.updated_at) : new Date(),
      deletedAt: user.deleted_at ? new Date(user.deleted_at) : null,
      lastLoginAt: user.last_login_at ? new Date(user.last_login_at) : null,
      preferences: { ...(user.preferences || {}) },
      role: user.role || 'user',
      permissions: [...(user.permissions || [])],
      metadata: { ...(user.metadata || {}) },
    };
  } catch (error) {
    logService.error('转换用户模型失败', error);
    return null;
  }
};

/**
 * 将前端用户对象转换为后端用户模型
 * @param {Object} user 前端用户对象
 * @returns {Object} 后端用户模型
 */
export const toBackendUser = (user) => {
  if (!user) return null;
  
  try {
    return {
      _id: user.id,
      username: user.username || '',
      email: user.email || '',
      display_name: user.displayName || '',
      avatar: user.avatar || '',
      is_active: user.isActive || false,
      is_verified: user.isVerified || false,
      is_deleted: user.isDeleted || false,
      is_synced: user.isSynced || false,
      created_at: user.createdAt || new Date(),
      updated_at: user.updatedAt || new Date(),
      deleted_at: user.deletedAt || null,
      last_login_at: user.lastLoginAt || null,
      preferences: { ...(user.preferences || {}) },
      role: user.role || 'user',
      permissions: [...(user.permissions || [])],
      metadata: { ...(user.metadata || {}) },
    };
  } catch (error) {
    logService.error('转换用户对象失败', error);
    return null;
  }
};

/**
 * 创建用户
 * @param {Object} userData 用户数据
 * @returns {Promise<Object>} 创建的用户
 */
export const createUser = async (userData) => {
  try {
    // 准备用户数据
    const now = new Date();
    const userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    
    const backendUser = {
      _id: userId,
      username: userData.username || '',
      email: userData.email || '',
      display_name: userData.displayName || userData.username || '',
      avatar: userData.avatar || '',
      is_active: userData.isActive || true,
      is_verified: userData.isVerified || false,
      is_deleted: false,
      is_synced: false,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      last_login_at: now,
      preferences: { ...(userData.preferences || {}) },
      role: userData.role || 'user',
      permissions: [...(userData.permissions || [])],
      metadata: { ...(userData.metadata || {}) },
    };
    
    // 创建用户模型
    const realm = await realmService.getRealm();
    let user;
    realm.write(() => {
      user = realm.create('User', backendUser);
    });
    
    // 添加到同步队列
    await offlineSyncService.addToSyncQueue({
      entity_id: user._id,
      entity_type: 'user',
      operation: 'create',
      data: user.toJSON(),
      user_id: user._id,
    });
    
    // 返回前端用户对象
    return toFrontendUser(user);
  } catch (error) {
    logService.error('创建用户失败', error);
    throw error;
  }
};

/**
 * 更新用户
 * @param {string} userId 用户ID
 * @param {Object} userData 用户数据
 * @returns {Promise<Object>} 更新后的用户
 */
export const updateUser = async (userId, userData) => {
  try {
    // 查找用户
    const realm = await realmService.getRealm();
    const user = realm.objectForPrimaryKey('User', userId);
    
    if (!user) {
      throw new Error(`用户不存在: ${userId}`);
    }
    
    // 更新用户属性
    if (userData.username !== undefined) user.username = userData.username;
    if (userData.email !== undefined) user.email = userData.email;
    if (userData.displayName !== undefined) user.display_name = userData.displayName;
    if (userData.avatar !== undefined) user.avatar = userData.avatar;
    if (userData.isActive !== undefined) user.is_active = userData.isActive;
    if (userData.isVerified !== undefined) user.is_verified = userData.isVerified;
    if (userData.preferences !== undefined) user.preferences = { ...user.preferences, ...userData.preferences };
    if (userData.role !== undefined) user.role = userData.role;
    if (userData.permissions !== undefined) user.permissions = [...userData.permissions];
    if (userData.metadata !== undefined) user.metadata = { ...user.metadata, ...userData.metadata };
    
    // 更新时间
    user.updated_at = new Date();
    user.is_synced = false;
    
    // 保存用户
    await user.save();
    
    // 添加到同步队列
    await offlineSyncService.addToSyncQueue({
      entity_id: user._id,
      entity_type: 'user',
      operation: 'update',
      data: user.toJSON(),
      user_id: user._id,
    });
    
    // 返回前端用户对象
    return toFrontendUser(user);
  } catch (error) {
    logService.error(`更新用户失败: ${userId}`, error);
    throw error;
  }
};

/**
 * 删除用户
 * @param {string} userId 用户ID
 * @param {boolean} permanent 是否永久删除
 * @returns {Promise<boolean>} 是否成功
 */
export const deleteUser = async (userId, permanent = false) => {
  try {
    // 查找用户
    const realm = await realmService.getRealm();
    const user = realm.objectForPrimaryKey('User', userId);
    
    if (!user) {
      throw new Error(`用户不存在: ${userId}`);
    }
    
    if (permanent) {
      // 永久删除
      await user.remove({ soft: false });
    } else {
      // 软删除
      user.is_deleted = true;
      user.deleted_at = new Date();
      user.is_synced = false;
      await user.save();
      
      // 添加到同步队列
      await offlineSyncService.addToSyncQueue({
        entity_id: user._id,
        entity_type: 'user',
        operation: 'update',
        data: user.toJSON(),
        user_id: user._id,
      });
    }
    
    return true;
  } catch (error) {
    logService.error(`删除用户失败: ${userId}`, error);
    throw error;
  }
};

/**
 * 获取用户
 * @param {string} userId 用户ID
 * @returns {Promise<Object>} 用户
 */
export const getUser = async (userId) => {
  try {
    // 查找用户
    const realm = await realmService.getRealm();
    const user = realm.objectForPrimaryKey('User', userId);
    
    if (!user) {
      throw new Error(`用户不存在: ${userId}`);
    }
    
    // 返回前端用户对象
    return toFrontendUser(user);
  } catch (error) {
    logService.error(`获取用户失败: ${userId}`, error);
    throw error;
  }
};

/**
 * 获取当前用户
 * @returns {Promise<Object>} 当前用户
 */
export const getCurrentUser = async () => {
  try {
    // 查找当前用户
    const realm = await realmService.getRealm();
    const user = realm.objects('User').filtered('is_current = true')[0];
    
    if (!user) {
      throw new Error('当前用户不存在');
    }
    
    // 返回前端用户对象
    return toFrontendUser(user);
  } catch (error) {
    logService.error('获取当前用户失败', error);
    throw error;
  }
};

/**
 * 更新用户偏好设置
 * @param {string} userId 用户ID
 * @param {Object} preferences 偏好设置
 * @returns {Promise<Object>} 更新后的用户
 */
export const updateUserPreferences = async (userId, preferences) => {
  try {
    // 查找用户
    const realm = await realmService.getRealm();
    const user = realm.objectForPrimaryKey('User', userId);
    
    if (!user) {
      throw new Error(`用户不存在: ${userId}`);
    }
    
    // 更新偏好设置
    user.preferences = {
      ...user.preferences,
      ...preferences,
    };
    
    // 更新时间
    user.updated_at = new Date();
    user.is_synced = false;
    
    // 保存用户
    await user.save();
    
    // 添加到同步队列
    await offlineSyncService.addToSyncQueue({
      entity_id: user._id,
      entity_type: 'user',
      operation: 'update',
      data: user.toJSON(),
      user_id: user._id,
    });
    
    // 返回前端用户对象
    return toFrontendUser(user);
  } catch (error) {
    logService.error(`更新用户偏好设置失败: ${userId}`, error);
    throw error;
  }
};
