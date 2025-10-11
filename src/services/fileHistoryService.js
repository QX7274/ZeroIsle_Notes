import AsyncStorage from '@react-native-async-storage/async-storage';
import { eventEmitter } from './utils/eventEmitter';
// STORAGE_EVENTS 常量定义
const STORAGE_EVENTS = {
  STORAGE_INITIALIZED: 'storage:initialized',
  STORAGE_ERROR: 'storage:error',
  ITEM_CREATED: 'storage:item_created',
  ITEM_UPDATED: 'storage:item_updated',
  ITEM_DELETED: 'storage:item_deleted',
  STORAGE_CLEARED: 'storage:cleared',
};
import networkErrorService from './networkErrorService';

/**
 * 文件历史服务
 * 管理最近打开的文件历史记录
 */
class FileHistoryService {
  constructor() {
    this.storageKey = 'file_history';
    this.maxHistorySize = 30;
    this.history = [];
    this.listeners = [];
    
    // 监听文件删除事件，同步清理历史记录
    this.setupEventListeners();
  }

  /**
   * 设置事件监听器
   */
  setupEventListeners() {
    // 监听笔记删除事件
    eventEmitter.on(STORAGE_EVENTS.ITEM_DELETED, (data) => {
      if (data.collectionName === 'Note') {
        this.removeFileByNoteId(data.itemId);
      }
    });

    // 监听文件删除事件
    eventEmitter.on('FILE_DELETED', (data) => {
      if (data.fileId) {
        this.removeFile(data.fileId);
      }
    });
  }

  /**
   * 初始化历史记录
   */
  async initialize() {
    try {
      const stored = await AsyncStorage.getItem(this.storageKey);
      if (stored) {
        this.history = JSON.parse(stored);
        // 确保加载的历史记录按最近更新时间排序
        this.sortHistoryByLastOpened();
        console.log('FileHistoryService: 历史记录加载完成，共', this.history.length, '条记录');
      }
    } catch (error) {
      console.error('FileHistoryService: 初始化失败:', error);
      this.history = [];
    }
  }

  /**
   * 添加文件到历史记录
   * @param {Object} fileInfo - 文件信息
   */
  async addFile(fileInfo) {
    try {
      const { uri, title, type, fileName, noteId, noteType, file_uri } = fileInfo;
      
      // 对于笔记类型，如果没有uri但有noteId，使用noteId作为uri
      const effectiveUri = uri || (noteId ? `${noteType || 'note'}://${noteId}` : null);
      
      if (!effectiveUri || !title) {
        console.warn('FileHistoryService: 文件信息不完整，跳过添加', { uri, effectiveUri, title, noteId });
        return;
      }

      // 创建历史记录项
      const historyItem = {
        id: noteId || `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        noteId: noteId, // 添加noteId字段，确保与主页匹配逻辑兼容
        uri: effectiveUri,
        title,
        type: type || 'unknown',
        fileName: fileName || title,
        noteType: noteType || null,
        file_uri: file_uri || effectiveUri,
        lastOpened: new Date().toISOString(),
        openCount: 1
      };

      // 检查是否已存在 - 优化匹配逻辑
      console.log('FileHistoryService: 查找现有记录，参数:', { noteId, effectiveUri, fileName, title });
      console.log('FileHistoryService: 当前历史记录数量:', this.history.length);
      
      const existingIndex = this.history.findIndex(item => {
        // 优先匹配noteId（对于笔记类型）
        if (noteId && item.id === noteId) {
          console.log('FileHistoryService: 通过noteId匹配到现有记录:', item.title);
          return true;
        }
        if (noteId && item.noteId === noteId) {
          console.log('FileHistoryService: 通过noteId字段匹配到现有记录:', item.title);
          return true;
        }
        
        // 匹配uri
        if (item.uri === effectiveUri) {
          console.log('FileHistoryService: 通过uri匹配到现有记录:', item.title);
          return true;
        }
        if (item.file_uri === effectiveUri) {
          console.log('FileHistoryService: 通过file_uri匹配到现有记录:', item.title);
          return true;
        }
        
        // 匹配文件名（作为备用）
        if (item.fileName === fileName && item.title === title) {
          console.log('FileHistoryService: 通过文件名和标题匹配到现有记录:', item.title);
          return true;
        }
        
        return false;
      });
      
      console.log('FileHistoryService: 查找结果，existingIndex:', existingIndex);

      if (existingIndex !== -1) {
        // 更新现有记录
        const existingItem = this.history[existingIndex];
        const oldTime = existingItem.lastOpened;
        const newTime = new Date().toISOString();
        
        const updatedItem = {
          ...existingItem,
          ...historyItem,
          openCount: existingItem.openCount + 1,
          lastOpened: newTime // 确保更新时间戳
        };
        
        // 从原位置移除
        this.history.splice(existingIndex, 1);
        // 添加到最前面
        this.history.unshift(updatedItem);
        
        console.log('FileHistoryService: 更新现有文件记录:', title, '打开次数:', updatedItem.openCount);
        console.log('FileHistoryService: 时间戳更新:', oldTime, '->', newTime);
      } else {
        // 添加新记录到最前面
        this.history.unshift(historyItem);
        console.log('FileHistoryService: 添加新文件记录:', title);
      }

      // 限制历史记录数量
      if (this.history.length > this.maxHistorySize) {
        this.history = this.history.slice(0, this.maxHistorySize);
      }

      // 保存到存储
      await this.saveHistory();
      
      // 通知监听器
      this.notifyListeners();

      console.log('FileHistoryService: 文件已添加到历史记录:', title);
      
    } catch (error) {
      console.error('FileHistoryService: 添加文件失败:', error);
    }
  }

  /**
   * 根据笔记ID移除文件历史记录
   * @param {string} noteId - 笔记ID
   */
  async removeFileByNoteId(noteId) {
    try {
      const initialLength = this.history.length;
      this.history = this.history.filter(item => item.noteId !== noteId);
      
      if (this.history.length < initialLength) {
        await this.saveHistory();
        this.notifyListeners();
        console.log('FileHistoryService: 根据笔记ID移除文件历史记录:', noteId);
      }
    } catch (error) {
      console.error('FileHistoryService: 根据笔记ID移除文件失败:', error);
    }
  }

  /**
   * 批量清理不存在的文件历史记录
   * @param {Array} existingFileIds - 当前存在的文件ID列表
   */
  async cleanupNonExistentFiles(existingFileIds = []) {
    try {
      const initialLength = this.history.length;
      
      // 过滤掉不存在的文件
      this.history = this.history.filter(item => {
        // 检查文件ID是否在现有文件列表中
        const exists = existingFileIds.includes(item.id) || 
                      existingFileIds.includes(item.noteId) ||
                      existingFileIds.includes(item.fileName);
        
        if (!exists) {
          console.log('FileHistoryService: 清理不存在的文件历史记录:', item.title);
        }
        
        return exists;
      });
      
      if (this.history.length < initialLength) {
        await this.saveHistory();
        this.notifyListeners();
        console.log(`FileHistoryService: 批量清理完成，移除了 ${initialLength - this.history.length} 条记录`);
      }
    } catch (error) {
      console.error('FileHistoryService: 批量清理失败:', error);
    }
  }

  /**
   * 检查文件是否存在
   * @param {string} fileId - 文件ID
   * @returns {boolean} 是否存在
   */
  hasFile(fileId) {
    return this.history.some(item => 
      item.id === fileId || 
      item.noteId === fileId || 
      item.fileName === fileId
    );
  }

  /**
   * 获取文件历史记录
   * @param {string} fileId - 文件ID
   * @returns {Object|null} 文件历史记录
   */
  getFileHistory(fileId) {
    return this.history.find(item => 
      item.id === fileId || 
      item.noteId === fileId || 
      item.fileName === fileId
    ) || null;
  }

  /**
   * 从历史记录中移除文件
   * @param {string} fileId - 文件ID
   */
  async removeFile(fileId) {
    try {
      const initialLength = this.history.length;
      this.history = this.history.filter(item => item.id !== fileId);
      
      if (this.history.length < initialLength) {
        await this.saveHistory();
        this.notifyListeners();
        console.log('FileHistoryService: 文件已从历史记录中移除:', fileId);
      }
      
    } catch (error) {
      console.error('FileHistoryService: 移除文件失败:', error);
    }
  }

  /**
   * 获取历史记录
   * @param {number} limit - 限制返回数量
   * @returns {Array} 历史记录数组
   */
  getHistory(limit = this.maxHistorySize) {
    // 确保按最近更新时间排序
    const sortedHistory = [...this.history].sort((a, b) => {
      const dateA = new Date(a.lastOpened || 0);
      const dateB = new Date(b.lastOpened || 0);
      return dateB - dateA; // 降序排列，最新的在前面
    });
    
    return sortedHistory.slice(0, limit);
  }

  /**
   * 清空历史记录
   */
  async clearHistory() {
    try {
      this.history = [];
      await AsyncStorage.removeItem(this.storageKey);
      this.notifyListeners();
      console.log('FileHistoryService: 历史记录已清空');
    } catch (error) {
      console.error('FileHistoryService: 清空历史记录失败:', error);
    }
  }

  /**
   * 搜索历史记录
   * @param {string} query - 搜索关键词
   * @returns {Array} 匹配的历史记录
   */
  searchHistory(query) {
    if (!query || query.trim() === '') {
      return this.getHistory();
    }

    const lowerQuery = query.toLowerCase();
    return this.history.filter(item => 
      item.title.toLowerCase().includes(lowerQuery) ||
      item.fileName.toLowerCase().includes(lowerQuery) ||
      item.type.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * 获取特定类型的历史记录
   * @param {string} type - 文件类型
   * @returns {Array} 指定类型的历史记录
   */
  getHistoryByType(type) {
    return this.history.filter(item => item.type === type);
  }

  /**
   * 保存历史记录到存储
   */
  async saveHistory() {
    try {
      // 保存前确保按最近更新时间排序
      this.sortHistoryByLastOpened();
      await AsyncStorage.setItem(this.storageKey, JSON.stringify(this.history));
    } catch (error) {
      console.error('FileHistoryService: 保存历史记录失败:', error);
    }
  }

  /**
   * 按最近更新时间排序历史记录
   */
  sortHistoryByLastOpened() {
    this.history.sort((a, b) => {
      const dateA = new Date(a.lastOpened || 0);
      const dateB = new Date(b.lastOpened || 0);
      return dateB - dateA; // 降序排列，最新的在前面
    });
  }

  /**
   * 添加监听器
   * @param {Function} listener - 监听器函数
   */
  addListener(listener) {
    this.listeners.push(listener);
    console.log('FileHistoryService: 添加监听器，当前监听器数量:', this.listeners.length);
  }

  /**
   * 移除监听器
   * @param {Function} listener - 监听器函数
   */
  removeListener(listener) {
    this.listeners = this.listeners.filter(l => l !== listener);
    console.log('FileHistoryService: 移除监听器，当前监听器数量:', this.listeners.length);
  }

  /**
   * 通知所有监听器
   */
  notifyListeners() {
    console.log('FileHistoryService: 通知监听器，监听器数量:', this.listeners.length);
    this.listeners.forEach((listener, index) => {
      try {
        console.log('FileHistoryService: 执行监听器', index);
        listener(this.history);
      } catch (error) {
        console.error('FileHistoryService: 监听器执行失败:', error);
      }
    });
  }

  /**
   * 获取统计信息
   */
  getStatistics() {
    const typeCount = {};
    let totalOpenCount = 0;

    this.history.forEach(item => {
      typeCount[item.type] = (typeCount[item.type] || 0) + 1;
      totalOpenCount += item.openCount;
    });

    return {
      totalFiles: this.history.length,
      totalOpenCount,
      typeCount,
      mostRecentFile: this.history[0] || null,
      oldestFile: this.history[this.history.length - 1] || null
    };
  }

  /**
   * 导出历史记录
   */
  exportHistory() {
    return {
      version: '1.0',
      exportDate: new Date().toISOString(),
      history: this.history
    };
  }

  /**
   * 导入历史记录
   * @param {Object} data - 导入的数据
   */
  async importHistory(data) {
    try {
      if (data && data.history && Array.isArray(data.history)) {
        this.history = data.history.slice(0, this.maxHistorySize);
        // 确保导入的数据也按时间排序
        this.sortHistoryByLastOpened();
        await this.saveHistory();
        this.notifyListeners();
        console.log('FileHistoryService: 历史记录导入完成，共', this.history.length, '条记录');
      }
    } catch (error) {
      console.error('FileHistoryService: 导入历史记录失败:', error);
    }
  }

  /**
   * 测试排序功能
   * 用于调试和验证排序逻辑
   */
  testSorting() {
    console.log('FileHistoryService: 测试排序功能');
    console.log('排序前:', this.history.map(item => ({
      title: item.title,
      lastOpened: item.lastOpened,
      openCount: item.openCount
    })));
    
    this.sortHistoryByLastOpened();
    
    console.log('排序后:', this.history.map(item => ({
      title: item.title,
      lastOpened: item.lastOpened,
      openCount: item.openCount
    })));
  }
}

// 创建单例实例
const fileHistoryService = new FileHistoryService();

// 自动初始化
fileHistoryService.initialize();

export default fileHistoryService;
