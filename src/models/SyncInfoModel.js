/**
 * 同步信息模型类
 * 提供同步信息相关的操作方法
 */

import BaseModel from './BaseModel';
import { SyncInfo } from './index';
import { logService } from '../services/utils/logService';

/**
 * 同步信息模型类
 * @extends BaseModel
 */
class SyncInfoModel extends BaseModel {
  /**
   * 构造函数
   * @param {Object} data 同步信息数据
   */
  constructor(data) {
    super(data);
    this.model = SyncInfo;
  }

  /**
   * 创建同步信息
   * @param {Object} data 同步信息数据
   * @returns {Promise<SyncInfoModel>} 创建的同步信息
   * @static
   */
  static async create(data) {
    try {
      // 创建同步信息
      const syncInfo = await SyncInfo.create(data);
      return new SyncInfoModel(syncInfo);
    } catch (error) {
      logService.error('创建同步信息失败', error);
      throw error;
    }
  }

  /**
   * 查找同步信息
   * @param {Object} query 查询条件
   * @param {Object} options 选项
   * @returns {Promise<Array<SyncInfoModel>>} 同步信息列表
   * @static
   */
  static async find(query = {}, options = {}) {
    try {
      // 查找同步信息
      const syncInfos = await SyncInfo.find(query, null, options);
      return syncInfos.map(item => new SyncInfoModel(item));
    } catch (error) {
      logService.error('查找同步信息失败', error);
      throw error;
    }
  }

  /**
   * 查找单个同步信息
   * @param {Object} query 查询条件
   * @returns {Promise<SyncInfoModel|null>} 同步信息
   * @static
   */
  static async findOne(query) {
    try {
      // 查找同步信息
      const syncInfo = await SyncInfo.findOne(query);
      return syncInfo ? new SyncInfoModel(syncInfo) : null;
    } catch (error) {
      logService.error('查找单个同步信息失败', error);
      throw error;
    }
  }

  /**
   * 根据ID查找同步信息
   * @param {string} id 同步信息ID
   * @returns {Promise<SyncInfoModel|null>} 同步信息
   * @static
   */
  static async findById(id) {
    try {
      // 查找同步信息
      const syncInfo = await SyncInfo.findById(id);
      return syncInfo ? new SyncInfoModel(syncInfo) : null;
    } catch (error) {
      logService.error(`根据ID查找同步信息失败: ${id}`, error);
      throw error;
    }
  }

  /**
   * 查找实体的同步信息
   * @param {string} entityId 实体ID
   * @param {string} entityType 实体类型
   * @returns {Promise<SyncInfoModel|null>} 同步信息
   * @static
   */
  static async findByEntity(entityId, entityType) {
    try {
      // 查找同步信息
      const syncInfo = await SyncInfo.findOne({
        entity_id: entityId,
        entity_type: entityType,
      });
      return syncInfo ? new SyncInfoModel(syncInfo) : null;
    } catch (error) {
      logService.error(`查找实体同步信息失败: ${entityId}`, error);
      throw error;
    }
  }

  /**
   * 查找待同步的信息
   * @param {Object} query 查询条件
   * @param {Object} options 选项
   * @returns {Promise<Array<SyncInfoModel>>} 同步信息列表
   * @static
   */
  static async findPending(query = {}, options = {}) {
    try {
      // 查找待同步的信息
      const syncInfos = await SyncInfo.findPending(query, options);
      return syncInfos.map(item => new SyncInfoModel(item));
    } catch (error) {
      logService.error('查找待同步的信息失败', error);
      throw error;
    }
  }

  /**
   * 查找失败的同步信息
   * @param {Object} query 查询条件
   * @param {Object} options 选项
   * @returns {Promise<Array<SyncInfoModel>>} 同步信息列表
   * @static
   */
  static async findFailed(query = {}, options = {}) {
    try {
      // 查找失败的同步信息
      const syncInfos = await SyncInfo.findFailed(query, options);
      return syncInfos.map(item => new SyncInfoModel(item));
    } catch (error) {
      logService.error('查找失败的同步信息失败', error);
      throw error;
    }
  }

  /**
   * 查找已同步的信息
   * @param {Object} query 查询条件
   * @param {Object} options 选项
   * @returns {Promise<Array<SyncInfoModel>>} 同步信息列表
   * @static
   */
  static async findSynced(query = {}, options = {}) {
    try {
      // 查找已同步的信息
      const syncInfos = await SyncInfo.findSynced(query, options);
      return syncInfos.map(item => new SyncInfoModel(item));
    } catch (error) {
      logService.error('查找已同步的信息失败', error);
      throw error;
    }
  }

  /**
   * 清理已同步的信息
   * @param {Object} query 查询条件
   * @param {number} days 天数
   * @returns {Promise<Object>} 删除结果
   * @static
   */
  static async cleanupSynced(query = {}, days = 7) {
    try {
      // 清理已同步的信息
      return await SyncInfo.cleanupSynced(query, days);
    } catch (error) {
      logService.error('清理已同步的信息失败', error);
      throw error;
    }
  }

  /**
   * 更新同步信息
   * @param {Object} query 查询条件
   * @param {Object} update 更新数据
   * @param {Object} options 选项
   * @returns {Promise<Object>} 更新结果
   * @static
   */
  static async updateOne(query, update, options = {}) {
    try {
      // 更新同步信息
      return await SyncInfo.updateOne(query, update, options);
    } catch (error) {
      logService.error('更新同步信息失败', error);
      throw error;
    }
  }

  /**
   * 更新多个同步信息
   * @param {Object} query 查询条件
   * @param {Object} update 更新数据
   * @param {Object} options 选项
   * @returns {Promise<Object>} 更新结果
   * @static
   */
  static async updateMany(query, update, options = {}) {
    try {
      // 更新多个同步信息
      return await SyncInfo.updateMany(query, update, options);
    } catch (error) {
      logService.error('更新多个同步信息失败', error);
      throw error;
    }
  }

  /**
   * 删除同步信息
   * @param {Object} query 查询条件
   * @returns {Promise<Object>} 删除结果
   * @static
   */
  static async deleteOne(query) {
    try {
      // 删除同步信息
      return await SyncInfo.deleteOne(query);
    } catch (error) {
      logService.error('删除同步信息失败', error);
      throw error;
    }
  }

  /**
   * 删除多个同步信息
   * @param {Object} query 查询条件
   * @returns {Promise<Object>} 删除结果
   * @static
   */
  static async deleteMany(query) {
    try {
      // 删除多个同步信息
      return await SyncInfo.deleteMany(query);
    } catch (error) {
      logService.error('删除多个同步信息失败', error);
      throw error;
    }
  }

  /**
   * 保存同步信息
   * @returns {Promise<SyncInfoModel>} 保存后的同步信息
   */
  async save() {
    try {
      // 更新时间
      this.data.updated_at = new Date();
      
      // 保存同步信息
      await this.data.save();
      return this;
    } catch (error) {
      logService.error('保存同步信息失败', error);
      throw error;
    }
  }

  /**
   * 标记为已同步
   * @returns {Promise<SyncInfoModel>} 更新后的同步信息
   */
  async markAsSynced() {
    try {
      // 标记为已同步
      await this.data.markAsSynced();
      return this;
    } catch (error) {
      logService.error('标记同步信息为已同步失败', error);
      throw error;
    }
  }

  /**
   * 标记为失败
   * @param {string} error 错误信息
   * @returns {Promise<SyncInfoModel>} 更新后的同步信息
   */
  async markAsFailed(error) {
    try {
      // 标记为失败
      await this.data.markAsFailed(error);
      return this;
    } catch (error) {
      logService.error('标记同步信息为失败失败', error);
      throw error;
    }
  }

  /**
   * 标记为同步中
   * @returns {Promise<SyncInfoModel>} 更新后的同步信息
   */
  async markAsSyncing() {
    try {
      // 标记为同步中
      await this.data.markAsSyncing();
      return this;
    } catch (error) {
      logService.error('标记同步信息为同步中失败', error);
      throw error;
    }
  }

  /**
   * 重置为待同步
   * @returns {Promise<SyncInfoModel>} 更新后的同步信息
   */
  async resetToPending() {
    try {
      // 重置为待同步
      await this.data.resetToPending();
      return this;
    } catch (error) {
      logService.error('重置同步信息为待同步失败', error);
      throw error;
    }
  }

  /**
   * 删除同步信息
   * @returns {Promise<boolean>} 是否成功
   */
  async remove() {
    try {
      // 删除同步信息
      await this.data.remove();
      return true;
    } catch (error) {
      logService.error('删除同步信息失败', error);
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

export default SyncInfoModel;
