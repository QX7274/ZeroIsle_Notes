/**
 * 聊天历史服务 - 管理AI助手的聊天历史
 */

import { mongoDBService } from '../database/mongoDBAdapter';
// 已移除 offlineStorageService 导入，现在直接使用 realmService
import realmService from '../database/realmService';
import { networkService } from '../network/networkService';
import { logService } from '../../utils/logService';

class ChatHistoryService {
  constructor() {
    this.initialized = false;
    this.initializationPromise = null;
    this.collection = 'ai_conversations';
  }

  /**
   * 初始化聊天历史服务
   */
  async initialize() {
    if (this.initialized) return Promise.resolve();

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = new Promise(async (resolve, reject) => {
      try {
        // 确保MongoDB服务已初始化
        await mongoDBService.initialize();

        // 设置已初始化标志
        this.initialized = true;
        logService.info('聊天历史服务初始化成功');
        resolve();
      } catch (error) {
        logService.error('聊天历史服务初始化失败', error);
        reject(error);
      }
    });

    return this.initializationPromise;
  }

  /**
   * 创建新对话
   * @param {string} title 对话标题
   * @returns {Promise<Object>} 创建的对话对象
   */
  async createConversation(title = '新对话') {
    try {
      await this.initialize();

      // 创建对话对象
      const now = new Date();
      const conversation = {
        title,
        created_at: now,
        updated_at: now,
        messages: [],
        is_deleted: false,
        is_synced: false,
      };

      // 在线模式：保存到MongoDB
      if (networkService.isOnline()) {
        const result = await mongoDBService.insertOne(this.collection, conversation);
        conversation._id = result.insertedId;
        conversation.is_synced = true;

        // 同时保存到本地存储
        const realm = await realmService.getRealm();
        realm.write(() => {
          realm.create('AIChat', conversation);
        });

        return conversation;
      }

      // 离线模式：保存到本地存储
      const realm = await realmService.getRealm();
      let conversationId;
      realm.write(() => {
        const savedConversation = realm.create('AIChat', conversation);
        conversationId = savedConversation._id;
      });
      conversation._id = conversationId;

      return conversation;
    } catch (error) {
      logService.error('创建对话失败', error);
      throw error;
    }
  }

  /**
   * 获取所有对话
   * @param {Object} options 查询选项
   * @returns {Promise<Array>} 对话列表
   */
  async getConversations(options = {}) {
    try {
      await this.initialize();

      const { filter = {}, sort = { updated_at: -1 }, limit = 0, skip = 0 } = options;

      // 默认不显示已删除的对话
      const defaultFilter = { is_deleted: false, ...filter };

      // 在线模式：从MongoDB获取
      if (networkService.isOnline()) {
        const conversations = await mongoDBService.find(
          this.collection,
          defaultFilter,
          { sort, limit, skip }
        );

        // 更新本地缓存
        const realm = await realmService.getRealm();
        realm.write(() => {
          for (const conversation of conversations) {
            realm.create('AIChat', conversation);
          }
        });

        return conversations;
      }

      // 离线模式：从本地存储获取
      const realm = await realmService.getRealm();
      let conversations = realm.objects('AIChat');
      
      // 应用过滤和排序
      if (defaultFilter) {
        conversations = conversations.filtered(defaultFilter);
      }
      if (sort) {
        conversations = conversations.sorted(sort);
      }
      if (limit) {
        conversations = conversations.slice(skip || 0, (skip || 0) + limit);
      }
      
      return conversations;
    } catch (error) {
      logService.error('获取对话列表失败', error);
      throw error;
    }
  }

  /**
   * 根据ID获取对话
   * @param {string} conversationId 对话ID
   * @returns {Promise<Object>} 对话对象
   */
  async getConversationById(conversationId) {
    try {
      await this.initialize();

      // 在线模式：从MongoDB获取
      if (networkService.isOnline()) {
        const conversation = await mongoDBService.findOne(
          this.collection,
          { _id: conversationId }
        );

        // 更新本地缓存
        if (conversation) {
          const realm = await realmService.getRealm();
          realm.write(() => {
            realm.create('AIChat', conversation);
          });
        }

        return conversation;
      }

      // 离线模式：从本地存储获取
      const realm = await realmService.getRealm();
      return realm.objectForPrimaryKey('AIChat', conversationId);
    } catch (error) {
      logService.error(`获取对话(ID: ${conversationId})失败`, error);
      throw error;
    }
  }

  /**
   * 更新对话标题
   * @param {string} conversationId 对话ID
   * @param {string} title 新标题
   * @returns {Promise<Object>} 更新后的对话对象
   */
  async updateConversationTitle(conversationId, title) {
    try {
      await this.initialize();

      const update = {
        title,
        updated_at: new Date(),
        is_synced: false,
      };

      // 在线模式：更新MongoDB
      if (networkService.isOnline()) {
        await mongoDBService.updateOne(
          this.collection,
          { _id: conversationId },
          { $set: update }
        );

        update.is_synced = true;
      }

      // 更新本地存储
      const realm = await realmService.getRealm();
      let updatedConversation;
      realm.write(() => {
        const conversation = realm.objectForPrimaryKey('AIChat', conversationId);
        if (conversation) {
          Object.assign(conversation, updateData);
          updatedConversation = conversation;
        }
      });
      return updatedConversation;
    } catch (error) {
      logService.error(`更新对话标题(ID: ${conversationId})失败`, error);
      throw error;
    }
  }

  /**
   * 添加消息到对话
   * @param {string} conversationId 对话ID
   * @param {string} content 消息内容
   * @param {boolean} isUser 是否为用户消息
   * @returns {Promise<Object>} 更新后的对话对象
   */
  async addMessage(conversationId, content, isUser = true) {
    try {
      await this.initialize();

      // 获取当前对话
      const conversation = await this.getConversationById(conversationId);

      if (!conversation) {
        throw new Error(`对话(ID: ${conversationId})不存在`);
      }

      // 创建新消息
      const message = {
        id: `msg_${Date.now()}`,
        content,
        isUser,
        timestamp: new Date(),
      };

      // 添加消息到对话
      const messages = [...(conversation.messages || []), message];

      const update = {
        messages,
        updated_at: new Date(),
        is_synced: false,
      };

      // 在线模式：更新MongoDB
      if (networkService.isOnline()) {
        await mongoDBService.updateOne(
          this.collection,
          { _id: conversationId },
          { $set: update }
        );

        update.is_synced = true;
      }

      // 更新本地存储
      const realm = await realmService.getRealm();
      let updatedConversation;
      realm.write(() => {
        const conversation = realm.objectForPrimaryKey('AIChat', conversationId);
        if (conversation) {
          Object.assign(conversation, updateData);
          updatedConversation = conversation;
        }
      });
      return updatedConversation;
    } catch (error) {
      logService.error(`添加消息到对话(ID: ${conversationId})失败`, error);
      throw error;
    }
  }

  /**
   * 删除对话（软删除）
   * @param {string} conversationId 对话ID
   * @returns {Promise<boolean>} 是否成功
   */
  async deleteConversation(conversationId) {
    try {
      await this.initialize();

      const update = {
        is_deleted: true,
        updated_at: new Date(),
        is_synced: false,
      };

      // 在线模式：更新MongoDB
      if (networkService.isOnline()) {
        await mongoDBService.updateOne(
          this.collection,
          { _id: conversationId },
          { $set: update }
        );

        update.is_synced = true;
      }

      // 更新本地存储
      const realm = await realmService.getRealm();
      realm.write(() => {
        const conversation = realm.objectForPrimaryKey('AIChat', conversationId);
        if (conversation) {
          Object.assign(conversation, update);
        }
      });

      return true;
    } catch (error) {
      logService.error(`删除对话(ID: ${conversationId})失败`, error);
      throw error;
    }
  }

  /**
   * 永久删除对话
   * @param {string} conversationId 对话ID
   * @returns {Promise<boolean>} 是否成功
   */
  async permanentlyDeleteConversation(conversationId) {
    try {
      await this.initialize();

      // 在线模式：从MongoDB删除
      if (networkService.isOnline()) {
        await mongoDBService.deleteOne(this.collection, { _id: conversationId });
      }

      // 从本地存储删除
      const realm = await realmService.getRealm();
      realm.write(() => {
        const conversation = realm.objectForPrimaryKey('AIChat', conversationId);
        if (conversation) {
          realm.delete(conversation);
        }
      });

      return true;
    } catch (error) {
      logService.error(`永久删除对话(ID: ${conversationId})失败`, error);
      throw error;
    }
  }

  /**
   * 清空所有对话历史
   * @returns {Promise<boolean>} 是否成功
   */
  async clearAllConversations() {
    try {
      await this.initialize();

      // 在线模式：从MongoDB删除所有对话
      if (networkService.isOnline()) {
        await mongoDBService.deleteMany(this.collection, {});
      }

      // 从本地存储删除所有对话
      const realm = await realmService.getRealm();
      realm.write(() => {
        const conversations = realm.objects('AIChat');
        realm.delete(conversations);
      });

      return true;
    } catch (error) {
      logService.error('清空所有对话历史失败', error);
      throw error;
    }
  }

  /**
   * 获取AI工具历史记录
   * 为了兼容AIToolbar.js中的调用
   * @param {Object} options 查询选项
   * @returns {Promise<Array>} 历史记录列表
   */
  async getHistory(options = {}) {
    try {
      // 复用getConversations方法，但转换返回格式以兼容AIToolbar
      const conversations = await this.getConversations(options);

      // 转换为AIToolbar期望的格式
      return conversations.map(conversation => ({
        id: conversation._id,
        tool: conversation.title || 'chat',
        input: conversation.messages && conversation.messages.length > 0
          ? conversation.messages[0].content
          : '',
        output: conversation.messages && conversation.messages.length > 1
          ? conversation.messages[1].content
          : '',
        timestamp: conversation.updated_at || conversation.created_at,
      }));
    } catch (error) {
      logService.error('获取AI历史记录失败', error);
      return []; // 出错时返回空数组
    }
  }

  /**
   * 添加AI工具历史记录
   * 为了兼容AIToolbar.js中的调用
   * @param {Object} historyData 历史记录数据
   * @returns {Promise<Object>} 创建的历史记录对象
   */
  async addHistory(historyData) {
    try {
      // 创建一个新对话，使用工具名称作为标题
      const conversation = await this.createConversation(historyData.tool || '工具使用记录');

      // 添加输入消息
      if (historyData.input) {
        await this.addMessage(conversation._id, historyData.input, true);
      }

      // 添加输出消息
      if (historyData.output) {
        await this.addMessage(conversation._id, historyData.output, false);
      }

      // 返回兼容格式
      return {
        id: conversation._id,
        tool: historyData.tool,
        input: historyData.input,
        output: historyData.output,
        timestamp: historyData.timestamp || new Date(),
      };
    } catch (error) {
      logService.error('添加AI历史记录失败', error);
      throw error;
    }
  }

  /**
   * 清除AI工具历史记录
   * 为了兼容AIToolbar.js中的调用
   * @returns {Promise<boolean>} 是否成功
   */
  async clearHistory() {
    return this.clearAllConversations();
  }
}

export const chatHistoryService = new ChatHistoryService();