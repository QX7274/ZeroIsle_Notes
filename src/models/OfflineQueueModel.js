/**
 * 离线队列模型类
 * 提供离线队列相关的操作方法
 */

import BaseModel from './BaseModel';
import { OfflineQueue } from './index';
import { logService } from '../services/utils/logService';

/**
 * 离线队列模型类
 * @extends BaseModel
 */
class OfflineQueueModel extends BaseModel {
  /**
   * 构造函数
   * @param {Object} data 离线队列数据
   */
  constructor(data) {
    super(data);
    this.model = OfflineQueue;
  }

  /**
   * 创建离线队列项
   * @param {Object} data 离线队列数据
   * @returns {Promise<OfflineQueueModel>} 创建的离线队列项
   * @static
   */
  static async create(data) {
    try {
      // 创建离线队列项
      const queue = await OfflineQueue.create(data);
      return new OfflineQueueModel(queue);
    } catch (error) {
      logService.error('创建离线队列项失败', error);
      throw error;
    }
  }

  /**
   * 查找离线队列项
   * @param {Object} query 查询条件
   * @param {Object} options 选项
   * @returns {Promise<Array<OfflineQueueModel>>} 离线队列项列表
   * @static
   */
  static async find(query = {}, options = {}) {
    try {
      // 查找离线队列项
      const queues = await OfflineQueue.find(query, null, options);
      return queues.map(item => new OfflineQueueModel(item));
    } catch (error) {
      logService.error('查找离线队列项失败', error);
      throw error;
    }
  }

  /**
   * 查找单个离线队列项
   * @param {Object} query 查询条件
   * @returns {Promise<OfflineQueueModel|null>} 离线队列项
   * @static
   */
  static async findOne(query) {
    try {
      // 查找离线队列项
      const queue = await OfflineQueue.findOne(query);
      return queue ? new OfflineQueueModel(queue) : null;
    } catch (error) {
      logService.error('查找单个离线队列项失败', error);
      throw error;
    }
  }

  /**
   * 根据ID查找离线队列项
   * @param {string} id 离线队列项ID
   * @returns {Promise<OfflineQueueModel|null>} 离线队列项
   * @static
   */
  static async findById(id) {
    try {
      // 查找离线队列项
      const queue = await OfflineQueue.findById(id);
      return queue ? new OfflineQueueModel(queue) : null;
    } catch (error) {
      logService.error(`根据ID查找离线队列项失败: ${id}`, error);
      throw error;
    }
  }

  /**
   * 查找待同步的离线队列项
   * @param {Object} query 查询条件
   * @param {Object} options 选项
   * @returns {Promise<Array<OfflineQueueModel>>} 离线队列项列表
   * @static
   */
  static async findPending(query = {}, options = {}) {
    try {
      // 查找待同步的离线队列项
      const queues = await OfflineQueue.findPending(query, options);
      return queues.map(item => new OfflineQueueModel(item));
    } catch (error) {
      logService.error('查找待同步的离线队列项失败', error);
      throw error;
    }
  }

  /**
   * 查找失败的离线队列项
   * @param {Object} query 查询条件
   * @param {Object} options 选项
   * @returns {Promise<Array<OfflineQueueModel>>} 离线队列项列表
   * @static
   */
  static async findFailed(query = {}, options = {}) {
    try {
      // 查找失败的离线队列项
      const queues = await OfflineQueue.findFailed(query, options);
      return queues.map(item => new OfflineQueueModel(item));
    } catch (error) {
      logService.error('查找失败的离线队列项失败', error);
      throw error;
    }
  }

  /**
   * 查找已同步的离线队列项
   * @param {Object} query 查询条件
   * @param {Object} options 选项
   * @returns {Promise<Array<OfflineQueueModel>>} 离线队列项列表
   * @static
   */
  static async findSynced(query = {}, options = {}) {
    try {
      // 查找已同步的离线队列项
      const queues = await OfflineQueue.findSynced(query, options);
      return queues.map(item => new OfflineQueueModel(item));
    } catch (error) {
      logService.error('查找已同步的离线队列项失败', error);
      throw error;
    }
  }

  /**
   * 清理已同步的离线队列项
   * @param {Object} query 查询条件
   * @param {number} days 天数
   * @returns {Promise<Object>} 删除结果
   * @static
   */
  static async cleanupSynced(query = {}, days = 7) {
    try {
      // 清理已同步的离线队列项
      return await OfflineQueue.cleanupSynced(query, days);
    } catch (error) {
      logService.error('清理已同步的离线队列项失败', error);
      throw error;
    }
  }

  /**
   * 更新离线队列项
   * @param {Object} query 查询条件
   * @param {Object} update 更新数据
   * @param {Object} options 选项
   * @returns {Promise<Object>} 更新结果
   * @static
   */
  static async updateOne(query, update, options = {}) {
    try {
      // 更新离线队列项
      return await OfflineQueue.updateOne(query, update, options);
    } catch (error) {
      logService.error('更新离线队列项失败', error);
      throw error;
    }
  }

  /**
   * 更新多个离线队列项
   * @param {Object} query 查询条件
   * @param {Object} update 更新数据
   * @param {Object} options 选项
   * @returns {Promise<Object>} 更新结果
   * @static
   */
  static async updateMany(query, update, options = {}) {
    try {
      // 更新多个离线队列项
      return await OfflineQueue.updateMany(query, update, options);
    } catch (error) {
      logService.error('更新多个离线队列项失败', error);
      throw error;
    }
  }

  /**
   * 删除离线队列项
   * @param {Object} query 查询条件
   * @returns {Promise<Object>} 删除结果
   * @static
   */
  static async deleteOne(query) {
    try {
      // 删除离线队列项
      return await OfflineQueue.deleteOne(query);
    } catch (error) {
      logService.error('删除离线队列项失败', error);
      throw error;
    }
  }

  /**
   * 删除多个离线队列项
   * @param {Object} query 查询条件
   * @returns {Promise<Object>} 删除结果
   * @static
   */
  static async deleteMany(query) {
    try {
      // 删除多个离线队列项
      return await OfflineQueue.deleteMany(query);
    } catch (error) {
      logService.error('删除多个离线队列项失败', error);
      throw error;
    }
  }

  /**
   * 保存离线队列项
   * @returns {Promise<OfflineQueueModel>} 保存后的离线队列项
   */
  async save() {
    try {
      // 更新时间
      this.data.updated_at = new Date();
      
      // 保存离线队列项
      await this.data.save();
      return this;
    } catch (error) {
      logService.error('保存离线队列项失败', error);
      throw error;
    }
  }

  /**
   * 标记为已同步
   * @returns {Promise<OfflineQueueModel>} 更新后的离线队列项
   */
  async markAsSynced() {
    try {
      // 标记为已同步
      await this.data.markAsSynced();
      return this;
    } catch (error) {
      logService.error('标记离线队列项为已同步失败', error);
      throw error;
    }
  }

  /**
   * 标记为失败
   * @param {string} error 错误信息
   * @returns {Promise<OfflineQueueModel>} 更新后的离线队列项
   */
  async markAsFailed(error) {
    try {
      // 标记为失败
      await this.data.markAsFailed(error);
      return this;
    } catch (error) {
      logService.error('标记离线队列项为失败失败', error);
      throw error;
    }
  }

  /**
   * 标记为同步中
   * @returns {Promise<OfflineQueueModel>} 更新后的离线队列项
   */
  async markAsSyncing() {
    try {
      // 标记为同步中
      await this.data.markAsSyncing();
      return this;
    } catch (error) {
      logService.error('标记离线队列项为同步中失败', error);
      throw error;
    }
  }

  /**
   * 重置为待同步
   * @returns {Promise<OfflineQueueModel>} 更新后的离线队列项
   */
  async resetToPending() {
    try {
      // 重置为待同步
      await this.data.resetToPending();
      return this;
    } catch (error) {
      logService.error('重置离线队列项为待同步失败', error);
      throw error;
    }
  }

  /**
   * 删除离线队列项
   * @returns {Promise<boolean>} 是否成功
   */
  async remove() {
    try {
      // 删除离线队列项
      await this.data.remove();
      return true;
    } catch (error) {
      logService.error('删除离线队列项失败', error);
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

export default OfflineQueueModel;
