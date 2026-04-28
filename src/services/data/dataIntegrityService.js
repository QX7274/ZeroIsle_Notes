/**
 * 数据完整性验证服务
 * 确保所有笔记数据的完整性和一致性
 */

import realmService from '../database/realmService';
import { logService } from '../../utils/logService';
import crypto from 'crypto-js';

class DataIntegrityService {
  constructor() {
    this.initialized = false;
    this.validationRules = new Map();
    this.setupValidationRules();
  }

  /**
   * 初始化服务
   */
  async initialize() {
    if (this.initialized) {return;}

    try {
      await realmService.initialize();
      this.initialized = true;
      logService.info('数据完整性验证服务初始化成功');
    } catch (error) {
      logService.error('数据完整性验证服务初始化失败', error);
      throw error;
    }
  }

  /**
   * 设置验证规则
   */
  setupValidationRules() {
    // 文本笔记验证规则
    this.validationRules.set('text', {
      requiredFields: ['title', 'content'],
      optionalFields: ['tags', 'category_id', 'color'],
      maxContentLength: 1000000, // 1MB
      validateContent: (content) => typeof content === 'string',
    });

    // 画布笔记验证规则
    this.validationRules.set('canvas', {
      requiredFields: ['title', 'strokeData'],
      optionalFields: ['viewport', 'canvasStyle', 'paths', 'images'],
      maxContentLength: 5000000, // 5MB
      validateContent: (content) => {
        try {
          if (content.strokeData) {
            JSON.parse(content.strokeData);
          }
          if (content.viewport) {
            JSON.parse(content.viewport);
          }
          return true;
        } catch (error) {
          return false;
        }
      },
    });

    // PDF笔记验证规则
    this.validationRules.set('pdf', {
      requiredFields: ['title', 'pdfPath'],
      optionalFields: ['pdfAnnotations', 'pdfCurrentPage', 'pdfTotalPages', 'pdfScale'],
      maxContentLength: 100000000, // 100MB
      validateContent: (content) => {
        try {
          if (content.pdfAnnotations) {
            JSON.parse(content.pdfAnnotations);
          }
          return true;
        } catch (error) {
          return false;
        }
      },
    });

    // 音频笔记验证规则
    this.validationRules.set('audio', {
      requiredFields: ['title', 'audioPath'],
      optionalFields: ['duration', 'audioTranscription'],
      maxContentLength: 50000000, // 50MB
      validateContent: (content) => {
        return content.audioPath && content.audioPath.length > 0;
      },
    });

    // 视频笔记验证规则
    this.validationRules.set('video', {
      requiredFields: ['title', 'videoPath'],
      optionalFields: ['duration', 'videoThumbnails'],
      maxContentLength: 200000000, // 200MB
      validateContent: (content) => {
        return content.videoPath && content.videoPath.length > 0;
      },
    });

    // 图片笔记验证规则
    this.validationRules.set('image', {
      requiredFields: ['title', 'imagePath'],
      optionalFields: ['imageWidth', 'imageHeight', 'imageFormat'],
      maxContentLength: 20000000, // 20MB
      validateContent: (content) => {
        return content.imagePath && content.imagePath.length > 0;
      },
    });

    // Word文档验证规则
    this.validationRules.set('word', {
      requiredFields: ['title', 'wordPath'],
      optionalFields: ['wordContent', 'wordMetadata'],
      maxContentLength: 10000000, // 10MB
      validateContent: (content) => {
        try {
          if (content.wordMetadata) {
            JSON.parse(content.wordMetadata);
          }
          return true;
        } catch (error) {
          return false;
        }
      },
    });

    // 分页笔记验证规则
    this.validationRules.set('paged', {
      requiredFields: ['title', 'pages'],
      optionalFields: ['currentPage', 'totalPages', 'pageStyle', 'scale'],
      maxContentLength: 10000000, // 10MB
      validateContent: (content) => {
        try {
          if (content.pages) {
            JSON.parse(content.pages);
          }
          return true;
        } catch (error) {
          return false;
        }
      },
    });
  }

  /**
   * 验证笔记数据完整性
   * @param {Object} note 笔记对象
   * @returns {Object} 验证结果
   */
  async validateNote(note) {
    try {
      await this.initialize();

      const result = {
        isValid: true,
        errors: [],
        warnings: [],
        score: 100,
      };

      if (!note) {
        result.isValid = false;
        result.errors.push('笔记对象为空');
        result.score = 0;
        return result;
      }

      // 基础字段验证
      const basicValidation = this.validateBasicFields(note);
      result.errors.push(...basicValidation.errors);
      result.warnings.push(...basicValidation.warnings);
      result.score -= basicValidation.scoreDeduction;

      // 类型特定验证
      const typeValidation = this.validateByType(note);
      result.errors.push(...typeValidation.errors);
      result.warnings.push(...typeValidation.warnings);
      result.score -= typeValidation.scoreDeduction;

      // 数据哈希验证
      const hashValidation = this.validateDataHash(note);
      result.errors.push(...hashValidation.errors);
      result.warnings.push(...hashValidation.warnings);
      result.score -= hashValidation.scoreDeduction;

      // 文件路径验证
      const pathValidation = await this.validateFilePaths(note);
      result.errors.push(...pathValidation.errors);
      result.warnings.push(...pathValidation.warnings);
      result.score -= pathValidation.scoreDeduction;

      // 确定最终状态
      result.isValid = result.errors.length === 0;
      result.score = Math.max(0, result.score);

      return result;
    } catch (error) {
      logService.error('验证笔记数据完整性失败', error);
      return {
        isValid: false,
        errors: [`验证过程出错: ${error.message}`],
        warnings: [],
        score: 0,
      };
    }
  }

  /**
   * 验证基础字段
   * @private
   */
  validateBasicFields(note) {
    const result = {
      errors: [],
      warnings: [],
      scoreDeduction: 0,
    };

    // 必需字段检查
    if (!note._id) {
      result.errors.push('缺少笔记ID');
      result.scoreDeduction += 30;
    }

    if (!note.title || note.title.trim().length === 0) {
      result.errors.push('缺少笔记标题');
      result.scoreDeduction += 20;
    }

    if (!note.type) {
      result.errors.push('缺少笔记类型');
      result.scoreDeduction += 15;
    }

    if (!note.created_at) {
      result.errors.push('缺少创建时间');
      result.scoreDeduction += 10;
    }

    if (!note.updated_at) {
      result.errors.push('缺少更新时间');
      result.scoreDeduction += 10;
    }

    // 时间一致性检查
    if (note.created_at && note.updated_at) {
      if (new Date(note.updated_at) < new Date(note.created_at)) {
        result.warnings.push('更新时间早于创建时间');
        result.scoreDeduction += 5;
      }
    }

    // 标题长度检查
    if (note.title && note.title.length > 200) {
      result.warnings.push('标题过长，可能影响显示');
      result.scoreDeduction += 5;
    }

    return result;
  }

  /**
   * 按类型验证
   * @private
   */
  validateByType(note) {
    const result = {
      errors: [],
      warnings: [],
      scoreDeduction: 0,
    };

    const noteType = note.type;
    const rules = this.validationRules.get(noteType);

    if (!rules) {
      result.warnings.push(`未知的笔记类型: ${noteType}`);
      result.scoreDeduction += 10;
      return result;
    }

    // 检查必需字段
    for (const field of rules.requiredFields) {
      if (!note[field] || (typeof note[field] === 'string' && note[field].trim().length === 0)) {
        result.errors.push(`缺少必需字段: ${field}`);
        result.scoreDeduction += 20;
      }
    }

    // 内容验证
    if (rules.validateContent && !rules.validateContent(note)) {
      result.errors.push('内容格式验证失败');
      result.scoreDeduction += 25;
    }

    // 内容长度检查
    const contentLength = this.calculateContentLength(note);
    if (contentLength > rules.maxContentLength) {
      result.errors.push(`内容长度超过限制: ${contentLength} > ${rules.maxContentLength}`);
      result.scoreDeduction += 30;
    }

    return result;
  }

  /**
   * 验证数据哈希
   * @private
   */
  validateDataHash(note) {
    const result = {
      errors: [],
      warnings: [],
      scoreDeduction: 0,
    };

    if (!note.dataHash) {
      result.warnings.push('缺少数据完整性哈希');
      result.scoreDeduction += 15;
      return result;
    }

    try {
      const currentHash = this.generateDataHash(note);
      if (currentHash !== note.dataHash) {
        result.errors.push('数据完整性验证失败，数据可能已损坏');
        result.scoreDeduction += 50;
      }
    } catch (error) {
      result.errors.push(`哈希验证过程出错: ${error.message}`);
      result.scoreDeduction += 25;
    }

    return result;
  }

  /**
   * 验证文件路径
   * @private
   */
  async validateFilePaths(note) {
    const result = {
      errors: [],
      warnings: [],
      scoreDeduction: 0,
    };

    const filePaths = [
      note.file_path,
      note.file_uri,
      note.pdfPath,
      note.audioPath,
      note.videoPath,
      note.imagePath,
      note.wordPath,
    ].filter(path => path && path.length > 0);

    for (const path of filePaths) {
      try {
        // 这里应该检查文件是否实际存在
        // 由于这是React Native环境，我们只能做基本的路径格式检查
        if (!this.isValidPath(path)) {
          result.warnings.push(`文件路径格式可能无效: ${path}`);
          result.scoreDeduction += 5;
        }
      } catch (error) {
        result.warnings.push(`文件路径检查失败: ${path}`);
        result.scoreDeduction += 5;
      }
    }

    return result;
  }

  /**
   * 生成数据哈希
   * @private
   */
  generateDataHash(note) {
    try {
      const hashData = {
        title: note.title,
        content: note.content,
        type: note.type,
        strokeData: note.strokeData,
        viewport: note.viewport,
        pdfAnnotations: note.pdfAnnotations,
        audioTranscription: note.audioTranscription,
        wordContent: note.wordContent,
        pages: note.pages,
      };

      const hashString = JSON.stringify(hashData);
      return crypto.SHA256(hashString).toString();
    } catch (error) {
      logService.error('生成数据哈希失败', error);
      return null;
    }
  }

  /**
   * 计算内容长度
   * @private
   */
  calculateContentLength(note) {
    let length = 0;

    const contentFields = [
      'content',
      'strokeData',
      'viewport',
      'pdfAnnotations',
      'audioTranscription',
      'wordContent',
      'pages',
      'videoThumbnails',
      'wordMetadata',
      'pdfBookmarks',
    ];

    for (const field of contentFields) {
      if (note[field] && typeof note[field] === 'string') {
        length += note[field].length;
      }
    }

    return length;
  }

  /**
   * 验证路径格式
   * @private
   */
  isValidPath(path) {
    if (!path || typeof path !== 'string') {
      return false;
    }

    // 基本路径格式检查
    const pathPattern = /^[a-zA-Z0-9\/\.\-\_]+$/;
    return pathPattern.test(path) && path.length > 0 && path.length < 1000;
  }

  /**
   * 批量验证笔记
   * @param {Array} notes 笔记数组
   * @returns {Object} 批量验证结果
   */
  async validateNotes(notes) {
    try {
      await this.initialize();

      const results = {
        total: notes.length,
        valid: 0,
        invalid: 0,
        warnings: 0,
        details: [],
        summary: {
          averageScore: 0,
          commonErrors: new Map(),
          commonWarnings: new Map(),
        },
      };

      let totalScore = 0;

      for (const note of notes) {
        const validation = await this.validateNote(note);

        results.details.push({
          noteId: note._id,
          title: note.title,
          type: note.type,
          ...validation,
        });

        if (validation.isValid) {
          results.valid++;
        } else {
          results.invalid++;
        }

        if (validation.warnings.length > 0) {
          results.warnings++;
        }

        totalScore += validation.score;

        // 统计常见错误和警告
        for (const error of validation.errors) {
          const count = results.summary.commonErrors.get(error) || 0;
          results.summary.commonErrors.set(error, count + 1);
        }

        for (const warning of validation.warnings) {
          const count = results.summary.commonWarnings.get(warning) || 0;
          results.summary.commonWarnings.set(warning, count + 1);
        }
      }

      results.summary.averageScore = results.total > 0 ? totalScore / results.total : 0;

      return results;
    } catch (error) {
      logService.error('批量验证笔记失败', error);
      throw error;
    }
  }

  /**
   * 修复数据问题
   * @param {Object} note 笔记对象
   * @param {Object} validation 验证结果
   * @returns {Object} 修复后的笔记
   */
  async repairNote(note, validation) {
    try {
      await this.initialize();

      const repairedNote = { ...note };
      let repaired = false;

      // 修复基础字段
      if (!repairedNote.title || repairedNote.title.trim().length === 0) {
        repairedNote.title = '未命名笔记';
        repaired = true;
      }

      if (!repairedNote.type) {
        repairedNote.type = 'text';
        repaired = true;
      }

      if (!repairedNote.created_at) {
        repairedNote.created_at = new Date();
        repaired = true;
      }

      if (!repairedNote.updated_at) {
        repairedNote.updated_at = new Date();
        repaired = true;
      }

      // 修复数据哈希
      if (!repairedNote.dataHash || validation.errors.some(e => e.includes('数据完整性验证失败'))) {
        repairedNote.dataHash = this.generateDataHash(repairedNote);
        repaired = true;
      }

      // 修复JSON字段
      const jsonFields = ['strokeData', 'viewport', 'pdfAnnotations', 'pages', 'videoThumbnails', 'wordMetadata', 'pdfBookmarks'];
      for (const field of jsonFields) {
        if (repairedNote[field] && typeof repairedNote[field] === 'string') {
          try {
            JSON.parse(repairedNote[field]);
          } catch (error) {
            // JSON格式错误，尝试修复或清空
            logService.warn(`修复JSON字段: ${field}`);
            repairedNote[field] = '{}';
            repaired = true;
          }
        }
      }

      if (repaired) {
        repairedNote.updated_at = new Date();
        logService.info(`笔记修复完成(ID: ${repairedNote._id})`);
      }

      return repairedNote;
    } catch (error) {
      logService.error('修复笔记失败', error);
      throw error;
    }
  }
}

// 创建单例实例
const dataIntegrityService = new DataIntegrityService();

export default dataIntegrityService;
export { DataIntegrityService };




