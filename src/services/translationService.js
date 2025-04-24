import { analyticsService } from './analytics';
import { apiService } from './api';
import { aiService } from './aiService';

class TranslationService {
  constructor() {
    this.translationHistory = [];
    this.supportedLanguages = [
      { code: 'zh', name: '中文' },
      { code: 'en', name: '英语' },
      { code: 'ja', name: '日语' },
      { code: 'ko', name: '韩语' },
      { code: 'fr', name: '法语' },
      { code: 'de', name: '德语' },
      { code: 'es', name: '西班牙语' },
      { code: 'ru', name: '俄语' },
    ];
  }

  async translateText(text, targetLang) {
    try {
      const response = await apiService.post('/translate', {
        text,
        targetLang,
      });
      
      analyticsService.trackTranslationAction('translate', {
        textLength: text.length,
        targetLang,
      });
      
      this.addToHistory(text, response.data.translatedText, targetLang);
      return response.data.translatedText;
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

  async detectLanguage(text) {
    try {
      const response = await apiService.post('/translate/detect', { text });
      
      analyticsService.trackTranslationAction('detect_language', {
        textLength: text.length,
      });
      
      return response.data.language;
    } catch (error) {
      console.error('语言检测错误:', error);
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
    
    // 保持历史记录在100条以内
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

export const translationService = new TranslationService(); 