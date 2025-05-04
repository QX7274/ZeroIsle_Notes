/**
 * AI处理历史记录服务
 * 提供AI处理历史记录的存储和管理
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { analyticsService } from '../analytics/analyticsService';

// 存储�?
const AI_HISTORY_KEY = 'ai_processing_history';
// 最大历史记录数�?
const MAX_HISTORY_ITEMS = 50;

class AIHistoryService {
  constructor() {
    this.history = [];
    this.isLoaded = false;
  }

  /**
   * 初始化服�?
   * 从本地存储加载历史记�?
   */
  async init() {
    try {
      const historyJson = await AsyncStorage.getItem(AI_HISTORY_KEY);
      if (historyJson) {
        this.history = JSON.parse(historyJson);
      }
      this.isLoaded = true;
      return true;
    } catch (error) {
      console.error('加载AI历史记录失败:', error);
      analyticsService.trackError(error, { action: 'ai_history_init' });
      this.history = [];
      this.isLoaded = true;
      return false;
    }
  }

  /**
   * 确保服务已初始化
   */
  async ensureInitialized() {
    if (!this.isLoaded) {
      await this.init();
    }
  }

  /**
   * 添加历史记录
   * @param {Object} item - 历史记录�?
   * @param {string} item.tool - 工具类型
   * @param {string} item.input - 输入文本
   * @param {string} item.output - 输出结果
   * @param {Date} item.timestamp - 时间�?
   */
  async addHistory(item) {
    await this.ensureInitialized();

    // 创建历史记录�?
    const historyItem = {
      id: Date.now().toString(),
      tool: item.tool,
      input: item.input,
      output: item.output,
      timestamp: item.timestamp || new Date(),
    };

    // 添加到历史记�?
    this.history.unshift(historyItem);

    // 限制历史记录数量
    if (this.history.length > MAX_HISTORY_ITEMS) {
      this.history = this.history.slice(0, MAX_HISTORY_ITEMS);
    }

    // 保存到本地存�?
    try {
      await AsyncStorage.setItem(AI_HISTORY_KEY, JSON.stringify(this.history));
      analyticsService.trackEvent('ai_history_added', {
        tool: item.tool,
      });
      return true;
    } catch (error) {
      console.error('保存AI历史记录失败:', error);
      analyticsService.trackError(error, { action: 'ai_history_add' });
      return false;
    }
  }

  /**
   * 获取历史记录
   * @param {Object} options - 选项
   * @param {string} options.tool - 按工具类型筛�?
   * @param {number} options.limit - 限制返回数量
   * @returns {Array} - 历史记录列表
   */
  async getHistory(options = {}) {
    await this.ensureInitialized();

    let result = [...this.history];

    // 按工具类型筛�?
    if (options.tool) {
      result = result.filter(item => item.tool === options.tool);
    }

    // 限制返回数量
    if (options.limit && options.limit > 0) {
      result = result.slice(0, options.limit);
    }

    return result;
  }

  /**
   * 清除历史记录
   * @param {string} id - 历史记录ID，如果不提供则清除所�?
   */
  async clearHistory(id) {
    await this.ensureInitialized();

    if (id) {
      // 清除指定历史记录
      this.history = this.history.filter(item => item.id !== id);
    } else {
      // 清除所有历史记�?
      this.history = [];
    }

    // 保存到本地存�?
    try {
      await AsyncStorage.setItem(AI_HISTORY_KEY, JSON.stringify(this.history));
      analyticsService.trackEvent('ai_history_cleared', {
        all: !id,
      });
      return true;
    } catch (error) {
      console.error('清除AI历史记录失败:', error);
      analyticsService.trackError(error, { action: 'ai_history_clear' });
      return false;
    }
  }

  /**
   * 获取历史记录�?
   * @param {string} id - 历史记录ID
   * @returns {Object} - 历史记录�?
   */
  async getHistoryItem(id) {
    await this.ensureInitialized();
    return this.history.find(item => item.id === id);
  }
}

export const aiHistoryService = new AIHistoryService();

