/**
 * Word文档解析服务
 * 提供多种解析方法，确保在mammoth失败时有备选方案
 */

import RNFS from 'react-native-fs';
import '../../utils/mammothPolyfill';

// 动态导入各种Word文档解析库
let mammoth = null;

// 尝试加载mammoth库
try {
  mammoth = require('mammoth');
  console.log('WordDocumentParser: mammoth库加载成功');
} catch (error) {
  console.warn('WordDocumentParser: mammoth库不可用:', error.message);
  try {
    mammoth = require('mammoth/browser');
    console.log('WordDocumentParser: mammoth浏览器版本加载成功');
  } catch (browserError) {
    console.warn('WordDocumentParser: mammoth浏览器版本也不可用:', browserError.message);
  }
}

// docx库在React Native环境中不可用，已移除
// 该库依赖Node.js模块，在移动端无法使用

// docx4js库在React Native环境中不兼容，已移除
// 该库依赖Node.js的fs模块，在移动端无法使用

class WordDocumentParser {
  constructor() {
    this.cache = new Map();
    this.maxCacheSize = 20;
  }

  /**
   * 解析Word文档
   */
  async parseWordDocument(filePath, fileName) {
    console.log('WordDocumentParser: 开始解析Word文档:', fileName);
    
    // 检查缓存
    const cacheKey = `word_${filePath}`;
    if (this.cache.has(cacheKey)) {
      console.log('WordDocumentParser: 使用缓存结果');
      return this.cache.get(cacheKey);
    }

    try {
      // 检查文件存在性
      const fileExists = await RNFS.exists(filePath);
      if (!fileExists) {
        throw new Error(`文件不存在: ${filePath}`);
      }

      const fileStats = await RNFS.stat(filePath);
      
      // 尝试多种解析方法
      let result = null;
      
      // 方法1: mammoth解析
      if (mammoth) {
        try {
          result = await this.parseWithMammoth(filePath, fileName, fileStats);
          if (result) {
            this.addToCache(cacheKey, result);
            return result;
          }
        } catch (error) {
          console.warn('WordDocumentParser: mammoth解析失败:', error.message);
        }
      }

      // docx库解析方法已移除（React Native不兼容）

      // docx4js库解析方法已移除（React Native不兼容）

      // 方法4: 原生文本提取
      try {
        result = await this.parseWithNative(filePath, fileName, fileStats);
        if (result) {
          this.addToCache(cacheKey, result);
          return result;
        }
      } catch (error) {
        console.warn('WordDocumentParser: 原生解析失败:', error.message);
      }

      // 所有方法都失败，返回降级结果
      console.warn('WordDocumentParser: 所有解析方法都失败，返回降级结果');
      return this.createFallbackResult(filePath, fileName, fileStats);

    } catch (error) {
      console.error('WordDocumentParser: 解析过程出错:', error);
      return this.createFallbackResult(filePath, fileName, null);
    }
  }

  /**
   * 使用mammoth解析
   */
  async parseWithMammoth(filePath, fileName, fileStats) {
    console.log('WordDocumentParser: 使用mammoth解析');
    
    const fileBase64 = await RNFS.readFile(filePath, 'base64');
    const buffer = Buffer.from(fileBase64, 'base64');
    const arrayBuffer = buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength
    );

    let html = null;
    let rawText = null;
    let messages = [];

    try {
      const htmlResult = await mammoth.convertToHtml({ arrayBuffer });
      html = htmlResult.value;
      messages = htmlResult.messages || [];
    } catch (error) {
      console.warn('WordDocumentParser: mammoth HTML转换失败:', error.message);
    }

    try {
      const textResult = await mammoth.extractRawText({ arrayBuffer });
      rawText = textResult.value;
    } catch (error) {
      console.warn('WordDocumentParser: mammoth文本提取失败:', error.message);
    }

    if (!html && !rawText) {
      throw new Error('mammoth解析结果为空');
    }

    return {
      type: 'word',
      content: rawText || '文档内容',
      htmlContent: this.enhanceHtmlContent(html || rawText || ''),
      formattedContent: this.enhanceHtmlContent(html || rawText || ''),
      messages: messages.map(msg => ({ message: msg.message, type: 'info' })),
      structure: {
        hasHtml: !!html,
        paragraphs: (html ? (html.match(/<p[^>]*>/g) || []).length : 0),
        tables: (html ? (html.match(/<table[^>]*>/g) || []).length : 0),
        images: (html ? (html.match(/<img[^>]*>/g) || []).length : 0)
      },
      metadata: {
        filePath,
        fileName,
        fileSize: fileStats.size,
        lastModified: new Date(fileStats.mtime).toISOString(),
        extractionMethod: 'mammoth',
        requiresNativeApp: false,
        fileType: fileName.toLowerCase().endsWith('.docx') ? 'docx' : 'doc'
      }
    };
  }

  /**
   * docx库解析方法已移除（React Native不兼容）
   * 该库依赖Node.js模块，在移动端无法使用
   */

  /**
   * docx4js库解析方法已移除（React Native不兼容）
   * 该库依赖Node.js的fs模块，在移动端无法使用
   */

  /**
   * 使用原生方法解析
   */
  async parseWithNative(filePath, fileName, fileStats) {
    console.log('WordDocumentParser: 使用原生方法解析');
    
    const fileContent = await RNFS.readFile(filePath, 'base64');
    const buffer = Buffer.from(fileContent, 'base64');
    
    const text = this.extractTextFromBuffer(buffer);
    
    if (!text || text.length === 0) {
      throw new Error('原生方法无法提取文本');
    }
    
    const html = this.convertTextToHtml(text);
    
    return {
      type: 'word',
      content: text,
      htmlContent: this.enhanceHtmlContent(html),
      formattedContent: this.enhanceHtmlContent(html),
      messages: [{ message: '使用原生方法成功提取文本', type: 'success' }],
      structure: {
        hasHtml: true,
        paragraphs: text.split('\n\n').length,
        tables: 0,
        images: 0
      },
      metadata: {
        filePath,
        fileName,
        fileSize: fileStats.size,
        lastModified: new Date(fileStats.mtime).toISOString(),
        extractionMethod: 'native',
        requiresNativeApp: false,
        fileType: fileName.toLowerCase().endsWith('.docx') ? 'docx' : 'doc'
      }
    };
  }

  /**
   * 从Buffer中提取文本
   */
  extractTextFromBuffer(buffer) {
    try {
      // 检查文件头
      const header = buffer.slice(0, 4).toString('hex').toUpperCase();
      
      if (header.startsWith('504B0304') || header.startsWith('504B0506') || header.startsWith('504B0708')) {
        console.warn('WordDocumentParser: 检测到ZIP格式文件，无法直接提取文本');
        return null;
      }
      
      if (header.startsWith('D0CF11E0')) {
        console.warn('WordDocumentParser: 检测到OLE格式文件，无法直接提取文本');
        return null;
      }
      
      // 尝试不同的编码方式
      const encodings = ['utf8', 'utf16le', 'latin1'];
      
      for (const encoding of encodings) {
        try {
          const text = buffer.toString(encoding);
          if (text && text.length > 0 && 
              /[\u4e00-\u9fa5a-zA-Z]/.test(text) && 
              !text.includes('PK') && 
              !text.includes('\x00') &&
              text.length > 10) {
            return text;
          }
        } catch (e) {
          continue;
        }
      }
      
      return null;
    } catch (error) {
      console.warn('WordDocumentParser: 文本提取失败:', error);
      return null;
    }
  }

  /**
   * 将文本转换为HTML
   */
  convertTextToHtml(text) {
    if (!text) return '';
    
    let html = text
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    return `<p>${html}</p>`;
  }

  /**
   * 增强HTML内容
   */
  enhanceHtmlContent(html) {
    if (!html) return '';
    
    // 添加基本的样式
    return `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333;">
        ${html}
      </div>
    `;
  }

  /**
   * 创建降级结果
   */
  createFallbackResult(filePath, fileName, fileStats) {
    return {
      type: 'word',
      content: '无法解析文档内容，建议使用原生应用打开',
      htmlContent: '<div style="padding: 20px; text-align: center; color: #666;"><p>无法解析文档内容</p><p>建议使用原生应用打开此文件</p></div>',
      formattedContent: '<div style="padding: 20px; text-align: center; color: #666;"><p>无法解析文档内容</p><p>建议使用原生应用打开此文件</p></div>',
      messages: [{ message: '所有解析方法都失败，建议使用原生应用打开', type: 'warning' }],
      structure: {
        hasHtml: false,
        paragraphs: 0,
        tables: 0,
        images: 0
      },
      metadata: {
        filePath,
        fileName,
        fileSize: fileStats ? fileStats.size : 0,
        lastModified: fileStats ? new Date(fileStats.mtime).toISOString() : new Date().toISOString(),
        extractionMethod: 'fallback',
        requiresNativeApp: true,
        fileType: fileName.toLowerCase().endsWith('.docx') ? 'docx' : 'doc'
      }
    };
  }

  /**
   * 添加到缓存
   */
  addToCache(key, data) {
    if (this.cache.size >= this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, data);
  }

  /**
   * 清理缓存
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * 获取缓存统计
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

export default new WordDocumentParser();
