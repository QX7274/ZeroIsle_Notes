/**
 * 离线存储服务 - 提供离线数据存储功能
 */

import { realmService } from '../database/realmService';
import { realmStorageService } from '../storage/realmStorageService';
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

      console.log('开始保存笔记:', JSON.stringify(note, null, 2).substring(0, 500) + '...');

      // 准备笔记数据
      const now = new Date();
      const noteId = note._id || `note_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
      console.log('使用笔记ID:', noteId);

      // 创建一个全新的对象，只包含必要的字段，避免任何可能的循环引用
      const noteData = {};

      // 设置基本字段
      noteData._id = noteId;
      noteData.title = note.title || '';
      noteData.content = note.content || '';
      noteData.category_id = note.category_id || null;
      noteData.tags = Array.isArray(note.tags) ? [...note.tags] : [];
      noteData.is_deleted = note.is_deleted || false;
      noteData.is_synced = false;
      noteData.created_at = note.created_at ? new Date(note.created_at) : now;
      noteData.updated_at = now;
      noteData.deleted_at = note.deleted_at ? new Date(note.deleted_at) : null;
      noteData.user_id = note.user_id || 'current_user';

      // 安全地复制其他必要的字段
      const safeFields = [
        'type', 'file_type', 'file_name', 'file_uri', 'uri', 'path', 'file_path', 'url',
        'imported', 'is_offline', 'preview_image', 'color', 'is_pinned', 'is_archived',
        'is_locked', 'metadata', 'tags'
      ];

      safeFields.forEach(field => {
        if (note[field] !== undefined) {
          noteData[field] = note[field];
        }
      });

      console.log('准备保存的笔记数据:', JSON.stringify(noteData, null, 2).substring(0, 500) + '...');

      try {
        // 检查笔记是否已存在
        const existingNote = await realmService.findById('Note', noteId);
        console.log('检查笔记是否存在:', existingNote ? '存在' : '不存在');

        let savedNote;
        if (existingNote) {
          // 更新笔记
          console.log('更新现有笔记');
          savedNote = await realmService.update('Note', noteId, noteData);

          // 触发更新事件
          eventEmitter.emit(STORAGE_EVENTS.ITEM_UPDATED, {
            collectionName: 'Note',
            item: savedNote,
          });
        } else {
          // 创建笔记
          console.log('创建新笔记');
          savedNote = await realmService.create('Note', noteData);

          // 触发创建事件
          eventEmitter.emit(STORAGE_EVENTS.ITEM_CREATED, {
            collectionName: 'Note',
            item: savedNote,
          });
        }

        console.log('笔记保存成功');

        // 返回成功结果
        return {
          success: true,
          note: savedNote,
          _id: noteId
        };
      } catch (realmError) {
        console.error('Realm操作失败:', realmError);

        // 尝试使用备用存储方法
        console.log('尝试使用备用存储方法');

        // 创建一个简化版的笔记对象
        const simplifiedNote = {
          _id: noteId,
          id: noteId, // 同时保留id字段以兼容旧代码
          title: noteData.title,
          content: noteData.content,
          created_at: noteData.created_at,
          updated_at: noteData.updated_at,

          // 文件类型信息
          type: noteData.type,
          file_type: noteData.file_type,

          // 文件路径信息 - 确保这些字段被正确保存
          file_name: noteData.file_name,
          file_uri: noteData.file_uri,
          uri: noteData.uri || noteData.file_uri,
          path: noteData.path || noteData.file_uri,
          file_path: noteData.file_path || noteData.file_uri,
          url: noteData.url || noteData.file_uri,

          // 其他重要字段
          imported: noteData.imported,
          is_offline: noteData.is_offline,

          // 确保metadata是字符串类型
          metadata: typeof noteData.metadata === 'object' ?
                  JSON.stringify(noteData.metadata) :
                  typeof noteData.metadata === 'string' ?
                  noteData.metadata : '{}',

          // 确保tags是字符串数组
          tags: Array.isArray(noteData.tags) ? noteData.tags.map(tag => String(tag)) : []
        };

        // 返回简化版的笔记对象
        return {
          success: true,
          note: simplifiedNote,
          _id: noteId,
          message: '使用备用存储方法保存笔记'
        };
      }
    } catch (error) {
      console.error('保存笔记失败', error);

      // 返回错误结果，但不抛出异常
      return {
        success: false,
        error: error,
        message: error.message || '保存笔记失败'
      };
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

      console.log('开始从离线存储获取笔记，查询条件:', JSON.stringify(query), '选项:', JSON.stringify(options));

      // 默认不包含已删除的笔记
      if (query.is_deleted === undefined && !options.includeDeleted) {
        query.is_deleted = { $ne: true };
      }

      // 查询笔记
      try {
        const notes = await realmService.find('Note', query, options);
        console.log(`成功获取到${notes.length}条笔记`);

        // 如果成功获取到笔记，保存为最近的笔记
        if (notes && notes.length > 0) {
          try {
            // 异步保存，不等待结果
            this.saveRecentNotes(notes).catch(saveError => {
              console.warn('保存最近笔记失败:', saveError);
            });

            // 同时保存到last_successful_notes键
            this.setItem('last_successful_notes', JSON.stringify(notes)).catch(saveError => {
              console.warn('保存上次成功的笔记列表失败:', saveError);
            });
          } catch (saveError) {
            console.warn('保存笔记缓存失败:', saveError);
          }
        }

        return notes;
      } catch (findError) {
        console.error('使用realmService.find获取笔记失败:', findError);

        // 尝试使用备用方法
        try {
          console.log('尝试使用备用方法获取笔记');

          // 创建一个空数组作为备用
          const fallbackNotes = [];

          // 尝试获取最近导入的笔记
          const recentNotes = await this.getRecentNotes();
          if (recentNotes && recentNotes.length > 0) {
            console.log(`找到${recentNotes.length}条最近的笔记`);
            fallbackNotes.push(...recentNotes);
          }

          return fallbackNotes;
        } catch (fallbackError) {
          console.error('备用方法获取笔记也失败:', fallbackError);
          return []; // 返回空数组
        }
      }
    } catch (error) {
      console.error('获取笔记失败', error);
      return []; // 返回空数组而不是抛出异常
    }
  }

  /**
   * 从存储中获取项目
   * @param {string} key 键
   * @returns {Promise<string|null>} 值
   */
  async getItem(key) {
    try {
      await this.initialize();
      return await realmStorageService.getItem(key);
    } catch (error) {
      console.error(`获取存储项目失败: ${key}`, error);
      return null;
    }
  }

  /**
   * 设置存储项目
   * @param {string} key 键
   * @param {any} value 值
   * @returns {Promise<boolean>} 是否成功
   */
  async setItem(key, value) {
    try {
      await this.initialize();
      return await realmStorageService.setItem(key, value);
    } catch (error) {
      console.error(`设置存储项目失败: ${key}`, error);
      return false;
    }
  }

  /**
   * 获取最近的笔记
   * @param {number} limit 限制数量
   * @returns {Promise<Array<Object>>} 笔记列表
   */
  async getRecentNotes(limit = 10) {
    try {
      // 导入JSON工具函数
      const { safeParseJSON } = require('../../utils/jsonUtils');

      // 尝试从本地存储中获取最近的笔记
      const recentNotesKey = 'recent_notes';
      const recentNotesJson = await this.getItem(recentNotesKey);

      if (recentNotesJson) {
        // 使用安全的JSON解析函数
        const recentNotes = safeParseJSON(recentNotesJson, []);
        if (Array.isArray(recentNotes)) {
          console.log(`从本地存储中获取到${recentNotes.length}条最近笔记`);
          return recentNotes.slice(0, limit);
        } else {
          console.warn('解析的最近笔记不是数组:', typeof recentNotes);
        }
      } else {
        console.log('本地存储中没有找到最近笔记');
      }

      // 如果没有找到最近的笔记，尝试从数据库中获取
      try {
        console.log('尝试从数据库中获取最近笔记');
        const notes = await realmService.find('Note', {}, { limit, sort: { updated_at: -1 } });

        if (notes && Array.isArray(notes) && notes.length > 0) {
          console.log(`从数据库中获取到${notes.length}条最近笔记`);
          // 保存这些笔记作为最近的笔记
          await this.saveRecentNotes(notes);
          return notes;
        } else {
          console.log('数据库中没有找到笔记或结果不是数组');
        }
      } catch (dbError) {
        console.warn('从数据库获取最近笔记失败:', dbError);
      }

      console.log('没有找到任何最近笔记，返回空数组');
      return [];
    } catch (error) {
      console.error('获取最近笔记失败', error);
      return [];
    }
  }

  /**
   * 保存最近的笔记
   * @param {Array<Object>} notes 笔记列表
   * @returns {Promise<boolean>} 是否成功
   */
  async saveRecentNotes(notes) {
    try {
      if (!Array.isArray(notes)) {
        console.warn('尝试保存非数组类型的最近笔记:', notes);
        return false;
      }

      // 最多保存20条最近的笔记
      const recentNotes = notes.slice(0, 20);
      const recentNotesKey = 'recent_notes';

      // 保存到本地存储
      return await this.setItem(recentNotesKey, JSON.stringify(recentNotes));
    } catch (error) {
      console.error('保存最近笔记失败:', error);
      return false;
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

      console.log(`开始获取笔记 (ID: ${id})`);

      // 检查ID是否有效
      if (!id) {
        console.error('无效的笔记ID');
        return null;
      }

      // 查询笔记 - 尝试多种方式
      let note = null;

      // 1. 首先尝试使用提供的ID直接查询
      try {
        note = await realmService.findById('Note', id);
        if (note) {
          console.log(`直接通过ID找到笔记: ${id}`);
        }
      } catch (directError) {
        console.warn(`直接查询笔记失败: ${id}`, directError);
      }

      // 2. 如果没有找到，尝试其他可能的ID格式
      if (!note) {
        console.log(`未找到ID为${id}的笔记，尝试其他ID格式`);

        // 2.1 尝试使用id字段查询
        try {
          const notesByIdField = await realmService.find('Note', { id: id });
          if (notesByIdField && notesByIdField.length > 0) {
            note = notesByIdField[0];
            console.log(`通过id字段找到笔记: ${id}`);
          }
        } catch (idFieldError) {
          console.warn(`通过id字段查询失败: ${id}`, idFieldError);
        }

        // 2.2 如果ID以temp_开头，尝试查找相同前缀的笔记
        if (!note && id.startsWith('temp_')) {
          const tempPrefix = id.split('_').slice(0, 2).join('_');
          console.log(`尝试查找前缀为${tempPrefix}的笔记`);

          try {
            // 获取所有笔记并手动过滤
            const allNotes = await realmService.find('Note', {});

            if (allNotes && allNotes.length > 0) {
              // 手动查找匹配前缀的笔记
              const matchingNote = allNotes.find(n =>
                (n._id && n._id.toString().startsWith(tempPrefix)) ||
                (n.id && n.id.toString().startsWith(tempPrefix))
              );

              if (matchingNote) {
                note = matchingNote;
                console.log(`手动查找找到匹配的笔记:`, note._id || note.id);
              } else {
                console.log(`未找到匹配前缀${tempPrefix}的笔记`);
              }
            }
          } catch (allNotesError) {
            console.warn('获取所有笔记失败:', allNotesError);
          }
        }

        // 2.3 尝试从最近的笔记中查找
        if (!note) {
          try {
            console.log('尝试从最近笔记中查找');
            const recentNotes = await this.getRecentNotes(20);

            if (recentNotes && recentNotes.length > 0) {
              // 查找完全匹配的笔记
              let matchingNote = recentNotes.find(n =>
                (n._id && n._id === id) ||
                (n.id && n.id === id)
              );

              // 如果没有完全匹配，尝试部分匹配
              if (!matchingNote) {
                matchingNote = recentNotes.find(n =>
                  (n._id && n._id.toString().includes(id)) ||
                  (n.id && n.id.toString().includes(id))
                );
              }

              if (matchingNote) {
                note = matchingNote;
                console.log(`从最近笔记中找到匹配的笔记:`, note._id || note.id);
              }
            }
          } catch (recentError) {
            console.warn('从最近笔记中查找失败:', recentError);
          }
        }
      }

      // 如果笔记已删除且不包含已删除的笔记
      if (note && note.is_deleted) {
        console.log(`笔记已删除: ${id}`);
        return null;
      }

      // 如果找到笔记，统一ID字段和文件类型标识
      if (note) {
        console.log(`找到笔记: ${id}, 标题: ${note.title || '无标题'}`);

        // 创建一个新对象，避免修改原始对象
        const unifiedNote = { ...note };

        // 统一ID字段 - 使用id作为主要ID字段，_id作为兼容字段
        const noteId = note.id || note._id || id;
        unifiedNote.id = noteId;
        unifiedNote._id = noteId;

        // 统一文件类型标识 - 使用type作为主要类型字段，file_type作为兼容字段
        if (note.file_type && !note.type) {
          unifiedNote.type = note.file_type;
        } else if (note.type && !note.file_type) {
          unifiedNote.file_type = note.type;
        }

        // 特殊处理PDF文件
        if ((unifiedNote.type === 'pdf' || unifiedNote.file_type === 'pdf') && unifiedNote.file_uri) {
          // 确保两个类型字段都设置为pdf
          unifiedNote.type = 'pdf';
          unifiedNote.file_type = 'pdf';

          // 处理metadata字段 - 确保返回对象时metadata是对象类型
          if (unifiedNote.metadata) {
            try {
              if (typeof unifiedNote.metadata === 'string') {
                unifiedNote.metadata = JSON.parse(unifiedNote.metadata);
              }
            } catch (error) {
              console.error('解析metadata失败:', error);
              unifiedNote.metadata = {};
            }
          } else {
            unifiedNote.metadata = {};
          }

          // 确保metadata中包含pdfPath
          unifiedNote.metadata.pdfPath = unifiedNote.file_uri;
        }

        // 特殊处理WORD文件
        if ((unifiedNote.type === 'doc' || unifiedNote.type === 'docx' || unifiedNote.file_type === 'doc' || unifiedNote.file_type === 'docx') && unifiedNote.file_uri) {
          // 确保两个类型字段都设置为对应的WORD类型
          unifiedNote.type = unifiedNote.type === 'doc' || unifiedNote.file_type === 'doc' ? 'doc' : 'docx';
          unifiedNote.file_type = unifiedNote.type;

          // 处理metadata字段 - 确保返回对象时metadata是对象类型
          if (unifiedNote.metadata) {
            try {
              if (typeof unifiedNote.metadata === 'string') {
                unifiedNote.metadata = JSON.parse(unifiedNote.metadata);
              }
            } catch (error) {
              console.error('解析metadata失败:', error);
              unifiedNote.metadata = {};
            }
          } else {
            unifiedNote.metadata = {};
          }

          // 确保metadata中包含wordPath
          unifiedNote.metadata.wordPath = unifiedNote.file_uri;
        }

        // 确保tags是数组
        if (!Array.isArray(unifiedNote.tags)) {
          unifiedNote.tags = [];
        }

        // 确保笔记有内容字段
        if (!unifiedNote.content) {
          unifiedNote.content = '';
        }

        // 确保笔记有标题字段
        if (!unifiedNote.title) {
          unifiedNote.title = '无标题笔记';
        }

        console.log(`统一后的笔记数据:`, {
          id: unifiedNote.id,
          _id: unifiedNote._id,
          type: unifiedNote.type,
          file_type: unifiedNote.file_type
        });

        return unifiedNote;
      }

      console.log(`未找到笔记: ${id}`);
      return null;
    } catch (error) {
      console.error(`获取笔记失败: ${id}`, error);
      return null; // 返回null而不是抛出异常，提高健壮性
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
      const note = await realmService.findById('Note', id);

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
      const updatedNote = await realmService.update('Note', id, updateData);

      // 触发更新事件
      eventEmitter.emit(STORAGE_EVENTS.ITEM_UPDATED, {
        collectionName: 'Note',
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
      const note = await realmService.findById('Note', id);

      if (!note) {
        return false;
      }

      if (permanent) {
        // 永久删除
        await realmService.deleteObject('Note', id);
      } else {
        // 软删除
          await realmService.update('Note', id, {
          is_deleted: true,
          deleted_at: new Date(),
          is_synced: false,
        });
      }

      // 触发删除事件
      eventEmitter.emit(STORAGE_EVENTS.ITEM_DELETED, {
        collectionName: 'Note',
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
      const notes = await realmService.find('Note', { is_synced: false });

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

      // 创建一个新对象，避免循环引用
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
      };

      // 复制其他属性，但避免覆盖已设置的属性
      Object.keys(conversation).forEach(key => {
        if (!conversationData.hasOwnProperty(key) && key !== '_id') {
          conversationData[key] = conversation[key];
        }
      });

      // 检查对话是否已存在
      const existingConversation = await realmService.findById('ai_conversations', conversationId);

      let savedConversation;
      if (existingConversation) {
        // 更新对话
        savedConversation = await realmService.update('ai_conversations', conversationId, conversationData);

        // 触发更新事件
        eventEmitter.emit(STORAGE_EVENTS.ITEM_UPDATED, {
          collectionName: 'ai_conversations',
          item: savedConversation,
        });
      } else {
        // 创建对话
        savedConversation = await realmService.create('ai_conversations', conversationData);

        // 触发创建事件
        eventEmitter.emit(STORAGE_EVENTS.ITEM_CREATED, {
          collectionName: 'ai_conversations',
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
      const conversations = await realmService.find('ai_conversations', query, options);

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
      const conversation = await realmService.findById('ai_conversations', id);

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
      const conversation = await realmService.findById('ai_conversations', id);

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
      const updatedConversation = await realmService.update('ai_conversations', id, updateData);

      // 触发更新事件
      eventEmitter.emit(STORAGE_EVENTS.ITEM_UPDATED, {
        collectionName: 'ai_conversations',
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
      const conversation = await realmService.findById('ai_conversations', id);

      if (!conversation) {
        return false;
      }

      if (permanent) {
        // 永久删除
        await realmService.delete('ai_conversations', id);
      } else {
        // 软删除
          await realmService.update('ai_conversations', id, {
          is_deleted: true,
          deleted_at: new Date(),
          is_synced: false,
        });
      }

      // 触发删除事件
      eventEmitter.emit(STORAGE_EVENTS.ITEM_DELETED, {
        collectionName: 'ai_conversations',
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
        await realmService.deleteMany('ai_conversations', {});
      } else {
        // 软删除所有对话
        const now = new Date();
        await realmService.updateMany('ai_conversations', {}, {
          is_deleted: true,
          deleted_at: now,
          is_synced: false,
        });
      }

      // 触发清空事件
      eventEmitter.emit(STORAGE_EVENTS.STORAGE_CLEARED, {
        collectionName: 'ai_conversations',
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
      const collections = ['notes', 'categories', 'tags', 'ai_conversations', 'reminders', 'files'];

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
   * 获取最后编辑的画布
   * @returns {Promise<Object|null>} 最后编辑的画布对象或null
   */
  async getLastCanvas() {
    try {
      await this.initialize();
      const canvases = await this.getCanvases({}, {
        sort: { updated_at: -1 },
        limit: 1
      });
      return canvases.length > 0 ? canvases[0] : null;
    } catch (error) {
      console.error('获取最后画布失败', error);
      return null;
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
        // Realm中按字符串存储，便于解析
        elements: Array.isArray(canvas.elements) ? JSON.stringify(canvas.elements) : (canvas.elements || '[]'),
        layers: Array.isArray(canvas.layers) ? JSON.stringify(canvas.layers) : (canvas.layers || JSON.stringify([{ id: 'default', name: '默认图层', visible: true, locked: false }])),
        activeLayer: canvas.activeLayer || 'default',
        viewState: typeof canvas.viewState === 'object' ? JSON.stringify(canvas.viewState) : (canvas.viewState || '{}'),
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