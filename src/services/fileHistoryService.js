import AsyncStorage from '@react-native-async-storage/async-storage';

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
  }

  /**
   * 初始化历史记录
   */
  async initialize() {
    try {
      const stored = await AsyncStorage.getItem(this.storageKey);
      if (stored) {
        this.history = JSON.parse(stored);
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
      const { uri, title, type, fileName, noteId } = fileInfo;
      
      if (!uri || !title) {
        console.warn('FileHistoryService: 文件信息不完整，跳过添加');
        return;
      }

      // 创建历史记录项
      const historyItem = {
        id: noteId || `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        uri,
        title,
        type: type || 'unknown',
        fileName: fileName || title,
        lastOpened: new Date().toISOString(),
        openCount: 1
      };

      // 检查是否已存在
      const existingIndex = this.history.findIndex(item => 
        item.uri === uri || item.id === historyItem.id
      );

      if (existingIndex !== -1) {
        // 更新现有记录
        this.history[existingIndex] = {
          ...this.history[existingIndex],
          ...historyItem,
          openCount: this.history[existingIndex].openCount + 1
        };
        // 移动到最前面
        const updatedItem = this.history.splice(existingIndex, 1)[0];
        this.history.unshift(updatedItem);
      } else {
        // 添加新记录到最前面
        this.history.unshift(historyItem);
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
    return this.history.slice(0, limit);
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
      await AsyncStorage.setItem(this.storageKey, JSON.stringify(this.history));
    } catch (error) {
      console.error('FileHistoryService: 保存历史记录失败:', error);
    }
  }

  /**
   * 添加监听器
   * @param {Function} listener - 监听器函数
   */
  addListener(listener) {
    this.listeners.push(listener);
  }

  /**
   * 移除监听器
   * @param {Function} listener - 监听器函数
   */
  removeListener(listener) {
    this.listeners = this.listeners.filter(l => l !== listener);
  }

  /**
   * 通知所有监听器
   */
  notifyListeners() {
    this.listeners.forEach(listener => {
      try {
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
        await this.saveHistory();
        this.notifyListeners();
        console.log('FileHistoryService: 历史记录导入完成，共', this.history.length, '条记录');
      }
    } catch (error) {
      console.error('FileHistoryService: 导入历史记录失败:', error);
    }
  }
}

// 创建单例实例
const fileHistoryService = new FileHistoryService();

// 自动初始化
fileHistoryService.initialize();

export default fileHistoryService;
