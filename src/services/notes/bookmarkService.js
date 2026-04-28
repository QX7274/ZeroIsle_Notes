/**
 * 书签服务
 * 提供笔记书签的本地存储和管理功能
 */

import realmService from '../database/realmService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logService } from '../../utils/logService';

const STORAGE_KEY = 'note_bookmarks';

/**
 * 书签服务类
 */
class BookmarkService {
  constructor() {
    this.initialized = false;
    this.bookmarks = [];
  }

  /**
   * 初始化服务
   */
  async initialize() {
    if (this.initialized) {return;}

    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.bookmarks = JSON.parse(stored);
        logService.info(`书签服务初始化成功，共加载 ${this.bookmarks.length} 个书签`);
      } else {
        this.bookmarks = [];
        logService.info('书签服务初始化成功，无现有书签');
      }
      this.initialized = true;
    } catch (error) {
      logService.error('书签服务初始化失败', error);
      this.bookmarks = [];
      throw error;
    }
  }

  /**
   * 保存书签到存储
   */
  async save() {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.bookmarks));
      return true;
    } catch (error) {
      logService.error('保存书签失败', error);
      throw error;
    }
  }

  /**
   * 添加书签
   * @param {string} noteId 笔记ID
   * @param {number} pageNumber 页码
   * @param {Object} position 位置信息 {x, y}
   * @param {string} title 书签标题
   * @param {string} color 书签颜色
   * @returns {Promise<Object>} 新建的书签对象
   */
  async addBookmark(noteId, pageNumber = 1, position = null, title = '', color = '#FFD700') {
    try {
      await this.initialize();

      // 生成默认标题
      if (!title || title.trim() === '') {
        title = `书签 - 第${pageNumber}页`;
      }

      const newBookmark = {
        id: realmService.createObjectId(),
        noteId,
        pageNumber,
        position,
        title,
        color,
        timestamp: new Date().toISOString(),
      };

      this.bookmarks.push(newBookmark);
      await this.save();

      logService.info(`添加书签成功: ${title}`, { noteId, pageNumber });
      return newBookmark;
    } catch (error) {
      logService.error('添加书签失败', error);
      throw error;
    }
  }

  /**
   * 获取所有书签
   * @returns {Promise<Array>} 所有书签列表
   */
  async getAllBookmarks() {
    try {
      await this.initialize();
      // 返回书签副本，按时间倒序排序
      return [...this.bookmarks].sort((a, b) =>
        new Date(b.timestamp) - new Date(a.timestamp)
      );
    } catch (error) {
      logService.error('获取所有书签失败', error);
      throw error;
    }
  }

  /**
   * 获取特定笔记的书签
   * @param {string} noteId 笔记ID
   * @returns {Promise<Array>} 该笔记的书签列表
   */
  async getBookmarks(noteId) {
    try {
      await this.initialize();

      if (!noteId) {
        logService.warn('获取书签时未提供noteId');
        throw new Error('获取书签失败：noteId不能为空');
      }

      // 过滤出指定笔记的书签，按页码排序
      const noteBookmarks = this.bookmarks
        .filter(bookmark => bookmark.noteId === noteId)
        .sort((a, b) => a.pageNumber - b.pageNumber);

      logService.info(`获取笔记 ${noteId} 的书签，共 ${noteBookmarks.length} 个`);
      return noteBookmarks;
    } catch (error) {
      logService.error('获取书签失败', error);
      throw error;
    }
  }

  /**
   * 根据ID获取书签
   * @param {string} id 书签ID
   * @returns {Promise<Object|null>} 书签对象或null
   */
  async getBookmarkById(id) {
    try {
      await this.initialize();
      const bookmark = this.bookmarks.find(b => b.id === id);
      return bookmark || null;
    } catch (error) {
      logService.error('获取书签失败', error);
      throw error;
    }
  }

  /**
   * 更新书签
   * @param {string} id 书签ID
   * @param {Object} updates 要更新的字段
   * @returns {Promise<Object|null>} 更新后的书签对象或null
   */
  async updateBookmark(id, updates) {
    try {
      await this.initialize();

      const index = this.bookmarks.findIndex(b => b.id === id);
      if (index === -1) {
        logService.warn(`书签不存在: ${id}`);
        throw new Error(`书签不存在: ${id}`);
      }

      // 更新书签
      this.bookmarks[index] = {
        ...this.bookmarks[index],
        ...updates,
        id, // 确保ID不被更改
        timestamp: this.bookmarks[index].timestamp, // 保持原创建时间
        updatedAt: new Date().toISOString(), // 添加更新时间
      };

      await this.save();
      logService.info(`更新书签成功: ${id}`);
      return this.bookmarks[index];
    } catch (error) {
      logService.error('更新书签失败', error);
      throw error;
    }
  }

  /**
   * 删除书签
   * @param {string} id 书签ID
   * @returns {Promise<boolean>} 是否成功删除
   */
  async deleteBookmark(id) {
    try {
      await this.initialize();

      const initialLength = this.bookmarks.length;
      this.bookmarks = this.bookmarks.filter(b => b.id !== id);

      if (this.bookmarks.length === initialLength) {
        logService.warn(`书签不存在: ${id}`);
        throw new Error(`书签不存在: ${id}`);
      }

      await this.save();
      logService.info(`删除书签成功: ${id}`);
      return true;
    } catch (error) {
      logService.error('删除书签失败', error);
      throw error;
    }
  }

  /**
   * 清除特定笔记的所有书签
   * @param {string} noteId 笔记ID
   * @returns {Promise<number>} 删除的书签数量
   */
  async clearBookmarks(noteId) {
    try {
      await this.initialize();

      const initialLength = this.bookmarks.length;
      this.bookmarks = this.bookmarks.filter(b => b.noteId !== noteId);
      const deletedCount = initialLength - this.bookmarks.length;

      if (deletedCount > 0) {
        await this.save();
        logService.info(`清除笔记 ${noteId} 的 ${deletedCount} 个书签`);
      }

      return deletedCount;
    } catch (error) {
      logService.error('清除书签失败', error);
      throw error;
    }
  }

  /**
   * 清除所有书签
   * @returns {Promise<number>} 删除的书签数量
   */
  async clearAllBookmarks() {
    try {
      await this.initialize();

      const count = this.bookmarks.length;
      this.bookmarks = [];
      await this.save();

      logService.info(`清除所有书签，共 ${count} 个`);
      return count;
    } catch (error) {
      logService.error('清除所有书签失败', error);
      throw error;
    }
  }

  /**
   * 搜索书签
   * @param {string} query 搜索关键词
   * @returns {Promise<Array>} 匹配的书签列表
   */
  async searchBookmarks(query) {
    try {
      await this.initialize();

      if (!query || query.trim() === '') {
        throw new Error('搜索书签失败：query不能为空');
      }

      const lowerQuery = query.toLowerCase();
      const results = this.bookmarks.filter(bookmark =>
        bookmark.title.toLowerCase().includes(lowerQuery) ||
        bookmark.noteId.toLowerCase().includes(lowerQuery)
      );

      logService.info(`搜索书签 "${query}"，找到 ${results.length} 个结果`);
      return results;
    } catch (error) {
      logService.error('搜索书签失败', error);
      throw error;
    }
  }

  /**
   * 导出书签数据
   * @returns {Promise<string>} JSON格式的书签数据
   */
  async exportBookmarks() {
    try {
      await this.initialize();
      const data = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        bookmarks: this.bookmarks,
      };
      return JSON.stringify(data, null, 2);
    } catch (error) {
      logService.error('导出书签失败', error);
      throw error;
    }
  }

  /**
   * 导入书签数据
   * @param {string} jsonData JSON格式的书签数据
   * @param {boolean} merge 是否合并（true）还是替换（false）
   * @returns {Promise<number>} 导入的书签数量
   */
  async importBookmarks(jsonData, merge = true) {
    try {
      await this.initialize();

      const data = JSON.parse(jsonData);
      const importedBookmarks = data.bookmarks || [];

      if (!merge) {
        // 替换模式：清空现有书签
        this.bookmarks = importedBookmarks;
      } else {
        // 合并模式：添加新书签，跳过重复ID
        const existingIds = new Set(this.bookmarks.map(b => b.id));
        const newBookmarks = importedBookmarks.filter(b => !existingIds.has(b.id));
        this.bookmarks.push(...newBookmarks);
      }

      await this.save();
      logService.info(`导入书签成功，共 ${importedBookmarks.length} 个`);
      return importedBookmarks.length;
    } catch (error) {
      logService.error('导入书签失败', error);
      throw error;
    }
  }
}

// 导出单例
const bookmarkService = new BookmarkService();

module.exports = bookmarkService;
module.exports.default = bookmarkService;
module.exports.bookmarkService = bookmarkService;
module.exports.BookmarkService = BookmarkService;
export default bookmarkService;







