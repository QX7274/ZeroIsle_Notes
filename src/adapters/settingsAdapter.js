/**
 * 设置模型适配器
 * 用于在前端和后端模型之间进行转换
 */

import { Settings } from '../models';
import realmService from '../services/database/realmService';
import { logService } from '../utils/logService';
import { offlineSyncService } from '../services/offline/offlineSyncService';

/**
 * 将后端设置模型转换为前端设置对象
 * @param {Object} settings 后端设置模型
 * @returns {Object} 前端设置对象
 */
export const toFrontendSettings = (settings) => {
  if (!settings) return null;
  
  try {
    return {
      id: settings._id,
      userId: settings.user_id,
      theme: settings.theme || 'light',
      language: settings.language || 'zh-CN',
      fontSize: settings.font_size || 'medium',
      fontFamily: settings.font_family || 'system',
      autoSave: settings.auto_save !== false,
      autoSaveInterval: settings.auto_save_interval || 30000,
      syncEnabled: settings.sync_enabled !== false,
      syncInterval: settings.sync_interval || 300000,
      notificationsEnabled: settings.notifications_enabled !== false,
      soundEnabled: settings.sound_enabled !== false,
      editorSettings: { ...(settings.editor_settings || {}) },
      viewSettings: { ...(settings.view_settings || {}) },
      privacySettings: { ...(settings.privacy_settings || {}) },
      securitySettings: { ...(settings.security_settings || {}) },
      accessibilitySettings: { ...(settings.accessibility_settings || {}) },
      customSettings: { ...(settings.custom_settings || {}) },
      isSynced: settings.is_synced || false,
      createdAt: settings.created_at ? new Date(settings.created_at) : new Date(),
      updatedAt: settings.updated_at ? new Date(settings.updated_at) : new Date(),
    };
  } catch (error) {
    logService.error('转换设置模型失败', error);
    return null;
  }
};

/**
 * 将前端设置对象转换为后端设置模型
 * @param {Object} settings 前端设置对象
 * @returns {Object} 后端设置模型
 */
export const toBackendSettings = (settings) => {
  if (!settings) return null;
  
  try {
    return {
      _id: settings.id,
      user_id: settings.userId,
      theme: settings.theme || 'light',
      language: settings.language || 'zh-CN',
      font_size: settings.fontSize || 'medium',
      font_family: settings.fontFamily || 'system',
      auto_save: settings.autoSave !== false,
      auto_save_interval: settings.autoSaveInterval || 30000,
      sync_enabled: settings.syncEnabled !== false,
      sync_interval: settings.syncInterval || 300000,
      notifications_enabled: settings.notificationsEnabled !== false,
      sound_enabled: settings.soundEnabled !== false,
      editor_settings: { ...(settings.editorSettings || {}) },
      view_settings: { ...(settings.viewSettings || {}) },
      privacy_settings: { ...(settings.privacySettings || {}) },
      security_settings: { ...(settings.securitySettings || {}) },
      accessibility_settings: { ...(settings.accessibilitySettings || {}) },
      custom_settings: { ...(settings.customSettings || {}) },
      is_synced: settings.isSynced || false,
      created_at: settings.createdAt || new Date(),
      updated_at: settings.updatedAt || new Date(),
    };
  } catch (error) {
    logService.error('转换设置对象失败', error);
    return null;
  }
};

/**
 * 获取用户设置
 * @param {string} userId 用户ID
 * @returns {Promise<Object>} 用户设置
 */
export const getUserSettings = async (userId) => {
  try {
    // 查找用户设置
    const realm = await realmService.getRealm();
    let settings = realm.objects('Settings').filtered(`user_id = "${userId}"`)[0];
    
    // 如果不存在，创建默认设置
    if (!settings) {
      settings = await createUserSettings(userId);
    }
    
    // 返回前端设置对象
    return toFrontendSettings(settings);
  } catch (error) {
    logService.error(`获取用户设置失败: ${userId}`, error);
    throw error;
  }
};

/**
 * 创建用户设置
 * @param {string} userId 用户ID
 * @param {Object} settingsData 设置数据
 * @returns {Promise<Object>} 创建的设置
 */
export const createUserSettings = async (userId, settingsData = {}) => {
  try {
    // 准备设置数据
    const now = new Date();
    const settingsId = `settings_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    
    const backendSettings = {
      _id: settingsId,
      user_id: userId,
      theme: settingsData.theme || 'light',
      language: settingsData.language || 'zh-CN',
      font_size: settingsData.fontSize || 'medium',
      font_family: settingsData.fontFamily || 'system',
      auto_save: settingsData.autoSave !== false,
      auto_save_interval: settingsData.autoSaveInterval || 30000,
      sync_enabled: settingsData.syncEnabled !== false,
      sync_interval: settingsData.syncInterval || 300000,
      notifications_enabled: settingsData.notificationsEnabled !== false,
      sound_enabled: settingsData.soundEnabled !== false,
      editor_settings: { ...(settingsData.editorSettings || {}) },
      view_settings: { ...(settingsData.viewSettings || {}) },
      privacy_settings: { ...(settingsData.privacySettings || {}) },
      security_settings: { ...(settingsData.securitySettings || {}) },
      accessibility_settings: { ...(settingsData.accessibilitySettings || {}) },
      custom_settings: { ...(settingsData.customSettings || {}) },
      is_synced: false,
      created_at: now,
      updated_at: now,
    };
    
    // 创建设置模型
    const realm = await realmService.getRealm();
    let settings;
    realm.write(() => {
      settings = realm.create('Settings', backendSettings);
    });
    
    // 添加到同步队列
    await offlineSyncService.addToSyncQueue({
      entity_id: settings._id,
      entity_type: 'settings',
      operation: 'create',
      data: settings.toJSON(),
      user_id: userId,
    });
    
    // 返回前端设置对象
    return toFrontendSettings(settings);
  } catch (error) {
    logService.error(`创建用户设置失败: ${userId}`, error);
    throw error;
  }
};

/**
 * 更新用户设置
 * @param {string} userId 用户ID
 * @param {Object} settingsData 设置数据
 * @returns {Promise<Object>} 更新后的设置
 */
export const updateUserSettings = async (userId, settingsData) => {
  try {
    // 查找用户设置
    const realm = await realmService.getRealm();
    let settings = realm.objects('Settings').filtered(`user_id = "${userId}"`)[0];
    
    // 如果不存在，创建默认设置
    if (!settings) {
      settings = await createUserSettings(userId, settingsData);
      return toFrontendSettings(settings);
    }
    
    // 更新设置属性
    if (settingsData.theme !== undefined) settings.theme = settingsData.theme;
    if (settingsData.language !== undefined) settings.language = settingsData.language;
    if (settingsData.fontSize !== undefined) settings.font_size = settingsData.fontSize;
    if (settingsData.fontFamily !== undefined) settings.font_family = settingsData.fontFamily;
    if (settingsData.autoSave !== undefined) settings.auto_save = settingsData.autoSave;
    if (settingsData.autoSaveInterval !== undefined) settings.auto_save_interval = settingsData.autoSaveInterval;
    if (settingsData.syncEnabled !== undefined) settings.sync_enabled = settingsData.syncEnabled;
    if (settingsData.syncInterval !== undefined) settings.sync_interval = settingsData.syncInterval;
    if (settingsData.notificationsEnabled !== undefined) settings.notifications_enabled = settingsData.notificationsEnabled;
    if (settingsData.soundEnabled !== undefined) settings.sound_enabled = settingsData.soundEnabled;
    
    // 更新复杂设置
    if (settingsData.editorSettings !== undefined) {
      settings.editor_settings = {
        ...settings.editor_settings,
        ...settingsData.editorSettings,
      };
    }
    
    if (settingsData.viewSettings !== undefined) {
      settings.view_settings = {
        ...settings.view_settings,
        ...settingsData.viewSettings,
      };
    }
    
    if (settingsData.privacySettings !== undefined) {
      settings.privacy_settings = {
        ...settings.privacy_settings,
        ...settingsData.privacySettings,
      };
    }
    
    if (settingsData.securitySettings !== undefined) {
      settings.security_settings = {
        ...settings.security_settings,
        ...settingsData.securitySettings,
      };
    }
    
    if (settingsData.accessibilitySettings !== undefined) {
      settings.accessibility_settings = {
        ...settings.accessibility_settings,
        ...settingsData.accessibilitySettings,
      };
    }
    
    if (settingsData.customSettings !== undefined) {
      settings.custom_settings = {
        ...settings.custom_settings,
        ...settingsData.customSettings,
      };
    }
    
    // 更新时间
    settings.updated_at = new Date();
    settings.is_synced = false;
    
    // 保存设置
    await settings.save();
    
    // 添加到同步队列
    await offlineSyncService.addToSyncQueue({
      entity_id: settings._id,
      entity_type: 'settings',
      operation: 'update',
      data: settings.toJSON(),
      user_id: userId,
    });
    
    // 返回前端设置对象
    return toFrontendSettings(settings);
  } catch (error) {
    logService.error(`更新用户设置失败: ${userId}`, error);
    throw error;
  }
};

/**
 * 重置用户设置
 * @param {string} userId 用户ID
 * @returns {Promise<Object>} 重置后的设置
 */
export const resetUserSettings = async (userId) => {
  try {
    // 查找用户设置
    const realm = await realmService.getRealm();
    const settings = realm.objects('Settings').filtered(`user_id = "${userId}"`)[0];
    
    // 如果不存在，创建默认设置
    if (!settings) {
      return createUserSettings(userId);
    }
    
    // 删除旧设置
    await settings.remove();
    
    // 创建新设置
    return createUserSettings(userId);
  } catch (error) {
    logService.error(`重置用户设置失败: ${userId}`, error);
    throw error;
  }
};
