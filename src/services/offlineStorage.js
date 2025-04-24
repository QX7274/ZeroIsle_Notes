import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { analyticsService } from './analytics';

class OfflineStorageService {
  constructor() {
    this.isOnline = true;
    this.pendingOperations = [];
    this.syncInterval = 5 * 60 * 1000; // 5分钟
    this.timer = null;
  }

  async init() {
    // 监听网络状态
    NetInfo.addEventListener(state => {
      this.isOnline = state.isConnected;
      if (this.isOnline) {
        this.syncPendingOperations();
      }
    });

    // 加载待处理的操作
    await this.loadPendingOperations();
    this.startSyncTimer();
  }

  async saveNote(note) {
    try {
      // 保存到本地存储
      const notes = await this.getNotes();
      const index = notes.findIndex(n => n.id === note.id);
      if (index >= 0) {
        notes[index] = note;
      } else {
        notes.push(note);
      }
      await AsyncStorage.setItem('notes', JSON.stringify(notes));

      // 记录操作
      const operation = {
        type: 'save_note',
        data: note,
        timestamp: new Date().toISOString(),
      };
      await this.addPendingOperation(operation);

      // 如果在线，立即同步
      if (this.isOnline) {
        await this.syncPendingOperations();
      }
    } catch (error) {
      console.error('保存笔记失败:', error);
      analyticsService.trackError(error, { operation: 'save_note' });
    }
  }

  async deleteNote(noteId) {
    try {
      // 从本地存储中删除
      const notes = await this.getNotes();
      const filteredNotes = notes.filter(n => n.id !== noteId);
      await AsyncStorage.setItem('notes', JSON.stringify(filteredNotes));

      // 记录操作
      const operation = {
        type: 'delete_note',
        data: { id: noteId },
        timestamp: new Date().toISOString(),
      };
      await this.addPendingOperation(operation);

      // 如果在线，立即同步
      if (this.isOnline) {
        await this.syncPendingOperations();
      }
    } catch (error) {
      console.error('删除笔记失败:', error);
      analyticsService.trackError(error, { operation: 'delete_note' });
    }
  }

  async getNotes() {
    try {
      const notesJson = await AsyncStorage.getItem('notes');
      return notesJson ? JSON.parse(notesJson) : [];
    } catch (error) {
      console.error('获取笔记失败:', error);
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
  }

  async savePendingOperations() {
    try {
      await AsyncStorage.setItem(
        'pending_operations',
        JSON.stringify(this.pendingOperations)
      );
    } catch (error) {
      console.error('保存待处理操作失败:', error);
    }
  }

  async loadPendingOperations() {
    try {
      const operationsJson = await AsyncStorage.getItem('pending_operations');
      this.pendingOperations = operationsJson ? JSON.parse(operationsJson) : [];
    } catch (error) {
      console.error('加载待处理操作失败:', error);
    }
  }

  async syncPendingOperations() {
    if (!this.isOnline || this.pendingOperations.length === 0) return;

    try {
      // 这里可以添加同步到服务器的逻辑
      // 例如：await api.syncOperations(this.pendingOperations);
      
      // 同步成功后清空待处理操作
      this.pendingOperations = [];
      await this.savePendingOperations();
    } catch (error) {
      console.error('同步操作失败:', error);
      analyticsService.trackError(error, { operation: 'sync_operations' });
    }
  }

  startSyncTimer() {
    this.timer = setInterval(() => {
      if (this.isOnline) {
        this.syncPendingOperations();
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