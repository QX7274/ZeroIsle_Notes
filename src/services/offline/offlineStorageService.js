/**
 * 离线存储服务 - 提供离线数据存储功能
 */

import { realmService } from '../database/realmService';

import { eventEmitter } from '../utils/eventEmitter';

// 存储事件
export const STORAGE_EVENTS = {
  STORAGE_INITIALIZED: 'storage:initialized',
  STORAGE_ERROR: 'storage:error',
  ITEM_CREATED: 'storage:item_created',
  ITEM_UPDATED: 'storage:item_updated',
  ITEM_DELETED: 'storage:item_deleted',
  STORAGE_CLEARED: 'storage:cleared',
};

/**
 * 离线存储服务类
 */
class OfflineStorageService {
  constructor() {
    this.initialized = false;
    this.initializationPromise = null;
    this.isOfflineMode = false;
    this.isConnected = true;
    this.localProfile = null;
  }

  /**
   * 初始化离线存储服务
   */
  async initialize() {
    if (this.initialized) return Promise.resolve();

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = new Promise(async (resolve, reject) => {
      try {
        // 初始化Realm服务
        await realmService.initialize();

        this.initialized = true;
        console.info('离线存储服务初始化成功');

        // 触发初始化事件
        eventEmitter.emit(STORAGE_EVENTS.STORAGE_INITIALIZED);

        resolve();
      } catch (error) {
        console.error('离线存储服务初始化失败', error);

        // 触发错误事件
        eventEmitter.emit(STORAGE_EVENTS.STORAGE_ERROR, error);

        reject(error);
      }
    });

    return this.initializationPromise;
  }

  /**
   * 保存笔记
   * @param {Object} note 笔记数据
   * @returns {Promise<Object>} 保存的笔记
   */
  async saveNote(note) {
    try {
      await this.initialize();

      // 准备笔记数据
      const now = new Date();
      const noteId = note._id || `note_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;

      const noteData = {
        _id: noteId,
        title: note.title || '',
        content: note.content || '',
        category_id: note.category_id || null,
        tags: note.tags || [],
        is_deleted: note.is_deleted || false,
        is_synced: false,
        created_at: note.created_at || now,
        updated_at: now,
        deleted_at: note.deleted_at || null,
        user_id: note.user_id || 'current_user',
        ...note,
      };

      // 检查笔记是否已存在
      const existingNote = await realmService.findById('notes', noteId);

      let savedNote;
      if (existingNote) {
        // 更新笔记
        savedNote = await realmService.update('notes', noteId, noteData);

        // 触发更新事件
        eventEmitter.emit(STORAGE_EVENTS.ITEM_UPDATED, {
          collectionName: 'notes',
          item: savedNote,
        });
      } else {
        // 创建笔记
        savedNote = await realmService.create('notes', noteData);

        // 触发创建事件
        eventEmitter.emit(STORAGE_EVENTS.ITEM_CREATED, {
          collectionName: 'notes',
          item: savedNote,
        });
      }

      return savedNote;
    } catch (error) {
      console.error('保存笔记失败', error);
      throw error;
    }
  }

  /**
   * 保存多个笔记
   * @param {Array<Object>} notes 笔记数组
   * @returns {Promise<Array<Object>>} 保存的笔记数组
   */
  async saveNotes(notes) {
    try {
      await this.initialize();

      const savedNotes = [];

      for (const note of notes) {
        const savedNote = await this.saveNote(note);
        savedNotes.push(savedNote);
      }

      return savedNotes;
    } catch (error) {
      console.error('保存多个笔记失败', error);
      throw error;
    }
  }

  /**
   * 获取笔记
   * @param {Object} query 查询条件
   * @param {Object} options 选项
   * @returns {Promise<Array<Object>>} 笔记列表
   */
  async getNotes(query = {}, options = {}) {
    try {
      await this.initialize();

      // 默认不包含已删除的笔记
      if (query.is_deleted === undefined && !options.includeDeleted) {
        query.is_deleted = { $ne: true };
      }

      // 查询笔记
      const notes = await realmService.find('notes', query, options);

      return notes;
    } catch (error) {
      console.error('获取笔记失败', error);
      throw error;
    }
  }

  /**
   * 获取笔记
   * @param {string} id 笔记ID
   * @returns {Promise<Object|null>} 笔记
   */
  async getNote(id) {
    try {
      await this.initialize();

      // 查询笔记
      const note = await realmService.findById('notes', id);

      // 如果笔记已删除且不包含已删除的笔记
      if (note && note.is_deleted) {
        return null;
      }

      return note;
    } catch (error) {
      console.error(`获取笔记失败: ${id}`, error);
      throw error;
    }
  }

  /**
   * 更新笔记
   * @param {string} id 笔记ID
   * @param {Object} update 更新数据
   * @returns {Promise<Object|null>} 更新后的笔记
   */
  async updateNote(id, update) {
    try {
      await this.initialize();

      // 获取笔记
      const note = await realmService.findById('notes', id);

      if (!note) {
        return null;
      }

      // 准备更新数据
      const updateData = {
        ...update,
        updated_at: new Date(),
        is_synced: false,
      };

      // 更新笔记
      const updatedNote = await realmService.update('notes', id, updateData);

      // 触发更新事件
      eventEmitter.emit(STORAGE_EVENTS.ITEM_UPDATED, {
        collectionName: 'notes',
        item: updatedNote,
      });

      return updatedNote;
    } catch (error) {
      console.error(`更新笔记失败: ${id}`, error);
      throw error;
    }
  }

  /**
   * 删除笔记
   * @param {string} id 笔记ID
   * @param {boolean} permanent 是否永久删除
   * @returns {Promise<boolean>} 是否成功
   */
  async deleteNote(id, permanent = false) {
    try {
      await this.initialize();

      // 获取笔记
      const note = await realmService.findById('notes', id);

      if (!note) {
        return false;
      }

      if (permanent) {
        // 永久删除
        await realmService.delete('notes', id);
      } else {
        // 软删除
          await realmService.update('notes', id, {
          is_deleted: true,
          deleted_at: new Date(),
          is_synced: false,
        });
      }

      // 触发删除事件
      eventEmitter.emit(STORAGE_EVENTS.ITEM_DELETED, {
        collectionName: 'notes',
        itemId: id,
        permanent,
      });

      return true;
    } catch (error) {
      console.error(`删除笔记失败: ${id}`, error);
      throw error;
    }
  }

  /**
   * 获取未同步的笔记
   * @returns {Promise<Array<Object>>} 未同步的笔记数组
   */
  async getUnsyncedNotes() {
    try {
      await this.initialize();

      // 查询未同步的笔记
      const notes = await realmService.find('notes', { is_synced: false });

      return notes;
    } catch (error) {
      console.error('获取未同步的笔记失败', error);
      throw error;
    }
  }

  /**
   * 保存对话
   * @param {Object} conversation 对话数据
   * @returns {Promise<Object>} 保存的对话
   */
  async saveConversation(conversation) {
    try {
      await this.initialize();

      // 准备对话数据
      const now = new Date();
      const conversationId = conversation._id || `conversation_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;

      const conversationData = {
        _id: conversationId,
        title: conversation.title || '',
        messages: conversation.messages || [],
        is_deleted: conversation.is_deleted || false,
        is_synced: false,
        created_at: conversation.created_at || now,
        updated_at: now,
        deleted_at: conversation.deleted_at || null,
        user_id: conversation.user_id || 'current_user',
        ...conversation,
      };

      // 检查对话是否已存在
      const existingConversation = await realmService.findById('ai_chats', conversationId);

      let savedConversation;
      if (existingConversation) {
        // 更新对话
        savedConversation = await realmService.update('ai_chats', conversationId, conversationData);

        // 触发更新事件
        eventEmitter.emit(STORAGE_EVENTS.ITEM_UPDATED, {
          collectionName: 'ai_chats',
          item: savedConversation,
        });
      } else {
        // 创建对话
        savedConversation = await realmService.create('ai_chats', conversationData);

        // 触发创建事件
        eventEmitter.emit(STORAGE_EVENTS.ITEM_CREATED, {
          collectionName: 'ai_chats',
          item: savedConversation,
        });
      }

      return savedConversation;
    } catch (error) {
      console.error('保存对话失败', error);
      throw error;
    }
  }

  /**
   * 保存多个对话
   * @param {Array<Object>} conversations 对话数组
   * @returns {Promise<Array<Object>>} 保存的对话数组
   */
  async saveConversations(conversations) {
    try {
      await this.initialize();

      const savedConversations = [];

      for (const conversation of conversations) {
        const savedConversation = await this.saveConversation(conversation);
        savedConversations.push(savedConversation);
      }

      return savedConversations;
    } catch (error) {
      console.error('保存多个对话失败', error);
      throw error;
    }
  }

  /**
   * 获取对话
   * @param {Object} query 查询条件
   * @param {Object} options 选项
   * @returns {Promise<Array<Object>>} 对话列表
   */
  async getConversations(query = {}, options = {}) {
    try {
      await this.initialize();

      // 默认不包含已删除的对话
      if (query.is_deleted === undefined && !options.includeDeleted) {
        query.is_deleted = { $ne: true };
      }

      // 查询对话
      const conversations = await realmService.find('ai_chats', query, options);

      return conversations;
    } catch (error) {
      console.error('获取对话失败', error);
      throw error;
    }
  }

  /**
   * 获取对话
   * @param {string} id 对话ID
   * @returns {Promise<Object|null>} 对话
   */
  async getConversation(id) {
    try {
      await this.initialize();

      // 查询对话
      const conversation = await realmService.findById('ai_chats', id);

      // 如果对话已删除且不包含已删除的对话
      if (conversation && conversation.is_deleted) {
        return null;
      }

      return conversation;
    } catch (error) {
      console.error(`获取对话失败: ${id}`, error);
      throw error;
    }
  }

  /**
   * 更新对话
   * @param {string} id 对话ID
   * @param {Object} update 更新数据
   * @returns {Promise<Object|null>} 更新后的对话
   */
  async updateConversation(id, update) {
    try {
      await this.initialize();

      // 获取对话
      const conversation = await realmService.findById('ai_chats', id);

      if (!conversation) {
        return null;
      }

      // 准备更新数据
      const updateData = {
        ...update,
        updated_at: new Date(),
        is_synced: false,
      };

      // 更新对话
      const updatedConversation = await realmService.update('ai_chats', id, updateData);

      // 触发更新事件
      eventEmitter.emit(STORAGE_EVENTS.ITEM_UPDATED, {
        collectionName: 'ai_chats',
        item: updatedConversation,
      });

      return updatedConversation;
    } catch (error) {
      console.error(`更新对话失败: ${id}`, error);
      throw error;
    }
  }

  /**
   * 删除对话
   * @param {string} id 对话ID
   * @param {boolean} permanent 是否永久删除
   * @returns {Promise<boolean>} 是否成功
   */
  async deleteConversation(id, permanent = false) {
    try {
      await this.initialize();

      // 获取对话
      const conversation = await realmService.findById('ai_chats', id);

      if (!conversation) {
        return false;
      }

      if (permanent) {
        // 永久删除
        await realmService.delete('ai_chats', id);
      } else {
        // 软删除
          await realmService.update('ai_chats', id, {
          is_deleted: true,
          deleted_at: new Date(),
          is_synced: false,
        });
      }

      // 触发删除事件
      eventEmitter.emit(STORAGE_EVENTS.ITEM_DELETED, {
        collectionName: 'ai_chats',
        itemId: id,
        permanent,
      });

      return true;
    } catch (error) {
      console.error(`删除对话失败: ${id}`, error);
      throw error;
    }
  }

  /**
   * 清空所有对话
   * @param {boolean} permanent 是否永久删除
   * @returns {Promise<boolean>} 是否成功
   */
  async clearConversations(permanent = false) {
    try {
      await this.initialize();

      if (permanent) {
        // 永久删除所有对话
        await realmService.deleteMany('ai_chats', {});
      } else {
        // 软删除所有对话
        const now = new Date();
        await realmService.updateMany('ai_chats', {}, {
          is_deleted: true,
          deleted_at: now,
          is_synced: false,
        });
      }

      // 触发清空事件
      eventEmitter.emit(STORAGE_EVENTS.STORAGE_CLEARED, {
        collectionName: 'ai_chats',
        permanent,
      });

      return true;
    } catch (error) {
      console.error('清空所有对话失败', error);
      throw error;
    }
  }

  /**
   * 获取最后更新时间
   * @returns {Promise<Date|null>} 最后更新时间
   */
  async getLastUpdateTime() {
    try {
      await this.initialize();

      // 查询同步信息
      const syncInfo = await realmService.findOne('sync_info', { entity_type: 'last_update' });

      return syncInfo ? new Date(syncInfo.updated_at) : null;
    } catch (error) {
      console.error('获取最后更新时间失败', error);
      throw error;
    }
  }

  /**
   * 清空所有数据
   * @param {boolean} permanent 是否永久删除
   * @returns {Promise<boolean>} 是否成功
   */
  async clearAll(permanent = false) {
    try {
      await this.initialize();

      // 清空所有集合
      const collections = ['notes', 'categories', 'tags', 'ai_chats', 'reminders', 'files'];

      for (const collection of collections) {
        if (permanent) {
          // 永久删除所有数据
          await realmService.deleteMany(collection, {});
        } else {
          // 软删除所有数据
          const now = new Date();
          await realmService.updateMany(collection, {}, {
            is_deleted: true,
            deleted_at: now,
            is_synced: false,
          });
        }
      }

      // 触发清空事件
      eventEmitter.emit(STORAGE_EVENTS.STORAGE_CLEARED, {
        permanent,
      });

      return true;
    } catch (error) {
      console.error('清空所有数据失败', error);
      throw error;
    }
  }
  /**
   * 保存分类
   * @param {Object} category 分类数据
   * @returns {Promise<Object>} 保存的分类
   */
  async saveCategory(category) {
    try {
      await this.initialize();

      // 准备分类数据
      const now = new Date();
      const categoryId = category._id || `category_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;

      const categoryData = {
        _id: categoryId,
        name: category.name || '',
        description: category.description || '',
        color: category.color || '#CCCCCC',
        icon: category.icon || '',
        parent_id: category.parent_id || null,
        order: category.order || 0,
        is_default: category.is_default || false,
        is_favorite: category.is_favorite || false,
        is_archived: category.is_archived || false,
        is_deleted: category.is_deleted || false,
        is_synced: false,
        created_at: category.created_at || now,
        updated_at: now,
        deleted_at: category.deleted_at || null,
        user_id: category.user_id || 'current_user',
        ...category,
      };

      // 检查分类是否已存在
      const existingCategory = await realmService.findById('categories', categoryId);

      let savedCategory;
      if (existingCategory) {
        // 更新分类
        savedCategory = await realmService.update('categories', categoryId, categoryData);

        // 触发更新事件
        eventEmitter.emit(STORAGE_EVENTS.ITEM_UPDATED, {
          collectionName: 'categories',
          item: savedCategory,
        });
      } else {
        // 创建分类
        savedCategory = await realmService.create('categories', categoryData);

        // 触发创建事件
        eventEmitter.emit(STORAGE_EVENTS.ITEM_CREATED, {
          collectionName: 'categories',
          item: savedCategory,
        });
      }

      return savedCategory;
    } catch (error) {
      console.error('保存分类失败', error);
      throw error;
    }
  }

  /**
   * 获取分类
   * @param {Object} query 查询条件
   * @param {Object} options 选项
   * @returns {Promise<Array<Object>>} 分类列表
   */
  async getCategories(query = {}, options = {}) {
    try {
      await this.initialize();

      // 默认不包含已删除的分类
      if (query.is_deleted === undefined && !options.includeDeleted) {
        query.is_deleted = { $ne: true };
      }

      // 查询分类
      const categories = await realmService.find('categories', query, options);

      return categories;
    } catch (error) {
      console.error('获取分类失败', error);
      throw error;
    }
  }

  /**
   * 保存标签
   * @param {Object} tag 标签数据
   * @returns {Promise<Object>} 保存的标签
   */
  async saveTag(tag) {
    try {
      await this.initialize();

      // 准备标签数据
      const now = new Date();
      const tagId = tag._id || `tag_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;

      const tagData = {
        _id: tagId,
        name: tag.name || '',
        color: tag.color || '#CCCCCC',
        count: tag.count || 0,
        is_deleted: tag.is_deleted || false,
        is_synced: false,
        created_at: tag.created_at || now,
        updated_at: now,
        deleted_at: tag.deleted_at || null,
        user_id: tag.user_id || 'current_user',
        ...tag,
      };

      // 检查标签是否已存在
      const existingTag = await realmService.findById('tags', tagId);

      let savedTag;
      if (existingTag) {
        // 更新标签
        savedTag = await realmService.update('tags', tagId, tagData);

        // 触发更新事件
        eventEmitter.emit(STORAGE_EVENTS.ITEM_UPDATED, {
          collectionName: 'tags',
          item: savedTag,
        });
      } else {
        // 创建标签
        savedTag = await realmService.create('tags', tagData);

        // 触发创建事件
        eventEmitter.emit(STORAGE_EVENTS.ITEM_CREATED, {
          collectionName: 'tags',
          item: savedTag,
        });
      }

      return savedTag;
    } catch (error) {
      console.error('保存标签失败', error);
      throw error;
    }
  }

  /**
   * 获取标签
   * @param {Object} query 查询条件
   * @param {Object} options 选项
   * @returns {Promise<Array<Object>>} 标签列表
   */
  async getTags(query = {}, options = {}) {
    try {
      await this.initialize();

      // 默认不包含已删除的标签
      if (query.is_deleted === undefined && !options.includeDeleted) {
        query.is_deleted = { $ne: true };
      }

      // 查询标签
      const tags = await realmService.find('tags', query, options);

      return tags;
    } catch (error) {
      console.error('获取标签失败', error);
      throw error;
    }
  }

  /**
   * 获取画布
   * @param {string} canvasId 画布ID
   * @returns {Promise<Object|null>} 画布对象
   */
  async getCanvas(canvasId) {
    try {
      await this.initialize();

      // 查询画布
      const canvas = await realmService.findById('canvases', canvasId);

      // 如果画布已删除且不包含已删除的画布
      if (canvas && canvas.is_deleted) {
        return null;
      }

      return canvas;
    } catch (error) {
      console.error(`获取画布失败: ${canvasId}`, error);

      // 创建一个空画布
      return this._createEmptyCanvas(canvasId);
    }
  }

  /**
   * 获取画布（通过ID）
   * @param {string} id 画布ID
   * @returns {Promise<Object|null>} 画布对象
   */
  async getCanvasById(id) {
    return this.getCanvas(id);
  }

  /**
   * 获取所有画布
   * @param {Object} query 查询条件
   * @param {Object} options 选项
   * @returns {Promise<Array<Object>>} 画布列表
   */
  async getCanvases(query = {}, options = {}) {
    try {
      await this.initialize();

      // 默认不包含已删除的画布
      if (query.is_deleted === undefined && !options.includeDeleted) {
        query.is_deleted = { $ne: true };
      }

      // 查询画布
      const canvases = await realmService.find('canvases', query, options);

      return canvases;
    } catch (error) {
      console.error('获取所有画布失败', error);
      return [];
    }
  }

  /**
   * 保存画布
   * @param {Object} canvas 画布对象
   * @returns {Promise<Object>} 保存的画布
   */
  async saveCanvas(canvas) {
    try {
      await this.initialize();

      // 准备画布数据
      const now = new Date();
      const canvasId = canvas._id || canvas.id || `canvas_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;

      const canvasData = {
        _id: canvasId,
        id: canvasId,
        title: canvas.title || '新画布',
        description: canvas.description || '',
        elements: canvas.elements || [],
        layers: canvas.layers || [{ id: 'default', name: '默认图层', visible: true, locked: false }],
        activeLayer: canvas.activeLayer || 'default',
        viewState: canvas.viewState || {},
        is_deleted: canvas.is_deleted || false,
        is_synced: false,
        created_at: canvas.created_at || canvas.createdAt || now,
        updated_at: now,
        deleted_at: canvas.deleted_at || null,
        user_id: canvas.user_id || 'current_user',
        ...canvas,
      };

      // 检查画布是否已存在
      const existingCanvas = await realmService.findById('canvases', canvasId);

      let savedCanvas;
      if (existingCanvas) {
        // 更新画布
        savedCanvas = await realmService.update('canvases', canvasId, canvasData);

        // 触发更新事件
        eventEmitter.emit(STORAGE_EVENTS.ITEM_UPDATED, {
          collectionName: 'canvases',
          item: savedCanvas,
        });
      } else {
        // 创建画布
        savedCanvas = await realmService.create('canvases', canvasData);

        // 触发创建事件
        eventEmitter.emit(STORAGE_EVENTS.ITEM_CREATED, {
          collectionName: 'canvases',
          item: savedCanvas,
        });
      }

      return savedCanvas;
    } catch (error) {
      console.error(`保存画布失败: ${canvas.id || canvas._id}`, error);
      throw error;
    }
  }

  /**
   * 创建空画布
   * @param {string} canvasId 画布ID
   * @returns {Object} 空画布对象
   * @private
   */
  _createEmptyCanvas(canvasId) {
    const now = new Date().toISOString();

    return {
      _id: canvasId,
      id: canvasId,
      title: '新画布',
      description: '',
      elements: [],
      layers: [{ id: 'default', name: '默认图层', visible: true, locked: false }],
      activeLayer: 'default',
      viewState: {},
      created_at: now,
      updated_at: now,
      is_empty: true,
    };
  }

  /**
   * 确保画布属性完全   * @param {Object} canvas 画布对象
   * @returns {Object} 完整的画布对象
   * @private
   */
  _ensureCanvasProperties(canvas) {
    if (!canvas) return this._createEmptyCanvas(Date.now().toString());

    return {
      _id: canvas._id || canvas.id,
      id: canvas.id || canvas._id,
      title: canvas.title || '新画布',
      description: canvas.description || '',
      elements: canvas.elements || [],
      layers: canvas.layers || [{ id: 'default', name: '默认图层', visible: true, locked: false }],
      activeLayer: canvas.activeLayer || 'default',
      viewState: canvas.viewState || {},
      created_at: canvas.created_at || canvas.createdAt || new Date().toISOString(),
      updated_at: canvas.updated_at || canvas.updatedAt || new Date().toISOString(),
    };
  }

  /**
   * 获取离线存储服务状态
   * @returns {Object} 状态对象
   */
  getStatus() {
    return {
      isOffline: this.isOfflineMode || !this.isConnected,
      isOfflineMode: this.isOfflineMode,
      isConnected: this.isConnected,
      initialized: this.initialized
    };
  }

  /**
   * 设置离线模式
   * @param {boolean} enabled 是否启用离线模式
   */
  setOfflineMode(enabled) {
    const oldValue = this.isOfflineMode;
    this.isOfflineMode = !!enabled;

    // 如果状态发生变化，触发事件
    if (oldValue !== this.isOfflineMode) {
      eventEmitter.emit('offlineModeChange', {
        type: 'offlineModeChange',
        isOffline: this.isOfflineMode || !this.isConnected,
        isOfflineMode: this.isOfflineMode
      });
    }
  }

  /**
   * 设置连接状态
   * @param {boolean} connected 是否已连接
   */
  setConnectionStatus(connected) {
    const oldValue = this.isConnected;
    this.isConnected = !!connected;

    // 如果状态发生变化，触发事件
    if (oldValue !== this.isConnected) {
      eventEmitter.emit('connectionChange', {
        type: 'connectionChange',
        isOffline: this.isOfflineMode || !this.isConnected,
        isConnected: this.isConnected
      });
    }
  }

  /**
   * 获取本地个人简介
   * @returns {Object|null} 本地个人简介
   */
  getLocalProfile() {
    return this.localProfile;
  }

  /**
   * 保存本地个人简介
   * @param {Object} profile 个人简介
   */
  saveLocalProfile(profile) {
    this.localProfile = profile;
    // 可以选择将其保存到持久化存储
    try {
      // 检查是否存在，如果存在则更新，否则创建
      const existingProfile = realmService.findById('user_profiles', 'local_profile');
      if (existingProfile) {
        realmService.update('user_profiles', 'local_profile', {
          profile: profile,
          updated_at: new Date()
        });
      } else {
        realmService.create('user_profiles', {
          _id: 'local_profile',
          profile: profile,
          updated_at: new Date()
        });
      }
    } catch (error) {
      console.warn('保存本地个人简介失败', error);
    }
  }

  /**
   * 同步个人简介到云端
   * @param {Object} profile 个人简介
   * @returns {Promise<boolean>} 是否成功
   */
  async syncProfile(profile) {
    // 如果处于离线模式，保存到本地
    if (this.isOfflineMode || !this.isConnected) {
      this.saveLocalProfile(profile);
      return false;
    }

    try {
      // 这里应该实现与云端的同步逻辑
      // 例如，调用API将个人简介同步到服务器
      console.log('同步个人简介到云端', profile);

      // 清除本地缓存的个人简介
      this.localProfile = null;

      return true;
    } catch (error) {
      console.error('同步个人简介失败', error);

      // 同步失败，保存到本地
      this.saveLocalProfile(profile);

      return false;
    }
  }

  /**
   * 添加存储事件监听器
   * @param {Function} listener 监听器函数
   * @returns {Function} 移除监听器的函数
   */
  addListener(listener) {
    // 为所有相关事件添加监听器
    const events = ['connectionChange', 'offlineModeChange', STORAGE_EVENTS.STORAGE_INITIALIZED, STORAGE_EVENTS.STORAGE_ERROR];

    const subscriptions = events.map(event => {
      eventEmitter.addListener(event, listener);
      return { event, listener };
    });

    // 返回一个函数，用于移除所有监听器
    return () => {
      subscriptions.forEach(({ event, listener }) => {
        eventEmitter.removeListener(event, listener);
      });
    };
  }

  /**
   * 移除存储事件监听器
   * @param {string} event 事件名称
   * @param {Function} listener 监听器函数
   */
  removeListener(event, listener) {
    eventEmitter.removeListener(event, listener);
  }
}

export const offlineStorageService = new OfflineStorageService();
export default offlineStorageService;

