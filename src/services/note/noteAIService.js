/**
 * 笔记AI处理服务
 * 提供笔记中AI工具的API调用
 */
import { analyticsService } from '../analytics/analyticsService';
import { aiAssistantApi } from './api/index';

class NoteAIService {
  constructor() {
    // 不再需要baseUrl，使用aiAssistantApi
  }

  /**
   * 处理文本
   * @param {string} text - 要处理的文本
   * @param {string} tool - 工具类型 (translate, code_recognition, summarize, extract_keywords, explain, rewrite)
   * @returns {Promise<Object>} - 处理结果
   */
  async processText(text, tool) {
    try {
      const response = await aiAssistantApi.processText({ text, tool });

      analyticsService.trackEvent('ai_tool_used', {
        tool,
        textLength: text.length,
      });

      return response.data;
    } catch (error) {
      console.error(`AI处理失败 (${tool}):`, error);
      analyticsService.trackError(error, { action: 'ai_process_text', tool });
      throw error;
    }
  }

  /**
   * 翻译文本
   * @param {string} text - 要翻译的文本
   * @param {string} sourceLang - 源语言 (auto, en, zh, etc.)
   * @param {string} targetLang - 目标语言 (en, zh, etc.)
   * @returns {Promise<Object>} - 翻译结果
   */
  async translateText(text, sourceLang = 'auto', targetLang = 'zh') {
    try {
      const response = await axios.post(`${this.baseUrl}/ai/translate/`, {
        text,
        source_lang: sourceLang,
        target_lang: targetLang,
      });

      analyticsService.trackEvent('ai_translate', {
        sourceLang,
        targetLang,
        textLength: text.length,
      });

      return response.data;
    } catch (error) {
      console.error('翻译失败:', error);
      analyticsService.trackError(error, { action: 'ai_translate' });
      throw error;
    }
  }

  /**
   * 代码识别
   * @param {string} text - 要识别的代码文本
   * @returns {Promise<Object>} - 识别结果
   */
  async recognizeCode(text) {
    try {
      const response = await axios.post(`${this.baseUrl}/ai/process`, {
        text,
        tool: 'code_recognition',
      });

      analyticsService.trackEvent('ai_code_recognition', {
        textLength: text.length,
      });

      return response.data;
    } catch (error) {
      console.error('代码识别失败:', error);
      analyticsService.trackError(error, { action: 'ai_code_recognition' });
      throw error;
    }
  }

  /**
   * 生成摘要
   * @param {string} text - 要摘要的文本
   * @returns {Promise<Object>} - 摘要结果
   */
  async summarizeText(text) {
    try {
      const response = await axios.post(`${this.baseUrl}/ai/summarize/`, {
        text,
      });

      analyticsService.trackEvent('ai_summarize', {
        textLength: text.length,
      });

      return response.data;
    } catch (error) {
      console.error('生成摘要失败:', error);
      analyticsService.trackError(error, { action: 'ai_summarize' });
      throw error;
    }
  }

  /**
   * 提取关键�?   * @param {string} text - 要提取关键词的文�?   * @returns {Promise<Object>} - 关键词结�?   */
  async extractKeywords(text) {
    try {
      const response = await axios.post(`${this.baseUrl}/ai/process`, {
        text,
        tool: 'extract_keywords',
      });

      analyticsService.trackEvent('ai_extract_keywords', {
        textLength: text.length,
      });

      return response.data;
    } catch (error) {
      console.error('提取关键词失�?', error);
      analyticsService.trackError(error, { action: 'ai_extract_keywords' });
      throw error;
    }
  }

  /**
   * 解释文本
   * @param {string} text - 要解释的文本
   * @returns {Promise<Object>} - 解释结果
   */
  async explainText(text) {
    try {
      const response = await axios.post(`${this.baseUrl}/ai/process`, {
        text,
        tool: 'explain',
      });

      analyticsService.trackEvent('ai_explain', {
        textLength: text.length,
      });

      return response.data;
    } catch (error) {
      console.error('解释文本失败:', error);
      analyticsService.trackError(error, { action: 'ai_explain' });
      throw error;
    }
  }

  /**
   * 改写文本
   * @param {string} text - 要改写的文本
   * @returns {Promise<Object>} - 改写结果
   */
  async rewriteText(text) {
    try {
      const response = await axios.post(`${this.baseUrl}/ai/process`, {
        text,
        tool: 'rewrite',
      });

      analyticsService.trackEvent('ai_rewrite', {
        textLength: text.length,
      });

      return response.data;
    } catch (error) {
      console.error('改写文本失败:', error);
      analyticsService.trackError(error, { action: 'ai_rewrite' });
      throw error;
    }
  }

  /**
   * 识别数学公式
   * @param {string} text - 要识别的数学公式文本
   * @returns {Promise<Object>} - 识别结果（LaTeX格式�?   */
  async recognizeMathFormula(text) {
    try {
      const response = await axios.post(`${this.baseUrl}/ai/process`, {
        text,
        tool: 'math_formula',
      });

      analyticsService.trackEvent('ai_math_formula', {
        textLength: text.length,
      });

      return response.data;
    } catch (error) {
      console.error('识别数学公式失败:', error);
      analyticsService.trackError(error, { action: 'ai_math_formula' });
      throw error;
    }
  }
}

export const noteAIService = new NoteAIService();

