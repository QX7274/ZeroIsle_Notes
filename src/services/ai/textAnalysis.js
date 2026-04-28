/**
 * 文本分析服务
 * 提供文本分析相关功能，如关键词提取、摘要生成、情感分析等
 */
import apiClient from '../api/apiClient';
import analyticsService from '../analytics/analyticsService';

/**
 * 文本分析服务
 */
class TextAnalysisService {
  /**
   * 提取关键词
   * @param {string} text - 要分析的文本
   * @param {number} limit - 返回的关键词数量
   * @returns {Promise<Array>} - 关键词数组
   */
  async extractKeywords(text, limit = 10) {
    try {
      const response = await apiService.post('/ai/text/keywords', {
        text,
        limit,
      });

      analyticsService.trackEvent('extract_keywords', {
        textLength: text.length,
        keywordCount: response.data.keywords.length,
      });

      return response.data.keywords;
    } catch (error) {
      console.error('提取关键词失败:', error);
      analyticsService.trackError(error, { action: 'extract_keywords' });
      throw error;
    }
  }

  /**
   * 生成摘要
   * @param {string} text - 要分析的文本
   * @param {number} maxLength - 摘要最大长度
   * @returns {Promise<string>} - 生成的摘要
   */
  async generateSummary(text, maxLength = 200) {
    try {
      const response = await apiService.post('/ai/text/summary', {
        text,
        max_length: maxLength,
      });

      analyticsService.trackEvent('generate_summary', {
        textLength: text.length,
        summaryLength: response.data.summary.length,
      });

      return response.data.summary;
    } catch (error) {
      console.error('生成摘要失败:', error);
      analyticsService.trackError(error, { action: 'generate_summary' });
      throw error;
    }
  }

  /**
   * 情感分析
   * @param {string} text - 要分析的文本
   * @returns {Promise<Object>} - 情感分析结果
   */
  async analyzeSentiment(text) {
    try {
      const response = await apiService.post('/ai/text/sentiment', {
        text,
      });

      analyticsService.trackEvent('analyze_sentiment', {
        textLength: text.length,
      });

      return response.data;
    } catch (error) {
      console.error('情感分析失败:', error);
      analyticsService.trackError(error, { action: 'analyze_sentiment' });
      throw error;
    }
  }

  /**
   * 文本分类
   * @param {string} text - 要分析的文本
   * @param {Array} categories - 可选的分类类别
   * @returns {Promise<Object>} - 分类结果
   */
  async classifyText(text, categories = []) {
    try {
      const response = await apiService.post('/ai/text/classify', {
        text,
        categories,
      });

      analyticsService.trackEvent('classify_text', {
        textLength: text.length,
        categoryCount: categories.length,
      });

      return response.data;
    } catch (error) {
      console.error('文本分类失败:', error);
      analyticsService.trackError(error, { action: 'classify_text' });
      throw error;
    }
  }

  /**
   * 实体识别
   * @param {string} text - 要分析的文本
   * @returns {Promise<Array>} - 识别到的实体数组
   */
  async recognizeEntities(text) {
    try {
      const response = await apiService.post('/ai/text/entities', {
        text,
      });

      analyticsService.trackEvent('recognize_entities', {
        textLength: text.length,
        entityCount: response.data.entities.length,
      });

      return response.data.entities;
    } catch (error) {
      console.error('实体识别失败:', error);
      analyticsService.trackError(error, { action: 'recognize_entities' });
      throw error;
    }
  }
}

export default new TextAnalysisService();
