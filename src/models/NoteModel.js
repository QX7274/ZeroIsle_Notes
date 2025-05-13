/**
 * 笔记模型类
 */

import BaseModel from './BaseModel';
import { logService } from '../services/utils/logService';

class NoteModel extends BaseModel {
  constructor(data = {}) {
    super(data, 'Note');
    
    this.title = data.title || '';
    this.content = data.content || '';
    this.type = data.type || 'text';
    this.tags = data.tags || [];
    this.category_id = data.category_id || null;
    this.color = data.color || null;
    this.is_favorite = data.is_favorite || false;
    this.is_archived = data.is_archived || false;
    this.is_deleted = data.is_deleted || false;
    this.is_synced = data.is_synced || false;
    this.created_at = data.created_at || null;
    this.updated_at = data.updated_at || null;
    this.deleted_at = data.deleted_at || null;
    this.user_id = data.user_id || null;
    this.metadata = data.metadata || {};
    this.file_path = data.file_path || null;
    this.file_size = data.file_size || null;
    this.file_type = data.file_type || null;
    this.thumbnail_path = data.thumbnail_path || null;
    this.version = data.version || 1;
    this.parent_id = data.parent_id || null;
  }

  /**
   * 添加标签
   * @param {string} tag 标签
   * @returns {NoteModel} 笔记模型
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
   * @returns {NoteModel} 笔记模型
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
   * 设置分类
   * @param {string} categoryId 分类ID
   * @returns {NoteModel} 笔记模型
   */
  setCategory(categoryId) {
    this.category_id = categoryId;
    this.isModified = true;
    this.modifiedFields.add('category_id');
    return this;
  }

  /**
   * 设置颜色
   * @param {string} color 颜色
   * @returns {NoteModel} 笔记模型
   */
  setColor(color) {
    this.color = color;
    this.isModified = true;
    this.modifiedFields.add('color');
    return this;
  }

  /**
   * 设置收藏状态
   * @param {boolean} isFavorite 是否收藏
   * @returns {NoteModel} 笔记模型
   */
  setFavorite(isFavorite) {
    this.is_favorite = isFavorite;
    this.isModified = true;
    this.modifiedFields.add('is_favorite');
    return this;
  }

  /**
   * 设置归档状态
   * @param {boolean} isArchived 是否归档
   * @returns {NoteModel} 笔记模型
   */
  setArchived(isArchived) {
    this.is_archived = isArchived;
    this.isModified = true;
    this.modifiedFields.add('is_archived');
    return this;
  }

  /**
   * 更新内容
   * @param {string} content 内容
   * @returns {NoteModel} 笔记模型
   */
  updateContent(content) {
    this.content = content;
    this.isModified = true;
    this.modifiedFields.add('content');
    return this;
  }

  /**
   * 更新标题
   * @param {string} title 标题
   * @returns {NoteModel} 笔记模型
   */
  updateTitle(title) {
    this.title = title;
    this.isModified = true;
    this.modifiedFields.add('title');
    return this;
  }

  /**
   * 更新元数据
   * @param {Object} metadata 元数据
   * @returns {NoteModel} 笔记模型
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
   * 更新文件信息
   * @param {Object} fileInfo 文件信息
   * @returns {NoteModel} 笔记模型
   */
  updateFileInfo(fileInfo) {
    const { path, size, type, thumbnailPath } = fileInfo;
    
    if (path) {
      this.file_path = path;
      this.modifiedFields.add('file_path');
    }
    
    if (size !== undefined) {
      this.file_size = size;
      this.modifiedFields.add('file_size');
    }
    
    if (type) {
      this.file_type = type;
      this.modifiedFields.add('file_type');
    }
    
    if (thumbnailPath) {
      this.thumbnail_path = thumbnailPath;
      this.modifiedFields.add('thumbnail_path');
    }
    
    this.isModified = true;
    
    return this;
  }

  /**
   * 增加版本号
   * @returns {NoteModel} 笔记模型
   */
  incrementVersion() {
    this.version += 1;
    this.isModified = true;
    this.modifiedFields.add('version');
    return this;
  }

  /**
   * 设置父笔记
   * @param {string} parentId 父笔记ID
   * @returns {NoteModel} 笔记模型
   */
  setParent(parentId) {
    this.parent_id = parentId;
    this.isModified = true;
    this.modifiedFields.add('parent_id');
    return this;
  }

  /**
   * 查找用户的笔记
   * @param {string} userId 用户ID
   * @param {Object} options 选项
   * @returns {Promise<Array<NoteModel>>} 笔记模型数组
   */
  static async findByUser(userId, options = {}) {
    try {
      const {
        limit = 50,
        skip = 0,
        sort = { updated_at: -1 },
        is_deleted = false,
        is_archived = false,
        is_favorite = null,
        category_id = null,
        type = null,
        tags = null,
        search = null,
      } = options;
      
      const filter = { user_id: userId, is_deleted };
      
      if (is_archived !== null) {
        filter.is_archived = is_archived;
      }
      
      if (is_favorite !== null) {
        filter.is_favorite = is_favorite;
      }
      
      if (category_id) {
        filter.category_id = category_id;
      }
      
      if (type) {
        filter.type = type;
      }
      
      if (tags) {
        filter.tags = { $in: Array.isArray(tags) ? tags : [tags] };
      }
      
      // 简单的搜索实现
      if (search) {
        const searchLower = search.toLowerCase();
        const notes = await this.find(filter);
        
        const filteredNotes = notes.filter(note => 
          note.title.toLowerCase().includes(searchLower) || 
          note.content.toLowerCase().includes(searchLower) ||
          note.tags.some(tag => tag.toLowerCase().includes(searchLower))
        );
        
        // 排序
        const sortField = Object.keys(sort)[0];
        const sortDirection = sort[sortField];
        
        filteredNotes.sort((a, b) => {
          if (sortDirection === 1) {
            return a[sortField] > b[sortField] ? 1 : -1;
          } else {
            return a[sortField] < b[sortField] ? 1 : -1;
          }
        });
        
        // 分页
        return filteredNotes.slice(skip, skip + limit);
      }
      
      return this.find(filter, { sort, limit, skip });
    } catch (error) {
      logService.error('查找用户笔记失败', error);
      throw error;
    }
  }

  /**
   * 查找分类的笔记
   * @param {string} categoryId 分类ID
   * @param {Object} options 选项
   * @returns {Promise<Array<NoteModel>>} 笔记模型数组
   */
  static async findByCategory(categoryId, options = {}) {
    try {
      const {
        limit = 50,
        skip = 0,
        sort = { updated_at: -1 },
        is_deleted = false,
        is_archived = false,
      } = options;
      
      const filter = {
        category_id: categoryId,
        is_deleted,
        is_archived,
      };
      
      return this.find(filter, { sort, limit, skip });
    } catch (error) {
      logService.error('查找分类笔记失败', error);
      throw error;
    }
  }

  /**
   * 查找标签的笔记
   * @param {string} tag 标签
   * @param {Object} options 选项
   * @returns {Promise<Array<NoteModel>>} 笔记模型数组
   */
  static async findByTag(tag, options = {}) {
    try {
      const {
        limit = 50,
        skip = 0,
        sort = { updated_at: -1 },
        is_deleted = false,
        is_archived = false,
        user_id = null,
      } = options;
      
      const filter = {
        tags: tag,
        is_deleted,
        is_archived,
      };
      
      if (user_id) {
        filter.user_id = user_id;
      }
      
      return this.find(filter, { sort, limit, skip });
    } catch (error) {
      logService.error('查找标签笔记失败', error);
      throw error;
    }
  }

  /**
   * 查找收藏的笔记
   * @param {string} userId 用户ID
   * @param {Object} options 选项
   * @returns {Promise<Array<NoteModel>>} 笔记模型数组
   */
  static async findFavorites(userId, options = {}) {
    try {
      const {
        limit = 50,
        skip = 0,
        sort = { updated_at: -1 },
        is_deleted = false,
        is_archived = false,
      } = options;
      
      const filter = {
        user_id: userId,
        is_favorite: true,
        is_deleted,
        is_archived,
      };
      
      return this.find(filter, { sort, limit, skip });
    } catch (error) {
      logService.error('查找收藏笔记失败', error);
      throw error;
    }
  }

  /**
   * 查找归档的笔记
   * @param {string} userId 用户ID
   * @param {Object} options 选项
   * @returns {Promise<Array<NoteModel>>} 笔记模型数组
   */
  static async findArchived(userId, options = {}) {
    try {
      const {
        limit = 50,
        skip = 0,
        sort = { updated_at: -1 },
        is_deleted = false,
      } = options;
      
      const filter = {
        user_id: userId,
        is_archived: true,
        is_deleted,
      };
      
      return this.find(filter, { sort, limit, skip });
    } catch (error) {
      logService.error('查找归档笔记失败', error);
      throw error;
    }
  }

  /**
   * 查找已删除的笔记
   * @param {string} userId 用户ID
   * @param {Object} options 选项
   * @returns {Promise<Array<NoteModel>>} 笔记模型数组
   */
  static async findDeleted(userId, options = {}) {
    try {
      const {
        limit = 50,
        skip = 0,
        sort = { deleted_at: -1 },
      } = options;
      
      const filter = {
        user_id: userId,
        is_deleted: true,
      };
      
      return this.find(filter, { sort, limit, skip });
    } catch (error) {
      logService.error('查找已删除笔记失败', error);
      throw error;
    }
  }

  /**
   * 查找最近更新的笔记
   * @param {string} userId 用户ID
   * @param {number} limit 限制数量
   * @returns {Promise<Array<NoteModel>>} 笔记模型数组
   */
  static async findRecent(userId, limit = 10) {
    try {
      const filter = {
        user_id: userId,
        is_deleted: false,
      };
      
      return this.find(filter, {
        sort: { updated_at: -1 },
        limit,
      });
    } catch (error) {
      logService.error('查找最近笔记失败', error);
      throw error;
    }
  }

  /**
   * 搜索笔记
   * @param {string} query 搜索关键词
   * @param {Object} options 选项
   * @returns {Promise<Array<NoteModel>>} 笔记模型数组
   */
  static async search(query, options = {}) {
    try {
      const {
        limit = 50,
        skip = 0,
        user_id = null,
        is_deleted = false,
        is_archived = null,
      } = options;
      
      const filter = { is_deleted };
      
      if (user_id) {
        filter.user_id = user_id;
      }
      
      if (is_archived !== null) {
        filter.is_archived = is_archived;
      }
      
      // 获取所有符合基本条件的笔记
      const notes = await this.find(filter);
      
      // 在内存中进行搜索
      const queryLower = query.toLowerCase();
      const results = notes.filter(note => 
        note.title.toLowerCase().includes(queryLower) || 
        note.content.toLowerCase().includes(queryLower) ||
        note.tags.some(tag => tag.toLowerCase().includes(queryLower))
      );
      
      // 计算相关性分数
      const scoredResults = results.map(note => {
        let score = 0;
        
        // 标题匹配得分高
        if (note.title.toLowerCase().includes(queryLower)) {
          score += 3;
        }
        
        // 内容匹配
        if (note.content.toLowerCase().includes(queryLower)) {
          score += 1;
        }
        
        // 标签匹配
        if (note.tags.some(tag => tag.toLowerCase().includes(queryLower))) {
          score += 2;
        }
        
        return { note, score };
      });
      
      // 按相关性排序
      scoredResults.sort((a, b) => b.score - a.score);
      
      // 分页
      return scoredResults
        .slice(skip, skip + limit)
        .map(item => item.note);
    } catch (error) {
      logService.error('搜索笔记失败', error);
      throw error;
    }
  }
}

// 设置集合名称
NoteModel.collectionName = 'Note';

export default NoteModel;
