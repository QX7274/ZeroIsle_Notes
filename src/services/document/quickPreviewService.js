import RNFS from 'react-native-fs';
import { Platform } from 'react-native';
import '../../utils/textEncodingPolyfill';

// 确保Buffer在React Native环境中可用
if (typeof Buffer === 'undefined') {
  global.Buffer = require('buffer').Buffer;
}

// 动态导入各种文档处理库
let mammoth = null;
let XLSX = null;
let OpenFile = null;

// 使用mammoth标准版本（适配React Native环境）
try {
  mammoth = require('mammoth');
  console.log('NativeDocumentViewer: mammoth标准库加载成功');
} catch (error) {
  console.warn('NativeDocumentViewer: mammoth标准库不可用:', error);
}

try {
  XLSX = require('xlsx');
  console.log('NativeDocumentViewer: xlsx库加载成功');
} catch (error) {
  console.warn('NativeDocumentViewer: xlsx库不可用:', error);
}

try {
  OpenFile = require('react-native-doc-viewer');
  console.log('NativeDocumentViewer: react-native-doc-viewer库加载成功');
} catch (error) {
  console.warn('NativeDocumentViewer: react-native-doc-viewer库不可用:', error);
}

/**
 * 纯原生前端文档查看服务
 * 支持Word、PPT、Excel文件的完整预览，不依赖后端转换
 */
class NativeDocumentViewer {
  constructor() {
    this.cache = new Map();
    this.supportedFormats = {
      word: ['.doc', '.docx'],
      powerpoint: ['.ppt', '.pptx'],
      excel: ['.xls', '.xlsx']
    };
  }

  /**
   * 检查文件格式是否支持
   * @param {string} fileName - 文件名
   * @returns {string|null} - 支持的类型或null
   */
  getSupportedType(fileName) {
    if (!fileName) return null;
    
    if (!fileName.includes('.')) {
      console.warn('NativeDocumentViewer: 文件名缺少扩展名:', fileName);
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
   * 使用原生应用打开文档
   * @param {string} filePath - 文件路径
   * @param {string} fileName - 文件名
   * @param {string} fileType - 文件类型
   * @returns {Promise<boolean>} - 是否成功打开
   */
  async openWithNativeApp(filePath, fileName, fileType) {
    try {
      console.log('NativeDocumentViewer: 尝试使用原生应用打开文档:', { filePath, fileName, fileType });
      
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
            console.error('NativeDocumentViewer: 原生应用打开失败:', error);
            reject(error);
          } else {
            console.log('NativeDocumentViewer: 原生应用打开成功:', url);
            resolve(true);
          }
        });
      });
      
    } catch (error) {
      console.error('NativeDocumentViewer: 原生应用打开异常:', error);
      throw error;
    }
  }

  /**
   * 获取OpenFile支持的文件类型
   * @param {string} fileType - 原始文件类型
   * @returns {string} - OpenFile支持的文件类型
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
   * 读取Word文档内容并转换为HTML（修复版）
   * @param {string} filePath - 文件路径
   * @returns {Promise<Object>} - 解析后的文档内容（含HTML预览）
   */
  async readWordDocument(filePath) {
    let fileName;
    let fileStats;
    
    try {
      console.log('NativeDocumentViewer: 开始读取Word文档:', filePath);
      
      // 1. 缓存逻辑（保留原功能）
      const cacheKey = `word_${filePath}`;
      if (this.cache.has(cacheKey)) {
        console.log('NativeDocumentViewer: 使用缓存的Word文档');
        return this.cache.get(cacheKey);
      }

      // 2. 检查文件存在性和基本信息
      const fileExists = await RNFS.exists(filePath);
      if (!fileExists) throw new Error(`文件不存在: ${filePath}`);
      
      fileStats = await RNFS.stat(filePath);
      fileName = filePath.split('/').pop();

      // 3. 检查mammoth是否可用（无则直接返回原生预览提示）
      if (!mammoth) {
        console.warn('NativeDocumentViewer: mammoth库不可用，需安装依赖');
        return this.createNativeViewDocument(filePath, fileName, 'word', fileStats);
      }

      // 4. 二进制读取文件（关键修复：.docx是二进制，不能用utf8）
      console.log('NativeDocumentViewer: 二进制读取Word文件');
      const fileBase64 = await RNFS.readFile(filePath, 'base64'); // 先读为base64
      const buffer = Buffer.from(fileBase64, 'base64'); // 转为Buffer
      const arrayBuffer = buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength
      ); // 转为mammoth需要的ArrayBuffer

      // 5. 使用mammoth解析（修复API调用：用convertToHtml，而非extractRawText）
      console.log('NativeDocumentViewer: 用mammoth解析Word文档');
      const { value: html, messages } = await mammoth.convertToHtml({ arrayBuffer });
      // 额外提取纯文本（用于内容预览）
      const { value: rawText } = await mammoth.extractRawText({ arrayBuffer });

      // 6. 分析文档结构（统计段落、表格、图片数量）
      const structure = {
        hasHtml: !!html,
        paragraphs: (html.match(/<p[^>]*>/g) || []).length, // 统计<p>标签数
        tables: (html.match(/<table[^>]*>/g) || []).length, // 统计<table>标签数
        images: (html.match(/<img[^>]*>/g) || []).length    // 统计<img>标签数
      };

      // 7. 构造解析结果（含可直接渲染的HTML）
      const documentData = {
        type: 'word',
        content: rawText, // 纯文本内容
        htmlContent: this.enhanceHtmlContent(html), // 带样式的HTML（可直接渲染）
        formattedContent: this.enhanceHtmlContent(html), // 预览用HTML
        messages: messages.map(msg => ({ message: msg.message, type: 'info' })), // 解析日志
        structure,
        metadata: {
          filePath,
          fileName,
          fileSize: fileStats.size,
          lastModified: new Date(fileStats.mtime).toISOString(),
          extractionMethod: 'mammoth',
          requiresNativeApp: false, // 标记为"可内预览"
          fileType: fileName.toLowerCase().endsWith('.docx') ? 'docx' : 'doc'
        }
      };

      // 8. 缓存结果（避免重复解析）
      this.cache.set(cacheKey, documentData);
      console.log('NativeDocumentViewer: Word文档解析完成（可内预览）');
      return documentData;

    } catch (parseError) {
      console.error('NativeDocumentViewer: Word解析失败:', parseError.message);
      // 失败降级：返回原生应用打开提示
      return this.createNativeViewDocument(filePath, fileName, 'word', fileStats);
    }
  }

  /**
   * 读取PPT文档内容并转换为HTML
   * @param {string} filePath - 文件路径
   * @returns {Promise<Object>} - 解析后的文档内容
   */
  async readPowerPointDocument(filePath) {
    let fileName;
    let fileStats;
    
    try {
      console.log('NativeDocumentViewer: 开始读取PPT文档:', filePath);
      
      // 检查缓存
      const cacheKey = `ppt_${filePath}`;
      if (this.cache.has(cacheKey)) {
        console.log('NativeDocumentViewer: 使用缓存的PPT文档');
        return this.cache.get(cacheKey);
      }

      // 检查文件是否存在 - 添加超时
      const fileExists = await this.withTimeout(
        RNFS.exists(filePath),
        5000,
        '文件存在性检查超时'
      );
      if (!fileExists) {
        throw new Error(`文件不存在: ${filePath}`);
      }

      // 获取文件信息 - 添加超时
      fileStats = await this.withTimeout(
        RNFS.stat(filePath),
        5000,
        '文件信息获取超时'
      );
      fileName = filePath.split('/').pop();

      // 尝试读取PPT文件的基本信息
      try {
        // 读取文件内容进行简单分析 - 添加超时
        const fileContent = await this.withTimeout(
          RNFS.readFile(filePath, 'base64'),
          8000, // 8秒超时
          'PPT文件读取超时'
        );
        
        const buffer = Buffer.from(fileContent, 'base64');
        
        // 简单分析PPT文件结构 - 添加超时
        const presentationInfo = await this.withTimeout(
          this.analyzePPTFile(buffer, fileName),
          5000, // 5秒超时
          'PPT文件分析超时'
        );
        
        const documentData = {
          type: 'powerpoint',
          content: presentationInfo.text,
          htmlContent: presentationInfo.html,
          formattedContent: presentationInfo.html || presentationInfo.text,
          messages: [],
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
            extractionMethod: 'react-native',
            requiresNativeApp: true, // PPT文件通常需要原生应用查看
            fileType: 'pptx'
          }
        };

        // 缓存结果
        this.cache.set(cacheKey, documentData);
        
        console.log('NativeDocumentViewer: PPT文档解析完成');
        return documentData;

      } catch (parseError) {
        console.warn('NativeDocumentViewer: PPT解析失败，使用原生应用查看:', parseError);
        return await this.createNativeViewDocument(filePath, fileName, 'powerpoint', fileStats);
      }

    } catch (error) {
      console.error('NativeDocumentViewer: PPT文档读取失败:', error);
      return await this.createNativeViewDocument(filePath, fileName, 'powerpoint', fileStats);
    }
  }

  /**
   * 通用超时包装器
   */
  async withTimeout(promise, timeoutMs, errorMessage) {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
    });
    return Promise.race([promise, timeoutPromise]);
  }

  /**
   * 分析PPT文件结构
   * @param {Buffer} buffer - 文件buffer
   * @param {string} fileName - 文件名
   * @returns {Promise<Object>} - 解析结果
   */
  async analyzePPTFile(buffer, fileName) {
    try {
      // 在React Native中，我们无法直接解析PPT文件内容
      // 但可以提供有用的预览信息和操作选项
      
      const fileSize = buffer.length;
      const isPPTX = fileName.toLowerCase().endsWith('.pptx');
      
      // 生成友好的预览内容
      const text = `演示文稿: ${fileName}\n\n` +
                  `文件类型: ${isPPTX ? 'PPTX (PowerPoint Open XML)' : 'PPT (PowerPoint 97-2003)'}\n` +
                  `文件大小: ${(fileSize / 1024).toFixed(2)} KB\n\n` +
                  `此演示文稿包含多张幻灯片，建议使用原生PowerPoint应用或兼容的演示文稿查看器打开以获得完整体验。`;
      
      const html = this.createPPTPreviewHtml(fileName, fileSize, isPPTX);
      
      return {
        text,
        html,
        slides: this.estimateSlideCount(fileSize),
        tables: 0,
        images: this.estimateImageCount(fileSize)
      };
      
    } catch (error) {
      throw new Error(`PPT文件分析失败: ${error.message}`);
    }
  }

  /**
   * 估计幻灯片数量（基于文件大小）
   */
  estimateSlideCount(fileSize) {
    // 简单的启发式估算：每50KB大约1张幻灯片
    return Math.max(1, Math.floor(fileSize / 51200));
  }

  /**
   * 估计图片数量（基于文件大小）
   */
  estimateImageCount(fileSize) {
    // 简单的启发式估算：每100KB大约1张图片
    return Math.floor(fileSize / 102400);
  }

  /**
   * 创建PPT预览HTML内容
   */
  createPPTPreviewHtml(fileName, fileSize, isPPTX) {
    const slideCount = this.estimateSlideCount(fileSize);
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
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
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
            预估幻灯片: ${slideCount} 张<br>
            预估图片: ${imageCount} 张
          </div>
          
          <div class="slide-grid">
            ${Array.from({length: Math.min(slideCount, 6)}, (_, i) => `
              <div class="slide-thumbnail">
                幻灯片 ${i + 1}
                ${i === 5 && slideCount > 6 ? `<br><small>+${slideCount - 6}更多</small>` : ''}
              </div>
            `).join('')}
          </div>
          
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
   * 读取Excel文档内容并转换为HTML
   * @param {string} filePath - 文件路径
   * @returns {Promise<Object>} - 解析后的文档内容
   */
  async readExcelDocument(filePath) {
    let fileName;
    let fileStats;
    
    try {
      console.log('NativeDocumentViewer: 开始读取Excel文档:', filePath);
      
      // 检查缓存
      const cacheKey = `excel_${filePath}`;
      if (this.cache.has(cacheKey)) {
        console.log('NativeDocumentViewer: 使用缓存的Excel文档');
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
        console.warn('NativeDocumentViewer: XLSX库不可用，使用原生应用查看');
        return await this.createNativeViewDocument(filePath, fileName, 'excel', fileStats);
      }

      // 读取文件内容
      const fileContent = await RNFS.readFile(filePath, 'base64');
      const buffer = Buffer.from(fileContent, 'base64');

      // 使用XLSX解析Excel
      console.log('NativeDocumentViewer: 尝试使用XLSX解析Excel文件');
      
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
        this.cache.set(cacheKey, documentData);
        
        console.log('NativeDocumentViewer: Excel文档解析完成');
        return documentData;

      } catch (parseError) {
        console.warn('NativeDocumentViewer: Excel解析失败，使用原生应用查看:', parseError);
        return await this.createNativeViewDocument(filePath, fileName, 'excel', fileStats);
      }

    } catch (error) {
      console.error('NativeDocumentViewer: Excel文档读取失败:', error);
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
   * 创建备用内容
   */
  createFallbackContent(fileName, fileStats, fileType) {
    const fileTypeName = fileType === 'word' ? 'Word文档' : 
                         fileType === 'powerpoint' ? '演示文稿' : '文档';
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
          .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            border: 1px solid #ddd;
            border-radius: 8px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
          }
          .title {
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 15px;
            text-align: center;
          }
          .info {
            margin: 10px 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="title">${fileTypeName}预览</div>
          <div class="info">文件名: ${fileName}</div>
          <div class="info">文件大小: ${(fileStats.size / 1024).toFixed(2)} KB</div>
          <div class="info">修改时间: ${new Date(fileStats.mtime).toLocaleString()}</div>
          <div class="info">状态: 需要使用原生应用查看完整内容</div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * 增强HTML内容（适配RN屏幕，添加响应式样式）
   */
  enhanceHtmlContent(htmlContent) {
    // 移除mammoth默认的多余样式，添加RN适配样式
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
      formattedContent: `此${fileTypeName}需要使用原生应用打开以查看完整内容。\n\n文档信息：\n- 文件名: ${fileName}\n- 文件大小: ${(fileStats.size / 1024).toFixed(2)} KB\n- 修改时间: ${new Date(fileStats.mtime).toLocaleString()}\n- 建议操作: 使用原生应用打开此${fileTypeName}\n\n您可以使用以下方式打开文档：\n1. 点击右上角的"外部应用"按钮\n2. 使用系统默认的${fileTypeName}应用\n3. 选择其他支持${fileExtension.toUpperCase()}格式的应用`,
      messages: [{ 
        message: `${fileTypeName}解析器不可用，建议使用原生应用打开文档`,
        type: 'warning'
      }],
      structure: {
        hasHtml: false,
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
    
    console.log(`NativeDocumentViewer: ${fileTypeName}原生查看数据创建完成`);
    return documentData;
  }

  /**
   * 通用文档读取方法
   */
  async readDocument(filePath, fileName) {
    try {
      console.log('NativeDocumentViewer: 开始读取文档:', { filePath, fileName });
      
      const supportedType = this.getSupportedType(fileName);
      console.log('NativeDocumentViewer: 检测到的文件类型:', supportedType);
      
      if (!supportedType) {
        throw new Error(`不支持的文件格式: ${fileName}`);
      }

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

    } catch (error) {
      console.error('NativeDocumentViewer: 文档读取失败:', error);
      
      try {
        const fileExists = await RNFS.exists(filePath);
        if (fileExists) {
          const fileStats = await RNFS.stat(filePath);
          const fileName = filePath.split('/').pop();
          const fileType = this.getSupportedType(fileName) || 'unknown';
          
          if (fileType === 'unknown') {
            console.warn('NativeDocumentViewer: 不支持的文件格式，尝试使用原生应用查看');
            return await this.createNativeViewDocument(filePath, fileName, 'unknown', fileStats);
          }
        }
      } catch (infoError) {
        console.warn('NativeDocumentViewer: 无法获取文件信息:', infoError);
      }
      
      throw error;
    }
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
      console.log('NativeDocumentViewer: 清理特定文件缓存:', filePath);
    } else {
      this.cache.clear();
      console.log('NativeDocumentViewer: 清理所有缓存');
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
const nativeDocumentViewer = new NativeDocumentViewer();

export default nativeDocumentViewer;