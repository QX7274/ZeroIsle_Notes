/**
 * 搜索服务
 * 提供高级搜索功能，包括分析跟踪和历史记录管理
 */
import { analyticsService } from './analytics';
import { searchApi } from './api/index';
import { aiService } from './ai/index';

class SearchService {
  constructor() {
    this.searchHistory = [];
  }

  /**
   * 文本搜索
   * @param {string} query - 搜索查询文本
   * @param {Object} options - 搜索选项
   * @returns {Promise<Array>} - 搜索结果
   */
  async searchByText(query, options = {}) {
    try {
      const response = await searchApi.textSearch(query, options);

      analyticsService.trackSearchAction('text', {
        queryLength: query.length,
        resultCount: response.data?.length || 0,
        options
      });

      this.addToHistory('text', query);
      return response.data;
    } catch (error) {
      console.error('文本搜索错误:', error);
      analyticsService.trackError(error, { action: 'search_text' });
      throw error;
    }
  }

  /**
   * 图像搜索
   * @param {Object} imageFile - 图像文件对象
   * @param {Object} options - 搜索选项
   * @returns {Promise<Array>} - 搜索结果
   */
  async searchByImage(imageFile, options = {}) {
    try {
      const imageUri = imageFile.uri || imageFile.path;
      const response = await searchApi.imageSearch(imageUri, options);

      analyticsService.trackSearchAction('image', {
        fileSize: imageFile.size,
        fileType: imageFile.type,
        resultCount: response.data?.length || 0,
        options
      });

      this.addToHistory('image', imageFile.name || '图像搜索');
      return response.data;
    } catch (error) {
      console.error('图片搜索错误:', error);
      analyticsService.trackError(error, { action: 'search_image' });
      throw error;
    }
  }

  /**
   * 语音搜索
   * @param {Object} audioFile - 音频文件对象
   * @param {Object} options - 搜索选项
   * @returns {Promise<Array>} - 搜索结果
   */
  async searchByVoice(audioFile, options = {}) {
    try {
      const audioUri = audioFile.uri || audioFile.path;

      // 方法1：使用API直接进行语音搜索
      if (options.directVoiceSearch) {
        const response = await searchApi.voiceSearch(audioUri, options);

        analyticsService.trackSearchAction('voice_direct', {
          fileSize: audioFile.size,
          fileType: audioFile.type,
          resultCount: response.data?.length || 0,
          options
        });

        this.addToHistory('voice', response.query || '语音搜索');
        return response.data;
      }

      // 方法2：先将语音转换为文本，再进行文本搜索
      const text = await aiService.transcribeAudio(audioFile);
      const results = await this.searchByText(text, options);

      analyticsService.trackSearchAction('voice', {
        fileSize: audioFile.size,
        fileType: audioFile.type,
        resultCount: results.length,
        transcribedText: text,
        options
      });

      this.addToHistory('voice', text);
      return results;
    } catch (error) {
      console.error('语音搜索错误:', error);
      analyticsService.trackError(error, { action: 'search_voice' });
      throw error;
    }
  }

  /**
   * 知识图谱搜索
   * @param {string} query - 搜索查询文本
   * @param {Object} options - 搜索选项
   * @returns {Promise<Array>} - 搜索结果
   */
  async searchByKnowledgeGraph(query, options = {}) {
    try {
      const response = await searchApi.knowledgeGraphSearch(query, options);

      analyticsService.trackSearchAction('knowledge_graph', {
        queryLength: query.length,
        resultCount: response.data?.length || 0,
        options
      });

      this.addToHistory('knowledge_graph', query);
      return response.data;
    } catch (error) {
      console.error('知识图谱搜索错误:', error);
      analyticsService.trackError(error, { action: 'search_knowledge_graph' });
      throw error;
    }
  }

  /**
   * 添加搜索历史
   * @param {string} type - 搜索类型
   * @param {string} query - 搜索查询文本
   */
  addToHistory(type, query) {
    // 添加到本地历史记录
    this.searchHistory.unshift({
      type,
      query,
      timestamp: new Date().toISOString(),
    });

    // 保持历史记录在100条以内
    if (this.searchHistory.length > 100) {
      this.searchHistory.pop();
    }

    // 记录分析数据
    analyticsService.trackSearchAction('add_to_history', {
      type,
      queryLength: typeof query === 'string' ? query.length : 0,
    });

    // 同步到服务器（如果在线）
    this.syncHistoryToServer().catch(error => {
      console.error('同步搜索历史到服务器失败:', error);
    });
  }

  /**
   * 获取搜索历史
   * @param {number} limit - 限制数量
   * @returns {Promise<Array>} - 搜索历史
   */
  async getSearchHistory(limit = 10) {
    try {
      // 尝试从服务器获取历史记录
      const response = await searchApi.getSearchHistory(limit);

      if (response.success && response.data) {
        // 合并本地和服务器历史记录
        const serverHistory = response.data;
        const mergedHistory = [...serverHistory];

        // 添加本地历史记录中不存在于服务器的记录
        this.searchHistory.forEach(localItem => {
          const exists = serverHistory.some(serverItem =>
            serverItem.query === localItem.query &&
            serverItem.type === localItem.type
          );

          if (!exists) {
            mergedHistory.push(localItem);
          }
        });

        // 按时间排序
        mergedHistory.sort((a, b) =>
          new Date(b.timestamp) - new Date(a.timestamp)
        );

        // 更新本地历史记录
        this.searchHistory = mergedHistory.slice(0, 100);

        return mergedHistory.slice(0, limit);
      }

      // 如果服务器请求失败，返回本地历史记录
      return this.searchHistory.slice(0, limit);
    } catch (error) {
      console.error('获取搜索历史错误:', error);
      // 返回本地历史记录
      return this.searchHistory.slice(0, limit);
    }
  }

  /**
   * 清除搜索历史
   * @returns {Promise<boolean>} - 是否成功
   */
  async clearSearchHistory() {
    try {
      // 清除本地历史记录
      this.searchHistory = [];

      // 记录分析数据
      analyticsService.trackSearchAction('clear_history');

      // 尝试清除服务器历史记录
      await searchApi.clearSearchHistory();

      return true;
    } catch (error) {
      console.error('清除搜索历史错误:', error);
      analyticsService.trackError(error, { action: 'clear_search_history' });
      return false;
    }
  }

  /**
   * 同步历史记录到服务器
   * @private
   */
  async syncHistoryToServer() {
    // 这里可以实现同步逻辑，但目前API可能不支持
    // 未来可以实现
  }
}

export const searchService = new SearchService();