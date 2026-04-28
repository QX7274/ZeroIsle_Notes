/**
 * 代码服务
 * 提供代码检测、补全、解释、格式化、运行等功能
 */
import { analyticsService } from '../analytics/analyticsService';
import { codeApi } from './api/index';
import { aiService } from '../ai/index';

class CodeService {
  constructor() {
    this.codeSnippets = [];
  }

  /**
   * 检测
   * @param {string} text - 要检测的文本
   * @returns {Promise<Object>} - 检测结果
   */
  async detectCode(text) {
    try {
      const response = await codeApi.detectCodeLanguage(text);

      analyticsService.trackCodeAction('detect_code', {
        textLength: text.length,
        codeCount: response.data?.codeBlocks?.length || 0,
      });

      return response.data;
    } catch (error) {
      console.error('检测代码错误?', error);
      analyticsService.trackError(error, { action: 'detect_code' });
      throw error;
    }
  }

  async completeCode(code, language) {
    try {
      const response = await codeApi.completeCode({
        code,
        language,
      });

      analyticsService.trackCodeAction('complete_code', {
        language,
        codeLength: code.length,
      });

      return response.data.completedCode;
    } catch (error) {
      console.error('代码补全错误:', error);
      analyticsService.trackError(error, { action: 'complete_code' });
      throw error;
    }
  }

  async explainCode(code, language) {
    try {
      const response = await codeApi.explainCode({
        code,
        language,
      });

      analyticsService.trackCodeAction('explain_code', {
        language,
        codeLength: code.length,
      });

      return response.data.explanation;
    } catch (error) {
      console.error('代码解释错误:', error);
      analyticsService.trackError(error, { action: 'explain_code' });
      throw error;
    }
  }

  async generateExample(language, concept) {
    try {
      const response = await codeApi.generateExample({
        language,
        concept,
      });

      analyticsService.trackCodeAction('generate_example', {
        language,
        concept,
      });

      return response.data.example;
    } catch (error) {
      console.error('生成示例错误:', error);
      analyticsService.trackError(error, { action: 'generate_example' });
      throw error;
    }
  }

  async formatCode(code, language) {
    try {
      const response = await codeApi.formatCode({
        code,
        language,
      });

      analyticsService.trackCodeAction('format_code', {
        language,
        codeLength: code.length,
      });

      return response.data.formattedCode;
    } catch (error) {
      console.error('代码格式化错误', error);
      analyticsService.trackError(error, { action: 'format_code' });
      throw error;
    }
  }

  async lintCode(code, language) {
    try {
      const response = await codeApi.lintCode({
        code,
        language,
      });

      analyticsService.trackCodeAction('lint_code', {
        language,
        codeLength: code.length,
      });

      return response.data.issues;
    } catch (error) {
      console.error('代码检查错误', error);
      analyticsService.trackError(error, { action: 'lint_code' });
      throw error;
    }
  }

  async runCode(code, language, input) {
    try {
      const response = await codeApi.runCode({
        code,
        language,
        input,
      });

      analyticsService.trackCodeAction('run_code', {
        language,
        codeLength: code.length,
      });

      return response.data;
    } catch (error) {
      console.error('运行代码错误:', error);
      analyticsService.trackError(error, { action: 'run_code' });
      throw error;
    }
  }

  async saveSnippet(code, language, title, description) {
    try {
      const response = await codeApi.createSnippet({
        code,
        language,
        title,
        description,
      });

      analyticsService.trackCodeAction('save_snippet', {
        language,
        titleLength: title.length,
      });

      return response.data.snippet;
    } catch (error) {
      console.error('保存代码片段错误:', error);
      analyticsService.trackError(error, { action: 'save_snippet' });
      throw error;
    }
  }

  async getSnippets(page = 1, limit = 10) {
    try {
      const response = await codeApi.getAllSnippets({
        params: { page, limit },
      });

      analyticsService.trackCodeAction('get_snippets', {
        page,
        snippetCount: response.data.snippets.length,
      });

      return response.data;
    } catch (error) {
      console.error('获取代码片段错误:', error);
      analyticsService.trackError(error, { action: 'get_snippets' });
      throw error;
    }
  }
}

const codeService = new CodeService();

module.exports = codeService;
module.exports.default = codeService;
module.exports.codeService = codeService;
module.exports.CodeService = CodeService;

