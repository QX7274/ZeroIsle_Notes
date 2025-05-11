/**
 * 简单存储服务
 * 使用AsyncStorage替代SQLite，避免数据库初始化问题
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import uuid from 'react-native-uuid';

// 存储键前缀
const STORAGE_KEYS = {
  NOTES: 'simple_storage_notes_',
  NOTES_LIST: 'simple_storage_notes_list',
  CATEGORIES: 'simple_storage_categories_',
  CATEGORIES_LIST: 'simple_storage_categories_list',
  TAGS: 'simple_storage_tags_',
  TAGS_LIST: 'simple_storage_tags_list',
  SETTINGS: 'simple_storage_settings_',
  USERS: 'simple_storage_users_',
  CURRENT_USER: 'simple_storage_current_user',
};

/**
 * 简单存储服务
 */
class SimpleStorageService {
  constructor() {
    this.isInitialized = false;
    this.currentUser = null;
  }

  /**
   * 初始化存储服务
   * @returns {Promise<boolean>}
   */
  async init() {
    try {
      console.log('初始化简单存储服务...');
      
      // 尝试获取当前用户
      const currentUserJson = await AsyncStorage.getItem(STORAGE_KEYS.CURRENT_USER);
      if (currentUserJson) {
        this.currentUser = JSON.parse(currentUserJson);
        console.log('已加载当前用户:', this.currentUser.username);
      }
      
      this.isInitialized = true;
      console.log('简单存储服务初始化成功');
      return true;
    } catch (error) {
      console.error('初始化简单存储服务失败:', error);
      // 即使失败也标记为已初始化，避免应用卡住
      this.isInitialized = true;
      return false;
    }
  }

  /**
   * 设置当前用户
   * @param {object} user - 用户对象
   */
  async setCurrentUser(user) {
    try {
      this.currentUser = user;
      await AsyncStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
      console.log('当前用户已设置:', user.username);
    } catch (error) {
      console.error('设置当前用户失败:', error);
    }
  }

  /**
   * 获取当前用户
   * @returns {object} 当前用户
   */
  getCurrentUser() {
    return this.currentUser;
  }

  /**
   * 获取当前用户ID
   * @returns {string} 用户ID
   */
  getCurrentUserId() {
    return this.currentUser?.id;
  }

  /**
   * 创建笔记
   * @param {object} noteData - 笔记数据
   * @returns {Promise<object>} 创建的笔记
   */
  async createNote(noteData) {
    try {
      const userId = this.getCurrentUserId();
      if (!userId) {
        throw new Error('未设置当前用户');
      }

      const now = new Date().toISOString();
      const noteId = noteData.id || uuid.v4();

      // 创建笔记对象
      const note = {
        id: noteId,
        user_id: userId,
        title: noteData.title || '新笔记',
        content: noteData.content || '',
        category_id: noteData.category_id || '',
        tags: noteData.tags || [],
        is_favorite: noteData.is_favorite || 0,
        is_deleted: noteData.is_deleted || 0,
        created_at: now,
        updated_at: now,
      };

      // 保存笔记
      await AsyncStorage.setItem(`${STORAGE_KEYS.NOTES}${noteId}`, JSON.stringify(note));

      // 更新笔记列表
      await this._addToList(STORAGE_KEYS.NOTES_LIST, noteId);

      console.log('笔记创建成功:', noteId);
      return note;
    } catch (error) {
      console.error('创建笔记失败:', error);
      throw error;
    }
  }

  /**
   * 获取笔记
   * @param {string} noteId - 笔记ID
   * @returns {Promise<object>} 笔记对象
   */
  async getNote(noteId) {
    try {
      const noteJson = await AsyncStorage.getItem(`${STORAGE_KEYS.NOTES}${noteId}`);
      if (!noteJson) {
        throw new Error(`找不到笔记: ${noteId}`);
      }
      return JSON.parse(noteJson);
    } catch (error) {
      console.error(`获取笔记失败 (ID: ${noteId}):`, error);
      throw error;
    }
  }

  /**
   * 获取所有笔记
   * @returns {Promise<Array>} 笔记列表
   */
  async getAllNotes() {
    try {
      const userId = this.getCurrentUserId();
      if (!userId) {
        return { success: false, message: '未设置当前用户', data: [] };
      }

      // 获取笔记ID列表
      const noteIds = await this._getList(STORAGE_KEYS.NOTES_LIST);
      
      // 如果没有笔记，返回空数组
      if (!noteIds || noteIds.length === 0) {
        return { success: true, data: [] };
      }

      // 获取所有笔记
      const notesPromises = noteIds.map(id => this.getNote(id).catch(() => null));
      const notes = await Promise.all(notesPromises);
      
      // 过滤掉null值和不属于当前用户的笔记
      const filteredNotes = notes
        .filter(note => note && note.user_id === userId && !note.is_deleted)
        .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

      return { success: true, data: filteredNotes };
    } catch (error) {
      console.error('获取所有笔记失败:', error);
      return { success: false, message: error.message, data: [] };
    }
  }

  /**
   * 更新笔记
   * @param {string} noteId - 笔记ID
   * @param {object} noteData - 笔记数据
   * @returns {Promise<object>} 更新后的笔记
   */
  async updateNote(noteId, noteData) {
    try {
      // 获取现有笔记
      const existingNote = await this.getNote(noteId);
      
      // 更新笔记
      const updatedNote = {
        ...existingNote,
        ...noteData,
        updated_at: new Date().toISOString(),
      };
      
      // 保存更新后的笔记
      await AsyncStorage.setItem(`${STORAGE_KEYS.NOTES}${noteId}`, JSON.stringify(updatedNote));
      
      console.log('笔记更新成功:', noteId);
      return updatedNote;
    } catch (error) {
      console.error(`更新笔记失败 (ID: ${noteId}):`, error);
      throw error;
    }
  }

  /**
   * 删除笔记
   * @param {string} noteId - 笔记ID
   * @returns {Promise<boolean>} 是否成功
   */
  async deleteNote(noteId) {
    try {
      // 标记为已删除
      await this.updateNote(noteId, { is_deleted: 1 });
      
      console.log('笔记已标记为删除:', noteId);
      return true;
    } catch (error) {
      console.error(`删除笔记失败 (ID: ${noteId}):`, error);
      throw error;
    }
  }

  /**
   * 添加ID到列表
   * @private
   * @param {string} listKey - 列表键
   * @param {string} id - 要添加的ID
   */
  async _addToList(listKey, id) {
    try {
      const list = await this._getList(listKey);
      if (!list.includes(id)) {
        list.push(id);
        await AsyncStorage.setItem(listKey, JSON.stringify(list));
      }
    } catch (error) {
      console.error(`添加到列表失败 (${listKey}):`, error);
    }
  }

  /**
   * 获取ID列表
   * @private
   * @param {string} listKey - 列表键
   * @returns {Promise<Array>} ID列表
   */
  async _getList(listKey) {
    try {
      const listJson = await AsyncStorage.getItem(listKey);
      return listJson ? JSON.parse(listJson) : [];
    } catch (error) {
      console.error(`获取列表失败 (${listKey}):`, error);
      return [];
    }
  }
}

export default new SimpleStorageService();
