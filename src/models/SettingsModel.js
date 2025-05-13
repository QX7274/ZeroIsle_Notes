/**
 * 设置模型类
 * 提供设置相关的操作方法
 */

import BaseModel from './BaseModel';
import { Settings } from './index';
import { logService } from '../services/utils/logService';

/**
 * 设置模型类
 * @extends BaseModel
 */
class SettingsModel extends BaseModel {
  /**
   * 构造函数
   * @param {Object} data 设置数据
   */
  constructor(data) {
    super(data);
    this.model = Settings;
  }

  /**
   * 创建设置
   * @param {Object} data 设置数据
   * @returns {Promise<SettingsModel>} 创建的设置
   * @static
   */
  static async create(data) {
    try {
      // 创建设置
      const settings = await Settings.create(data);
      return new SettingsModel(settings);
    } catch (error) {
      logService.error('创建设置失败', error);
      throw error;
    }
  }

  /**
   * 查找设置
   * @param {Object} query 查询条件
   * @param {Object} options 选项
   * @returns {Promise<Array<SettingsModel>>} 设置列表
   * @static
   */
  static async find(query = {}, options = {}) {
    try {
      // 查找设置
      const settings = await Settings.find(query, null, options);
      return settings.map(item => new SettingsModel(item));
    } catch (error) {
      logService.error('查找设置失败', error);
      throw error;
    }
  }

  /**
   * 查找单个设置
   * @param {Object} query 查询条件
   * @returns {Promise<SettingsModel|null>} 设置
   * @static
   */
  static async findOne(query) {
    try {
      // 查找设置
      const settings = await Settings.findOne(query);
      return settings ? new SettingsModel(settings) : null;
    } catch (error) {
      logService.error('查找单个设置失败', error);
      throw error;
    }
  }

  /**
   * 根据ID查找设置
   * @param {string} id 设置ID
   * @returns {Promise<SettingsModel|null>} 设置
   * @static
   */
  static async findById(id) {
    try {
      // 查找设置
      const settings = await Settings.findById(id);
      return settings ? new SettingsModel(settings) : null;
    } catch (error) {
      logService.error(`根据ID查找设置失败: ${id}`, error);
      throw error;
    }
  }

  /**
   * 查找用户设置
   * @param {string} userId 用户ID
   * @returns {Promise<SettingsModel|null>} 设置
   * @static
   */
  static async findByUser(userId) {
    try {
      // 查找设置
      const settings = await Settings.findOne({ user_id: userId });
      return settings ? new SettingsModel(settings) : null;
    } catch (error) {
      logService.error(`查找用户设置失败: ${userId}`, error);
      throw error;
    }
  }

  /**
   * 更新设置
   * @param {Object} query 查询条件
   * @param {Object} update 更新数据
   * @param {Object} options 选项
   * @returns {Promise<Object>} 更新结果
   * @static
   */
  static async updateOne(query, update, options = {}) {
    try {
      // 更新设置
      return await Settings.updateOne(query, update, options);
    } catch (error) {
      logService.error('更新设置失败', error);
      throw error;
    }
  }

  /**
   * 更新多个设置
   * @param {Object} query 查询条件
   * @param {Object} update 更新数据
   * @param {Object} options 选项
   * @returns {Promise<Object>} 更新结果
   * @static
   */
  static async updateMany(query, update, options = {}) {
    try {
      // 更新设置
      return await Settings.updateMany(query, update, options);
    } catch (error) {
      logService.error('更新多个设置失败', error);
      throw error;
    }
  }

  /**
   * 删除设置
   * @param {Object} query 查询条件
   * @returns {Promise<Object>} 删除结果
   * @static
   */
  static async deleteOne(query) {
    try {
      // 删除设置
      return await Settings.deleteOne(query);
    } catch (error) {
      logService.error('删除设置失败', error);
      throw error;
    }
  }

  /**
   * 删除多个设置
   * @param {Object} query 查询条件
   * @returns {Promise<Object>} 删除结果
   * @static
   */
  static async deleteMany(query) {
    try {
      // 删除设置
      return await Settings.deleteMany(query);
    } catch (error) {
      logService.error('删除多个设置失败', error);
      throw error;
    }
  }

  /**
   * 查找或创建用户设置
   * @param {string} userId 用户ID
   * @param {Object} defaultSettings 默认设置
   * @returns {Promise<SettingsModel>} 设置
   * @static
   */
  static async findOrCreate(userId, defaultSettings = {}) {
    try {
      // 查找设置
      let settings = await Settings.findOne({ user_id: userId });
      
      // 如果不存在，创建设置
      if (!settings) {
        const now = new Date();
        const settingsId = `settings_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
        
        settings = await Settings.create({
          _id: settingsId,
          user_id: userId,
          created_at: now,
          updated_at: now,
          ...defaultSettings,
        });
      }
      
      return new SettingsModel(settings);
    } catch (error) {
      logService.error(`查找或创建用户设置失败: ${userId}`, error);
      throw error;
    }
  }

  /**
   * 保存设置
   * @returns {Promise<SettingsModel>} 保存后的设置
   */
  async save() {
    try {
      // 更新时间
      this.data.updated_at = new Date();
      
      // 保存设置
      await this.data.save();
      return this;
    } catch (error) {
      logService.error('保存设置失败', error);
      throw error;
    }
  }

  /**
   * 更新设置
   * @param {Object} data 更新数据
   * @returns {Promise<SettingsModel>} 更新后的设置
   */
  async update(data) {
    try {
      // 更新设置属性
      Object.keys(data).forEach(key => {
        // 转换驼峰命名为下划线命名
        const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        
        // 更新属性
        if (key === 'userId') {
          this.data.user_id = data[key];
        } else if (key === 'isSynced') {
          this.data.is_synced = data[key];
        } else if (key === 'createdAt') {
          this.data.created_at = data[key];
        } else if (key === 'updatedAt') {
          this.data.updated_at = data[key];
        } else if (key === 'editorSettings') {
          this.data.editor_settings = { ...this.data.editor_settings, ...data[key] };
        } else if (key === 'viewSettings') {
          this.data.view_settings = { ...this.data.view_settings, ...data[key] };
        } else if (key === 'privacySettings') {
          this.data.privacy_settings = { ...this.data.privacy_settings, ...data[key] };
        } else if (key === 'securitySettings') {
          this.data.security_settings = { ...this.data.security_settings, ...data[key] };
        } else if (key === 'accessibilitySettings') {
          this.data.accessibility_settings = { ...this.data.accessibility_settings, ...data[key] };
        } else if (key === 'customSettings') {
          this.data.custom_settings = { ...this.data.custom_settings, ...data[key] };
        } else if (this.data[snakeKey] !== undefined) {
          this.data[snakeKey] = data[key];
        } else {
          this.data[key] = data[key];
        }
      });
      
      // 更新时间
      this.data.updated_at = new Date();
      this.data.is_synced = false;
      
      // 保存设置
      await this.data.save();
      return this;
    } catch (error) {
      logService.error('更新设置失败', error);
      throw error;
    }
  }

  /**
   * 删除设置
   * @returns {Promise<boolean>} 是否成功
   */
  async remove() {
    try {
      // 删除设置
      await this.data.remove();
      return true;
    } catch (error) {
      logService.error('删除设置失败', error);
      throw error;
    }
  }

  /**
   * 转换为JSON
   * @returns {Object} JSON对象
   */
  toJSON() {
    return this.data.toObject();
  }
}

export default SettingsModel;
