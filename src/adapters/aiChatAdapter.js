/**
 * AI聊天模型适配器
 * 用于在前端和后端模型之间进行转换
 */

import { AIChat } from '../models';
import realmService from '../services/database/realmService';
import { logService } from '../utils/logService';
import { offlineSyncService } from '../services/offline/offlineSyncService';

/**
 * 将后端AI聊天模型转换为前端AI聊天对象
 * @param {Object} chat 后端AI聊天模型
 * @returns {Object} 前端AI聊天对象
 */
export const toFrontendChat = (chat) => {
  if (!chat) return null;
  
  try {
    return {
      id: chat._id,
      title: chat.title || '新对话',
      messages: (chat.messages || []).map(toFrontendMessage),
      isDeleted: chat.is_deleted || false,
      isSynced: chat.is_synced || false,
      userId: chat.user_id,
      createdAt: chat.created_at ? new Date(chat.created_at) : new Date(),
      updatedAt: chat.updated_at ? new Date(chat.updated_at) : new Date(),
      deletedAt: chat.deleted_at ? new Date(chat.deleted_at) : null,
      model: chat.model || 'gpt-3.5-turbo',
      systemPrompt: chat.system_prompt || '',
      temperature: chat.temperature || 0.7,
      maxTokens: chat.max_tokens || 2048,
      isStarred: chat.is_starred || false,
      isArchived: chat.is_archived || false,
      tags: [...(chat.tags || [])],
      folder: chat.folder || 'default',
    };
  } catch (error) {
    logService.error('转换AI聊天模型失败', error);
    return null;
  }
};

/**
 * 将后端AI聊天消息模型转换为前端AI聊天消息对象
 * @param {Object} message 后端AI聊天消息模型
 * @returns {Object} 前端AI聊天消息对象
 */
export const toFrontendMessage = (message) => {
  if (!message) return null;
  
  try {
    return {
      id: message._id,
      chatId: message.chat_id,
      content: message.content || '',
      role: message.role || 'user',
      createdAt: message.created_at ? new Date(message.created_at) : new Date(),
      isDeleted: message.is_deleted || false,
      isSynced: message.is_synced || false,
      isError: message.is_error || false,
      errorMessage: message.error_message || '',
      tokens: message.tokens || 0,
      model: message.model || '',
      metadata: { ...(message.metadata || {}) },
    };
  } catch (error) {
    logService.error('转换AI聊天消息模型失败', error);
    return null;
  }
};

/**
 * 将前端AI聊天对象转换为后端AI聊天模型
 * @param {Object} chat 前端AI聊天对象
 * @returns {Object} 后端AI聊天模型
 */
export const toBackendChat = (chat) => {
  if (!chat) return null;
  
  try {
    return {
      _id: chat.id,
      title: chat.title || '新对话',
      messages: (chat.messages || []).map(toBackendMessage),
      is_deleted: chat.isDeleted || false,
      is_synced: chat.isSynced || false,
      user_id: chat.userId,
      created_at: chat.createdAt || new Date(),
      updated_at: chat.updatedAt || new Date(),
      deleted_at: chat.deletedAt || null,
      model: chat.model || 'gpt-3.5-turbo',
      system_prompt: chat.systemPrompt || '',
      temperature: chat.temperature || 0.7,
      max_tokens: chat.maxTokens || 2048,
      is_starred: chat.isStarred || false,
      is_archived: chat.isArchived || false,
      tags: [...(chat.tags || [])],
      folder: chat.folder || 'default',
    };
  } catch (error) {
    logService.error('转换AI聊天对象失败', error);
    return null;
  }
};

/**
 * 将前端AI聊天消息对象转换为后端AI聊天消息模型
 * @param {Object} message 前端AI聊天消息对象
 * @returns {Object} 后端AI聊天消息模型
 */
export const toBackendMessage = (message) => {
  if (!message) return null;
  
  try {
    return {
      _id: message.id,
      chat_id: message.chatId,
      content: message.content || '',
      role: message.role || 'user',
      created_at: message.createdAt || new Date(),
      is_deleted: message.isDeleted || false,
      is_synced: message.isSynced || false,
      is_error: message.isError || false,
      error_message: message.errorMessage || '',
      tokens: message.tokens || 0,
      model: message.model || '',
      metadata: { ...(message.metadata || {}) },
    };
  } catch (error) {
    logService.error('转换AI聊天消息对象失败', error);
    return null;
  }
};

/**
 * 创建AI聊天
 * @param {Object} chatData 聊天数据
 * @param {string} userId 用户ID
 * @returns {Promise<Object>} 创建的聊天
 */
export const createChat = async (chatData, userId) => {
  try {
    // 准备聊天数据
    const now = new Date();
    const chatId = `chat_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    
    const backendChat = {
      _id: chatId,
      title: chatData.title || '新对话',
      messages: [],
      is_deleted: false,
      is_synced: false,
      user_id: userId,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      model: chatData.model || 'gpt-3.5-turbo',
      system_prompt: chatData.systemPrompt || '',
      temperature: chatData.temperature || 0.7,
      max_tokens: chatData.maxTokens || 2048,
      is_starred: chatData.isStarred || false,
      is_archived: chatData.isArchived || false,
      tags: [...(chatData.tags || [])],
      folder: chatData.folder || 'default',
    };
    
    // 创建聊天模型
    const realm = await realmService.getRealm();
    let chat;
    realm.write(() => {
      chat = realm.create('AIChat', backendChat);
    });
    
    // 添加到同步队列
    await offlineSyncService.addToSyncQueue({
      entity_id: chat._id,
      entity_type: 'ai_chat',
      operation: 'create',
      data: chat.toJSON(),
      user_id: userId,
    });
    
    // 返回前端聊天对象
    return toFrontendChat(chat);
  } catch (error) {
    logService.error('创建AI聊天失败', error);
    throw error;
  }
};

/**
 * 添加AI聊天消息
 * @param {string} chatId 聊天ID
 * @param {Object} messageData 消息数据
 * @returns {Promise<Object>} 添加的消息
 */
export const addMessage = async (chatId, messageData) => {
  try {
    // 查找聊天
    const realm = await realmService.getRealm();
    const chat = realm.objectForPrimaryKey('AIChat', chatId);
    
    if (!chat) {
      throw new Error(`聊天不存在: ${chatId}`);
    }
    
    // 准备消息数据
    const now = new Date();
    const messageId = `message_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    
    const backendMessage = {
      _id: messageId,
      chat_id: chatId,
      content: messageData.content || '',
      role: messageData.role || 'user',
      created_at: now,
      is_deleted: false,
      is_synced: false,
      is_error: messageData.isError || false,
      error_message: messageData.errorMessage || '',
      tokens: messageData.tokens || 0,
      model: messageData.model || chat.model,
      metadata: { ...(messageData.metadata || {}) },
    };
    
    // 创建消息模型
    let message;
    realm.write(() => {
      message = realm.create('AIChat', backendMessage);
    });
    
    // 更新聊天
    chat.messages.push(message);
    chat.updated_at = now;
    chat.is_synced = false;
    await chat.save();
    
    // 添加到同步队列
    await offlineSyncService.addToSyncQueue({
      entity_id: message._id,
      entity_type: 'ai_chat_message',
      operation: 'create',
      data: message.toJSON(),
      user_id: chat.user_id,
    });
    
    // 返回前端消息对象
    return toFrontendMessage(message);
  } catch (error) {
    logService.error(`添加AI聊天消息失败: ${chatId}`, error);
    throw error;
  }
};

/**
 * 更新AI聊天
 * @param {string} chatId 聊天ID
 * @param {Object} chatData 聊天数据
 * @returns {Promise<Object>} 更新后的聊天
 */
export const updateChat = async (chatId, chatData) => {
  try {
    // 查找聊天
    const realm = await realmService.getRealm();
    const chat = realm.objectForPrimaryKey('AIChat', chatId);
    
    if (!chat) {
      throw new Error(`聊天不存在: ${chatId}`);
    }
    
    // 更新聊天属性
    if (chatData.title !== undefined) chat.title = chatData.title;
    if (chatData.model !== undefined) chat.model = chatData.model;
    if (chatData.systemPrompt !== undefined) chat.system_prompt = chatData.systemPrompt;
    if (chatData.temperature !== undefined) chat.temperature = chatData.temperature;
    if (chatData.maxTokens !== undefined) chat.max_tokens = chatData.maxTokens;
    if (chatData.isStarred !== undefined) chat.is_starred = chatData.isStarred;
    if (chatData.isArchived !== undefined) chat.is_archived = chatData.isArchived;
    if (chatData.tags !== undefined) chat.tags = [...chatData.tags];
    if (chatData.folder !== undefined) chat.folder = chatData.folder;
    
    // 更新时间
    chat.updated_at = new Date();
    chat.is_synced = false;
    
    // 保存聊天
    await chat.save();
    
    // 添加到同步队列
    await offlineSyncService.addToSyncQueue({
      entity_id: chat._id,
      entity_type: 'ai_chat',
      operation: 'update',
      data: chat.toJSON(),
      user_id: chat.user_id,
    });
    
    // 返回前端聊天对象
    return toFrontendChat(chat);
  } catch (error) {
    logService.error(`更新AI聊天失败: ${chatId}`, error);
    throw error;
  }
};

/**
 * 删除AI聊天
 * @param {string} chatId 聊天ID
 * @param {boolean} permanent 是否永久删除
 * @returns {Promise<boolean>} 是否成功
 */
export const deleteChat = async (chatId, permanent = false) => {
  try {
    // 查找聊天
    const realm = await realmService.getRealm();
    const chat = realm.objectForPrimaryKey('AIChat', chatId);
    
    if (!chat) {
      throw new Error(`聊天不存在: ${chatId}`);
    }
    
    if (permanent) {
      // 永久删除
      await chat.remove({ soft: false });
    } else {
      // 软删除
      chat.is_deleted = true;
      chat.deleted_at = new Date();
      chat.is_synced = false;
      await chat.save();
      
      // 添加到同步队列
      await offlineSyncService.addToSyncQueue({
        entity_id: chat._id,
        entity_type: 'ai_chat',
        operation: 'update',
        data: chat.toJSON(),
        user_id: chat.user_id,
      });
    }
    
    return true;
  } catch (error) {
    logService.error(`删除AI聊天失败: ${chatId}`, error);
    throw error;
  }
};

/**
 * 获取AI聊天列表
 * @param {string} userId 用户ID
 * @param {Object} options 选项
 * @returns {Promise<Array<Object>>} 聊天列表
 */
export const getChats = async (userId, options = {}) => {
  try {
    // 查找聊天
    const realm = await realmService.getRealm();
    let chats = realm.objects('AIChat').filtered(`user_id = "${userId}"`);
    
    // 应用排序
    if (options.sortBy) {
      chats = chats.sorted(options.sortBy, options.sortOrder === 'desc');
    }
    
    // 应用分页
    if (options.limit) {
      chats = chats.slice(0, options.limit);
    }
    
    // 转换为前端聊天对象
    return chats.map(toFrontendChat);
  } catch (error) {
    logService.error('获取AI聊天列表失败', error);
    throw error;
  }
};

/**
 * 获取AI聊天详情
 * @param {string} chatId 聊天ID
 * @returns {Promise<Object>} 聊天详情
 */
export const getChatById = async (chatId) => {
  try {
    // 查找聊天
    const realm = await realmService.getRealm();
    const chat = realm.objectForPrimaryKey('AIChat', chatId);
    
    if (!chat) {
      throw new Error(`聊天不存在: ${chatId}`);
    }
    
    // 转换为前端聊天对象
    return toFrontendChat(chat);
  } catch (error) {
    logService.error(`获取AI聊天详情失败: ${chatId}`, error);
    throw error;
  }
};
