import { analyticsService } from './analytics';
import { apiService } from './api';
import { aiService } from './aiService';

class SearchService {
  constructor() {
    this.searchHistory = [];
  }

  async searchByText(query) {
    try {
      const response = await apiService.post('/search/text', { query });
      
      analyticsService.trackSearchAction('text', {
        queryLength: query.length,
        resultCount: response.data.results.length,
      });
      
      this.addToHistory('text', query);
      return response.data.results;
    } catch (error) {
      console.error('文本搜索错误:', error);
      analyticsService.trackError(error, { action: 'search_text' });
      throw error;
    }
  }

  async searchByImage(imageFile) {
    try {
      const formData = new FormData();
      formData.append('image', imageFile);
      
      const response = await apiService.post('/search/image', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      analyticsService.trackSearchAction('image', {
        fileSize: imageFile.size,
        fileType: imageFile.type,
        resultCount: response.data.results.length,
      });
      
      this.addToHistory('image', imageFile.name);
      return response.data.results;
    } catch (error) {
      console.error('图片搜索错误:', error);
      analyticsService.trackError(error, { action: 'search_image' });
      throw error;
    }
  }

  async searchByVoice(audioFile) {
    try {
      // 先将语音转换为文本
      const text = await aiService.transcribeAudio(audioFile);
      
      // 使用转换后的文本进行搜索
      const results = await this.searchByText(text);
      
      analyticsService.trackSearchAction('voice', {
        fileSize: audioFile.size,
        fileType: audioFile.type,
        resultCount: results.length,
      });
      
      this.addToHistory('voice', text);
      return results;
    } catch (error) {
      console.error('语音搜索错误:', error);
      analyticsService.trackError(error, { action: 'search_voice' });
      throw error;
    }
  }

  async searchByKnowledgeGraph(query) {
    try {
      const response = await apiService.post('/search/knowledge-graph', { query });
      
      analyticsService.trackSearchAction('knowledge_graph', {
        queryLength: query.length,
        resultCount: response.data.results.length,
      });
      
      this.addToHistory('knowledge_graph', query);
      return response.data.results;
    } catch (error) {
      console.error('知识图谱搜索错误:', error);
      analyticsService.trackError(error, { action: 'search_knowledge_graph' });
      throw error;
    }
  }

  addToHistory(type, query) {
    this.searchHistory.unshift({
      type,
      query,
      timestamp: new Date().toISOString(),
    });
    
    // 保持历史记录在100条以内
    if (this.searchHistory.length > 100) {
      this.searchHistory.pop();
    }
    
    analyticsService.trackSearchAction('add_to_history', {
      type,
      queryLength: typeof query === 'string' ? query.length : 0,
    });
  }

  getSearchHistory() {
    return this.searchHistory;
  }

  clearSearchHistory() {
    this.searchHistory = [];
    analyticsService.trackSearchAction('clear_history');
  }
}

export const searchService = new SearchService(); 