/**
 * 笔记工具栏服务
 * 提供笔记工具栏相关功能
 */
import { analyticsService } from './analytics';
import { notesApi } from './api/index';
import { aiService } from './ai/index';

class NoteToolbarService {
  constructor() {
    this.exportFormats = [
      { id: 'pdf', name: 'PDF' },
      { id: 'docx', name: 'Word' },
      { id: 'txt', name: '纯文本' },
      { id: 'md', name: 'Markdown' },
    ];
  }

  /**
   * 根据关键词搜索笔记内容
   * @param {string} text - 要搜索的文本
   * @param {Array<string>} keywords - 关键词数组
   * @returns {Promise<Array>} - 搜索结果
   */
  async searchByKeywords(text, keywords) {
    try {
      // 使用notesApi进行搜索
      const response = await notesApi.searchByKeywords({
        text,
        keywords,
      });

      analyticsService.trackNoteAction('keyword_search', {
        textLength: text.length,
        keywordCount: keywords.length,
        resultCount: response.data?.results?.length || 0,
      });

      return response.data?.results || [];
    } catch (error) {
      console.error('关键词搜索错误:', error);
      analyticsService.trackError(error, { action: 'keyword_search' });
      throw error;
    }
  }

  async generateSummary(text) {
    try {
      const summary = await aiService.summarizeText(text);

      analyticsService.trackNoteAction('generate_summary', {
        textLength: text.length,
        summaryLength: summary.length,
      });

      return summary;
    } catch (error) {
      console.error('生成摘要错误:', error);
      analyticsService.trackError(error, { action: 'generate_summary' });
      throw error;
    }
  }

  async generateMindMap(text) {
    try {
      const mindmap = await aiService.generateMindMap(text);

      analyticsService.trackNoteAction('generate_mindmap', {
        textLength: text.length,
        nodeCount: mindmap.nodes.length,
      });

      return mindmap;
    } catch (error) {
      console.error('生成思维导图错误:', error);
      analyticsService.trackError(error, { action: 'generate_mindmap' });
      throw error;
    }
  }

  async checkContent(text) {
    try {
      const result = await aiService.checkContent(text);

      analyticsService.trackNoteAction('check_content', {
        textLength: text.length,
        errorCount: result.errors.length,
        suggestionCount: result.suggestions.length,
      });

      return result;
    } catch (error) {
      console.error('内容检查错误:', error);
      analyticsService.trackError(error, { action: 'check_content' });
      throw error;
    }
  }

  /**
   * 导出笔记
   * @param {string} noteId - 笔记ID
   * @param {string} format - 导出格式
   * @returns {Promise<string>} - 导出文件URL
   */
  async exportNote(noteId, format) {
    try {
      const response = await notesApi.exportNote(noteId, format);

      analyticsService.trackNoteAction('export', {
        noteId,
        format,
      });

      return response.data?.fileUrl || response.data;
    } catch (error) {
      console.error('导出笔记错误:', error);
      analyticsService.trackError(error, { action: 'export_note' });
      throw error;
    }
  }

  async generateKnowledgeGraph(text) {
    try {
      const graph = await aiService.generateKnowledgeGraph(text);

      analyticsService.trackNoteAction('generate_knowledge_graph', {
        textLength: text.length,
        nodeCount: graph.nodes.length,
        edgeCount: graph.edges.length,
      });

      return graph;
    } catch (error) {
      console.error('生成知识图谱错误:', error);
      analyticsService.trackError(error, { action: 'generate_knowledge_graph' });
      throw error;
    }
  }

  getExportFormats() {
    return this.exportFormats;
  }
}

export const noteToolbarService = new NoteToolbarService();