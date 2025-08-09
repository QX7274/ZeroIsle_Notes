/**
 * 笔记服务 - 提供笔记的CRUD操作和相关功能
 * 使用Realm作为数据存储
 */

import { Alert } from 'react-native';
import { mongoDBService } from '../database/mongoDBAdapter';
import { offlineStorageService } from '../offline/offlineStorageService';
import { networkService } from '../network/networkService';
import { logService } from '../utils/logService';
import { fileService } from '../files/fileService';
import {
  findDocuments,
  findOneDocument,
  findDocumentById,
  createDocument,
  updateDocument,
  deleteDocument
} from '../database/realmQueries';

class NoteService {
  constructor() {
    this.initialized = false;
    this.initializationPromise = null;
    this.collection = 'notes';
  }

  /**
   * 初始化笔记服务
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
        logService.info('笔记服务初始化成功');
        resolve();
      } catch (error) {
        logService.error('笔记服务初始化失败', error);
        reject(error);
      }
    });

    return this.initializationPromise;
  }

  /**
   * 创建新笔记
   * @param {Object} noteData 笔记数据
   * @returns {Promise<Object>} 创建的笔记对象
   */
  async createNote(noteData) {
    try {
      await this.initialize();

      const now = new Date();

      // 严格遵循Note schema定义
      const note = {
        _id: noteData._id || new Realm.BSON.ObjectId(),
        title: String(noteData.title || ''),
        content: String(noteData.content || ''),
        type: String(noteData.type || 'text'),
        // 确保tags是字符串数组
        tags: Array.isArray(noteData.tags) ? noteData.tags.map(tag => String(tag)) : [],
        category_id: noteData.category_id ? new Realm.BSON.ObjectId(noteData.category_id) : null,
        is_deleted: Boolean(noteData.is_deleted || false),
        created_at: now,
        updated_at: now,
        is_synced: Boolean(noteData.is_synced || networkService.isOnline()),
        user_id: noteData.user_id ? new Realm.BSON.ObjectId(noteData.user_id) : null,

        // 文件相关字段严格匹配schema
        file_path: noteData.file_uri ? String(noteData.file_uri) :
                  noteData.file_path ? String(noteData.file_path) :
                  noteData.path ? String(noteData.path) :
                  noteData.uri ? String(noteData.uri) : null,

        file_type: noteData.file_type ? String(noteData.file_type) :
                  noteData.type ? String(noteData.type) : null,

        // metadata必须是字符串类型
        metadata: typeof noteData.metadata === 'object' ?
                JSON.stringify(noteData.metadata) :
                typeof noteData.metadata === 'string' ?
                noteData.metadata : '{}'
      };

      // 只保留schema中定义的字段
      const schemaFields = [
        '_id', 'title', 'content', 'type', 'tags', 'category_id',
        'is_deleted', 'created_at', 'updated_at', 'is_synced',
        'user_id', 'file_path', 'file_type', 'metadata'
      ];

      const finalNote = {};
      for (const field of schemaFields) {
        if (note[field] !== undefined) {
          // 严格类型检查
          if (field === 'file_path' || field === 'file_uri') {
            finalNote[field] = String(note[field] || '');
          } else {
            finalNote[field] = note[field];
          }
        }
      }

      // 调试日志
      logService.debug('准备创建Note对象', {
        data: finalNote,
        types: Object.entries(finalNote).map(([k, v]) => [k, typeof v])
      });

      // 使用优化的创建方法
      const createdNote = await createDocument('Note', finalNote);

      // 如果在线，同步到服务器
      if (networkService.isOnline()) {
        logService.info(`同步新创建的笔记(ID: ${createdNote._id})`);
        // 这里可以添加同步逻辑
      } else {
        // 离线模式：记录待同步操作
        logService.info(`笔记创建成功，将在联网时同步(ID: ${createdNote._id})`);
      }

      return createdNote;
    } catch (error) {
      logService.error('创建笔记失败', error);

      // 如果Realm创建失败，尝试使用离线存储
      try {
        const now = new Date();
        const note = {
          ...noteData,
          created_at: now,
          updated_at: now,
          is_deleted: false,
          is_synced: false,
        };

        note._id = await offlineStorageService.saveNote(note);
        return note;
      } catch (fallbackError) {
        logService.error('使用离线存储创建笔记失败', fallbackError);
        throw error; // 抛出原始错误
      }
    }
  }

  /**
   * 获取所有笔记
   * @param {Object} options 查询选项
   * @returns {Promise<Array>} 笔记列表
   */
  async getNotes(options = {}) {
    try {
      await this.initialize();

      const { filter = {}, sort = { updated_at: -1 }, limit = 0, skip = 0 } = options;

      // 默认不显示已删除的笔记
      const defaultFilter = { is_deleted: false, ...filter };

      // 使用优化的查询方法
      const notes = await findDocuments('Note', defaultFilter, {
        sort,
        limit: limit > 0 ? limit : undefined,
        skip: skip > 0 ? skip : undefined
      });

      // 如果在线，同步到服务器
      if (networkService.isOnline()) {
        // 找出未同步的笔记
        const unsyncedNotes = notes.filter(note => !note.is_synced);

        if (unsyncedNotes.length > 0) {
          logService.info(`同步 ${unsyncedNotes.length} 个未同步的笔记`);
          // 这里可以添加同步逻辑
        }
      }

      return notes;
    } catch (error) {
      logService.error('获取笔记列表失败', error);

      // 如果Realm查询失败，尝试从离线存储获取
      try {
        const { filter = {}, sort = { updated_at: -1 }, limit = 0, skip = 0 } = options;
        const defaultFilter = { is_deleted: false, ...filter };
        return await offlineStorageService.getNotes(defaultFilter, sort, limit, skip);
      } catch (fallbackError) {
        logService.error('从离线存储获取笔记失败', fallbackError);
        throw error; // 抛出原始错误
      }
    }
  }

  /**
   * 根据ID获取笔记
   * @param {string} noteId 笔记ID
   * @returns {Promise<Object>} 笔记对象
   */
  async getNoteById(noteId) {
    try {
      await this.initialize();

      // 使用优化的查询方法
      const note = await findDocumentById('Note', noteId);

      if (!note) {
        logService.warn(`未找到笔记(ID: ${noteId})`);
        return null;
      }

      // 如果在线且笔记未同步，同步到服务器
      if (networkService.isOnline() && !note.is_synced) {
        logService.info(`同步笔记(ID: ${noteId})`);
        // 这里可以添加同步逻辑
      }

      return note;
    } catch (error) {
      logService.error(`获取笔记(ID: ${noteId})失败`, error);

      // 如果Realm查询失败，尝试从离线存储获取
      try {
        return await offlineStorageService.getNoteById(noteId);
      } catch (fallbackError) {
        logService.error(`从离线存储获取笔记(ID: ${noteId})失败`, fallbackError);
        throw error; // 抛出原始错误
      }
    }
  }

  /**
   * 更新笔记
   * @param {string} noteId 笔记ID
   * @param {Object} updateData 更新数据
   * @returns {Promise<Object>} 更新后的笔记对象
   */
  async updateNote(noteId, updateData) {
    try {
      await this.initialize();

      // 添加更新时间
      const update = {
        ...updateData,
        updated_at: new Date(),
        is_synced: networkService.isOnline(), // 如果在线，标记为已同步
      };

      // 使用优化的更新方法
      const updatedNote = await updateDocument('Note', noteId, update);

      if (!updatedNote) {
        throw new Error(`笔记不存在(ID: ${noteId})`);
      }

      // 如果在线，同步到服务器
      if (networkService.isOnline()) {
        logService.info(`同步更新的笔记(ID: ${noteId})`);
        // 这里可以添加同步逻辑
      } else {
        // 离线模式：记录待同步操作
        logService.info(`笔记更新成功，将在联网时同步(ID: ${noteId})`);
      }

      return updatedNote;
    } catch (error) {
      logService.error(`更新笔记(ID: ${noteId})失败`, error);

      // 如果Realm更新失败，尝试使用离线存储
      try {
        const update = {
          ...updateData,
          updated_at: new Date(),
          is_synced: false,
        };

        const updatedNote = await offlineStorageService.updateNote(noteId, update);
        return updatedNote;
      } catch (fallbackError) {
        logService.error(`使用离线存储更新笔记(ID: ${noteId})失败`, fallbackError);
        throw error; // 抛出原始错误
      }
    }
  }

  /**
   * 删除笔记（软删除）
   * @param {string} noteId 笔记ID
   * @returns {Promise<boolean>} 是否成功
   */
  async deleteNote(noteId) {
    try {
      await this.initialize();

      const update = {
        is_deleted: true,
        updated_at: new Date(),
        is_synced: networkService.isOnline(), // 如果在线，标记为已同步
      };

      // 使用优化的更新方法
      const updatedNote = await updateDocument('Note', noteId, update);

      if (!updatedNote) {
        throw new Error(`笔记不存在(ID: ${noteId})`);
      }

      // 如果在线，同步到服务器
      if (networkService.isOnline()) {
        logService.info(`同步删除的笔记(ID: ${noteId})`);
        // 这里可以添加同步逻辑
      } else {
        // 离线模式：记录待同步操作
        logService.info(`笔记删除成功，将在联网时同步(ID: ${noteId})`);
      }

      return true;
    } catch (error) {
      logService.error(`删除笔记(ID: ${noteId})失败`, error);

      // 如果Realm更新失败，尝试使用离线存储
      try {
        const update = {
          is_deleted: true,
          updated_at: new Date(),
          is_synced: false,
        };

        await offlineStorageService.updateNote(noteId, update);
        return true;
      } catch (fallbackError) {
        logService.error(`使用离线存储删除笔记(ID: ${noteId})失败`, fallbackError);
        throw error; // 抛出原始错误
      }
    }
  }

  /**
   * 永久删除笔记
   * @param {string} noteId 笔记ID
   * @returns {Promise<boolean>} 是否成功
   */
  async permanentlyDeleteNote(noteId) {
    try {
      await this.initialize();

      // 使用优化的删除方法
      const success = await deleteDocument('Note', noteId);

      if (!success) {
        throw new Error(`笔记不存在(ID: ${noteId})`);
      }

      // 如果在线，同步到服务器
      if (networkService.isOnline()) {
        logService.info(`同步永久删除的笔记(ID: ${noteId})`);
        // 这里可以添加同步逻辑
      } else {
        // 离线模式：记录待同步操作
        logService.info(`笔记永久删除成功，将在联网时同步(ID: ${noteId})`);
      }

      return true;
    } catch (error) {
      logService.error(`永久删除笔记(ID: ${noteId})失败`, error);

      // 如果Realm删除失败，尝试使用离线存储
      try {
        await offlineStorageService.deleteNote(noteId);
        return true;
      } catch (fallbackError) {
        logService.error(`使用离线存储永久删除笔记(ID: ${noteId})失败`, fallbackError);
        throw error; // 抛出原始错误
      }
    }
  }

  /**
   * 同步笔记
   * @returns {Promise<Object>} 同步结果
   */
  async syncNotes() {
    // 此功能在syncService中实现
    return { success: true };
  }
}

export const noteService = new NoteService();