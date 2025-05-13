/**
 * 标签模型类
 */

import BaseModel from './BaseModel';
import { logService } from '../services/utils/logService';

class TagModel extends BaseModel {
  constructor(data = {}) {
    super(data, 'Tag');
    
    this.name = data.name || '';
    this.color = data.color || null;
    this.user_id = data.user_id || null;
    this.count = data.count || 0;
    this.is_deleted = data.is_deleted || false;
    this.is_synced = data.is_synced || false;
    this.created_at = data.created_at || null;
    this.updated_at = data.updated_at || null;
  }

  /**
   * 更新名称
   * @param {string} name 名称
   * @returns {TagModel} 标签模型
   */
  updateName(name) {
    this.name = name;
    this.isModified = true;
    this.modifiedFields.add('name');
    return this;
  }

  /**
   * 设置颜色
   * @param {string} color 颜色
   * @returns {TagModel} 标签模型
   */
  setColor(color) {
    this.color = color;
    this.isModified = true;
    this.modifiedFields.add('color');
    return this;
  }

  /**
   * 增加计数
   * @param {number} amount 增加数量
   * @returns {TagModel} 标签模型
   */
  incrementCount(amount = 1) {
    this.count += amount;
    this.isModified = true;
    this.modifiedFields.add('count');
    return this;
  }

  /**
   * 减少计数
   * @param {number} amount 减少数量
   * @returns {TagModel} 标签模型
   */
  decrementCount(amount = 1) {
    this.count = Math.max(0, this.count - amount);
    this.isModified = true;
    this.modifiedFields.add('count');
    return this;
  }

  /**
   * 查找用户的标签
   * @param {string} userId 用户ID
   * @param {Object} options 选项
   * @returns {Promise<Array<TagModel>>} 标签模型数组
   */
  static async findByUser(userId, options = {}) {
    try {
      const {
        limit = 50,
        skip = 0,
        sort = { count: -1, name: 1 },
        is_deleted = false,
      } = options;
      
      const filter = { user_id: userId, is_deleted };
      
      return this.find(filter, { sort, limit, skip });
    } catch (error) {
      logService.error('查找用户标签失败', error);
      throw error;
    }
  }

  /**
   * 根据名称查找标签
   * @param {string} name 标签名称
   * @param {string} userId 用户ID
   * @returns {Promise<TagModel|null>} 标签模型
   */
  static async findByName(name, userId) {
    try {
      return this.findOne({
        name,
        user_id: userId,
        is_deleted: false,
      });
    } catch (error) {
      logService.error('根据名称查找标签失败', error);
      throw error;
    }
  }

  /**
   * 查找或创建标签
   * @param {string} name 标签名称
   * @param {string} userId 用户ID
   * @param {Object} options 选项
   * @returns {Promise<TagModel>} 标签模型
   */
  static async findOrCreate(name, userId, options = {}) {
    try {
      const { color = null } = options;
      
      // 查找现有标签
      let tag = await this.findByName(name, userId);
      
      if (tag) {
        return tag;
      }
      
      // 创建新标签
      return this.create({
        name,
        color,
        user_id: userId,
        count: 0,
      });
    } catch (error) {
      logService.error('查找或创建标签失败', error);
      throw error;
    }
  }

  /**
   * 获取热门标签
   * @param {string} userId 用户ID
   * @param {number} limit 限制数量
   * @returns {Promise<Array<TagModel>>} 标签模型数组
   */
  static async getPopularTags(userId, limit = 10) {
    try {
      return this.find(
        { user_id: userId, is_deleted: false, count: { $gt: 0 } },
        { sort: { count: -1 }, limit }
      );
    } catch (error) {
      logService.error('获取热门标签失败', error);
      throw error;
    }
  }

  /**
   * 批量创建标签
   * @param {Array<string>} names 标签名称数组
   * @param {string} userId 用户ID
   * @returns {Promise<Array<TagModel>>} 标签模型数组
   */
  static async createBatch(names, userId) {
    try {
      const tags = [];
      
      for (const name of names) {
        if (!name) continue;
        
        const tag = await this.findOrCreate(name, userId);
        tags.push(tag);
      }
      
      return tags;
    } catch (error) {
      logService.error('批量创建标签失败', error);
      throw error;
    }
  }

  /**
   * 更新标签计数
   * @param {string} userId 用户ID
   * @returns {Promise<boolean>} 是否成功
   */
  static async updateTagCounts(userId) {
    try {
      // 获取所有标签
      const tags = await this.findByUser(userId, { limit: 1000 });
      
      // 获取笔记模型
      const { NoteModel } = require('./index');
      
      // 更新每个标签的计数
      for (const tag of tags) {
        // 查找使用该标签的笔记数量
        const count = await NoteModel.count({
          user_id: userId,
          tags: tag.name,
          is_deleted: false,
        });
        
        // 更新标签计数
        if (tag.count !== count) {
          tag.count = count;
          await tag.save({ sync: false });
        }
      }
      
      return true;
    } catch (error) {
      logService.error('更新标签计数失败', error);
      throw error;
    }
  }

  /**
   * 合并标签
   * @param {string} sourceTagName 源标签名称
   * @param {string} targetTagName 目标标签名称
   * @param {string} userId 用户ID
   * @returns {Promise<Object>} 合并结果
   */
  static async mergeTags(sourceTagName, targetTagName, userId) {
    try {
      // 查找源标签和目标标签
      const sourceTag = await this.findByName(sourceTagName, userId);
      const targetTag = await this.findByName(targetTagName, userId);
      
      if (!sourceTag) {
        throw new Error(`源标签不存在: ${sourceTagName}`);
      }
      
      if (!targetTag) {
        throw new Error(`目标标签不存在: ${targetTagName}`);
      }
      
      // 获取笔记模型
      const { NoteModel } = require('./index');
      
      // 查找使用源标签的笔记
      const notes = await NoteModel.findByTag(sourceTagName, { user_id: userId });
      
      // 更新笔记标签
      let updatedCount = 0;
      for (const note of notes) {
        // 移除源标签
        const index = note.tags.indexOf(sourceTagName);
        if (index !== -1) {
          note.tags.splice(index, 1);
        }
        
        // 添加目标标签（如果不存在）
        if (!note.tags.includes(targetTagName)) {
          note.tags.push(targetTagName);
        }
        
        // 保存笔记
        await note.save();
        updatedCount++;
      }
      
      // 更新目标标签计数
      targetTag.count += sourceTag.count;
      await targetTag.save();
      
      // 删除源标签
      await sourceTag.remove();
      
      return {
        success: true,
        updatedCount,
        targetTag,
      };
    } catch (error) {
      logService.error('合并标签失败', error);
      throw error;
    }
  }
}

// 设置集合名称
TagModel.collectionName = 'Tag';

export default TagModel;
