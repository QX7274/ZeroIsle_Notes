/**
 * 笔记AI服务
 * 提供笔记相关的AI功能，如文本翻译、代码识别、公式识别等
 */

import axios from 'axios';
import { Platform } from 'react-native';
import { API_ENDPOINTS } from '../../config/api';
import { API_BASE_URL } from '../../config/api';
import { networkService } from '../network/networkService';
import { logService } from '../../utils/logService';
import authStorage from '../auth/authStorage';
import AIAssistant from '../../native/AIAssistantModule';

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
    if (this.initialized) { return; }

    try {
      // 创建API客户端
      this.apiClient = axios.create({
        baseURL: API_BASE_URL,
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
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
          target_language: targetLang,
        });

        return {
          translated_text: response.data.translated_text || response.data.result,
          source_text: text,
        };
      } else {
        // 离线模式：禁止返回伪成功结果
        logService.warn('离线模式：无法翻译文本');
        throw new Error('离线模式无法翻译文本');
      }
    } catch (error) {
      logService.error('文本翻译失败', error);
      throw error;
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
          tool: 'code_recognition',
        });

        const result = response.data.result;

        // 尝试解析JSON响应
        try {
          if (typeof result === 'string') {
            const parsed = JSON.parse(result);
            return {
              language: parsed.language || 'unknown',
              formatted_code: parsed.formatted_code || result,
              raw_result: result,
            };
          }
          return {
            language: result.language || 'unknown',
            formatted_code: result.formatted_code || text,
            raw_result: result,
          };
        } catch (parseError) {
          // 如果解析失败，返回原始响应
          return {
            language: 'unknown',
            formatted_code: result || text,
            raw_result: result,
          };
        }
      } else {
        // 离线模式：禁止返回伪成功结果
        logService.warn('离线模式：无法识别代码');
        throw new Error('离线模式无法识别代码');
      }
    } catch (error) {
      logService.error('代码识别失败', error);
      throw error;
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
          tool: 'math_formula',
        });

        const result = response.data.result;

        // 尝试解析JSON响应
        try {
          if (typeof result === 'string') {
            const parsed = JSON.parse(result);
            return {
              latex: parsed.latex || result,
              rendered: parsed.rendered || null,
              raw_result: result,
            };
          }
          return {
            latex: result.latex || result,
            rendered: result.rendered || null,
            raw_result: result,
          };
        } catch (parseError) {
          // 如果解析失败，返回原始响应
          return {
            latex: result || text,
            rendered: null,
            raw_result: result,
          };
        }
      } else {
        // 离线模式：禁止返回伪成功结果
        logService.warn('离线模式：无法识别数学公式');
        throw new Error('离线模式无法识别数学公式');
      }
    } catch (error) {
      logService.error('数学公式识别失败', error);
      throw error;
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
          text,
        });

        return {
          result: response.data.summary || response.data.result,
          source_text: text,
        };
      } else {
        // 离线模式：禁止返回伪成功结果
        logService.warn('离线模式：无法生成摘要');
        throw new Error('离线模式无法生成摘要');
      }
    } catch (error) {
      logService.error('文本摘要失败', error);
      throw error;
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
          tool: 'extract_keywords',
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
        // 离线模式：禁止返回伪成功结果
        logService.warn('离线模式：无法提取关键词');
        throw new Error('离线模式无法提取关键词');
      }
    } catch (error) {
      logService.error('关键词提取失败', error);
      throw error;
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
          tool: 'explain',
        });

        return {
          result: response.data.result,
          source_text: text,
        };
      } else {
        // 离线模式：禁止返回伪成功结果
        logService.warn('离线模式：无法提供解释');
        throw new Error('离线模式无法提供解释');
      }
    } catch (error) {
      logService.error('文本解释失败', error);
      throw error;
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
          tool: 'rewrite',
        });

        return {
          result: response.data.result,
          source_text: text,
        };
      } else {
        // 离线模式：禁止返回伪成功结果
        logService.warn('离线模式：无法改写文本');
        throw new Error('离线模式无法改写文本');
      }
    } catch (error) {
      logService.error('文本改写失败', error);
      throw error;
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
          tool: toolId,
        });

        return {
          result: response.data.result,
          source_text: text,
          tool: toolId,
        };
      } else {
        // 离线模式：禁止返回伪成功结果
        logService.warn(`离线模式：无法处理文本(${toolId})`);
        throw new Error(`离线模式无法处理文本(${toolId})`);
      }
    } catch (error) {
      logService.error(`文本处理失败(${toolId})`, error);
      throw error;
    }
  }

  /**
   * Process text with a streaming response.
   * @param {string} text The text to process.
   * @param {string} toolId The ID of the tool to use.
   * @param {object} options Additional options, including a custom `prompt`.
   * @returns {object} A stream controller with `onMessage`, `onComplete`, `onError`, `start`, and `stop` methods.
   */
  processTextStream(text, toolId, options = {}) {
    logService.info(`[noteAIService] Starting stream for tool: ${toolId}`, { text, options });

    const defaultPrompt = `You are an expert assistant. The user has provided the following text and wants to use the '${toolId}' tool. Please process it accordingly.`;

    const requestOptions = {
      engine: options.engine || 'default',
      model: options.model || 'default',
      prompt: options.prompt || defaultPrompt,
      history: options.history || [],
    };

    const fullPrompt = `${requestOptions.prompt}\n\nUser's text: "${text}"`;

    // Decide whether to use native or backend streaming
    if (Platform.OS === 'android' && AIAssistant.sendNativeStreamingMessage) {
      // Use direct native streaming on Android if available
      return AIAssistant.sendNativeStreamingMessage(fullPrompt, requestOptions);
    } else {
      // Fallback to backend API streaming for iOS and web
      return AIAssistant.sendMessageStream(fullPrompt, requestOptions);
    }
  }

}

const noteAIService = new NoteAIService();

module.exports = noteAIService;
module.exports.default = noteAIService;
module.exports.noteAIService = noteAIService;
module.exports.NoteAIService = NoteAIService;
