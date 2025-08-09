/**
 * Realm文件服务 - 提供文件在Realm数据库中的CRUD操作
 */

import Realm from 'realm';
import { v4 as uuidv4 } from 'uuid';
import { logService } from '../utils/logService';
import { realmService } from '../database/realmService';

// 文件模型定义
const FileSchema = {
  name: 'File',
  primaryKey: 'id',
  properties: {
    id: 'string',
    file_name: 'string',
    file_path: 'string',
    file_type: 'string',
    file_size: 'int',
    mime_type: 'string',
    note_id: 'string?',
    created_at: 'date',
    updated_at: 'date',
    is_deleted: 'bool',
    deleted_at: 'date?',
    tags: 'string[]',
    metadata: '{}'
  }
};

class RealmFileService {
  constructor() {
    this.realm = null;
    this.initialize();
  }

  /**
   * 初始化Realm文件服务
   */
  async initialize() {
    try {
      // 确保Realm服务已初始化
      await realmService.initialize();
      this.realm = realmService.getRealm();
      logService.info('Realm文件服务初始化成功');
    } catch (error) {
      logService.error('Realm文件服务初始化失败', error);
      throw error;
    }
  }

  /**
   * 创建文件记录
   * @param {Object} fileData 文件数据
   * @returns {Promise<Object>} 创建的文件记录
   */
  async createFile(fileData) {
    if (!this.realm) await this.initialize();

    return new Promise((resolve, reject) => {
      try {
        this.realm.write(() => {
          const file = this.realm.create('File', {
            id: uuidv4(),
            created_at: new Date(),
            updated_at: new Date(),
            is_deleted: false,
            ...fileData
          });
          logService.info(`创建文件记录: ${file.file_name}`);
          resolve(this.serializeFile(file));
        });
      } catch (error) {
        logService.error('创建文件记录失败', error);
        reject(error);
      }
    });
  }

  /**
   * 更新文件记录
   * @param {string} fileId 文件ID
   * @param {Object} updates 要更新的数据
   * @returns {Promise<Object>} 更新后的文件记录
   */
  async updateFile(fileId, updates) {
    if (!this.realm) await this.initialize();

    return new Promise((resolve, reject) => {
      try {
        this.realm.write(() => {
          const file = this.realm.objectForPrimaryKey('File', fileId);
          if (!file) {
            throw new Error(`文件不存在: ${fileId}`);
          }

          // 更新可修改的字段
          Object.keys(updates).forEach(key => {
            if (key !== 'id' && key in file) {
              file[key] = updates[key];
            }
          });

          // 更新修改时间
          file.updated_at = new Date();
          logService.info(`更新文件记录: ${file.file_name}`);
          resolve(this.serializeFile(file));
        });
      } catch (error) {
        logService.error('更新文件记录失败', error);
        reject(error);
      }
    });
  }

  /**
   * 删除文件记录（软删除）
   * @param {string} fileId 文件ID
   * @param {boolean} permanent 是否永久删除
   * @returns {Promise<boolean>} 是否删除成功
   */
  async deleteFile(fileId, permanent = false) {
    if (!this.realm) await this.initialize();

    return new Promise((resolve, reject) => {
      try {
        this.realm.write(() => {
          const file = this.realm.objectForPrimaryKey('File', fileId);
          if (!file) {
            throw new Error(`文件不存在: ${fileId}`);
          }

          if (permanent) {
            this.realm.delete(file);
            logService.info(`永久删除文件记录: ${file.file_name}`);
          } else {
            file.is_deleted = true;
            file.deleted_at = new Date();
            file.updated_at = new Date();
            logService.info(`软删除文件记录: ${file.file_name}`);
          }

          resolve(true);
        });
      } catch (error) {
        logService.error('删除文件记录失败', error);
        reject(error);
      }
    });
  }

  /**
   * 恢复已删除的文件记录
   * @param {string} fileId 文件ID
   * @returns {Promise<Object>} 恢复后的文件记录
   */
  async restoreFile(fileId) {
    if (!this.realm) await this.initialize();

    return new Promise((resolve, reject) => {
      try {
        this.realm.write(() => {
          const file = this.realm.objectForPrimaryKey('File', fileId);
          if (!file) {
            throw new Error(`文件不存在: ${fileId}`);
          }

          file.is_deleted = false;
          file.deleted_at = null;
          file.updated_at = new Date();
          logService.info(`恢复文件记录: ${file.file_name}`);
          resolve(this.serializeFile(file));
        });
      } catch (error) {
        logService.error('恢复文件记录失败', error);
        reject(error);
      }
    });
  }

  /**
   * 根据ID获取文件记录
   * @param {string} fileId 文件ID
   * @param {boolean} includeDeleted 是否包含已删除文件
   * @returns {Promise<Object>} 文件记录
   */
  async getFileById(fileId, includeDeleted = false) {
    if (!this.realm) await this.initialize();

    try {
      const file = this.realm.objectForPrimaryKey('File', fileId);
      if (!file || (!includeDeleted && file.is_deleted)) {
        return null;
      }
      return this.serializeFile(file);
    } catch (error) {
      logService.error('获取文件记录失败', error);
      throw error;
    }
  }

  /**
   * 根据笔记ID获取文件列表
   * @param {string} noteId 笔记ID
   * @param {boolean} includeDeleted 是否包含已删除文件
   * @returns {Promise<Array>} 文件列表
   */
  async getFilesByNoteId(noteId, includeDeleted = false) {
    if (!this.realm) await this.initialize();

    try {
      let files = this.realm.objects('File').filtered('note_id == $0', noteId);
      if (!includeDeleted) {
        files = files.filtered('is_deleted == false');
      }
      return this.serializeFiles(files);
    } catch (error) {
      logService.error('获取笔记文件列表失败', error);
      throw error;
    }
  }

  /**
   * 搜索文件
   * @param {string} keyword 搜索关键词
   * @param {Object} options 搜索选项
   * @returns {Promise<Array>} 匹配的文件列表
   */
  async searchFiles(keyword, options = {}) {
    if (!this.realm) await this.initialize();

    try {
      const { file_type, includeDeleted = false } = options;
      let files = this.realm.objects('File');

      // 应用过滤条件
      if (!includeDeleted) {
        files = files.filtered('is_deleted == false');
      }

      if (file_type) {
        files = files.filtered('file_type == $0', file_type);
      }

      // 关键词搜索
      if (keyword) {
        const lowerKeyword = keyword.toLowerCase();
        files = files.filtered('file_name CONTAINS[c] $0 OR file_type CONTAINS[c] $0', lowerKeyword);
      }

      return this.serializeFiles(files);
    } catch (error) {
      logService.error('搜索文件失败', error);
      throw error;
    }
  }

  /**
   * 获取所有文件
   * @param {boolean} includeDeleted 是否包含已删除文件
   * @returns {Promise<Array>} 文件列表
   */
  async getAllFiles(includeDeleted = false) {
    if (!this.realm) await this.initialize();

    try {
      let files = this.realm.objects('File');
      if (!includeDeleted) {
        files = files.filtered('is_deleted == false');
      }
      return this.serializeFiles(files);
    } catch (error) {
      logService.error('获取所有文件失败', error);
      throw error;
    }
  }

  /**
   * 序列化单个文件对象
   * @param {Object} file Realm文件对象
   * @returns {Object} 序列化后的文件对象
   */
  serializeFile(file) {
    if (!file) return null;

    return {
      id: file.id,
      file_name: file.file_name,
      file_path: file.file_path,
      file_type: file.file_type,
      file_size: file.file_size,
      mime_type: file.mime_type,
      note_id: file.note_id,
      created_at: file.created_at,
      updated_at: file.updated_at,
      is_deleted: file.is_deleted,
      deleted_at: file.deleted_at,
      tags: file.tags,
      metadata: file.metadata
    };
  }

  /**
   * 序列化文件对象数组
   * @param {Array} files Realm文件对象数组
   * @returns {Array} 序列化后的文件对象数组
   */
  serializeFiles(files) {
    return Array.from(files).map(file => this.serializeFile(file));
  }
}

export const realmFileService = new RealmFileService();