import RNFS from 'react-native-fs';
import { Platform } from 'react-native';
import '../../utils/textEncodingPolyfill';
import '../../utils/mammothPolyfill';
import wordDocumentParser from './wordDocumentParser';

// 确保Buffer在React Native环境中可用
if (typeof Buffer === 'undefined') {
  global.Buffer = require('buffer').Buffer;
}

// 添加必要的polyfill
if (typeof global.process === 'undefined') {
  global.process = require('process');
}

// 确保stream模块可用
if (typeof global.stream === 'undefined') {
  try {
    global.stream = require('stream-browserify');
  } catch (error) {
    console.warn('EnhancedDocumentViewer: stream polyfill不可用:', error);
  }
}

// 确保util模块可用
if (typeof global.util === 'undefined') {
  try {
    global.util = require('util');
  } catch (error) {
    console.warn('EnhancedDocumentViewer: util polyfill不可用:', error);
  }
}

// 动态导入各种文档处理库
let mammoth = null;
let XLSX = null;
let OpenFile = null;
let pptxgen = null;
let docx = null;
let docxPreview = null;

// 使用mammoth标准版本（适配React Native环境）
try {
  // 在导入mammoth之前确保所有必要的polyfill都已加载
  mammoth = require('mammoth');
  console.log('EnhancedDocumentViewer: mammoth标准库加载成功');
} catch (error) {
  console.warn('EnhancedDocumentViewer: mammoth标准库不可用:', error.message);
  // 尝试使用备用方法
  try {
    mammoth = require('mammoth/browser');
    console.log('EnhancedDocumentViewer: mammoth浏览器版本加载成功');
  } catch (browserError) {
    console.warn('EnhancedDocumentViewer: mammoth浏览器版本也不可用:', browserError.message);
  }
}

try {
  XLSX = require('xlsx');
  console.log('EnhancedDocumentViewer: xlsx库加载成功');
} catch (error) {
  console.warn('EnhancedDocumentViewer: xlsx库不可用:', error);
}

try {
  OpenFile = require('react-native-doc-viewer');
  console.log('EnhancedDocumentViewer: react-native-doc-viewer库加载成功');
} catch (error) {
  console.warn('EnhancedDocumentViewer: react-native-doc-viewer库不可用:', error);
}

try {
  pptxgen = require('pptxgenjs');
  console.log('EnhancedDocumentViewer: pptxgenjs库加载成功');
} catch (error) {
  console.warn('EnhancedDocumentViewer: pptxgenjs库不可用:', error);
}

try {
  docx = require('docx');
  console.log('EnhancedDocumentViewer: docx库加载成功');
} catch (error) {
  console.warn('EnhancedDocumentViewer: docx库不可用:', error);
}

// 尝试加载docx-preview库
try {
  docxPreview = require('docx-preview');
  console.log('EnhancedDocumentViewer: docx-preview库加载成功');
} catch (error) {
  console.warn('EnhancedDocumentViewer: docx-preview库不可用:', error);
}

// 尝试加载docx4js库作为mammoth的替代方案
let docx4js = null;
try {
  docx4js = require('docx4js');
  console.log('EnhancedDocumentViewer: docx4js库加载成功');
} catch (error) {
  console.warn('EnhancedDocumentViewer: docx4js库不可用:', error);
}

/**
 * 增强的文档查看服务
 * 支持Word、PPT、Excel文件的多种解析方法
 */
class EnhancedDocumentViewer {
  constructor() {
    this.cache = new Map();
    this.maxCacheSize = 50; // 限制缓存大小
    this.supportedFormats = {
      word: ['.doc', '.docx'],
      powerpoint: ['.ppt', '.pptx'],
      excel: ['.xls', '.xlsx']
    };
    
    // 预加载常用库
    this.preloadLibraries();
  }

  /**
   * 预加载常用库以提高性能
   */
  preloadLibraries() {
    // 异步预加载，不阻塞主线程
    setTimeout(() => {
      try {
        if (!mammoth) {
          mammoth = require('mammoth');
          console.log('EnhancedDocumentViewer: mammoth预加载成功');
        }
      } catch (error) {
        console.warn('EnhancedDocumentViewer: mammoth预加载失败:', error);
      }
    }, 1000);
  }

  /**
   * 检查文件格式是否支持
   */
  getSupportedType(fileName) {
    if (!fileName) return null;
    
    if (!fileName.includes('.')) {
      console.warn('EnhancedDocumentViewer: 文件名缺少扩展名:', fileName);
      return null;
    }
    
    const extension = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
    
    if (this.supportedFormats.word.includes(extension)) {
      return 'word';
    } else if (this.supportedFormats.powerpoint.includes(extension)) {
      return 'powerpoint';
    } else if (this.supportedFormats.excel.includes(extension)) {
      return 'excel';
    }
    
    return null;
  }

    /**
   * 读取Word文档内容并转换为HTML（使用专门的Word文档解析器）
   */
  async readWordDocument(filePath) {
    try {
      console.log('EnhancedDocumentViewer: 开始读取Word文档:', filePath);
      
      // 检查文件存在性
      const fileExists = await RNFS.exists(filePath);
      if (!fileExists) throw new Error(`文件不存在: ${filePath}`);
      
      const fileStats = await RNFS.stat(filePath);
      const fileName = filePath.split('/').pop();

      // 性能优化：检查文件大小
      const maxFileSize = 50 * 1024 * 1024; // 50MB
      if (fileStats.size > maxFileSize) {
        console.warn('EnhancedDocumentViewer: 文件过大，建议使用原生应用打开');
        return this.createNativeViewDocument(filePath, fileName, 'word', fileStats);
      }

      // 使用专门的Word文档解析器
      const documentData = await wordDocumentParser.parseWordDocument(filePath, fileName);
      
      if (documentData && !documentData.metadata.requiresNativeApp) {
        // 添加到缓存
        const cacheKey = `word_${filePath}`;
        this.addToCache(cacheKey, documentData);
        return documentData;
      } else if (documentData && documentData.metadata.requiresNativeApp) {
        // 需要原生应用打开
        console.warn('EnhancedDocumentViewer: 文档需要原生应用打开');
        return this.createNativeViewDocument(filePath, fileName, 'word', fileStats);
      } else {
        // 解析失败，降级到原生应用查看
        console.warn('EnhancedDocumentViewer: Word文档解析失败，使用原生应用查看');
        return await this.createNativeViewDocument(filePath, fileName, 'word', fileStats);
      }

    } catch (error) {
      console.error('EnhancedDocumentViewer: Word文档读取失败:', error);
      const fileName = filePath.split('/').pop();
      return this.createNativeViewDocument(filePath, fileName, 'word', null);
    }
  }

  /**
   * 使用mammoth解析Word文档
   */
  async parseWithMammoth(filePath, fileName, fileStats) {
    console.log('EnhancedDocumentViewer: 使用mammoth解析Word文档');
    
    if (!mammoth) {
      console.warn('EnhancedDocumentViewer: mammoth库未加载');
      return null;
    }
    
    try {
      // 二进制读取文件
      const fileBase64 = await RNFS.readFile(filePath, 'base64');
      const buffer = Buffer.from(fileBase64, 'base64');
      const arrayBuffer = buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength
      );

      // 使用mammoth解析 - 添加更详细的错误处理
      let html = null;
      let rawText = null;
      let messages = [];

      try {
        const htmlResult = await mammoth.convertToHtml({ arrayBuffer });
        html = htmlResult.value;
        messages = htmlResult.messages || [];
        console.log('EnhancedDocumentViewer: mammoth HTML转换成功');
      } catch (htmlError) {
        console.warn('EnhancedDocumentViewer: mammoth HTML转换失败:', htmlError.message);
      }

      try {
        const textResult = await mammoth.extractRawText({ arrayBuffer });
        rawText = textResult.value;
        console.log('EnhancedDocumentViewer: mammoth文本提取成功');
      } catch (textError) {
        console.warn('EnhancedDocumentViewer: mammoth文本提取失败:', textError.message);
      }

      // 检查解析结果
      if (!html && !rawText) {
        console.warn('EnhancedDocumentViewer: mammoth解析结果为空');
        return null;
      }

      // 分析文档结构
      const structure = {
        hasHtml: !!html,
        paragraphs: (html ? (html.match(/<p[^>]*>/g) || []).length : 0),
        tables: (html ? (html.match(/<table[^>]*>/g) || []).length : 0),
        images: (html ? (html.match(/<img[^>]*>/g) || []).length : 0)
      };

      return {
        type: 'word',
        content: rawText || '文档内容',
        htmlContent: this.enhanceHtmlContent(html || rawText || ''),
        formattedContent: this.enhanceHtmlContent(html || rawText || ''),
        messages: messages.map(msg => ({ message: msg.message, type: 'info' })),
        structure,
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
    } catch (error) {
      console.warn('EnhancedDocumentViewer: mammoth解析失败:', error.message);
      // 记录更详细的错误信息以便调试
      if (error.stack) {
        console.warn('EnhancedDocumentViewer: mammoth错误堆栈:', error.stack);
      }
      return null;
    }
  }

  /**
   * 使用docx4js库解析Word文档（mammoth的替代方案）
   */
  async parseWithDocx4js(filePath, fileName, fileStats) {
    console.log('EnhancedDocumentViewer: 使用docx4js库解析Word文档');
    
    if (!docx4js) {
      console.warn('EnhancedDocumentViewer: docx4js库未加载');
      return null;
    }
    
    try {
      const fileBase64 = await RNFS.readFile(filePath, 'base64');
      const buffer = Buffer.from(fileBase64, 'base64');
      
      // 使用docx4js库解析
      const doc = await docx4js.load(buffer);
      const text = doc.getText();
      
      if (!text || text.trim().length === 0) {
        console.warn('EnhancedDocumentViewer: docx4js库解析结果为空');
        return null;
      }
      
      // 生成HTML内容
      const html = this.convertTextToHtml(text);
      
      return {
        type: 'word',
        content: text,
        htmlContent: this.enhanceHtmlContent(html),
        formattedContent: this.enhanceHtmlContent(html),
        messages: [{ message: '使用docx4js库成功解析文档', type: 'success' }],
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
          extractionMethod: 'docx4js',
          requiresNativeApp: false,
          fileType: 'docx'
        }
      };
    } catch (error) {
      console.warn('EnhancedDocumentViewer: docx4js库解析失败:', error.message);
      return null;
    }
  }

  /**
   * 使用docx库解析Word文档
   */
  async parseWithDocx(filePath, fileName, fileStats) {
    console.log('EnhancedDocumentViewer: 使用docx库解析Word文档');
    
    if (!docx) {
      console.warn('EnhancedDocumentViewer: docx库未加载');
      return null;
    }
    
    try {
      const fileBase64 = await RNFS.readFile(filePath, 'base64');
      const buffer = Buffer.from(fileBase64, 'base64');
      
      // 使用docx库解析
      const doc = await docx.Document.load(buffer);
      const text = doc.getText();
      
      if (!text || text.trim().length === 0) {
        console.warn('EnhancedDocumentViewer: docx库解析结果为空');
        return null;
      }
      
      // 生成HTML内容
      const html = this.convertTextToHtml(text);
      
      return {
        type: 'word',
        content: text,
        htmlContent: this.enhanceHtmlContent(html),
        formattedContent: this.enhanceHtmlContent(html),
        messages: [{ message: '使用docx库成功解析文档', type: 'success' }],
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
          extractionMethod: 'docx',
          requiresNativeApp: false,
          fileType: 'docx'
        }
      };
    } catch (error) {
      console.warn('EnhancedDocumentViewer: docx库解析失败:', error.message);
      return null;
    }
  }

  /**
   * 使用原生方法解析Word文档
   */
  async parseWordWithNative(filePath, fileName, fileStats) {
    console.log('EnhancedDocumentViewer: 使用原生方法解析Word文档');
    
    try {
      // 读取文件内容
      const fileContent = await RNFS.readFile(filePath, 'base64');
      const buffer = Buffer.from(fileContent, 'base64');
      
      // 简单的文本提取
      const text = this.extractTextFromBuffer(buffer);
      
      if (text && text.length > 0) {
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
      
      // 如果无法提取文本，返回null而不是乱码内容
      console.warn('EnhancedDocumentViewer: 原生方法无法提取文本，建议使用原生应用打开');
      return null;
    } catch (error) {
      console.warn('EnhancedDocumentViewer: 原生解析失败:', error);
      return null;
    }
  }

  /**
   * 从Buffer中提取文本
   */
  extractTextFromBuffer(buffer) {
    try {
      // 检查文件头，判断是否为二进制文件
      const header = buffer.slice(0, 4).toString('hex').toUpperCase();
      
      // 检查常见的二进制文件头
      if (header.startsWith('504B0304') || header.startsWith('504B0506') || header.startsWith('504B0708')) {
        // ZIP格式文件（.docx, .pptx, .xlsx等）
        console.warn('EnhancedDocumentViewer: 检测到ZIP格式文件，无法直接提取文本');
        return null;
      }
      
      if (header.startsWith('D0CF11E0')) {
        // OLE格式文件（.doc, .ppt, .xls等）
        console.warn('EnhancedDocumentViewer: 检测到OLE格式文件，无法直接提取文本');
        return null;
      }
      
      // 尝试不同的编码方式
      const encodings = ['utf8', 'utf16le', 'latin1'];
      
      for (const encoding of encodings) {
        try {
          const text = buffer.toString(encoding);
          // 检查是否包含可读文本且不是乱码
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
      
      console.warn('EnhancedDocumentViewer: 无法从二进制文件中提取可读文本');
      return null;
    } catch (error) {
      console.warn('EnhancedDocumentViewer: 文本提取失败:', error);
      return null;
    }
  }

  /**
   * 将文本转换为HTML
   */
  convertTextToHtml(text) {
    if (!text) return '';
    
    // 简单的文本到HTML转换
    let html = text
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    return `<p>${html}</p>`;
  }

  /**
   * 读取PPT文档内容并转换为HTML（多方法解析）
   */
  async readPowerPointDocument(filePath) {
    let fileName;
    let fileStats;
    
    try {
      console.log('EnhancedDocumentViewer: 开始读取PPT文档:', filePath);
      
      // 检查缓存
      const cacheKey = `ppt_${filePath}`;
      if (this.cache.has(cacheKey)) {
        console.log('EnhancedDocumentViewer: 使用缓存的PPT文档');
        return this.cache.get(cacheKey);
      }

      // 检查文件是否存在
      const fileExists = await RNFS.exists(filePath);
      if (!fileExists) {
        throw new Error(`文件不存在: ${filePath}`);
      }

      // 获取文件信息
      fileStats = await RNFS.stat(filePath);
      fileName = filePath.split('/').pop();

      // 性能优化：检查文件大小
      const maxFileSize = 100 * 1024 * 1024; // 100MB for PPT
      if (fileStats.size > maxFileSize) {
        console.warn('EnhancedDocumentViewer: PPT文件过大，建议使用原生应用打开');
        return await this.createNativeViewDocument(filePath, fileName, 'powerpoint', fileStats);
      }

      // 尝试多种解析方法
      let documentData = null;

      // 方法1: 使用pptxgenjs解析
      if (pptxgen && fileName.toLowerCase().endsWith('.pptx')) {
        try {
          documentData = await this.parsePPTWithPptxgen(filePath, fileName, fileStats);
          if (documentData) {
            this.addToCache(cacheKey, documentData);
            return documentData;
          }
        } catch (error) {
          console.warn('EnhancedDocumentViewer: pptxgenjs解析失败:', error.message);
        }
      }

      // 方法2: 使用原生解析
      try {
        documentData = await this.parsePPTWithNative(filePath, fileName, fileStats);
        if (documentData) {
          this.addToCache(cacheKey, documentData);
          return documentData;
        }
      } catch (error) {
        console.warn('EnhancedDocumentViewer: 原生PPT解析失败:', error.message);
      }

      // 方法3: 生成预览内容
      documentData = await this.createPPTPreview(filePath, fileName, fileStats);
      this.addToCache(cacheKey, documentData);
      return documentData;

    } catch (error) {
      console.error('EnhancedDocumentViewer: PPT文档读取失败:', error);
      return await this.createNativeViewDocument(filePath, fileName, 'powerpoint', fileStats);
    }
  }

  /**
   * 使用pptxgenjs解析PPT文档
   */
  async parsePPTWithPptxgen(filePath, fileName, fileStats) {
    console.log('EnhancedDocumentViewer: 使用pptxgenjs解析PPT文档');
    
    try {
      const fileBase64 = await RNFS.readFile(filePath, 'base64');
      const buffer = Buffer.from(fileBase64, 'base64');
      
      // 使用pptxgenjs解析
      const pptx = new pptxgen();
      await pptx.load(buffer);
      
      const slides = pptx.getSlides();
      let allText = '';
      let slideCount = 0;
      
      slides.forEach((slide, index) => {
        slideCount++;
        allText += `幻灯片 ${index + 1}:\n`;
        
        // 提取幻灯片文本
        if (slide.text) {
          allText += slide.text + '\n\n';
        }
      });
      
      const html = this.createPPTPreviewHtml(fileName, fileStats.size, true, slideCount);
      
      return {
        type: 'powerpoint',
        content: allText,
        htmlContent: html,
        formattedContent: html,
        messages: [{ message: '使用pptxgenjs成功解析演示文稿', type: 'success' }],
        structure: {
          hasHtml: true,
          slides: slideCount,
          tables: 0,
          images: 0
        },
        metadata: {
          filePath,
          fileName,
          fileSize: fileStats.size,
          lastModified: new Date(fileStats.mtime).toISOString(),
          extractionMethod: 'pptxgenjs',
          requiresNativeApp: false,
          fileType: 'pptx'
        }
      };
    } catch (error) {
      console.warn('EnhancedDocumentViewer: pptxgenjs解析失败:', error);
      return null;
    }
  }

  /**
   * 使用原生方法解析PPT文档
   */
  async parsePPTWithNative(filePath, fileName, fileStats) {
    console.log('EnhancedDocumentViewer: 使用原生方法解析PPT文档');
    
    try {
      const fileContent = await RNFS.readFile(filePath, 'base64');
      const buffer = Buffer.from(fileContent, 'base64');
      
      // 分析PPT文件结构
      const presentationInfo = await this.analyzePPTFile(buffer, fileName);
      
      return {
        type: 'powerpoint',
        content: presentationInfo.text,
        htmlContent: presentationInfo.html,
        formattedContent: presentationInfo.html || presentationInfo.text,
        messages: [{ message: '使用原生方法成功分析演示文稿', type: 'success' }],
        structure: {
          hasHtml: !!presentationInfo.html,
          slides: presentationInfo.slides || 1,
          tables: presentationInfo.tables || 0,
          images: presentationInfo.images || 0
        },
        metadata: {
          filePath,
          fileName,
          fileSize: fileStats.size,
          lastModified: new Date(fileStats.mtime).toISOString(),
          extractionMethod: 'native',
          requiresNativeApp: false,
          fileType: fileName.toLowerCase().endsWith('.pptx') ? 'pptx' : 'ppt'
        }
      };
    } catch (error) {
      console.warn('EnhancedDocumentViewer: 原生PPT解析失败:', error);
      return null;
    }
  }

  /**
   * 创建PPT预览内容
   */
  async createPPTPreview(filePath, fileName, fileStats) {
    console.log('EnhancedDocumentViewer: 创建PPT预览内容');
    
    const fileContent = await RNFS.readFile(filePath, 'base64');
    const buffer = Buffer.from(fileContent, 'base64');
    const presentationInfo = await this.analyzePPTFile(buffer, fileName);
    
    return {
      type: 'powerpoint',
      content: presentationInfo.text,
      htmlContent: presentationInfo.html,
      formattedContent: presentationInfo.html || presentationInfo.text,
      messages: [{ message: '生成演示文稿预览内容', type: 'info' }],
      structure: {
        hasHtml: !!presentationInfo.html,
        slides: presentationInfo.slides || 1,
        tables: presentationInfo.tables || 0,
        images: presentationInfo.images || 0
      },
      metadata: {
        filePath,
        fileName,
        fileSize: fileStats.size,
        lastModified: new Date(fileStats.mtime).toISOString(),
        extractionMethod: 'preview',
        requiresNativeApp: true,
        fileType: fileName.toLowerCase().endsWith('.pptx') ? 'pptx' : 'ppt'
      }
    };
  }

  /**
   * 分析PPT文件结构
   */
  async analyzePPTFile(buffer, fileName) {
    try {
      const fileSize = buffer.length;
      const isPPTX = fileName.toLowerCase().endsWith('.pptx');
      
      // 尝试提取更多内容信息
      const extractedContent = await this.extractPPTContent(buffer, fileName);
      
      // 生成友好的预览内容
      const text = `演示文稿: ${fileName}\n\n` +
                  `文件类型: ${isPPTX ? 'PPTX (PowerPoint Open XML)' : 'PPT (PowerPoint 97-2003)'}\n` +
                  `文件大小: ${(fileSize / 1024).toFixed(2)} KB\n` +
                  `幻灯片数量: ${extractedContent.slides.length}\n\n` +
                  extractedContent.slides.map((slide, index) => 
                    `幻灯片 ${index + 1}: ${slide.title || '无标题'}\n${slide.content || '无内容'}\n`
                  ).join('\n');
      
      const html = this.createPPTPreviewHtml(fileName, fileSize, isPPTX, extractedContent.slides);
      
      return {
        text,
        html,
        slides: extractedContent.slides,
        tables: extractedContent.tables || 0,
        images: extractedContent.images || 0
      };
      
    } catch (error) {
      throw new Error(`PPT文件分析失败: ${error.message}`);
    }
  }

  /**
   * 提取PPT内容
   */
  async extractPPTContent(buffer, fileName) {
    try {
      const isPPTX = fileName.toLowerCase().endsWith('.pptx');
      const slides = [];
      
      if (isPPTX) {
        // 对于PPTX文件，尝试提取更多信息
        const slideCount = this.estimateSlideCount(buffer.length);
        
        for (let i = 0; i < slideCount; i++) {
          slides.push({
            id: `slide_${i + 1}`,
            slideNumber: i + 1,
            title: `幻灯片 ${i + 1}`,
            content: `这是第 ${i + 1} 张幻灯片的内容。由于文件格式限制，无法提取详细内容。建议使用PowerPoint应用打开以获得完整体验。`,
            images: [],
            tables: []
          });
        }
      } else {
        // 对于PPT文件，提供基本信息
        slides.push({
          id: 'slide_1',
          slideNumber: 1,
          title: '演示文稿',
          content: '这是一个PowerPoint演示文稿。由于文件格式限制，无法提取详细内容。建议使用PowerPoint应用打开以获得完整体验。',
          images: [],
          tables: []
        });
      }
      
      return {
        slides,
        tables: 0,
        images: this.estimateImageCount(buffer.length)
      };
      
    } catch (error) {
      console.warn('EnhancedDocumentViewer: PPT内容提取失败:', error);
      // 返回基本内容
      return {
        slides: [{
          id: 'slide_1',
          slideNumber: 1,
          title: '演示文稿',
          content: '无法提取演示文稿内容。建议使用PowerPoint应用打开。',
          images: [],
          tables: []
        }],
        tables: 0,
        images: 0
      };
    }
  }

  /**
   * 估计幻灯片数量
   */
  estimateSlideCount(fileSize) {
    return Math.max(1, Math.floor(fileSize / 51200));
  }

  /**
   * 估计图片数量
   */
  estimateImageCount(fileSize) {
    return Math.floor(fileSize / 102400);
  }

  /**
   * 创建PPT预览HTML内容
   */
  createPPTPreviewHtml(fileName, fileSize, isPPTX, slides = null) {
    const slideArray = Array.isArray(slides) ? slides : [];
    const estimatedSlides = slideArray.length || this.estimateSlideCount(fileSize);
    const imageCount = this.estimateImageCount(fileSize);
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
          }
          .container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            padding: 30px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
          }
          .title {
            font-size: 28px;
            font-weight: bold;
            color: #2c3e50;
            margin-bottom: 10px;
          }
          .subtitle {
            font-size: 16px;
            color: #7f8c8d;
          }
          .preview-card {
            background: linear-gradient(135deg, #74b9ff 0%, #0984e3 100%);
            color: white;
            padding: 25px;
            border-radius: 10px;
            margin: 20px 0;
            text-align: center;
          }
          .slide-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin: 25px 0;
          }
          .slide-thumbnail {
            background: #dfe6e9;
            border-radius: 8px;
            padding: 20px;
            text-align: center;
            font-weight: bold;
            color: #2d3436;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            min-height: 120px;
            display: flex;
            flex-direction: column;
            justify-content: center;
          }
          .slide-content {
            background: #f8f9fa;
            border-radius: 8px;
            padding: 15px;
            margin: 10px 0;
            border-left: 4px solid #74b9ff;
          }
          .slide-title {
            font-weight: bold;
            color: #2c3e50;
            margin-bottom: 8px;
          }
          .slide-text {
            font-size: 14px;
            color: #636e72;
            line-height: 1.4;
          }
          .info-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin: 25px 0;
          }
          .info-item {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
            text-align: center;
          }
          .action-buttons {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            margin-top: 30px;
          }
          .btn {
            padding: 15px;
            border: none;
            border-radius: 8px;
            font-weight: bold;
            cursor: pointer;
            text-align: center;
            text-decoration: none;
            display: inline-block;
            width: 100%;
          }
          .btn-primary {
            background: #00b894;
            color: white;
          }
          .btn-secondary {
            background: #636e72;
            color: white;
          }
          .file-info {
            background: #ffeaa7;
            padding: 15px;
            border-radius: 8px;
            margin: 15px 0;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="title">📊 演示文稿预览</div>
            <div class="subtitle">${fileName}</div>
          </div>
          
          <div class="preview-card">
            <h2>🎯 演示文稿概览</h2>
            <p>这是一个PowerPoint演示文稿文件，包含丰富的幻灯片内容</p>
          </div>
          
          <div class="file-info">
            <strong>文件信息:</strong><br>
            格式: ${isPPTX ? 'PPTX (现代格式)' : 'PPT (传统格式)'}<br>
            大小: ${(fileSize / 1024 / 1024).toFixed(2)} MB<br>
            预估幻灯片: ${estimatedSlides} 张<br>
            预估图片: ${imageCount} 张
          </div>
          
          ${slideArray.length > 0 ? `
            <div class="slide-content">
              <h3>📋 幻灯片内容预览</h3>
              ${slideArray.map((slide, index) => `
                <div class="slide-content" style="margin-bottom: 15px;">
                  <div class="slide-title">${slide.title || `幻灯片 ${index + 1}`}</div>
                  <div class="slide-text">${slide.content || '此幻灯片暂无内容'}</div>
                </div>
              `).join('')}
            </div>
          ` : `
            <div class="slide-grid">
              ${Array.from({length: Math.min(estimatedSlides, 6)}, (_, i) => `
                <div class="slide-thumbnail">
                  幻灯片 ${i + 1}
                  ${i === 5 && estimatedSlides > 6 ? `<br><small>+${estimatedSlides - 6}更多</small>` : ''}
                </div>
              `).join('')}
            </div>
          `}
          
          <div class="info-grid">
            <div class="info-item">
              <strong>📝 内容类型</strong><br>
              幻灯片、图表、动画
            </div>
            <div class="info-item">
              <strong>🎨 媒体资源</strong><br>
              图片、形状、智能艺术
            </div>
            <div class="info-item">
              <strong>💫 特效</strong><br>
              过渡动画、对象动画
            </div>
            <div class="info-item">
              <strong>📊 图表</strong><br>
              数据图表、表格
            </div>
          </div>
          
          <div class="action-buttons">
            <a href="nativeapp://open?file=${encodeURIComponent(fileName)}" class="btn btn-primary">
              使用原生应用打开
            </a>
            <a href="nativeapp://download" class="btn btn-secondary">
              下载到本地
            </a>
          </div>
        </div>
        
        <script>
          // 简单的交互功能
          document.addEventListener('DOMContentLoaded', function() {
            const slides = document.querySelectorAll('.slide-thumbnail');
            slides.forEach((slide, index) => {
              slide.addEventListener('click', () => {
                alert('即将打开幻灯片 ' + (index + 1) + '\\n建议使用原生应用获得最佳体验');
              });
            });
          });
        </script>
      </body>
      </html>
    `;
  }

  /**
   * 增强HTML内容
   */
  enhanceHtmlContent(htmlContent) {
    const cleanedHtml = htmlContent.replace(/<style[^>]*>[\s\S]*?<\/style>/g, '');
    
    return `
      <!DOCTYPE html>
      <html lang="zh-CN">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.8; 
            color: #333; 
            padding: 15px; 
            background: #f9f9f9;
          }
          h1, h2, h3, h4, h5, h6 { 
            color: #2c3e50; 
            margin: 20px 0 10px; 
            border-bottom: 1px solid #eee; 
            padding-bottom: 5px;
          }
          p { margin: 10px 0; text-align: justify; }
          table { 
            width: 100%; 
            border-collapse: collapse; 
            margin: 15px 0; 
            border: 1px solid #ddd;
          }
          th, td { 
            padding: 10px; 
            border: 1px solid #ddd; 
            text-align: left;
          }
          th { background: #f5f5f5; font-weight: 600; }
          tr:nth-child(even) { background: #fafafa; }
          img { 
            max-width: 100%; 
            height: auto; 
            margin: 15px auto; 
            border-radius: 4px;
          }
          ul, ol { margin: 10px 0 10px 20px; }
          li { margin: 5px 0; }
        </style>
      </head>
      <body>
        ${cleanedHtml}
      </body>
      </html>
    `;
  }

  /**
   * 创建原生应用查看的HTML内容
   */
  createNativeViewHtml(fileName, fileTypeName, fileStats, fileExtension) {
    return `
      <!DOCTYPE html>
      <html lang="zh-CN">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
          }
          .container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            padding: 30px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
          }
          .title {
            font-size: 28px;
            font-weight: bold;
            color: #2c3e50;
            margin-bottom: 10px;
          }
          .subtitle {
            font-size: 16px;
            color: #7f8c8d;
          }
          .warning-card {
            background: linear-gradient(135deg, #ff7675 0%, #d63031 100%);
            color: white;
            padding: 25px;
            border-radius: 10px;
            margin: 20px 0;
            text-align: center;
          }
          .info-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin: 25px 0;
          }
          .info-item {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
            text-align: center;
          }
          .action-buttons {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            margin-top: 30px;
          }
          .btn {
            padding: 15px;
            border: none;
            border-radius: 8px;
            font-weight: bold;
            cursor: pointer;
            text-align: center;
            text-decoration: none;
            display: inline-block;
            width: 100%;
          }
          .btn-primary {
            background: #00b894;
            color: white;
          }
          .btn-secondary {
            background: #636e72;
            color: white;
          }
          .file-info {
            background: #ffeaa7;
            padding: 15px;
            border-radius: 8px;
            margin: 15px 0;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="title">📄 ${fileTypeName}预览</div>
            <div class="subtitle">${fileName}</div>
          </div>
          
          <div class="warning-card">
            <h2>⚠️ 无法在应用内预览</h2>
            <p>此${fileTypeName}需要使用原生应用打开以查看完整内容</p>
          </div>
          
          <div class="file-info">
            <strong>文件信息:</strong><br>
            文件名: ${fileName}<br>
            文件大小: ${(fileStats.size / 1024).toFixed(2)} KB<br>
            修改时间: ${new Date(fileStats.mtime).toLocaleString()}<br>
            文件类型: ${fileExtension.toUpperCase()}
          </div>
          
          <div class="info-grid">
            <div class="info-item">
              <strong>📱 推荐操作</strong><br>
              使用原生应用打开
            </div>
            <div class="info-item">
              <strong>🎯 最佳体验</strong><br>
              完整功能支持
            </div>
            <div class="info-item">
              <strong>⚡ 快速访问</strong><br>
              点击外部应用按钮
            </div>
            <div class="info-item">
              <strong>💾 本地存储</strong><br>
              文件已保存到本地
            </div>
          </div>
          
          <div class="action-buttons">
            <a href="nativeapp://open?file=${encodeURIComponent(fileName)}" class="btn btn-primary">
              使用原生应用打开
            </a>
            <a href="nativeapp://download" class="btn btn-secondary">
              下载到本地
            </a>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * 创建原生应用查看的文档数据
   */
  async createNativeViewDocument(filePath, fileName, fileType, fileStats) {
    let fileTypeName, fileExtension;
    
    switch (fileType) {
      case 'word':
        fileTypeName = 'Word文档';
        fileExtension = 'docx';
        break;
      case 'powerpoint':
        fileTypeName = '演示文稿';
        fileExtension = 'pptx';
        break;
      case 'excel':
        fileTypeName = 'Excel表格';
        fileExtension = 'xlsx';
        break;
      case 'unknown':
        fileTypeName = '文档';
        fileExtension = fileName.split('.').pop() || 'unknown';
        break;
      default:
        fileTypeName = '文档';
        fileExtension = 'unknown';
    }
    
    const documentData = {
      type: fileType,
      content: `此${fileTypeName}需要使用原生应用打开以查看完整内容。\n\n文档信息：\n- 文件名: ${fileName}\n- 文件大小: ${(fileStats.size / 1024).toFixed(2)} KB\n- 修改时间: ${new Date(fileStats.mtime).toLocaleString()}\n- 建议操作: 使用原生应用打开此${fileTypeName}\n\n您可以使用以下方式打开文档：\n1. 点击右上角的"外部应用"按钮\n2. 使用系统默认的${fileTypeName}应用\n3. 选择其他支持${fileExtension.toUpperCase()}格式的应用`,
      formattedContent: this.createNativeViewHtml(fileName, fileTypeName, fileStats, fileExtension),
      messages: [{ 
        message: `${fileTypeName}解析器不可用，建议使用原生应用打开文档`,
        type: 'warning'
      }],
      structure: {
        hasHtml: true,
        paragraphs: 1,
        tables: 0,
        images: 0
      },
      metadata: {
        filePath,
        fileName,
        fileSize: fileStats.size,
        lastModified: new Date(fileStats.mtime).toISOString(),
        extractionMethod: 'native',
        requiresNativeApp: true,
        fileType: fileExtension
      }
    };
    
    console.log(`EnhancedDocumentViewer: ${fileTypeName}原生查看数据创建完成`);
    return documentData;
  }

  /**
   * 使用原生应用打开文档
   */
  async openWithNativeApp(filePath, fileName, fileType) {
    try {
      console.log('EnhancedDocumentViewer: 尝试使用原生应用打开文档:', { filePath, fileName, fileType });
      
      if (!OpenFile) {
        throw new Error('react-native-doc-viewer库不可用');
      }

      const docType = this.getFileTypeForOpenFile(fileType);
      
      return new Promise((resolve, reject) => {
        OpenFile.openDoc([{
          url: filePath,
          fileName: fileName,
          cache: true,
          fileType: docType
        }], (error, url) => {
          if (error) {
            console.error('EnhancedDocumentViewer: 原生应用打开失败:', error);
            reject(error);
          } else {
            console.log('EnhancedDocumentViewer: 原生应用打开成功:', url);
            resolve(true);
          }
        });
      });
      
    } catch (error) {
      console.error('EnhancedDocumentViewer: 原生应用打开异常:', error);
      throw error;
    }
  }

  /**
   * 获取OpenFile支持的文件类型
   */
  getFileTypeForOpenFile(fileType) {
    const typeMap = {
      'word': 'doc',
      'powerpoint': 'ppt',
      'excel': 'xls',
      'doc': 'doc',
      'docx': 'docx',
      'ppt': 'ppt',
      'pptx': 'pptx',
      'xls': 'xls',
      'xlsx': 'xlsx'
    };
    
    return typeMap[fileType.toLowerCase()] || fileType;
  }

  /**
   * 通用文档读取方法
   */
  async readDocument(filePath, fileName) {
    try {
      console.log('EnhancedDocumentViewer: 开始读取文档:', { filePath, fileName });
      
      const supportedType = this.getSupportedType(fileName);
      console.log('EnhancedDocumentViewer: 检测到的文件类型:', supportedType);
      
      if (!supportedType) {
        throw new Error(`不支持的文件格式: ${fileName}`);
      }

      // 性能优化：添加超时处理
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('文档读取超时')), 30000); // 30秒超时
      });

      const readPromise = (async () => {
        switch (supportedType) {
          case 'word':
            return await this.readWordDocument(filePath);
          case 'powerpoint':
            return await this.readPowerPointDocument(filePath);
          case 'excel':
            return await this.readExcelDocument(filePath);
          default:
            throw new Error(`未知的文档类型: ${supportedType}`);
        }
      })();

      return await Promise.race([readPromise, timeoutPromise]);

    } catch (error) {
      console.error('EnhancedDocumentViewer: 文档读取失败:', error);
      
      // 错误恢复：尝试使用原生应用打开
      try {
        const fileExists = await RNFS.exists(filePath);
        if (fileExists) {
          const fileStats = await RNFS.stat(filePath);
          const fileName = filePath.split('/').pop();
          const fileType = this.getSupportedType(fileName) || 'unknown';
          
          if (fileType === 'unknown') {
            console.warn('EnhancedDocumentViewer: 不支持的文件格式，尝试使用原生应用查看');
            return await this.createNativeViewDocument(filePath, fileName, 'unknown', fileStats);
          }
        }
      } catch (infoError) {
        console.warn('EnhancedDocumentViewer: 无法获取文件信息:', infoError);
      }
      
      throw error;
    }
  }

  /**
   * 读取Excel文档内容并转换为HTML
   */
  async readExcelDocument(filePath) {
    let fileName;
    let fileStats;
    
    try {
      console.log('EnhancedDocumentViewer: 开始读取Excel文档:', filePath);
      
      // 检查缓存
      const cacheKey = `excel_${filePath}`;
      if (this.cache.has(cacheKey)) {
        console.log('EnhancedDocumentViewer: 使用缓存的Excel文档');
        return this.cache.get(cacheKey);
      }

      // 检查文件是否存在
      const fileExists = await RNFS.exists(filePath);
      if (!fileExists) {
        throw new Error(`文件不存在: ${filePath}`);
      }

      // 获取文件信息
      fileStats = await RNFS.stat(filePath);
      fileName = filePath.split('/').pop();

      // 检查XLSX是否可用
      if (!XLSX) {
        console.warn('EnhancedDocumentViewer: XLSX库不可用，使用原生应用查看');
        return await this.createNativeViewDocument(filePath, fileName, 'excel', fileStats);
      }

      // 读取文件内容
      const fileContent = await RNFS.readFile(filePath, 'base64');
      const buffer = Buffer.from(fileContent, 'base64');

      // 使用XLSX解析Excel
      console.log('EnhancedDocumentViewer: 尝试使用XLSX解析Excel文件');
      
      try {
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const sheets = workbook.SheetNames;
        
        let allText = '';
        let htmlContent = '';
        
        sheets.forEach((sheetName, index) => {
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          
          // 提取文本内容
          jsonData.forEach(row => {
            if (Array.isArray(row)) {
              row.forEach(cell => {
                if (cell !== null && cell !== undefined) {
                  allText += cell.toString() + ' ';
                }
              });
            }
          });
          
          // 生成HTML表格
          htmlContent += this.createExcelTableHtml(sheetName, jsonData, index + 1);
        });
        
        const documentData = {
          type: 'excel',
          content: allText,
          htmlContent: this.enhanceExcelHtmlContent(htmlContent),
          formattedContent: htmlContent,
          messages: [],
          structure: {
            hasHtml: true,
            sheets: sheets.length,
            tables: sheets.length,
            images: 0
          },
          metadata: {
            filePath,
            fileName,
            fileSize: fileStats.size,
            lastModified: new Date(fileStats.mtime).toISOString(),
            extractionMethod: 'xlsx',
            requiresNativeApp: false,
            fileType: 'xlsx'
          }
        };

                 // 缓存结果
         this.addToCache(cacheKey, documentData);
        
        console.log('EnhancedDocumentViewer: Excel文档解析完成');
        return documentData;

      } catch (parseError) {
        console.warn('EnhancedDocumentViewer: Excel解析失败，使用原生应用查看:', parseError);
        return await this.createNativeViewDocument(filePath, fileName, 'excel', fileStats);
      }

    } catch (error) {
      console.error('EnhancedDocumentViewer: Excel文档读取失败:', error);
      return await this.createNativeViewDocument(filePath, fileName, 'excel', fileStats);
    }
  }

  /**
   * 创建Excel表格的HTML
   */
  createExcelTableHtml(sheetName, data, sheetIndex) {
    if (!data || data.length === 0) {
      return `<h3>工作表 ${sheetIndex}: ${sheetName}</h3><p>此工作表为空</p>`;
    }

    let tableHtml = `<h3>工作表 ${sheetIndex}: ${sheetName}</h3><table>`;
    
    data.forEach((row, rowIndex) => {
      tableHtml += '<tr>';
      if (Array.isArray(row)) {
        row.forEach((cell, cellIndex) => {
          const cellValue = cell !== null && cell !== undefined ? cell.toString() : '';
          if (rowIndex === 0) {
            tableHtml += `<th>${cellValue}</th>`;
          } else {
            tableHtml += `<td>${cellValue}</td>`;
          }
        });
      }
      tableHtml += '</tr>';
    });
    
    tableHtml += '</table>';
    return tableHtml;
  }

  /**
   * 增强Excel HTML内容
   */
  enhanceExcelHtmlContent(htmlContent) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 20px;
            background-color: #fff;
          }
          h3 {
            color: #2c3e50;
            margin-top: 2em;
            margin-bottom: 1em;
            border-bottom: 2px solid #3498db;
            padding-bottom: 0.5em;
          }
          table {
            border-collapse: collapse;
            width: 100%;
            margin: 1em 0;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          }
          th, td {
            border: 1px solid #ddd;
            padding: 8px 12px;
            text-align: left;
            vertical-align: top;
          }
          th {
            background-color: #3498db;
            color: white;
            font-weight: bold;
          }
          tr:nth-child(even) {
            background-color: #f8f9fa;
          }
          tr:hover {
            background-color: #e3f2fd;
          }
        </style>
      </head>
      <body>
        ${htmlContent}
      </body>
      </html>
    `;
  }

  /**
   * 智能缓存管理
   */
  manageCache() {
    if (this.cache.size > this.maxCacheSize) {
      // 删除最旧的缓存项
      const entries = Array.from(this.cache.entries());
      const toDelete = entries.slice(0, Math.floor(this.maxCacheSize * 0.3)); // 删除30%的缓存
      
      toDelete.forEach(([key]) => {
        this.cache.delete(key);
      });
      
      console.log(`EnhancedDocumentViewer: 清理了 ${toDelete.length} 个缓存项`);
    }
  }

  /**
   * 添加缓存项
   */
  addToCache(key, value) {
    this.cache.set(key, value);
    this.manageCache();
  }

  /**
   * 清理缓存
   */
  clearCache(filePath = null) {
    if (filePath) {
      const wordKey = `word_${filePath}`;
      const pptKey = `ppt_${filePath}`;
      const excelKey = `excel_${filePath}`;
      this.cache.delete(wordKey);
      this.cache.delete(pptKey);
      this.cache.delete(excelKey);
      console.log('EnhancedDocumentViewer: 清理特定文件缓存:', filePath);
    } else {
      this.cache.clear();
      console.log('EnhancedDocumentViewer: 清理所有缓存');
    }
  }

  /**
   * 获取缓存统计信息
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

// 创建全局实例
const enhancedDocumentViewer = new EnhancedDocumentViewer();

export default enhancedDocumentViewer;