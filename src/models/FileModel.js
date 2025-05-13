/**
 * 文件模型类
 */

import BaseModel from './BaseModel';
import { logService } from '../services/utils/logService';

class FileModel extends BaseModel {
  constructor(data = {}) {
    super(data, 'File');
    
    this.name = data.name || '';
    this.original_name = data.original_name || '';
    this.path = data.path || '';
    this.size = data.size || 0;
    this.mime_type = data.mime_type || '';
    this.extension = data.extension || '';
    this.type = data.type || 'other';
    this.hash = data.hash || null;
    this.thumbnail_path = data.thumbnail_path || null;
    this.metadata = data.metadata || {};
    this.storage_location = data.storage_location || 'local';
    this.cloud_path = data.cloud_path || null;
    this.cloud_provider = data.cloud_provider || null;
    this.user_id = data.user_id || null;
    this.note_id = data.note_id || null;
    this.is_deleted = data.is_deleted || false;
    this.is_synced = data.is_synced || false;
    this.created_at = data.created_at || null;
    this.updated_at = data.updated_at || null;
    this.deleted_at = data.deleted_at || null;
    this.last_accessed_at = data.last_accessed_at || null;
    this.is_public = data.is_public || false;
    this.public_url = data.public_url || null;
    this.expiry_date = data.expiry_date || null;
    this.tags = data.tags || [];
  }

  /**
   * 更新名称
   * @param {string} name 名称
   * @returns {FileModel} 文件模型
   */
  updateName(name) {
    this.name = name;
    this.isModified = true;
    this.modifiedFields.add('name');
    return this;
  }

  /**
   * 更新路径
   * @param {string} path 路径
   * @returns {FileModel} 文件模型
   */
  updatePath(path) {
    this.path = path;
    this.isModified = true;
    this.modifiedFields.add('path');
    return this;
  }

  /**
   * 更新缩略图路径
   * @param {string} thumbnailPath 缩略图路径
   * @returns {FileModel} 文件模型
   */
  updateThumbnailPath(thumbnailPath) {
    this.thumbnail_path = thumbnailPath;
    this.isModified = true;
    this.modifiedFields.add('thumbnail_path');
    return this;
  }

  /**
   * 更新元数据
   * @param {Object} metadata 元数据
   * @returns {FileModel} 文件模型
   */
  updateMetadata(metadata) {
    this.metadata = {
      ...this.metadata,
      ...metadata,
    };
    this.isModified = true;
    this.modifiedFields.add('metadata');
    return this;
  }

  /**
   * 更新云存储信息
   * @param {string} cloudPath 云存储路径
   * @param {string} cloudProvider 云存储提供商
   * @returns {FileModel} 文件模型
   */
  updateCloudStorage(cloudPath, cloudProvider) {
    this.cloud_path = cloudPath;
    this.cloud_provider = cloudProvider;
    this.storage_location = this.path ? 'both' : 'cloud';
    this.isModified = true;
    this.modifiedFields.add('cloud_path');
    this.modifiedFields.add('cloud_provider');
    this.modifiedFields.add('storage_location');
    return this;
  }

  /**
   * 关联笔记
   * @param {string} noteId 笔记ID
   * @returns {FileModel} 文件模型
   */
  linkNote(noteId) {
    this.note_id = noteId;
    this.isModified = true;
    this.modifiedFields.add('note_id');
    return this;
  }

  /**
   * 取消关联笔记
   * @returns {FileModel} 文件模型
   */
  unlinkNote() {
    this.note_id = null;
    this.isModified = true;
    this.modifiedFields.add('note_id');
    return this;
  }

  /**
   * 添加标签
   * @param {string} tag 标签
   * @returns {FileModel} 文件模型
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
   * @returns {FileModel} 文件模型
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
   * 设置公开访问
   * @param {boolean} isPublic 是否公开
   * @param {string} publicUrl 公开URL
   * @param {Date} expiryDate 过期日期
   * @returns {FileModel} 文件模型
   */
  setPublicAccess(isPublic, publicUrl = null, expiryDate = null) {
    this.is_public = isPublic;
    
    if (isPublic) {
      this.public_url = publicUrl;
      this.expiry_date = expiryDate;
    } else {
      this.public_url = null;
      this.expiry_date = null;
    }
    
    this.isModified = true;
    this.modifiedFields.add('is_public');
    this.modifiedFields.add('public_url');
    this.modifiedFields.add('expiry_date');
    
    return this;
  }

  /**
   * 更新访问时间
   * @returns {FileModel} 文件模型
   */
  updateAccessTime() {
    this.last_accessed_at = new Date();
    this.isModified = true;
    this.modifiedFields.add('last_accessed_at');
    return this;
  }

  /**
   * 查找用户的文件
   * @param {string} userId 用户ID
   * @param {Object} options 选项
   * @returns {Promise<Array<FileModel>>} 文件模型数组
   */
  static async findByUser(userId, options = {}) {
    try {
      const {
        limit = 50,
        skip = 0,
        sort = { created_at: -1 },
        is_deleted = false,
        type = null,
        extension = null,
        tags = null,
        search = null,
      } = options;
      
      const filter = { user_id: userId, is_deleted };
      
      if (type) {
        filter.type = type;
      }
      
      if (extension) {
        filter.extension = extension;
      }
      
      if (tags) {
        filter.tags = { $in: Array.isArray(tags) ? tags : [tags] };
      }
      
      // 简单的搜索实现
      if (search) {
        const searchLower = search.toLowerCase();
        const files = await this.find(filter);
        
        const filteredFiles = files.filter(file => 
          file.name.toLowerCase().includes(searchLower) || 
          file.original_name.toLowerCase().includes(searchLower) ||
          file.tags.some(tag => tag.toLowerCase().includes(searchLower))
        );
        
        // 排序
        const sortField = Object.keys(sort)[0];
        const sortDirection = sort[sortField];
        
        filteredFiles.sort((a, b) => {
          if (sortDirection === 1) {
            return a[sortField] > b[sortField] ? 1 : -1;
          } else {
            return a[sortField] < b[sortField] ? 1 : -1;
          }
        });
        
        // 分页
        return filteredFiles.slice(skip, skip + limit);
      }
      
      return this.find(filter, { sort, limit, skip });
    } catch (error) {
      logService.error('查找用户文件失败', error);
      throw error;
    }
  }

  /**
   * 查找笔记的文件
   * @param {string} noteId 笔记ID
   * @returns {Promise<Array<FileModel>>} 文件模型数组
   */
  static async findByNote(noteId) {
    try {
      return this.find({
        note_id: noteId,
        is_deleted: false,
      }, { sort: { created_at: -1 } });
    } catch (error) {
      logService.error('查找笔记文件失败', error);
      throw error;
    }
  }

  /**
   * 根据哈希查找文件
   * @param {string} hash 文件哈希
   * @param {string} userId 用户ID
   * @returns {Promise<FileModel|null>} 文件模型
   */
  static async findByHash(hash, userId = null) {
    try {
      const filter = {
        hash,
        is_deleted: false,
      };
      
      if (userId) {
        filter.user_id = userId;
      }
      
      return this.findOne(filter);
    } catch (error) {
      logService.error('根据哈希查找文件失败', error);
      throw error;
    }
  }

  /**
   * 查找最近访问的文件
   * @param {string} userId 用户ID
   * @param {number} limit 限制数量
   * @returns {Promise<Array<FileModel>>} 文件模型数组
   */
  static async findRecentlyAccessed(userId, limit = 10) {
    try {
      return this.find({
        user_id: userId,
        is_deleted: false,
        last_accessed_at: { $ne: null },
      }, {
        sort: { last_accessed_at: -1 },
        limit,
      });
    } catch (error) {
      logService.error('查找最近访问文件失败', error);
      throw error;
    }
  }

  /**
   * 查找大文件
   * @param {string} userId 用户ID
   * @param {number} minSize 最小大小（字节）
   * @param {number} limit 限制数量
   * @returns {Promise<Array<FileModel>>} 文件模型数组
   */
  static async findLargeFiles(userId, minSize = 1024 * 1024, limit = 10) {
    try {
      return this.find({
        user_id: userId,
        is_deleted: false,
        size: { $gte: minSize },
      }, {
        sort: { size: -1 },
        limit,
      });
    } catch (error) {
      logService.error('查找大文件失败', error);
      throw error;
    }
  }

  /**
   * 计算用户的存储使用量
   * @param {string} userId 用户ID
   * @returns {Promise<Object>} 存储使用量
   */
  static async calculateStorageUsage(userId) {
    try {
      const files = await this.find({
        user_id: userId,
        is_deleted: false,
      });
      
      let totalSize = 0;
      let count = 0;
      
      for (const file of files) {
        totalSize += file.size || 0;
        count++;
      }
      
      return { totalSize, count };
    } catch (error) {
      logService.error('计算存储使用量失败', error);
      throw error;
    }
  }

  /**
   * 搜索文件
   * @param {string} query 搜索关键词
   * @param {string} userId 用户ID
   * @param {Object} options 选项
   * @returns {Promise<Array<FileModel>>} 文件模型数组
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
      logService.error('搜索文件失败', error);
      throw error;
    }
  }
}

// 设置集合名称
FileModel.collectionName = 'File';

export default FileModel;
