import { Platform } from 'react-native';
import { analyticsService } from './analytics';
import { offlineStorageService } from './offlineStorage';

class AIService {
  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY;
    this.baseUrl = 'https://api.openai.com/v1';
  }

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

export const aiService = new AIService(); 