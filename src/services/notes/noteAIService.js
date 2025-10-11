/**
 * 笔记AI服务
 * 提供笔记相关的AI功能，如文本翻译、代码识别、公式识别等
 */

import axios from 'axios';
import { API_ENDPOINTS } from '../../config/api';
import { API_BASE_URL } from '../../config/api';
import { networkService } from '../network/networkService';
import { logService } from '../../utils/logService';
import authStorage from '../auth/authStorage';

/**
 * 笔记AI服务
 */
class NoteAIService {
  constructor() {
    this.initialized = false;
    this.apiClient = null;
  }

  /**
   * 初始化服务
   */
  async initialize() {
    if (this.initialized) return;

    try {
      // 创建API客户端
      this.apiClient = axios.create({
        baseURL: API_BASE_URL,
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        }
      });

      // 添加请求拦截器，自动添加认证令牌
      this.apiClient.interceptors.request.use(
        async (config) => {
          const token = await authStorage.getAccessToken();
          if (token) {
            config.headers.Authorization = `Bearer ${token}`;
          }
          return config;
        },
        (error) => Promise.reject(error)
      );

      // 检查网络状态
      this.isOnline = networkService.isOnline();
      this.initialized = true;
      logService.info('笔记AI服务初始化成功');
    } catch (error) {
      logService.error('笔记AI服务初始化失败', error);
      throw error;
    }
  }

  /**
   * 翻译文本
   * @param {string} text 要翻译的文本
   * @param {string} targetLang 目标语言，默认为中文
   * @returns {Promise<Object>} 翻译结果
   */
  async translateText(text, targetLang = 'Chinese') {
    try {
      await this.initialize();

      if (this.isOnline) {
        // 在线模式：调用后端API
        const response = await this.apiClient.post(API_ENDPOINTS.AI_ASSISTANT.TRANSLATE, {
          text,
          target_language: targetLang
        });

        return { 
          translated_text: response.data.translated_text || response.data.result,
          source_text: text 
        };
      } else {
        // 离线模式：返回原文本
        logService.warn('离线模式：无法翻译文本');
        return { translated_text: text, source_text: text };
      }
    } catch (error) {
      logService.error('文本翻译失败', error);
      // 降级处理：返回原文本
      return { translated_text: text, source_text: text, error: error.message };
    }
  }

  /**
   * 识别代码
   * @param {string} text 要识别的文本
   * @returns {Promise<Object>} 识别结果
   */
  async recognizeCode(text) {
    try {
      await this.initialize();

      if (this.isOnline) {
        // 在线模式：调用后端API
        const response = await this.apiClient.post(API_ENDPOINTS.AI_ASSISTANT.PROCESS, {
          text,
          tool: 'code_recognition'
        });

        const result = response.data.result;
        
        // 尝试解析JSON响应
        try {
          if (typeof result === 'string') {
            const parsed = JSON.parse(result);
            return {
              language: parsed.language || 'unknown',
              formatted_code: parsed.formatted_code || result,
              raw_result: result
            };
          }
          return {
            language: result.language || 'unknown',
            formatted_code: result.formatted_code || text,
            raw_result: result
          };
        } catch (parseError) {
          // 如果解析失败，返回原始响应
          return {
            language: 'unknown',
            formatted_code: result || text,
            raw_result: result
          };
        }
      } else {
        // 离线模式：返回简单的代码识别结果
        logService.warn('离线模式：无法识别代码');
        return {
          language: 'unknown',
          formatted_code: text
        };
      }
    } catch (error) {
      logService.error('代码识别失败', error);
      return {
        language: 'unknown',
        formatted_code: text,
        error: error.message
      };
    }
  }

  /**
   * 识别数学公式
   * @param {string} text 要识别的文本
   * @returns {Promise<Object>} 识别结果
   */
  async recognizeMathFormula(text) {
    try {
      await this.initialize();

      if (this.isOnline) {
        // 在线模式：调用后端API
        const response = await this.apiClient.post(API_ENDPOINTS.AI_ASSISTANT.PROCESS, {
          text,
          tool: 'math_formula'
        });

        const result = response.data.result;

        // 尝试解析JSON响应
        try {
          if (typeof result === 'string') {
            const parsed = JSON.parse(result);
            return {
              latex: parsed.latex || result,
              rendered: parsed.rendered || null,
              raw_result: result
            };
          }
          return {
            latex: result.latex || result,
            rendered: result.rendered || null,
            raw_result: result
          };
        } catch (parseError) {
          // 如果解析失败，返回原始响应
          return {
            latex: result || text,
            rendered: null,
            raw_result: result
          };
        }
      } else {
        // 离线模式：返回简单的数学公式识别结果
        logService.warn('离线模式：无法识别数学公式');
        return {
          latex: text,
          rendered: null
        };
      }
    } catch (error) {
      logService.error('数学公式识别失败', error);
      return {
        latex: text,
        rendered: null,
        error: error.message
      };
    }
  }

  /**
   * 生成文本摘要
   * @param {string} text 要摘要的文本
   * @returns {Promise<Object>} 摘要结果
   */
  async summarizeText(text) {
    try {
      await this.initialize();

      if (this.isOnline) {
        // 在线模式：调用后端API
        const response = await this.apiClient.post(API_ENDPOINTS.AI_ASSISTANT.SUMMARIZE, {
          text
        });

        return { 
          result: response.data.summary || response.data.result,
          source_text: text 
        };
      } else {
        // 离线模式：返回简单摘要
        logService.warn('离线模式：无法生成摘要');
        const summary = text.length > 100 ? text.substring(0, 100) + '...' : text;
        return { result: summary, source_text: text };
      }
    } catch (error) {
      logService.error('文本摘要失败', error);
      const summary = text.length > 100 ? text.substring(0, 100) + '...' : text;
      return { result: summary, source_text: text, error: error.message };
    }
  }

  /**
   * 提取关键词
   * @param {string} text 要提取关键词的文本
   * @returns {Promise<Object>} 提取结果
   */
  async extractKeywords(text) {
    try {
      await this.initialize();

      if (this.isOnline) {
        // 在线模式：调用后端API
        const response = await this.apiClient.post(API_ENDPOINTS.AI_ASSISTANT.PROCESS, {
          text,
          tool: 'extract_keywords'
        });

        const result = response.data.result;

        // 尝试解析JSON响应
        try {
          if (typeof result === 'string') {
            // 尝试解析为JSON
            const parsed = JSON.parse(result);
            if (parsed.keywords && Array.isArray(parsed.keywords)) {
              return { keywords: parsed.keywords, source_text: text };
            }
            // 如果不是预期格式，尝试分割字符串
            const keywords = result.split(/[,，、\n]/).map(k => k.trim()).filter(k => k);
            return { keywords, source_text: text };
          }
          
          if (result.keywords && Array.isArray(result.keywords)) {
            return { keywords: result.keywords, source_text: text };
          }

          // 尝试从字符串中提取关键词
          const keywords = String(result).split(/[,，、\n]/).map(k => k.trim()).filter(k => k);
          return { keywords, source_text: text };
        } catch (parseError) {
          // 如果解析失败，尝试从文本中提取关键词
          const keywords = result.split(/[,，、\n]/).map(k => k.trim()).filter(k => k);
          return { keywords, source_text: text };
        }
      } else {
        // 离线模式：返回简单关键词
        logService.warn('离线模式：无法提取关键词');
        const words = text.split(/\s+/).slice(0, 5);
        return { keywords: words, source_text: text };
      }
    } catch (error) {
      logService.error('关键词提取失败', error);
      const words = text.split(/\s+/).slice(0, 5);
      return { keywords: words, source_text: text, error: error.message };
    }
  }

  /**
   * 解释文本
   * @param {string} text 要解释的文本
   * @returns {Promise<Object>} 解释结果
   */
  async explainText(text) {
    try {
      await this.initialize();

      if (this.isOnline) {
        // 在线模式：调用后端API
        const response = await this.apiClient.post(API_ENDPOINTS.AI_ASSISTANT.PROCESS, {
          text,
          tool: 'explain'
        });

        return { 
          result: response.data.result,
          source_text: text 
        };
      } else {
        // 离线模式：返回简单解释
        logService.warn('离线模式：无法提供解释');
        return { result: '离线模式下无法提供详细解释', source_text: text };
      }
    } catch (error) {
      logService.error('文本解释失败', error);
      return { 
        result: '解释失败，请稍后重试', 
        source_text: text, 
        error: error.message 
      };
    }
  }

  /**
   * 改写文本
   * @param {string} text 要改写的文本
   * @returns {Promise<Object>} 改写结果
   */
  async rewriteText(text) {
    try {
      await this.initialize();

      if (this.isOnline) {
        // 在线模式：调用后端API
        const response = await this.apiClient.post(API_ENDPOINTS.AI_ASSISTANT.PROCESS, {
          text,
          tool: 'rewrite'
        });

        return { 
          result: response.data.result,
          source_text: text 
        };
      } else {
        // 离线模式：返回原文本
        logService.warn('离线模式：无法改写文本');
        return { result: text, source_text: text };
      }
    } catch (error) {
      logService.error('文本改写失败', error);
      return { result: text, source_text: text, error: error.message };
    }
  }

  /**
   * 通用文本处理
   * @param {string} text 要处理的文本
   * @param {string} toolId 工具ID
   * @returns {Promise<Object>} 处理结果
   */
  async processText(text, toolId) {
    try {
      await this.initialize();

      if (this.isOnline) {
        // 在线模式：调用后端API
        const response = await this.apiClient.post(API_ENDPOINTS.AI_ASSISTANT.PROCESS, {
          text,
          tool: toolId
        });

        return { 
          result: response.data.result,
          source_text: text,
          tool: toolId
        };
      } else {
        // 离线模式：返回简单处理结果
        logService.warn(`离线模式：无法处理文本(${toolId})`);
        return { result: text, source_text: text, tool: toolId };
      }
    } catch (error) {
      logService.error(`文本处理失败(${toolId})`, error);
      return { result: text, source_text: text, tool: toolId, error: error.message };
    }
  }
}

export const noteAIService = new NoteAIService();
