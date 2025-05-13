/**
 * AI聊天模型类
 */

import BaseModel from './BaseModel';
import { logService } from '../services/utils/logService';

class AIChatModel extends BaseModel {
  constructor(data = {}) {
    super(data, 'AIChat');
    
    this.title = data.title || '';
    this.messages = data.messages || [];
    this.user_id = data.user_id || null;
    this.is_deleted = data.is_deleted || false;
    this.is_synced = data.is_synced || false;
    this.created_at = data.created_at || null;
    this.updated_at = data.updated_at || null;
    this.model = data.model || null;
    this.system_prompt = data.system_prompt || null;
    this.tags = data.tags || [];
    this.is_favorite = data.is_favorite || false;
    this.category = data.category || null;
  }

  /**
   * 更新标题
   * @param {string} title 标题
   * @returns {AIChatModel} AI聊天模型
   */
  updateTitle(title) {
    this.title = title;
    this.isModified = true;
    this.modifiedFields.add('title');
    return this;
  }

  /**
   * 添加消息
   * @param {string} content 消息内容
   * @param {boolean} isUser 是否用户消息
   * @param {Object} metadata 元数据
   * @returns {AIChatModel} AI聊天模型
   */
  addMessage(content, isUser = true, metadata = {}) {
    const message = {
      content,
      isUser,
      timestamp: new Date(),
      metadata,
    };
    
    this.messages.push(message);
    this.isModified = true;
    this.modifiedFields.add('messages');
    return this;
  }

  /**
   * 更新最后一条消息
   * @param {string} content 消息内容
   * @param {Object} metadata 元数据
   * @returns {AIChatModel} AI聊天模型
   */
  updateLastMessage(content, metadata = {}) {
    if (this.messages.length > 0) {
      const lastMessage = this.messages[this.messages.length - 1];
      lastMessage.content = content;
      
      if (metadata) {
        lastMessage.metadata = {
          ...lastMessage.metadata,
          ...metadata,
        };
      }
      
      this.isModified = true;
      this.modifiedFields.add('messages');
    }
    
    return this;
  }

  /**
   * 删除消息
   * @param {number} index 消息索引
   * @returns {AIChatModel} AI聊天模型
   */
  deleteMessage(index) {
    if (index >= 0 && index < this.messages.length) {
      this.messages.splice(index, 1);
      this.isModified = true;
      this.modifiedFields.add('messages');
    }
    
    return this;
  }

  /**
   * 清空消息
   * @returns {AIChatModel} AI聊天模型
   */
  clearMessages() {
    this.messages = [];
    this.isModified = true;
    this.modifiedFields.add('messages');
    return this;
  }

  /**
   * 设置模型
   * @param {string} model 模型名称
   * @returns {AIChatModel} AI聊天模型
   */
  setModel(model) {
    this.model = model;
    this.isModified = true;
    this.modifiedFields.add('model');
    return this;
  }

  /**
   * 设置系统提示词
   * @param {string} systemPrompt 系统提示词
   * @returns {AIChatModel} AI聊天模型
   */
  setSystemPrompt(systemPrompt) {
    this.system_prompt = systemPrompt;
    this.isModified = true;
    this.modifiedFields.add('system_prompt');
    return this;
  }

  /**
   * 添加标签
   * @param {string} tag 标签
   * @returns {AIChatModel} AI聊天模型
   */
  addTag(tag) {
    if (!this.tags.includes(tag)) {
      this.tags.push(tag);
      this.isModified = true;
      this.modifiedFields.add('tags');
    }
    return this;
  }

  /**
   * 移除标签
   * @param {string} tag 标签
   * @returns {AIChatModel} AI聊天模型
   */
  removeTag(tag) {
    const index = this.tags.indexOf(tag);
    if (index !== -1) {
      this.tags.splice(index, 1);
      this.isModified = true;
      this.modifiedFields.add('tags');
    }
    return this;
  }

  /**
   * 设置收藏状态
   * @param {boolean} isFavorite 是否收藏
   * @returns {AIChatModel} AI聊天模型
   */
  setFavorite(isFavorite) {
    this.is_favorite = isFavorite;
    this.isModified = true;
    this.modifiedFields.add('is_favorite');
    return this;
  }

  /**
   * 设置分类
   * @param {string} category 分类
   * @returns {AIChatModel} AI聊天模型
   */
  setCategory(category) {
    this.category = category;
    this.isModified = true;
    this.modifiedFields.add('category');
    return this;
  }

  /**
   * 获取用户消息
   * @returns {Array<Object>} 用户消息数组
   */
  getUserMessages() {
    return this.messages.filter(message => message.isUser);
  }

  /**
   * 获取AI消息
   * @returns {Array<Object>} AI消息数组
   */
  getAIMessages() {
    return this.messages.filter(message => !message.isUser);
  }

  /**
   * 获取最后一条消息
   * @returns {Object|null} 最后一条消息
   */
  getLastMessage() {
    if (this.messages.length > 0) {
      return this.messages[this.messages.length - 1];
    }
    return null;
  }

  /**
   * 获取消息数量
   * @returns {number} 消息数量
   */
  getMessageCount() {
    return this.messages.length;
  }

  /**
   * 查找用户的AI聊天
   * @param {string} userId 用户ID
   * @param {Object} options 选项
   * @returns {Promise<Array<AIChatModel>>} AI聊天模型数组
   */
  static async findByUser(userId, options = {}) {
    try {
      const {
        limit = 50,
        skip = 0,
        sort = { updated_at: -1 },
        is_deleted = false,
        is_favorite = null,
        category = null,
        tags = null,
        search = null,
      } = options;
      
      const filter = { user_id: userId, is_deleted };
      
      if (is_favorite !== null) {
        filter.is_favorite = is_favorite;
      }
      
      if (category) {
        filter.category = category;
      }
      
      if (tags) {
        filter.tags = { $in: Array.isArray(tags) ? tags : [tags] };
      }
      
      // 简单的搜索实现
      if (search) {
        const searchLower = search.toLowerCase();
        const chats = await this.find(filter);
        
        const filteredChats = chats.filter(chat => 
          chat.title.toLowerCase().includes(searchLower) || 
          chat.messages.some(message => message.content.toLowerCase().includes(searchLower)) ||
          chat.tags.some(tag => tag.toLowerCase().includes(searchLower))
        );
        
        // 排序
        const sortField = Object.keys(sort)[0];
        const sortDirection = sort[sortField];
        
        filteredChats.sort((a, b) => {
          if (sortDirection === 1) {
            return a[sortField] > b[sortField] ? 1 : -1;
          } else {
            return a[sortField] < b[sortField] ? 1 : -1;
          }
        });
        
        // 分页
        return filteredChats.slice(skip, skip + limit);
      }
      
      return this.find(filter, { sort, limit, skip });
    } catch (error) {
      logService.error('查找用户AI聊天失败', error);
      throw error;
    }
  }

  /**
   * 查找收藏的AI聊天
   * @param {string} userId 用户ID
   * @param {Object} options 选项
   * @returns {Promise<Array<AIChatModel>>} AI聊天模型数组
   */
  static async findFavorites(userId, options = {}) {
    try {
      return this.findByUser(userId, {
        ...options,
        is_favorite: true,
      });
    } catch (error) {
      logService.error('查找收藏AI聊天失败', error);
      throw error;
    }
  }

  /**
   * 查找最近的AI聊天
   * @param {string} userId 用户ID
   * @param {number} limit 限制数量
   * @returns {Promise<Array<AIChatModel>>} AI聊天模型数组
   */
  static async findRecent(userId, limit = 10) {
    try {
      return this.findByUser(userId, {
        limit,
        sort: { updated_at: -1 },
      });
    } catch (error) {
      logService.error('查找最近AI聊天失败', error);
      throw error;
    }
  }

  /**
   * 搜索AI聊天
   * @param {string} query 搜索关键词
   * @param {string} userId 用户ID
   * @param {Object} options 选项
   * @returns {Promise<Array<AIChatModel>>} AI聊天模型数组
   */
  static async search(query, userId, options = {}) {
    try {
      const {
        limit = 20,
        skip = 0,
      } = options;
      
      return this.findByUser(userId, {
        search: query,
        limit,
        skip,
      });
    } catch (error) {
      logService.error('搜索AI聊天失败', error);
      throw error;
    }
  }

  /**
   * 创建新的AI聊天
   * @param {string} title 标题
   * @param {string} userId 用户ID
   * @param {Object} options 选项
   * @returns {Promise<AIChatModel>} AI聊天模型
   */
  static async createNew(title, userId, options = {}) {
    try {
      const { model = null, systemPrompt = null } = options;
      
      return this.create({
        title,
        user_id: userId,
        model,
        system_prompt: systemPrompt,
        messages: [],
      });
    } catch (error) {
      logService.error('创建AI聊天失败', error);
      throw error;
    }
  }
}

// 设置集合名称
AIChatModel.collectionName = 'AIChat';

export default AIChatModel;
