/**
 * 文件验证服务
 * 提供文件格式、完整性等验证功能
 */

import RNFS from 'react-native-fs';
import { Platform } from 'react-native';

class FileValidationService {
  constructor() {
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    
    try {
      // 确保必要的目录存在
      const docsDir = RNFS.DocumentDirectoryPath;
      const exists = await RNFS.exists(docsDir);
      if (!exists) {
        await RNFS.mkdir(docsDir);
      }
      
      this.initialized = true;
      console.log('FileValidationService: 初始化完成');
    } catch (error) {
      console.error('FileValidationService: 初始化失败:', error);
      throw error;
    }
  }

  /**
   * 验证PDF文件
   * @param {string} filePath - 文件路径
   * @returns {Promise<Object>} 验证结果
   */
  async validatePDF(filePath) {
    await this.initialize();
    
    try {
      console.log('FileValidationService: 开始验证PDF文件:', filePath);
      
      // 检查文件是否存在
      const exists = await RNFS.exists(filePath);
      if (!exists) {
        return {
          valid: false,
          error: 'FILE_NOT_FOUND',
          message: '文件不存在'
        };
      }

      // 检查文件大小
      const stats = await RNFS.stat(filePath);
      if (stats.size === 0) {
        return {
          valid: false,
          error: 'EMPTY_FILE',
          message: '文件为空'
        };
      }

      // 检查PDF文件头
      const header = await this.readFileHeader(filePath, 4);
      if (!header.startsWith('%PDF')) {
        return {
          valid: false,
          error: 'INVALID_PDF_FORMAT',
          message: '不是有效的PDF文件格式'
        };
      }

      // 检查文件是否损坏（尝试读取更多内容）
      try {
        const moreContent = await this.readFileHeader(filePath, 1024);
        // 检查是否包含PDF的基本结构
        if (!moreContent.includes('obj') && !moreContent.includes('xref')) {
          return {
            valid: false,
            error: 'CORRUPTED_PDF',
            message: 'PDF文件可能已损坏'
          };
        }
      } catch (readError) {
        return {
          valid: false,
          error: 'READ_ERROR',
          message: '无法读取文件内容'
        };
      }

      return {
        valid: true,
        message: 'PDF文件验证通过',
        fileSize: stats.size,
        lastModified: stats.mtime
      };

    } catch (error) {
      console.error('FileValidationService: PDF验证失败:', error);
      return {
        valid: false,
        error: 'VALIDATION_ERROR',
        message: `验证失败: ${error.message}`
      };
    }
  }

  /**
   * 验证Word文档
   * @param {string} filePath - 文件路径
   * @returns {Promise<Object>} 验证结果
   */
  async validateWord(filePath) {
    await this.initialize();
    
    try {
      console.log('FileValidationService: 开始验证Word文件:', filePath);
      
      // 检查文件是否存在
      const exists = await RNFS.exists(filePath);
      if (!exists) {
        return {
          valid: false,
          error: 'FILE_NOT_FOUND',
          message: '文件不存在'
        };
      }

      // 检查文件大小
      const stats = await RNFS.stat(filePath);
      if (stats.size === 0) {
        return {
          valid: false,
          error: 'EMPTY_FILE',
          message: '文件为空'
        };
      }

      // 检查Word文档的ZIP文件头（docx格式）
      const header = await this.readFileHeader(filePath, 4);
      const isZipFormat = header.startsWith('PK\x03\x04') || header.startsWith('PK\x05\x06') || header.startsWith('PK\x07\x08');
      
      if (!isZipFormat) {
        return {
          valid: false,
          error: 'INVALID_WORD_FORMAT',
          message: '不是有效的Word文档格式'
        };
      }

      return {
        valid: true,
        message: 'Word文档验证通过',
        fileSize: stats.size,
        lastModified: stats.mtime
      };

    } catch (error) {
      console.error('FileValidationService: Word验证失败:', error);
      return {
        valid: false,
        error: 'VALIDATION_ERROR',
        message: `验证失败: ${error.message}`
      };
    }
  }

  /**
   * 验证PPT文档
   * @param {string} filePath - 文件路径
   * @returns {Promise<Object>} 验证结果
   */
  async validatePPT(filePath) {
    await this.initialize();
    
    try {
      console.log('FileValidationService: 开始验证PPT文件:', filePath);
      
      // 检查文件是否存在
      const exists = await RNFS.exists(filePath);
      if (!exists) {
        return {
          valid: false,
          error: 'FILE_NOT_FOUND',
          message: '文件不存在'
        };
      }

      // 检查文件大小
      const stats = await RNFS.stat(filePath);
      if (stats.size === 0) {
        return {
          valid: false,
          error: 'EMPTY_FILE',
          message: '文件为空'
        };
      }

      // 检查PPT文档的ZIP文件头（pptx格式）
      const header = await this.readFileHeader(filePath, 4);
      const isZipFormat = header.startsWith('PK\x03\x04') || header.startsWith('PK\x05\x06') || header.startsWith('PK\x07\x08');
      
      if (!isZipFormat) {
        return {
          valid: false,
          error: 'INVALID_PPT_FORMAT',
          message: '不是有效的PPT文档格式'
        };
      }

      return {
        valid: true,
        message: 'PPT文档验证通过',
        fileSize: stats.size,
        lastModified: stats.mtime
      };

    } catch (error) {
      console.error('FileValidationService: PPT验证失败:', error);
      return {
        valid: false,
        error: 'VALIDATION_ERROR',
        message: `验证失败: ${error.message}`
      };
    }
  }

  /**
   * 通用文件验证
   * @param {string} filePath - 文件路径
   * @param {string} fileType - 文件类型
   * @returns {Promise<Object>} 验证结果
   */
  async validateFile(filePath, fileType) {
    switch (fileType.toLowerCase()) {
      case 'pdf':
        return await this.validatePDF(filePath);
      case 'doc':
      case 'docx':
        return await this.validateWord(filePath);
      case 'ppt':
      case 'pptx':
        return await this.validatePPT(filePath);
      default:
        return {
          valid: false,
          error: 'UNSUPPORTED_TYPE',
          message: `不支持的文件类型: ${fileType}`
        };
    }
  }

  /**
   * 读取文件头部
   * @param {string} filePath - 文件路径
   * @param {number} length - 读取长度
   * @returns {Promise<string>} 文件头内容
   */
  async readFileHeader(filePath, length = 4) {
    try {
      const content = await RNFS.read(filePath, length, 0, 'base64');
      return atob(content);
    } catch (error) {
      console.error('FileValidationService: 读取文件头失败:', error);
      throw error;
    }
  }

  /**
   * 检查文件是否需要在线转换
   * @param {string} fileType - 文件类型
   * @returns {boolean} 是否需要在线转换
   */
  needsOnlineConversion(fileType) {
    const typesNeedingConversion = ['ppt', 'pptx', 'doc', 'docx'];
    return typesNeedingConversion.includes(fileType.toLowerCase());
  }

  /**
   * 获取文件类型建议
   * @param {Object} validationResult - 验证结果
   * @returns {string} 建议的操作
   */
  getSuggestedAction(validationResult) {
    if (validationResult.valid) {
      return 'proceed';
    }

    switch (validationResult.error) {
      case 'FILE_NOT_FOUND':
        return 'reimport';
      case 'EMPTY_FILE':
        return 'reimport';
      case 'INVALID_PDF_FORMAT':
      case 'INVALID_WORD_FORMAT':
      case 'INVALID_PPT_FORMAT':
        return 'reimport';
      case 'CORRUPTED_PDF':
        return 'reimport';
      case 'READ_ERROR':
        return 'retry';
      default:
        return 'reimport';
    }
  }
}

// 创建单例实例
const fileValidationService = new FileValidationService();

export default fileValidationService;


