import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { analyticsService } from './analytics';
import { STORAGE_KEYS } from '../utils/constants/config';
import { Platform } from 'react-native';
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

      // 启动同步定时器
      this.startSyncTimer();

      return true;
    } catch (error) {
      console.error('初始化离线存储服务失败:', error);
      analyticsService.trackError(error, { operation: 'init_offline_storage' });
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

      // 添加设备ID和时间戳
      const noteWithMeta = {
        ...note,
        device_id: this.deviceId,
        updated_at: new Date().toISOString(),
        synced: false
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

      // 如果在线，立即同步
      if (this.isOnline) {
        await this.syncPendingOperations();
      }

      return { success: true, note: noteWithMeta };
    } catch (error) {
      console.error('保存笔记失败:', error);
      analyticsService.trackError(error, { operation: 'save_note' });
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

      // 如果在线，立即同步
      if (this.isOnline) {
        await this.syncPendingOperations();
      }

      return { success: true };
    } catch (error) {
      console.error('删除笔记失败:', error);
      analyticsService.trackError(error, { operation: 'delete_note' });
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

  async saveCanvas(canvas) {
    try {
      // 保存到本地存储
      const canvases = await this.getCanvases();
      const index = canvases.findIndex(c => c.id === canvas.id);
      if (index >= 0) {
        canvases[index] = canvas;
      } else {
        canvases.push(canvas);
      }
      await AsyncStorage.setItem('canvases', JSON.stringify(canvases));

      // 记录操作
      const operation = {
        type: 'save_canvas',
        data: canvas,
        timestamp: new Date().toISOString(),
      };
      await this.addPendingOperation(operation);

      // 如果在线，立即同步
      if (this.isOnline) {
        await this.syncPendingOperations();
      }
    } catch (error) {
      console.error('保存画布失败:', error);
      analyticsService.trackError(error, { operation: 'save_canvas' });
    }
  }

  async deleteCanvas(canvasId) {
    try {
      // 从本地存储中删除
      const canvases = await this.getCanvases();
      const filteredCanvases = canvases.filter(c => c.id !== canvasId);
      await AsyncStorage.setItem('canvases', JSON.stringify(filteredCanvases));

      // 记录操作
      const operation = {
        type: 'delete_canvas',
        data: { id: canvasId },
        timestamp: new Date().toISOString(),
      };
      await this.addPendingOperation(operation);

      // 如果在线，立即同步
      if (this.isOnline) {
        await this.syncPendingOperations();
      }
    } catch (error) {
      console.error('删除画布失败:', error);
      analyticsService.trackError(error, { operation: 'delete_canvas' });
    }
  }

  async getCanvases() {
    try {
      const canvasesJson = await AsyncStorage.getItem('canvases');
      return canvasesJson ? JSON.parse(canvasesJson) : [];
    } catch (error) {
      console.error('获取画布失败:', error);
      return [];
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
      analyticsService.trackError(error, { operation: 'save_pending_operations' });
    }
  }

  async loadPendingOperations() {
    try {
      const operationsJson = await AsyncStorage.getItem(STORAGE_KEYS.OFFLINE_OPERATIONS);
      this.pendingOperations = operationsJson ? JSON.parse(operationsJson) : [];
    } catch (error) {
      console.error('加载待处理操作失败:', error);
      analyticsService.trackError(error, { operation: 'load_pending_operations' });
      this.pendingOperations = [];
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

      // 这里可以添加同步到服务器的逻辑
      // 例如：const result = await api.syncOperations(this.pendingOperations);

      // 模拟同步延迟
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 模拟同步结果
      const syncedCount = this.pendingOperations.length;

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
      analyticsService.trackError(error, { operation: 'sync_operations' });

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
      analyticsService.trackError(error, { operation: 'clear_offline_data' });
      return { success: false, error: error.message };
    }
  }

  startSyncTimer() {
    // 停止现有定时器
    this.stopSyncTimer();

    // 启动新定时器
    this.timer = setInterval(() => {
      if (this.isOnline && this.pendingOperations.length > 0) {
        this.syncPendingOperations().catch(error => {
          console.error('自动同步失败:', error);
        });
      }
    }, this.syncInterval);
  }

  stopSyncTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

export const offlineStorageService = new OfflineStorageService();