/**
 * 聊天历史服务 - 管理AI助手的聊天历史
 */

import { mongoDBService } from '../database/mongoDBAdapter';
// 已移除 offlineStorageService 导入，现在直接使用 realmService
import realmService from '../database/realmService';
import { networkService } from '../network/networkService';
import { logService } from '../../utils/logService';
import { migrateAIChatData } from '../../utils/aiChatMigration';

class ChatHistoryService {
  constructor() {
    this.initialized = false;
    this.initializationPromise = null;
    this.collection = 'AIChat';
  }

  /**
   * 初始化聊天历史服务
   */
  async initialize() {
    if (this.initialized) {return Promise.resolve();}

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = new Promise(async (resolve, reject) => {
      try {
        // 确保MongoDB服务已初始化
        await mongoDBService.initialize();

        // 执行数据迁移（如果需要）
        try {
          await migrateAIChatData();
          logService.info('AI聊天数据迁移检查完成');
        } catch (migrationError) {
          // 迁移失败不应该阻止服务初始化
          logService.warn('AI聊天数据迁移失败，但服务将继续初始化', migrationError);
        }

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
        conversation._id = result.insertedId.toString();
        conversation.is_synced = true;

        // 同时保存到本地存储
        const realm = await realmService.getRealm();
        realm.write(() => {
          const realmData = this._convertToRealmFormat(conversation);
          realm.create('AIChat', realmData, 'modified');
        });

        return conversation;
      }

      // 离线模式：保存到本地存储
      const realm = await realmService.getRealm();
      let conversationId;
      realm.write(() => {
        const realmData = this._convertToRealmFormat(conversation);
        const savedConversation = realm.create('AIChat', realmData);
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
   * 转换MongoDB数据为Realm格式
   * @param {Object} data MongoDB数据
   * @returns {Object} Realm格式数据
   */
  _convertToRealmFormat(data) {
    const converted = {
      ...data,
      _id: data._id ? data._id.toString() : data._id,
      user_id: data.user_id ? data.user_id.toString() : data.user_id,
      messages: typeof data.messages === 'string'
        ? data.messages
        : JSON.stringify(data.messages || []),
    };
    return converted;
  }

  /**
   * 转换Realm数据为普通对象格式
   * @param {Object} data Realm数据
   * @returns {Object} 普通对象格式
   */
  _convertFromRealmFormat(data) {
    return {
      ...data,
      messages: typeof data.messages === 'string'
        ? JSON.parse(data.messages)
        : (data.messages || []),
    };
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
            const realmData = this._convertToRealmFormat(conversation);
            realm.create('AIChat', realmData, 'modified');
          }
        });

        return conversations;
      }

      // 离线模式：从本地存储获取
      const realm = await realmService.getRealm();
      let conversations = realm.objects('AIChat');

      // 应用过滤 - 转换MongoDB格式为Realm查询字符串
      if (defaultFilter && Object.keys(defaultFilter).length > 0) {
        const queryParts = [];
        for (const [key, value] of Object.entries(defaultFilter)) {
          if (typeof value === 'boolean') {
            queryParts.push(`${key} == ${value}`);
          } else if (typeof value === 'string') {
            queryParts.push(`${key} == "${value}"`);
          } else if (typeof value === 'number') {
            queryParts.push(`${key} == ${value}`);
          }
        }
        if (queryParts.length > 0) {
          conversations = conversations.filtered(queryParts.join(' AND '));
        }
      }

      // 应用排序 - 转换MongoDB格式为Realm格式
      if (sort && Object.keys(sort).length > 0) {
        const sortField = Object.keys(sort)[0];
        const sortDirection = sort[sortField] === -1; // -1 = descending = true in Realm
        conversations = conversations.sorted(sortField, sortDirection);
      }

      // 应用分页
      if (limit) {
        conversations = conversations.slice(skip || 0, (skip || 0) + limit);
      }

      // 转换为普通数组并转换格式
      return Array.from(conversations).map(conv => this._convertFromRealmFormat(conv));
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
            const realmData = this._convertToRealmFormat(conversation);
            realm.create('AIChat', realmData, 'modified');
          });
        }

        return conversation;
      }

      // 离线模式：从本地存储获取
      const realm = await realmService.getRealm();
      const conversation = realm.objectForPrimaryKey('AIChat', conversationId);
      return conversation ? this._convertFromRealmFormat(conversation) : null;
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
          Object.assign(conversation, update);
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
        id: realmService.createObjectId(),
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
          conversation.messages = JSON.stringify(messages);
          conversation.updated_at = update.updated_at;
          conversation.is_synced = update.is_synced;
          updatedConversation = this._convertFromRealmFormat(conversation);
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
      return conversations.map(conversation => {
        // 确保messages是数组
        const messages = Array.isArray(conversation.messages)
          ? conversation.messages
          : [];

        return {
          id: conversation._id ? conversation._id.toString() : '',
          tool: conversation.title || 'chat',
          input: messages.length > 0 ? (messages[0].content || '') : '',
          output: messages.length > 1 ? (messages[1].content || '') : '',
          timestamp: conversation.updated_at || conversation.created_at,
        };
      });
    } catch (error) {
      logService.error('获取AI历史记录失败', error);
      throw error;
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

const chatHistoryService = new ChatHistoryService();

module.exports = chatHistoryService;
module.exports.default = chatHistoryService;
module.exports.chatHistoryService = chatHistoryService;
module.exports.ChatHistoryService = ChatHistoryService;
