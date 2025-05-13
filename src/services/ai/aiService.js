/**
 * AI服务
 * 提供AI相关功能，如聊天、语音转写、图像分析等
 */
import { Platform } from 'react-native';
import analyticsService from '../analytics/analyticsService';
import { offlineStorageService } from '../offline/offlineStorageService';

/**
 * AI服务
 */
class AIService {
  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY;
    this.baseUrl = 'https://api.openai.com/v1';
  }

  /**
   * 聊天
   * @param {string} prompt - 用户输入的提示
   * @returns {Promise<string>} - AI回复
   */
  async chat(prompt) {
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      const data = await response.json();
      analyticsService.trackAIAction('chat', { prompt });
      return data.choices[0].message.content;
    } catch (error) {
      console.error('AI 聊天失败:', error);
      analyticsService.trackError(error, { action: 'ai_chat' });
      throw error;
    }
  }

  /**
   * 语音转写
   * @param {Object} audioFile - 音频文件
   * @returns {Promise<string>} - 转写文本
   */
  async transcribeAudio(audioFile) {
    try {
      const formData = new FormData();
      formData.append('file', audioFile);
      formData.append('model', 'whisper-1');

      const response = await fetch(`${this.baseUrl}/audio/transcriptions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: formData,
      });

      const data = await response.json();
      analyticsService.trackAIAction('transcribe', { fileSize: audioFile.size });
      return data.text;
    } catch (error) {
      console.error('语音转文字失败:', error);
      analyticsService.trackError(error, { action: 'transcribe' });
      throw error;
    }
  }

  /**
   * 文本翻译
   * @param {string} text - 要翻译的文本
   * @param {string} targetLang - 目标语言
   * @returns {Promise<string>} - 翻译结果
   */
  async translateText(text, targetLang) {
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: `Translate the following text to ${targetLang}. Only return the translation.`,
            },
            { role: 'user', content: text },
          ],
        }),
      });

      const data = await response.json();
      analyticsService.trackAIAction('translate', {
        textLength: text.length,
        targetLang,
      });
      return data.choices[0].message.content;
    } catch (error) {
      console.error('翻译失败:', error);
      analyticsService.trackError(error, { action: 'translate' });
      throw error;
    }
  }

  /**
   * 图像分析
   * @param {Object} imageFile - 图像文件
   * @returns {Promise<string>} - 分析结果
   */
  async analyzeImage(imageFile) {
    try {
      const formData = new FormData();
      formData.append('file', imageFile);
      formData.append('model', 'gpt-4-vision-preview');

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: formData,
      });

      const data = await response.json();
      analyticsService.trackAIAction('analyze_image', { fileSize: imageFile.size });
      return data.choices[0].message.content;
    } catch (error) {
      console.error('图片分析失败:', error);
      analyticsService.trackError(error, { action: 'analyze_image' });
      throw error;
    }
  }

  /**
   * 生成思维导图
   * @param {string} text - 要生成思维导图的文本
   * @returns {Promise<Object>} - 思维导图数据
   */
  async generateMindMap(text) {
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: 'Generate a mind map in JSON format from the following text.',
            },
            { role: 'user', content: text },
          ],
        }),
      });

      const data = await response.json();
      analyticsService.trackAIAction('generate_mindmap', { textLength: text.length });
      return JSON.parse(data.choices[0].message.content);
    } catch (error) {
      console.error('生成思维导图失败:', error);
      analyticsService.trackError(error, { action: 'generate_mindmap' });
      throw error;
    }
  }

  /**
   * 内容检查
   * @param {string} text - 要检查的文本
   * @returns {Promise<Object>} - 检查结果
   */
  async checkContent(text) {
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: 'Check the following text for spelling errors and knowledge accuracy. Return a JSON with errors and suggestions.',
            },
            { role: 'user', content: text },
          ],
        }),
      });

      const data = await response.json();
      analyticsService.trackAIAction('check_content', { textLength: text.length });
      return JSON.parse(data.choices[0].message.content);
    } catch (error) {
      console.error('内容检查失败:', error);
      analyticsService.trackError(error, { action: 'check_content' });
      throw error;
    }
  }

  /**
   * 文本总结
   * @param {string} text - 要总结的文本
   * @returns {Promise<string>} - 总结结果
   */
  async summarizeText(text) {
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: 'Summarize the following text in a concise way.',
            },
            { role: 'user', content: text },
          ],
        }),
      });

      const data = await response.json();
      analyticsService.trackAIAction('summarize', { textLength: text.length });
      return data.choices[0].message.content;
    } catch (error) {
      console.error('文本总结失败:', error);
      analyticsService.trackError(error, { action: 'summarize' });
      throw error;
    }
  }

  /**
   * 生成知识图谱
   * @param {string} text - 要生成知识图谱的文本
   * @returns {Promise<Object>} - 知识图谱数据
   */
  async generateKnowledgeGraph(text) {
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: 'Generate a knowledge graph in JSON format from the following text.',
            },
            { role: 'user', content: text },
          ],
        }),
      });

      const data = await response.json();
      analyticsService.trackAIAction('generate_knowledge_graph', { textLength: text.length });
      return JSON.parse(data.choices[0].message.content);
    } catch (error) {
      console.error('生成知识图谱失败:', error);
      analyticsService.trackError(error, { action: 'generate_knowledge_graph' });
      throw error;
    }
  }
}

export default new AIService();
