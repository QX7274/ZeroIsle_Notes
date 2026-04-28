/**
 * 翻译服务
 * 提供文本翻译功能
 * @deprecated 请使�?src/services/ai/translationService.js
 */
import { analyticsService } from '../analytics/analyticsService';
import translationServiceModule from '../ai/translationService';

/**
 * 翻译服务�?
 * 提供文本翻译功能
 * @deprecated 请使�?src/services/ai/translationService.js
 */
class TranslationService {
  constructor() {
    this.translationHistory = [];
    this.supportedLanguages = Object.entries(translationServiceModule.getSupportedLanguages()).map(
      ([code, name]) => ({ code, name })
    );
  }

  /**
   * 翻译文本
   * @param {string} text - 要翻译的文本
   * @param {string} targetLang - 目标语言代码
   * @returns {Promise<string>} - 翻译后的文本
   */
  async translateText(text, targetLang) {
    try {
      const translatedText = await translationServiceModule.translateText(text, targetLang);

      analyticsService.trackTranslationAction('translate', {
        textLength: text.length,
        targetLang,
      });

      this.addToHistory(text, translatedText, targetLang);
      return translatedText;
    } catch (error) {
      console.error('文本翻译错误:', error);
      analyticsService.trackError(error, { action: 'translate_text' });
      throw error;
    }
  }

  async translateSelection(selectedText, targetLang) {
    try {
      const translatedText = await this.translateText(selectedText, targetLang);

      analyticsService.trackTranslationAction('translate_selection', {
        textLength: selectedText.length,
        targetLang,
      });

      return translatedText;
    } catch (error) {
      console.error('选中文本翻译错误:', error);
      analyticsService.trackError(error, { action: 'translate_selection' });
      throw error;
    }
  }

  async translateDocument(text, targetLang) {
    try {
      // 将文本分成较小的段落进行翻译
      const paragraphs = text.split('\n\n');
      const translatedParagraphs = await Promise.all(
        paragraphs.map(paragraph => this.translateText(paragraph, targetLang))
      );

      const translatedText = translatedParagraphs.join('\n\n');

      analyticsService.trackTranslationAction('translate_document', {
        textLength: text.length,
        targetLang,
        paragraphCount: paragraphs.length,
      });

      return translatedText;
    } catch (error) {
      console.error('文档翻译错误:', error);
      analyticsService.trackError(error, { action: 'translate_document' });
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
      const language = await translationServiceModule.detectLanguage(text);

      analyticsService.trackTranslationAction('detect_language', {
        textLength: text.length,
      });

      return language;
    } catch (error) {
      console.error('语言检测错�?', error);
      analyticsService.trackError(error, { action: 'detect_language' });
      throw error;
    }
  }

  addToHistory(originalText, translatedText, targetLang) {
    this.translationHistory.unshift({
      originalText,
      translatedText,
      targetLang,
      timestamp: new Date().toISOString(),
    });

    // 保持历史记录�?00条以�?
    if (this.translationHistory.length > 100) {
      this.translationHistory.pop();
    }

    analyticsService.trackTranslationAction('add_to_history', {
      textLength: originalText.length,
      targetLang,
    });
  }

  getTranslationHistory() {
    return this.translationHistory;
  }

  clearTranslationHistory() {
    this.translationHistory = [];
    analyticsService.trackTranslationAction('clear_history');
  }

  getSupportedLanguages() {
    return this.supportedLanguages;
  }
}

const translationService = new TranslationService();

module.exports = translationService;
module.exports.default = translationService;
module.exports.translationService = translationService;
module.exports.TranslationService = TranslationService;
