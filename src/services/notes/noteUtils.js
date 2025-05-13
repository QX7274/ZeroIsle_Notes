/**
 * 笔记工具函数 - 提供笔记相关的辅助功能
 */

import { Platform } from 'react-native';
import { fileService } from '../files/fileService';
import { logService } from '../utils/logService';

/**
 * 笔记类型枚举
 */
export const NOTE_TYPES = {
  TEXT: 'text',
  MARKDOWN: 'markdown',
  CODE: 'code',
  HANDWRITING: 'handwriting',
  VOICE: 'voice',
  PDF: 'pdf',
  IMAGE: 'image',
  DOCUMENT: 'document',
  SPREADSHEET: 'spreadsheet',
  PRESENTATION: 'presentation',
  CANVAS: 'canvas',
  MIND_MAP: 'mind_map',
};

/**
 * 笔记类型颜色映射
 */
export const NOTE_TYPE_COLORS = {
  [NOTE_TYPES.TEXT]: '#4CAF50',       // 绿色
  [NOTE_TYPES.MARKDOWN]: '#2196F3',   // 蓝色
  [NOTE_TYPES.CODE]: '#9C27B0',       // 紫色
  [NOTE_TYPES.HANDWRITING]: '#FF9800', // 橙色
  [NOTE_TYPES.VOICE]: '#E91E63',      // 粉色
  [NOTE_TYPES.PDF]: '#F44336',        // 红色
  [NOTE_TYPES.IMAGE]: '#00BCD4',      // 青色
  [NOTE_TYPES.DOCUMENT]: '#3F51B5',   // 靛蓝色
  [NOTE_TYPES.SPREADSHEET]: '#009688', // 蓝绿色
  [NOTE_TYPES.PRESENTATION]: '#FF5722', // 深橙色
  [NOTE_TYPES.CANVAS]: '#795548',     // 棕色
  [NOTE_TYPES.MIND_MAP]: '#607D8B',   // 蓝灰色
};

/**
 * 笔记工具类
 */
class NoteUtils {
  /**
   * 根据文件扩展名确定笔记类型
   * @param {string} filename 文件名
   * @returns {string} 笔记类型
   */
  getNoteTypeFromFilename(filename) {
    if (!filename) return NOTE_TYPES.TEXT;
    
    const extension = filename.split('.').pop().toLowerCase();
    
    switch (extension) {
      case 'md':
        return NOTE_TYPES.MARKDOWN;
      case 'js':
      case 'py':
      case 'java':
      case 'c':
      case 'cpp':
      case 'cs':
      case 'html':
      case 'css':
      case 'php':
      case 'rb':
      case 'go':
      case 'rs':
      case 'swift':
      case 'kt':
      case 'ts':
        return NOTE_TYPES.CODE;
      case 'pdf':
        return NOTE_TYPES.PDF;
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'bmp':
      case 'webp':
      case 'svg':
        return NOTE_TYPES.IMAGE;
      case 'doc':
      case 'docx':
      case 'txt':
      case 'rtf':
        return NOTE_TYPES.DOCUMENT;
      case 'xls':
      case 'xlsx':
      case 'csv':
        return NOTE_TYPES.SPREADSHEET;
      case 'ppt':
      case 'pptx':
        return NOTE_TYPES.PRESENTATION;
      case 'mp3':
      case 'wav':
      case 'm4a':
      case 'ogg':
        return NOTE_TYPES.VOICE;
      default:
        return NOTE_TYPES.TEXT;
    }
  }

  /**
   * 获取笔记类型的颜色
   * @param {string} noteType 笔记类型
   * @returns {string} 颜色代码
   */
  getNoteTypeColor(noteType) {
    return NOTE_TYPE_COLORS[noteType] || NOTE_TYPE_COLORS[NOTE_TYPES.TEXT];
  }

  /**
   * 创建新笔记的默认数据
   * @param {string} type 笔记类型
   * @param {Object} additionalData 额外数据
   * @returns {Object} 笔记数据
   */
  createDefaultNoteData(type = NOTE_TYPES.TEXT, additionalData = {}) {
    const now = new Date();
    
    const defaultData = {
      title: `新建${this.getNoteTypeName(type)}`,
      content: '',
      type,
      tags: [],
      created_at: now,
      updated_at: now,
      is_deleted: false,
      is_synced: false,
      is_favorite: false,
      is_archived: false,
      color: this.getNoteTypeColor(type),
    };
    
    return { ...defaultData, ...additionalData };
  }

  /**
   * 获取笔记类型的名称
   * @param {string} type 笔记类型
   * @returns {string} 类型名称
   */
  getNoteTypeName(type) {
    const typeNames = {
      [NOTE_TYPES.TEXT]: '文本笔记',
      [NOTE_TYPES.MARKDOWN]: 'Markdown笔记',
      [NOTE_TYPES.CODE]: '代码笔记',
      [NOTE_TYPES.HANDWRITING]: '手写笔记',
      [NOTE_TYPES.VOICE]: '语音笔记',
      [NOTE_TYPES.PDF]: 'PDF文档',
      [NOTE_TYPES.IMAGE]: '图片',
      [NOTE_TYPES.DOCUMENT]: '文档',
      [NOTE_TYPES.SPREADSHEET]: '表格',
      [NOTE_TYPES.PRESENTATION]: '演示文稿',
      [NOTE_TYPES.CANVAS]: '画布',
      [NOTE_TYPES.MIND_MAP]: '思维导图',
    };
    
    return typeNames[type] || '笔记';
  }

  /**
   * 格式化笔记创建/更新时间
   * @param {Date|string} date 日期对象或字符串
   * @returns {string} 格式化后的日期字符串
   */
  formatNoteDate(date) {
    if (!date) return '';
    
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    return dateObj.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  /**
   * 生成笔记摘要
   * @param {string} content 笔记内容
   * @param {number} maxLength 最大长度
   * @returns {string} 摘要
   */
  generateSummary(content, maxLength = 100) {
    if (!content) return '';
    
    // 移除Markdown语法
    let plainText = content
      .replace(/#{1,6}\s+/g, '') // 标题
      .replace(/\*\*(.+?)\*\*/g, '$1') // 粗体
      .replace(/\*(.+?)\*/g, '$1') // 斜体
      .replace(/\[(.+?)\]\(.+?\)/g, '$1') // 链接
      .replace(/!\[(.+?)\]\(.+?\)/g, '[图片]') // 图片
      .replace(/```[\s\S]+?```/g, '[代码块]') // 代码块
      .replace(/`(.+?)`/g, '$1') // 行内代码
      .replace(/>\s(.+)/g, '$1') // 引用
      .replace(/\n\s*[-*+]\s/g, ' ') // 无序列表
      .replace(/\n\s*\d+\.\s/g, ' ') // 有序列表
      .replace(/\n/g, ' '); // 换行
    
    // 截取指定长度
    if (plainText.length > maxLength) {
      plainText = plainText.substring(0, maxLength) + '...';
    }
    
    return plainText;
  }

  /**
   * 提取笔记中的标签
   * @param {string} content 笔记内容
   * @returns {Array<string>} 标签数组
   */
  extractTags(content) {
    if (!content) return [];
    
    // 匹配#标签格式
    const tagRegex = /#([a-zA-Z0-9\u4e00-\u9fa5_-]+)/g;
    const matches = content.match(tagRegex);
    
    if (!matches) return [];
    
    // 移除#前缀并去重
    return [...new Set(matches.map(tag => tag.substring(1)))];
  }
}

export const noteUtils = new NoteUtils();
