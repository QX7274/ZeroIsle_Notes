/**
 * 笔记AI服务
 * 提供笔记相关的AI功能，如文本翻译、代码识别、公式识别等
 */

import { aiService } from '../ai/aiService';
import { networkService } from '../network/networkService';
import { offlineAIService } from '../offline/offlineAIService';

/**
 * 笔记AI服务
 */
class NoteAIService {
  constructor() {
    this.initialized = false;
  }

  /**
   * 初始化服务
   */
  async initialize() {
    if (this.initialized) return;

    try {
      // 检查网络状态
      this.isOnline = networkService.isOnline();
      this.initialized = true;
      console.info('笔记AI服务初始化成功');
    } catch (error) {
      console.error('笔记AI服务初始化失败', error);
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
        // 在线模式：使用AI服务
        const translatedText = await aiService.translateText(text, targetLang);
        return { translated_text: translatedText, source_text: text };
      } else {
        // 离线模式：使用离线AI服务
        return await offlineAIService.translateText(text, targetLang);
      }
    } catch (error) {
      console.error('文本翻译失败', error);
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
        // 在线模式：使用AI服务
        const prompt = `识别并格式化以下代码，返回JSON格式，包含language（编程语言）和formatted_code（格式化后的代码）字段：\n\n${text}`;
        const response = await aiService.chat(prompt);

        try {
          // 尝试解析JSON响应
          return JSON.parse(response);
        } catch (parseError) {
          // 如果解析失败，返回原始响应
          return {
            language: 'unknown',
            formatted_code: response
          };
        }
      } else {
        // 离线模式：使用离线AI服务
        return await offlineAIService.recognizeCode(text);
      }
    } catch (error) {
      console.error('代码识别失败', error);
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
        // 在线模式：使用AI服务
        const prompt = `识别以下数学公式，并转换为LaTeX格式，返回JSON格式，包含latex（LaTeX代码）和rendered（渲染后的公式，如果可能）字段：\n\n${text}`;
        const response = await aiService.chat(prompt);

        try {
          // 尝试解析JSON响应
          return JSON.parse(response);
        } catch (parseError) {
          // 如果解析失败，返回原始响应
          return {
            latex: response,
            rendered: null
          };
        }
      } else {
        // 离线模式：使用离线AI服务
        return await offlineAIService.recognizeMathFormula(text);
      }
    } catch (error) {
      console.error('数学公式识别失败', error);
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
        // 在线模式：使用AI服务
        const summary = await aiService.summarizeText(text);
        return { result: summary, source_text: text };
      } else {
        // 离线模式：使用离线AI服务
        return await offlineAIService.summarizeText(text);
      }
    } catch (error) {
      console.error('文本摘要失败', error);
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
        // 在线模式：使用AI服务
        const prompt = `从以下文本中提取关键词，返回JSON格式，包含keywords（关键词数组）字段：\n\n${text}`;
        const response = await aiService.chat(prompt);

        try {
          // 尝试解析JSON响应
          return JSON.parse(response);
        } catch (parseError) {
          // 如果解析失败，尝试从文本中提取关键词
          const keywords = response.split(/[,，、\n]/).map(k => k.trim()).filter(k => k);
          return { keywords, source_text: text };
        }
      } else {
        // 离线模式：使用离线AI服务
        return await offlineAIService.extractKeywords(text);
      }
    } catch (error) {
      console.error('关键词提取失败', error);
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
        // 在线模式：使用AI服务
        const explanation = await aiService.chat(`请解释以下内容：\n\n${text}`);
        return { result: explanation, source_text: text };
      } else {
        // 离线模式：使用离线AI服务
        return await offlineAIService.explainText(text);
      }
    } catch (error) {
      console.error('文本解释失败', error);
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
        // 在线模式：使用AI服务
        const rewritten = await aiService.chat(`请改写以下文本，保持原意但使用不同的表达方式：\n\n${text}`);
        return { result: rewritten, source_text: text };
      } else {
        // 离线模式：使用离线AI服务
        return await offlineAIService.rewriteText(text);
      }
    } catch (error) {
      console.error('文本改写失败', error);
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

      let prompt = '';

      // 根据工具ID生成不同的提示
      switch (toolId) {
        case 'grammar':
          prompt = `请检查以下文本的语法和拼写错误，并提供修正后的版本：\n\n${text}`;
          break;
        case 'simplify':
          prompt = `请简化以下文本，使其更容易理解，但保持原意：\n\n${text}`;
          break;
        default:
          prompt = `请处理以下文本（${toolId}）：\n\n${text}`;
          break;
      }

      if (this.isOnline) {
        // 在线模式：使用AI服务
        const result = await aiService.chat(prompt);
        return { result, source_text: text };
      } else {
        // 离线模式：使用离线AI服务
        return await offlineAIService.processText(text, toolId);
      }
    } catch (error) {
      console.error(`文本处理失败(${toolId})`, error);
      throw error;
    }
  }
}

export const noteAIService = new NoteAIService();
