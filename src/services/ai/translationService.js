/**
 * 翻译服务
 * 提供文本翻译功能
 */
import apiClient from '../api/apiClient';
import analyticsService from '../analytics/analyticsService';

/**
 * 支持的语言列表
 */
export const SUPPORTED_LANGUAGES = {
  'zh-CN': '中文(简体)',
  'zh-TW': '中文(繁体)',
  'en': '英语',
  'ja': '日语',
  'ko': '韩语',
  'fr': '法语',
  'de': '德语',
  'es': '西班牙语',
  'it': '意大利语',
  'ru': '俄语',
  'pt': '葡萄牙语',
  'ar': '阿拉伯语',
  'hi': '印地语',
  'th': '泰语',
  'vi': '越南语'
};

/**
 * 翻译服务
 */
class TranslationService {
  /**
   * 翻译文本
   * @param {string} text - 要翻译的文本
   * @param {string} targetLang - 目标语言代码
   * @param {string} sourceLang - 源语言代码（可选，自动检测）
   * @returns {Promise<string>} - 翻译后的文本
   */
  async translateText(text, targetLang, sourceLang = 'auto') {
    try {
      const response = await apiClient.post('/ai/translate', {
        text,
        target_lang: targetLang,
        source_lang: sourceLang
      });

      analyticsService.trackEvent('translate_text', {
        textLength: text.length,
        sourceLang,
        targetLang
      });

      return response.data.translated_text;
    } catch (error) {
      console.error('翻译文本失败:', error);
      analyticsService.trackError(error, { action: 'translate_text' });
      throw error;
    }
  }

  /**
   * 检测语言
   * @param {string} text - 要检测的文本
   * @returns {Promise<string>} - 检测到的语言代码
   */
  async detectLanguage(text) {
    try {
      const response = await apiClient.post('/ai/detect-language', {
        text
      });

      analyticsService.trackEvent('detect_language', {
        textLength: text.length
      });

      return response.data.language;
    } catch (error) {
      console.error('检测语言失败:', error);
      analyticsService.trackError(error, { action: 'detect_language' });
      throw error;
    }
  }

  /**
   * 获取支持的语言列表
   * @returns {Object} - 语言代码到语言名称的映射
   */
  getSupportedLanguages() {
    return SUPPORTED_LANGUAGES;
  }
}

export default new TranslationService();
