import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
// 创建一个安全的分析服务包装器，防止未定义错误
const safeAnalyticsService = {
  trackEvent: (eventName, params = {}) => {
    try {
      console.log(`[Analytics] 跟踪事件: ${eventName}`, params);
    } catch (error) {
      console.error('跟踪事件失败:', error);
    }
  },
  trackError: (error, context = {}) => {
    try {
      console.log('[Analytics] 跟踪错误:', error?.message || '未知错误', context);
    } catch (err) {
      console.error('跟踪错误失败:', err);
    }
  }
};
import { compressionService } from '../compression/compressionService';
import { STORAGE_KEYS } from '../../utils/constants/config';
// import { Platform } from 'react-native'; // 未使用，已注释
import DeviceInfo from 'react-native-device-info';

class OfflineStorageService {
  constructor() {
    this.isOnline = true;
    this.pendingOperations = [];
    this.syncInterval = 5 * 60 * 1000; // 5分钟
    this.timer = null;
    this.deviceId = null;
    this.listeners = [];
    this.offlineMode = false; // 是否手动开启离线模式
    this.lastSyncTime = null;
    this.syncStatus = 'idle'; // idle, syncing, error
    this.syncError = null;
    this.storageLimit = 100 * 1024 * 1024; // 100MB
    this.currentStorageUsage = 0;
  }

  async init() {
    try {
      // 获取设备ID
      this.deviceId = await DeviceInfo.getUniqueId();

      // 获取离线模式设置
      const settings = await this.getSettings();
      this.offlineMode = settings?.offlineMode || false;

      // 获取最后同步时间
      const lastSyncTimeStr = await AsyncStorage.getItem(STORAGE_KEYS.LAST_SYNC_TIME);
      this.lastSyncTime = lastSyncTimeStr ? new Date(lastSyncTimeStr) : null;

      // 初始化压缩服务
      await compressionService.init();

      // 监听网络状态
      NetInfo.addEventListener(state => {
        const wasOnline = this.isOnline;
        this.isOnline = state.isConnected && !this.offlineMode;

        // 网络状态变化通知
        if (wasOnline !== this.isOnline) {
          this.notifyListeners({ type: 'connectionChange', isOnline: this.isOnline });
        }

        // 如果恢复在线，尝试同步
        if (this.isOnline && !wasOnline) {
          this.syncPendingOperations();
        }
      });

      // 加载待处理的操作
      await this.loadPendingOperations();

      // 计算当前存储使用量
      await this.calculateStorageUsage();

      // 清理过期数据
      await this.cleanupExpiredData();

      // 启动同步定时器
      this.startSyncTimer();

      // 启动自动清理定时器
      this.startCleanupTimer();

      return true;
    } catch (error) {
      console.error('初始化离线存储服务失败:', error);
      safeAnalyticsService.trackError(error, { operation: 'init_offline_storage' });
      return false;
    }
  }

  // 获取应用设置
  async getSettings() {
    try {
      const settingsJson = await AsyncStorage.getItem(STORAGE_KEYS.SETTINGS);
      return settingsJson ? JSON.parse(settingsJson) : {};
    } catch (error) {
      console.error('获取设置失败:', error);
      return {};
    }
  }

  // 计算当前存储使用量
  async calculateStorageUsage() {
    try {
      // 获取所有键
      const keys = await AsyncStorage.getAllKeys();
      let totalSize = 0;

      // 计算每个键的大小
      for (const key of keys) {
        const value = await AsyncStorage.getItem(key);
        if (value) {
          // 估算字符串大小（2字节/字符）
          totalSize += value.length * 2;
        }
      }

      this.currentStorageUsage = totalSize;
      return totalSize;
    } catch (error) {
      console.error('计算存储使用量失败:', error);
      return 0;
    }
  }

  // 添加事件监听器
  addListener(listener) {
    if (typeof listener === 'function') {
      this.listeners.push(listener);
      return () => this.removeListener(listener);
    }
    return () => {};
  }

  // 移除事件监听器
  removeListener(listener) {
    this.listeners = this.listeners.filter(l => l !== listener);
  }

  // 通知所有监听器
  notifyListeners(event) {
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('通知监听器失败:', error);
      }
    });
  }

  // 设置离线模式
  async setOfflineMode(enabled) {
    try {
      this.offlineMode = enabled;

      // 更新网络状态
      const netInfo = await NetInfo.fetch();
      this.isOnline = netInfo.isConnected && !this.offlineMode;

      // 保存设置
      const settings = await this.getSettings();
      settings.offlineMode = enabled;
      await AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));

      // 通知监听器
      this.notifyListeners({
        type: 'offlineModeChange',
        offlineMode: enabled,
        isOnline: this.isOnline
      });

      return true;
    } catch (error) {
      console.error('设置离线模式失败:', error);
      return false;
    }
  }

  // 获取当前状态
  getStatus() {
    return {
      isOnline: this.isOnline,
      offlineMode: this.offlineMode,
      pendingOperationsCount: this.pendingOperations.length,
      lastSyncTime: this.lastSyncTime,
      syncStatus: this.syncStatus,
      syncError: this.syncError,
      storageUsage: {
        current: this.currentStorageUsage,
        limit: this.storageLimit,
        percentage: (this.currentStorageUsage / this.storageLimit) * 100
      }
    };
  }

  async saveNote(note) {
    try {
      // 检查存储限制
      if (this.currentStorageUsage >= this.storageLimit) {
        throw new Error('存储空间已满，无法保存笔记');
      }

      // 确保笔记有ID
      if (!note.id) {
        note.id = 'note_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11);
      }

      // 确保笔记有创建时间和更新时间
      if (!note.created_at) {
        note.created_at = new Date().toISOString();
      }

      // 添加设备ID和时间戳
      const noteWithMeta = {
        ...note,
        device_id: this.deviceId,
        updated_at: new Date().toISOString(),
        synced: false,
        is_offline: true // 标记为离线创建的笔记
      };

      // 保存到本地存储
      const notes = await this.getNotes();
      const index = notes.findIndex(n => n.id === note.id);

      // 计算大小变化
      let sizeChange = 0;
      const noteJson = JSON.stringify(noteWithMeta);

      if (index >= 0) {
        const oldNoteJson = JSON.stringify(notes[index]);
        sizeChange = (noteJson.length - oldNoteJson.length) * 2; // 2字节/字符
        notes[index] = noteWithMeta;
      } else {
        sizeChange = noteJson.length * 2; // 2字节/字符
        notes.push(noteWithMeta);
      }

      // 更新存储使用量
      this.currentStorageUsage += sizeChange;

      // 保存笔记
      await AsyncStorage.setItem(STORAGE_KEYS.NOTES_CACHE, JSON.stringify(notes));

      // 记录操作
      const operation = {
        type: 'save_note',
        data: noteWithMeta,
        timestamp: new Date().toISOString(),
        device_id: this.deviceId
      };
      await this.addPendingOperation(operation);

      // 通知监听器
      this.notifyListeners({
        type: 'noteSaved',
        note: noteWithMeta,
        pendingOperationsCount: this.pendingOperations.length
      });

      // 如果在线，尝试在后台同步，不阻塞当前操作
      if (this.isOnline) {
        this.trySyncInBackground();
      }

      return { success: true, note: noteWithMeta };
    } catch (error) {
      console.error('保存笔记失败:', error);
      safeAnalyticsService.trackError(error, { operation: 'save_note' });
      return { success: false, error: error.message };
    }
  }

  /**
   * 更新笔记的同步状态
   * @param {string} noteId - 笔记ID
   * @param {boolean} synced - 同步状态
   * @returns {Promise<Object>} - 更新结果
   */
  async updateNoteSync(noteId, synced) {
    try {
      // 获取所有笔记
      const notes = await this.getNotes();
      const index = notes.findIndex(n => n.id === noteId);

      if (index === -1) {
        return { success: false, error: '笔记不存在' };
      }

      // 更新同步状态
      notes[index].synced = synced;
      notes[index].updated_at = new Date().toISOString();

      // 保存更新后的笔记列表
      await AsyncStorage.setItem(STORAGE_KEYS.NOTES_CACHE, JSON.stringify(notes));

      // 通知监听器
      this.notifyListeners({
        type: 'noteSyncUpdated',
        noteId,
        synced
      });

      return { success: true };
    } catch (error) {
      console.error('更新笔记同步状态失败:', error);
      safeAnalyticsService.trackError(error, { operation: 'update_note_sync' });
      return { success: false, error: error.message };
    }
  }

  async deleteNote(noteId) {
    try {
      // 从本地存储中删除
      const notes = await this.getNotes();
      const noteToDelete = notes.find(n => n.id === noteId);

      if (!noteToDelete) {
        return { success: false, error: '笔记不存在' };
      }

      const filteredNotes = notes.filter(n => n.id !== noteId);

      // 计算大小变化
      const noteJson = JSON.stringify(noteToDelete);
      const sizeChange = -noteJson.length * 2; // 2字节/字符

      // 更新存储使用量
      this.currentStorageUsage += sizeChange;

      // 保存更新后的笔记列表
      await AsyncStorage.setItem(STORAGE_KEYS.NOTES_CACHE, JSON.stringify(filteredNotes));

      // 记录操作
      const operation = {
        type: 'delete_note',
        data: {
          id: noteId,
          device_id: this.deviceId,
          timestamp: new Date().toISOString()
        },
        timestamp: new Date().toISOString(),
        device_id: this.deviceId
      };
      await this.addPendingOperation(operation);

      // 通知监听器
      this.notifyListeners({
        type: 'noteDeleted',
        noteId,
        pendingOperationsCount: this.pendingOperations.length
      });

      // 如果在线，尝试在后台同步，不阻塞当前操作
      if (this.isOnline) {
        this.trySyncInBackground();
      }

      return { success: true };
    } catch (error) {
      console.error('删除笔记失败:', error);
      safeAnalyticsService.trackError(error, { operation: 'delete_note' });
      return { success: false, error: error.message };
    }
  }

  /**
   * 移动笔记到指定分类
   * @param {string} noteId - 笔记ID
   * @param {string} categoryId - 分类ID
   * @returns {Promise<Object>} - 移动结果
   */
  async moveNoteToCategory(noteId, categoryId) {
    try {
      // 获取所有笔记
      const notes = await this.getNotes();
      const noteIndex = notes.findIndex(note => note.id === noteId);

      if (noteIndex === -1) {
        return { success: false, error: '笔记不存在' };
      }

      // 更新笔记的分类
      notes[noteIndex].category_id = categoryId;
      notes[noteIndex].updated_at = new Date().toISOString();
      notes[noteIndex].synced = false;

      // 保存更新后的笔记列表
      await AsyncStorage.setItem(STORAGE_KEYS.NOTES_CACHE, JSON.stringify(notes));

      // 记录操作
      const operation = {
        type: 'update_note',
        data: notes[noteIndex],
        timestamp: new Date().toISOString(),
        device_id: this.deviceId
      };
      await this.addPendingOperation(operation);

      // 通知监听器
      this.notifyListeners({
        type: 'noteMoved',
        noteId,
        categoryId,
        pendingOperationsCount: this.pendingOperations.length
      });

      // 如果在线，尝试在后台同步，不阻塞当前操作
      if (this.isOnline) {
        this.trySyncInBackground();
      }

      return { success: true, note: notes[noteIndex] };
    } catch (error) {
      console.error('移动笔记失败:', error);
      safeAnalyticsService.trackError(error, { operation: 'move_note_to_category' });
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取所有分类
   * @returns {Promise<Object>} - 分类列表
   */
  async getCategories() {
    try {
      const categoriesJson = await AsyncStorage.getItem(STORAGE_KEYS.CATEGORIES);
      return {
        success: true,
        data: categoriesJson ? JSON.parse(categoriesJson) : []
      };
    } catch (error) {
      console.error('获取分类失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 创建分类
   * @param {Object} category - 分类对象
   * @returns {Promise<Object>} - 创建结果
   */
  async createCategory(category) {
    try {
      // 获取现有分类
      const categoriesResponse = await this.getCategories();
      let categories = [];

      if (categoriesResponse.success) {
        categories = categoriesResponse.data;
      }

      // 生成唯一ID
      const newCategory = {
        ...category,
        id: category.id || `category_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // 添加新分类
      categories.push(newCategory);

      // 保存分类列表
      await AsyncStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories));

      // 通知监听器
      this.notifyListeners({
        type: 'categoryCreated',
        category: newCategory
      });

      return { success: true, data: newCategory };
    } catch (error) {
      console.error('创建分类失败:', error);
      safeAnalyticsService.trackError(error, { operation: 'create_category' });
      return { success: false, error: error.message };
    }
  }

  async getNotes() {
    try {
      const notesJson = await AsyncStorage.getItem(STORAGE_KEYS.NOTES_CACHE);
      return notesJson ? JSON.parse(notesJson) : [];
    } catch (error) {
      console.error('获取笔记失败:', error);
      return [];
    }
  }

  async getUnsyncedNotes() {
    try {
      const notes = await this.getNotes();
      return notes.filter(note => note.synced === false);
    } catch (error) {
      console.error('获取未同步笔记失败:', error);
      return [];
    }
  }

  /**
   * 获取搜索历史记录
   * @param {string} scope - 搜索范围，可选值：'home', 'category', 'community'
   * @returns {Promise<Array>} - 搜索历史记录
   */
  async getSearchHistory(scope = 'home') {
    try {
      // 从本地存储获取搜索历史
      const historyKey = `${STORAGE_KEYS.SEARCH_HISTORY}_${scope}`;
      const historyJson = await AsyncStorage.getItem(historyKey);
      const history = historyJson ? JSON.parse(historyJson) : [];

      return history;
    } catch (error) {
      console.error('获取搜索历史失败:', error);
      return [];
    }
  }

  /**
   * 保存搜索历史记录
   * @param {string} query - 搜索关键词
   * @param {string} type - 搜索类型，如 'text', 'voice', 'image'
   * @param {string} scope - 搜索范围，可选值：'home', 'category', 'community'
   * @returns {Promise<boolean>} - 是否保存成功
   */
  async saveSearchHistory(query, type = 'text', scope = 'home') {
    try {
      if (!query) return false;

      // 从本地存储获取搜索历史
      const historyKey = `${STORAGE_KEYS.SEARCH_HISTORY}_${scope}`;
      const historyJson = await AsyncStorage.getItem(historyKey);
      const history = historyJson ? JSON.parse(historyJson) : [];

      // 检查是否已存在相同的查询
      const existingIndex = history.findIndex(item =>
        item.query.toLowerCase() === query.toLowerCase() && item.type === type
      );

      // 如果存在，移除旧记录
      if (existingIndex !== -1) {
        history.splice(existingIndex, 1);
      }

      // 添加新记录到开头
      history.unshift({
        query,
        type,
        timestamp: new Date().toISOString()
      });

      // 限制历史记录数量为20条
      const limitedHistory = history.slice(0, 20);

      // 保存到本地存储
      await AsyncStorage.setItem(historyKey, JSON.stringify(limitedHistory));

      return true;
    } catch (error) {
      console.error('保存搜索历史失败:', error);
      return false;
    }
  }

  async saveCanvas(canvas) {
    try {
      if (!canvas || !canvas.id) {
        throw new Error('无效的画布数据');
      }

      // 保存到本地存储
      const canvases = await this.getCanvases();
      const index = canvases.findIndex(c => c.id === canvas.id);

      // 确保画布有创建时间和更新时间
      if (!canvas.createdAt) {
        canvas.createdAt = new Date().toISOString();
      }

      // 更新时间戳
      canvas.updatedAt = new Date().toISOString();

      // 更新或添加画布
      if (index >= 0) {
        canvases[index] = canvas;
      } else {
        canvases.push(canvas);
      }

      // 使用正确的存储键名 STORAGE_KEYS.CANVAS_CACHE
      await AsyncStorage.setItem(STORAGE_KEYS.CANVAS_CACHE, JSON.stringify(canvases));

      // 记录操作
      const operation = {
        type: 'save_canvas',
        data: canvas,
        timestamp: new Date().toISOString(),
      };
      await this.addPendingOperation(operation);

      // 如果在线，尝试在后台同步，不阻塞当前操作
      if (this.isOnline) {
        this.trySyncInBackground();
      }

      // 通知监听器
      this.notifyListeners({
        type: 'canvasSaved',
        canvas,
      });

      return { success: true, canvas };
    } catch (error) {
      console.error('保存画布失败:', error);
      safeAnalyticsService.trackError(error, { operation: 'save_canvas' });
      return { success: false, error: error.message };
    }
  }

  async deleteCanvas(canvasId) {
    try {
      if (!canvasId) {
        throw new Error('无效的画布ID');
      }

      // 从本地存储中删除
      const canvases = await this.getCanvases();
      const filteredCanvases = canvases.filter(c => c.id !== canvasId);
      await AsyncStorage.setItem(STORAGE_KEYS.CANVAS_CACHE, JSON.stringify(filteredCanvases));

      // 记录操作
      const operation = {
        type: 'delete_canvas',
        data: { id: canvasId },
        timestamp: new Date().toISOString(),
      };
      await this.addPendingOperation(operation);

      // 如果在线，尝试在后台同步，不阻塞当前操作
      if (this.isOnline) {
        this.trySyncInBackground();
      }

      // 通知监听器
      this.notifyListeners({
        type: 'canvasDeleted',
        canvasId
      });

      return { success: true };
    } catch (error) {
      console.error('删除画布失败:', error);
      safeAnalyticsService.trackError(error, { operation: 'delete_canvas' });
      return { success: false, error: error.message };
    }
  }

  async getCanvases() {
    try {
      const canvasesJson = await AsyncStorage.getItem(STORAGE_KEYS.CANVAS_CACHE);
      return canvasesJson ? JSON.parse(canvasesJson) : [];
    } catch (error) {
      console.error('获取画布失败:', error);
      return [];
    }
  }

  async getLastCanvas() {
    try {
      const canvases = await this.getCanvases();
      if (canvases.length === 0) {
        return null;
      }

      // 按更新时间排序，获取最新的画布
      canvases.sort((a, b) => {
        const dateA = new Date(a.updatedAt || a.createdAt || 0);
        const dateB = new Date(b.updatedAt || b.createdAt || 0);
        return dateB - dateA;
      });

      return canvases[0];
    } catch (error) {
      console.error('获取最后画布失败:', error);
      return null;
    }
  }

  async getCanvasById(id) {
    try {
      const canvases = await this.getCanvases();
      return canvases.find(canvas => canvas.id === id) || null;
    } catch (error) {
      console.error(`获取画布(ID: ${id})失败:`, error);
      return null;
    }
  }

  /**
   * 获取指定ID的画布 (兼容方法，与getCanvasById功能相同)
   * @param {string} canvasId - 画布ID
   * @returns {Promise<Object|null>} - 画布对象或null
   */
  async getCanvas(canvasId) {
    try {
      // 防御性检查：确保canvasId不为null或undefined
      if (!canvasId) {
        console.warn('offlineStorageService.getCanvas: canvasId为null或undefined');
        return null;
      }

      // 使用安全的参数值
      const safeCanvasId = String(canvasId || '');

      // 确保getCanvasById方法存在
      if (typeof this.getCanvasById === 'function') {
        try {
          return await this.getCanvasById(safeCanvasId);
        } catch (getByIdError) {
          console.error(`offlineStorageService.getCanvasById调用失败:`, getByIdError);
          // 继续执行，尝试备选方案
        }
      } else {
        console.error('offlineStorageService.getCanvasById方法未定义，尝试备选方案');
      }

      // 备选方案：直接从存储中获取
      try {
        const canvases = await this.getCanvases();
        return canvases.find(canvas => canvas.id === safeCanvasId) || null;
      } catch (fallbackError) {
        console.error(`备选方案获取画布失败:`, fallbackError);
        return null;
      }
    } catch (error) {
      console.error(`offlineStorageService.getCanvas错误:`, error);
      return null;
    }
  }

  async addPendingOperation(operation) {
    this.pendingOperations.push(operation);
    await this.savePendingOperations();

    // 通知监听器
    this.notifyListeners({
      type: 'pendingOperationAdded',
      pendingOperationsCount: this.pendingOperations.length
    });
  }

  async savePendingOperations() {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.OFFLINE_OPERATIONS,
        JSON.stringify(this.pendingOperations)
      );
    } catch (error) {
      console.error('保存待处理操作失败:', error);
      safeAnalyticsService.trackError(error, { operation: 'save_pending_operations' });
    }
  }

  async loadPendingOperations() {
    try {
      const operationsJson = await AsyncStorage.getItem(STORAGE_KEYS.OFFLINE_OPERATIONS);
      this.pendingOperations = operationsJson ? JSON.parse(operationsJson) : [];
    } catch (error) {
      console.error('加载待处理操作失败:', error);
      safeAnalyticsService.trackError(error, { operation: 'load_pending_operations' });
      this.pendingOperations = [];
    }
  }

  /**
   * 同步操作到服务器
   * @param {Array} operations - 待同步的操作列表
   * @returns {Promise<Object>} - 同步结果
   */
  async syncOperationsToServer(operations) {
    if (!operations || operations.length === 0) {
      return { successCount: 0, failedCount: 0, failedOperations: [] };
    }

    try {
      // 按操作类型分组
      const operationsByType = operations.reduce((acc, op) => {
        if (!acc[op.type]) acc[op.type] = [];
        acc[op.type].push(op);
        return acc;
      }, {});

      const results = {
        successCount: 0,
        failedCount: 0,
        failedOperations: []
      };

      // 同步笔记操作
      if (operationsByType.save_note) {
        const noteResults = await this.syncNotes(operationsByType.save_note);
        results.successCount += noteResults.successCount;
        results.failedCount += noteResults.failedCount;
        results.failedOperations = [...results.failedOperations, ...noteResults.failedOperations];
      }

      // 同步删除笔记操作
      if (operationsByType.delete_note) {
        const deleteResults = await this.syncDeleteNotes(operationsByType.delete_note);
        results.successCount += deleteResults.successCount;
        results.failedCount += deleteResults.failedCount;
        results.failedOperations = [...results.failedOperations, ...deleteResults.failedOperations];
      }

      // 同步画布操作
      if (operationsByType.save_canvas) {
        const canvasResults = await this.syncCanvases(operationsByType.save_canvas);
        results.successCount += canvasResults.successCount;
        results.failedCount += canvasResults.failedCount;
        results.failedOperations = [...results.failedOperations, ...canvasResults.failedOperations];
      }

      // 同步删除画布操作
      if (operationsByType.delete_canvas) {
        const deleteCanvasResults = await this.syncDeleteCanvases(operationsByType.delete_canvas);
        results.successCount += deleteCanvasResults.successCount;
        results.failedCount += deleteCanvasResults.failedCount;
        results.failedOperations = [...results.failedOperations, ...deleteCanvasResults.failedOperations];
      }

      // 记录同步结果
      safeAnalyticsService.trackEvent('sync_operations', {
        totalCount: operations.length,
        successCount: results.successCount,
        failedCount: results.failedCount
      });

      return results;
    } catch (error) {
      console.error('同步操作到服务器失败:', error);
      safeAnalyticsService.trackError(error, { operation: 'sync_operations_to_server' });
      return {
        successCount: 0,
        failedCount: operations.length,
        failedOperations: operations,
        error: error.message
      };
    }
  }

  /**
   * 同步笔记到服务器
   * @param {Array} noteOperations - 笔记操作列表
   * @returns {Promise<Object>} - 同步结果
   */
  async syncNotes(noteOperations) {
    const results = {
      successCount: 0,
      failedCount: 0,
      failedOperations: []
    };

    try {
      // 按批次同步，每批10个
      const batchSize = 10;
      const batches = [];

      for (let i = 0; i < noteOperations.length; i += batchSize) {
        batches.push(noteOperations.slice(i, i + batchSize));
      }

      for (const batch of batches) {
        try {
          // 构建请求数据
          const notesData = batch.map(op => op.data);

          // 发送到服务器
          // 实际实现中应该调用API服务
          // const response = await apiService.post('/notes/sync', { notes: notesData });

          // 模拟API调用
          await new Promise(resolve => setTimeout(resolve, 300));
          const mockResponse = {
            success: true,
            results: notesData.map(note => ({
              id: note.id,
              success: Math.random() > 0.1, // 90%成功率
              synced: true
            }))
          };

          // 处理响应
          for (let i = 0; i < batch.length; i++) {
            const result = mockResponse.results[i];
            if (result.success) {
              results.successCount++;

              // 更新本地笔记的同步状态
              const notes = await this.getNotes();
              const noteIndex = notes.findIndex(n => n.id === result.id);
              if (noteIndex >= 0) {
                notes[noteIndex].synced = true;
                await AsyncStorage.setItem(STORAGE_KEYS.NOTES_CACHE, JSON.stringify(notes));
              }
            } else {
              results.failedCount++;
              results.failedOperations.push(batch[i]);
            }
          }
        } catch (error) {
          // 批次同步失败，将整个批次标记为失败
          results.failedCount += batch.length;
          results.failedOperations.push(...batch);
          console.error('同步笔记批次失败:', error);
        }
      }

      return results;
    } catch (error) {
      console.error('同步笔记失败:', error);
      return {
        successCount: 0,
        failedCount: noteOperations.length,
        failedOperations: noteOperations
      };
    }
  }

  /**
   * 同步删除笔记操作到服务器
   * @param {Array} deleteOperations - 删除笔记操作列表
   * @returns {Promise<Object>} - 同步结果
   */
  async syncDeleteNotes(deleteOperations) {
    const results = {
      successCount: 0,
      failedCount: 0,
      failedOperations: []
    };

    try {
      // 提取要删除的笔记ID
      const noteIds = deleteOperations.map(op => op.data.id);

      // 发送到服务器
      // 实际实现中应该调用API服务
      // const response = await apiService.post('/notes/delete-batch', { ids: noteIds });

      // 模拟API调用
      await new Promise(resolve => setTimeout(resolve, 200));
      const mockResponse = {
        success: true,
        results: noteIds.map(id => ({
          id,
          success: Math.random() > 0.1 // 90%成功率
        }))
      };

      // 处理响应
      for (let i = 0; i < deleteOperations.length; i++) {
        const result = mockResponse.results[i];
        if (result.success) {
          results.successCount++;
        } else {
          results.failedCount++;
          results.failedOperations.push(deleteOperations[i]);
        }
      }

      return results;
    } catch (error) {
      console.error('同步删除笔记操作失败:', error);
      return {
        successCount: 0,
        failedCount: deleteOperations.length,
        failedOperations: deleteOperations
      };
    }
  }

  /**
   * 同步画布到服务器
   * @param {Array} canvasOperations - 画布操作列表
   * @returns {Promise<Object>} - 同步结果
   */
  async syncCanvases(canvasOperations) {
    // 实现类似syncNotes的逻辑
    return {
      successCount: canvasOperations.length,
      failedCount: 0,
      failedOperations: []
    };
  }

  /**
   * 同步删除画布操作到服务器
   * @param {Array} deleteOperations - 删除画布操作列表
   * @returns {Promise<Object>} - 同步结果
   */
  async syncDeleteCanvases(deleteOperations) {
    // 实现类似syncDeleteNotes的逻辑
    return {
      successCount: deleteOperations.length,
      failedCount: 0,
      failedOperations: []
    };
  }

  /**
   * 安全地尝试同步操作，不阻塞当前流程
   * 用于替代直接调用syncPendingOperations的场景
   */
  trySyncInBackground() {
    // 使用setTimeout将同步操作放到下一个事件循环，避免阻塞当前操作
    setTimeout(() => {
      if (this.isOnline && this.pendingOperations.length > 0) {
        this.syncPendingOperations().catch(err => {
          console.warn('后台同步操作失败，将在下次联网时重试:', err);
        });
      }
    }, 0);
  }

  /**
   * 保存离线笔记 - 专门为Redux createNote action设计
   * @param {Object} note - 笔记对象
   * @returns {Promise<Object>} - 保存结果
   */
  async saveOfflineNote(note) {
    try {
      console.log('保存离线笔记:', note.id || '新笔记');

      // 确保笔记有ID
      if (!note.id) {
        note.id = 'note_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11);
        console.log('为离线笔记生成ID:', note.id);
      }

      // 确保笔记有创建时间和更新时间
      const now = new Date().toISOString();
      if (!note.created_at && !note.createdAt) {
        note.created_at = now;
        note.createdAt = now;
      }
      if (!note.updated_at && !note.updatedAt) {
        note.updated_at = now;
        note.updatedAt = now;
      }

      // 添加设备ID和离线标记
      const noteWithMeta = {
        ...note,
        device_id: this.deviceId,
        synced: false,
        is_offline: true,
        is_synced: false
      };

      // 保存到本地存储
      const notes = await this.getNotes();
      const index = notes.findIndex(n => n.id === note.id);

      if (index >= 0) {
        notes[index] = noteWithMeta;
      } else {
        notes.push(noteWithMeta);
      }

      // 保存笔记
      await AsyncStorage.setItem(STORAGE_KEYS.NOTES_CACHE, JSON.stringify(notes));

      // 记录操作
      const operation = {
        type: 'save_note',
        data: noteWithMeta,
        timestamp: now,
        device_id: this.deviceId
      };
      await this.addPendingOperation(operation);

      // 通知监听器
      this.notifyListeners({
        type: 'noteSaved',
        note: noteWithMeta,
        pendingOperationsCount: this.pendingOperations.length
      });

      console.log('离线笔记保存成功:', noteWithMeta.id);
      return noteWithMeta;
    } catch (error) {
      console.error('保存离线笔记失败:', error);
      safeAnalyticsService.trackError(error, { operation: 'save_offline_note' });
      throw error; // 重新抛出错误，让调用者处理
    }
  }

  /**
   * 更新离线笔记 - 专门为Redux createNote action设计
   * @param {string} noteId - 笔记ID
   * @param {Object} updatedNote - 更新的笔记数据
   * @returns {Promise<Object>} - 更新结果
   */
  async updateOfflineNote(noteId, updatedNote) {
    try {
      console.log('更新离线笔记:', noteId);

      // 获取所有笔记
      const notes = await this.getNotes();
      const index = notes.findIndex(n => n.id === noteId);

      if (index === -1) {
        console.warn('要更新的离线笔记不存在:', noteId);
        return null;
      }

      // 更新笔记
      const now = new Date().toISOString();
      const updatedNoteWithMeta = {
        ...notes[index],
        ...updatedNote,
        updated_at: now,
        updatedAt: now,
        device_id: this.deviceId
      };

      notes[index] = updatedNoteWithMeta;

      // 保存更新后的笔记列表
      await AsyncStorage.setItem(STORAGE_KEYS.NOTES_CACHE, JSON.stringify(notes));

      // 通知监听器
      this.notifyListeners({
        type: 'noteUpdated',
        note: updatedNoteWithMeta
      });

      console.log('离线笔记更新成功:', noteId);
      return updatedNoteWithMeta;
    } catch (error) {
      console.error('更新离线笔记失败:', error);
      safeAnalyticsService.trackError(error, { operation: 'update_offline_note' });
      throw error; // 重新抛出错误，让调用者处理
    }
  }

  async syncPendingOperations() {
    // 如果不在线或没有待处理操作，则返回
    if (!this.isOnline || this.pendingOperations.length === 0) {
      return { success: true, synced: 0, message: '没有需要同步的操作' };
    }

    // 如果已经在同步中，则返回
    if (this.syncStatus === 'syncing') {
      return { success: false, error: '同步已在进行中' };
    }

    try {
      // 更新同步状态
      this.syncStatus = 'syncing';
      this.syncError = null;

      // 通知监听器
      this.notifyListeners({
        type: 'syncStarted',
        pendingOperationsCount: this.pendingOperations.length
      });

      // 同步到服务器
      const syncResults = await this.syncOperationsToServer(this.pendingOperations);

      // 处理同步结果
      const syncedCount = syncResults.successCount;

      // 同步成功后清空待处理操作
      this.pendingOperations = [];
      await this.savePendingOperations();

      // 更新同步状态
      this.syncStatus = 'idle';
      this.lastSyncTime = new Date();
      await AsyncStorage.setItem(STORAGE_KEYS.LAST_SYNC_TIME, this.lastSyncTime.toISOString());

      // 通知监听器
      this.notifyListeners({
        type: 'syncCompleted',
        synced: syncedCount,
        timestamp: this.lastSyncTime
      });

      return {
        success: true,
        synced: syncedCount,
        message: `成功同步 ${syncedCount} 个操作`
      };
    } catch (error) {
      // 更新同步状态
      this.syncStatus = 'error';
      this.syncError = error.message || '同步失败';

      // 通知监听器
      this.notifyListeners({
        type: 'syncError',
        error: this.syncError,
        pendingOperationsCount: this.pendingOperations.length
      });

      console.error('同步操作失败:', error);
      safeAnalyticsService.trackError(error, { operation: 'sync_operations' });

      return {
        success: false,
        error: this.syncError
      };
    }
  }

  // 手动触发同步
  async manualSync() {
    return await this.syncPendingOperations();
  }

  // 清除所有离线数据
  async clearOfflineData() {
    try {
      // 停止同步定时器
      this.stopSyncTimer();

      // 清除待处理操作
      this.pendingOperations = [];
      await AsyncStorage.removeItem(STORAGE_KEYS.OFFLINE_OPERATIONS);

      // 清除笔记缓存
      await AsyncStorage.removeItem(STORAGE_KEYS.NOTES_CACHE);

      // 清除画布缓存
      await AsyncStorage.removeItem(STORAGE_KEYS.CANVAS_CACHE);

      // 重新计算存储使用量
      await this.calculateStorageUsage();

      // 重启同步定时器
      this.startSyncTimer();

      // 通知监听器
      this.notifyListeners({
        type: 'offlineDataCleared'
      });

      return { success: true };
    } catch (error) {
      console.error('清除离线数据失败:', error);
      safeAnalyticsService.trackError(error, { operation: 'clear_offline_data' });
      return { success: false, error: error.message };
    }
  }

  startSyncTimer() {
    // 停止现有定时器
    this.stopSyncTimer();

    // 启动新定时器
    this.timer = setInterval(() => {
      if (this.isOnline && this.pendingOperations.length > 0) {
        // 使用trySyncInBackground代替直接调用syncPendingOperations
        this.trySyncInBackground();
      }
    }, this.syncInterval);
  }

  stopSyncTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  // 启动自动清理定时器
  startCleanupTimer() {
    // 清除现有定时器
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    // 设置新定时器 - 每天运行一次
    const oneDayMs = 24 * 60 * 60 * 1000;
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredData().catch(error => {
        console.error('自动清理失败:', error);
      });
    }, oneDayMs);
  }

  // 停止清理定时器
  stopCleanupTimer() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  // 清理过期数据
  async cleanupExpiredData() {
    try {
      console.log('开始清理过期数据...');

      // 如果存储使用量低于阈值，不需要清理
      if (this.currentStorageUsage < this.storageLimit * 0.8) {
        console.log('存储使用量未达到清理阈值，跳过清理');
        return { success: true, message: '存储使用量未达到清理阈值' };
      }

      // 获取所有笔记
      const notes = await this.getNotes();

      // 按最后访问时间排序
      notes.sort((a, b) => {
        const lastAccessedA = new Date(a.lastAccessed || a.updatedAt || a.createdAt);
        const lastAccessedB = new Date(b.lastAccessed || b.updatedAt || b.createdAt);
        return lastAccessedA - lastAccessedB; // 最早访问的排在前面
      });

      // 计算需要删除的数据量
      const targetSize = this.storageLimit * 0.7; // 目标是降低到70%
      const needToFree = this.currentStorageUsage - targetSize;

      if (needToFree <= 0) {
        console.log('不需要释放空间');
        return { success: true, message: '不需要释放空间' };
      }

      console.log(`需要释放约 ${(needToFree / 1024 / 1024).toFixed(2)}MB 空间`);

      // 标记要删除的笔记
      let freedSpace = 0;
      const notesToKeep = [];
      const notesToRemove = [];

      for (const note of notes) {
        // 如果笔记已同步且超过30天未访问，或者空间不足，则删除
        const lastAccessed = new Date(note.lastAccessed || note.updatedAt || note.createdAt);
        const daysSinceLastAccess = (Date.now() - lastAccessed) / (1000 * 60 * 60 * 24);

        // 计算笔记大小（估算）
        const noteSize = JSON.stringify(note).length * 2; // 2字节/字符

        if ((note.synced && daysSinceLastAccess > 30) || freedSpace < needToFree) {
          notesToRemove.push(note);
          freedSpace += noteSize;
        } else {
          notesToKeep.push(note);
        }

        // 如果已经释放足够空间，且剩余的都是最近访问的，则停止
        if (freedSpace >= needToFree && daysSinceLastAccess < 7) {
          notesToKeep.push(...notes.slice(notes.indexOf(note) + 1));
          break;
        }
      }

      // 保存剩余的笔记
      if (notesToRemove.length > 0) {
        console.log(`清理 ${notesToRemove.length} 个笔记，释放约 ${(freedSpace / 1024 / 1024).toFixed(2)}MB 空间`);

        // 使用压缩存储
        const compressedData = compressionService.compressAndEncrypt(notesToKeep);
        await AsyncStorage.setItem(STORAGE_KEYS.NOTES_CACHE, compressedData);

        // 更新存储使用量
        this.currentStorageUsage -= freedSpace;

        // 通知监听器
        this.notifyListeners({
          type: 'dataCleanup',
          removedCount: notesToRemove.length,
          freedSpace: freedSpace
        });

        return {
          success: true,
          message: `清理了 ${notesToRemove.length} 个笔记，释放了 ${(freedSpace / 1024 / 1024).toFixed(2)}MB 空间`
        };
      } else {
        console.log('没有需要清理的笔记');
        return { success: true, message: '没有需要清理的笔记' };
      }
    } catch (error) {
      console.error('清理过期数据失败:', error);
      safeAnalyticsService.trackError(error, { operation: 'cleanup_expired_data' });
      return { success: false, error: error.message };
    }
  }

  // 导出数据
  async exportData(options = {}) {
    try {
      const { includeNotes = true, includeCanvases = true, includeSettings = true } = options;

      // 收集要导出的数据
      const exportData = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        deviceId: this.deviceId,
      };

      // 导出笔记
      if (includeNotes) {
        const notes = await this.getNotes();
        exportData.notes = notes;
      }

      // 导出画布
      if (includeCanvases) {
        const canvases = await this.getCanvases();
        exportData.canvases = canvases;
      }

      // 导出设置
      if (includeSettings) {
        const settings = await this.getSettings();
        exportData.settings = settings;
      }

      // 压缩和加密数据
      const compressedData = compressionService.compressAndEncrypt(exportData);

      // 生成导出文件名
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `zeroislenotes_backup_${timestamp}.zib`;

      // 返回导出数据
      return {
        success: true,
        fileName,
        data: compressedData,
        summary: {
          notes: includeNotes ? (exportData.notes?.length || 0) : 0,
          canvases: includeCanvases ? (exportData.canvases?.length || 0) : 0,
          settings: includeSettings,
          timestamp: exportData.timestamp,
        }
      };
    } catch (error) {
      console.error('导出数据失败:', error);
      safeAnalyticsService.trackError(error, { operation: 'export_data' });
      return { success: false, error: error.message };
    }
  }

  // 导入数据
  async importData(importData, options = {}) {
    try {
      const {
        mergeStrategy = 'newer', // newer, overwrite, skip
        includeNotes = true,
        includeCanvases = true,
        includeSettings = true
      } = options;

      // 解密和解压缩数据
      const decompressedData = compressionService.decryptAndDecompress(importData);

      // 验证数据格式
      if (!decompressedData || !decompressedData.version || !decompressedData.timestamp) {
        throw new Error('无效的备份数据格式');
      }

      const results = {
        notes: { imported: 0, skipped: 0, merged: 0 },
        canvases: { imported: 0, skipped: 0, merged: 0 },
        settings: false,
      };

      // 导入笔记
      if (includeNotes && decompressedData.notes && decompressedData.notes.length > 0) {
        const currentNotes = await this.getNotes();
        const notesToSave = [...currentNotes];

        for (const importedNote of decompressedData.notes) {
          const existingNoteIndex = notesToSave.findIndex(n => n.id === importedNote.id);

          if (existingNoteIndex === -1) {
            // 笔记不存在，直接添加
            notesToSave.push({
              ...importedNote,
              imported: true,
              importedAt: new Date().toISOString(),
            });
            results.notes.imported++;
          } else {
            // 笔记已存在，根据合并策略处理
            const existingNote = notesToSave[existingNoteIndex];
            const existingDate = new Date(existingNote.updatedAt || existingNote.createdAt);
            const importedDate = new Date(importedNote.updatedAt || importedNote.createdAt);

            if (mergeStrategy === 'overwrite') {
              // 覆盖现有笔记
              notesToSave[existingNoteIndex] = {
                ...importedNote,
                imported: true,
                importedAt: new Date().toISOString(),
              };
              results.notes.merged++;
            } else if (mergeStrategy === 'newer' && importedDate > existingDate) {
              // 仅当导入的笔记更新时才覆盖
              notesToSave[existingNoteIndex] = {
                ...importedNote,
                imported: true,
                importedAt: new Date().toISOString(),
              };
              results.notes.merged++;
            } else {
              // 跳过导入
              results.notes.skipped++;
            }
          }
        }

        // 保存更新后的笔记
        const compressedNotes = compressionService.compressAndEncrypt(notesToSave);
        await AsyncStorage.setItem(STORAGE_KEYS.NOTES_CACHE, compressedNotes);
      }

      // 导入画布
      if (includeCanvases && decompressedData.canvases && decompressedData.canvases.length > 0) {
        const currentCanvases = await this.getCanvases();
        const canvasesToSave = [...currentCanvases];

        for (const importedCanvas of decompressedData.canvases) {
          const existingCanvasIndex = canvasesToSave.findIndex(c => c.id === importedCanvas.id);

          if (existingCanvasIndex === -1) {
            // 画布不存在，直接添加
            canvasesToSave.push({
              ...importedCanvas,
              imported: true,
              importedAt: new Date().toISOString(),
            });
            results.canvases.imported++;
          } else {
            // 画布已存在，根据合并策略处理
            const existingCanvas = canvasesToSave[existingCanvasIndex];
            const existingDate = new Date(existingCanvas.updatedAt || existingCanvas.createdAt);
            const importedDate = new Date(importedCanvas.updatedAt || importedCanvas.createdAt);

            if (mergeStrategy === 'overwrite') {
              // 覆盖现有画布
              canvasesToSave[existingCanvasIndex] = {
                ...importedCanvas,
                imported: true,
                importedAt: new Date().toISOString(),
              };
              results.canvases.merged++;
            } else if (mergeStrategy === 'newer' && importedDate > existingDate) {
              // 仅当导入的画布更新时才覆盖
              canvasesToSave[existingCanvasIndex] = {
                ...importedCanvas,
                imported: true,
                importedAt: new Date().toISOString(),
              };
              results.canvases.merged++;
            } else {
              // 跳过导入
              results.canvases.skipped++;
            }
          }
        }

        // 保存更新后的画布
        const compressedCanvases = compressionService.compressAndEncrypt(canvasesToSave);
        await AsyncStorage.setItem(STORAGE_KEYS.CANVAS_CACHE, compressedCanvases);
      }

      // 导入设置
      if (includeSettings && decompressedData.settings) {
        if (mergeStrategy === 'overwrite') {
          // 完全覆盖设置
          await AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(decompressedData.settings));
          results.settings = true;
        } else {
          // 合并设置
          const currentSettings = await this.getSettings();
          const mergedSettings = {
            ...currentSettings,
            ...decompressedData.settings,
            // 保留一些本地特定的设置
            deviceId: this.deviceId,
            offlineMode: currentSettings.offlineMode,
          };
          await AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(mergedSettings));
          results.settings = true;
        }
      }

      // 重新计算存储使用量
      await this.calculateStorageUsage();

      // 通知监听器
      this.notifyListeners({
        type: 'dataImported',
        results
      });

      return {
        success: true,
        results,
        message: `导入完成: ${results.notes.imported + results.notes.merged} 个笔记, ${results.canvases.imported + results.canvases.merged} 个画布`
      };
    } catch (error) {
      console.error('导入数据失败:', error);
      safeAnalyticsService.trackError(error, { operation: 'import_data' });
      return { success: false, error: error.message };
    }
  }
}

export const offlineStorageService = new OfflineStorageService();