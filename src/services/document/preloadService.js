/**
 * 文档预加载服务
 * 实现智能预加载策略，提升文档打开速度
 */

import documentCacheService from './documentCacheService';
import { logService } from '../utils/logService';

class PreloadService {
  constructor() {
    this.preloadQueue = [];
    this.isPreloading = false;
    this.preloadHistory = new Set(); // 记录已预加载的文档
    this.maxConcurrentPreloads = 2; // 最大并发预加载数
    this.currentPreloads = 0;
  }

  /**
   * 添加文档到预加载队列
   * @param {string} uri - 文档URI
   * @param {string} type - 文档类型
   * @param {number} priority - 优先级 (1-10, 10最高)
   */
  addToPreloadQueue(uri, type, priority = 5) {
    if (!uri || this.preloadHistory.has(uri)) {
      return;
    }

    // 检查是否已在队列中
    const existingIndex = this.preloadQueue.findIndex(item => item.uri === uri);
    if (existingIndex !== -1) {
      // 更新优先级
      this.preloadQueue[existingIndex].priority = Math.max(
        this.preloadQueue[existingIndex].priority,
        priority
      );
      return;
    }

    this.preloadQueue.push({
      uri,
      type,
      priority,
      addedAt: Date.now()
    });

    // 按优先级排序
    this.preloadQueue.sort((a, b) => b.priority - a.priority);

    // 开始预加载
    this.startPreloading();
  }

  /**
   * 开始预加载处理
   */
  async startPreloading() {
    if (this.currentPreloads >= this.maxConcurrentPreloads) {
      return;
    }

    const nextItem = this.preloadQueue.shift();
    if (!nextItem) {
      return;
    }

    this.currentPreloads++;

    try {
      console.log(`PreloadService: 开始预加载 ${nextItem.type} 文档:`, nextItem.uri);
      
      // 检查是否已缓存
      const cached = await documentCacheService.getCachedDocument(nextItem.uri, nextItem.type);
      if (cached && cached.data) {
        console.log(`PreloadService: 文档已缓存，跳过预加载:`, nextItem.uri);
        this.preloadHistory.add(nextItem.uri);
        return;
      }

      // 执行预加载
      await this.preloadDocument(nextItem.uri, nextItem.type);
      this.preloadHistory.add(nextItem.uri);
      
      console.log(`PreloadService: 预加载完成:`, nextItem.uri);
    } catch (error) {
      logService.error('PreloadService: 预加载失败', {
        uri: nextItem.uri,
        type: nextItem.type,
        error: error.message
      });
    } finally {
      this.currentPreloads--;
      
      // 继续处理队列中的下一个项目
      if (this.preloadQueue.length > 0) {
        setTimeout(() => this.startPreloading(), 100);
      }
    }
  }

  /**
   * 预加载单个文档
   */
  async preloadDocument(uri, type) {
    const RNFS = require('react-native-fs');
    const { offlineStorageService } = require('../offline');

    try {
      let data;
      let actualPath = uri;

      // 首先尝试从笔记元数据中获取本地路径
      try {
        // 查找使用此URI的笔记
        const notes = await offlineStorageService.getAllNotes();
        const relatedNote = notes.find(note => {
          if (!note.metadata) return false;

          let metadata;
          try {
            metadata = typeof note.metadata === 'string' ? JSON.parse(note.metadata) : note.metadata;
          } catch (e) {
            return false;
          }

          // 检查是否有本地路径信息
          return metadata.originalUri === uri ||
                 metadata.localPath ||
                 metadata.localUri === uri ||
                 note.file_uri === uri ||
                 note.uri === uri;
        });

        if (relatedNote && relatedNote.metadata) {
          const metadata = typeof relatedNote.metadata === 'string'
            ? JSON.parse(relatedNote.metadata)
            : relatedNote.metadata;

          // 优先使用本地路径
          if (metadata.localPath && await RNFS.exists(metadata.localPath)) {
            actualPath = metadata.localPath;
            console.log('PreloadService: 使用笔记元数据中的本地路径:', actualPath);
          } else if (metadata.localUri && await RNFS.exists(metadata.localUri.replace('file://', ''))) {
            actualPath = metadata.localUri.replace('file://', '');
            console.log('PreloadService: 使用笔记元数据中的本地URI路径:', actualPath);
          } else if (relatedNote.file_path && await RNFS.exists(relatedNote.file_path)) {
            actualPath = relatedNote.file_path;
            console.log('PreloadService: 使用笔记中的file_path:', actualPath);
          }
        }
      } catch (metadataError) {
        console.warn('PreloadService: 获取笔记元数据失败，使用原始URI:', metadataError);
      }

      if (type === 'pdf') {
        // PDF预加载：只读取文件头部信息
        if (actualPath.startsWith('content://')) {
          // 对于content://协议，先复制到缓存目录
          const dest = `${RNFS.CachesDirectoryPath}/preload_${Date.now()}.pdf`;
          await RNFS.copyFile(actualPath, dest);
          data = dest; // 存储文件路径而不是内容
        } else {
          // 使用本地路径或已处理的路径
          data = actualPath;
        }
      } else if (type === 'docx' || type === 'pptx' || type === 'word' || type === 'ppt') {
        // Word/PPT预加载：读取完整内容为base64
        let path = actualPath;

        if (path.startsWith('content://')) {
          const ext = (type === 'docx' || type === 'word') ? 'docx' : 'pptx';
          const dest = `${RNFS.CachesDirectoryPath}/preload_${Date.now()}.${ext}`;
          await RNFS.copyFile(path, dest);
          path = dest;
        }

        // 确保以base64格式读取二进制文件
        data = await RNFS.readFile(path, 'base64');
      } else if (type === 'md' || type === 'txt' || type === 'markdown') {
        // 文本类型文档
        data = await RNFS.readFile(actualPath, 'utf8');
      } else {
        // 其他类型文档，默认为文本
        try {
          data = await RNFS.readFile(actualPath, 'utf8');
        } catch (error) {
          // 如果UTF-8读取失败，尝试base64
          console.warn(`PreloadService: UTF-8读取失败，尝试base64: ${error.message}`);
          data = await RNFS.readFile(actualPath, 'base64');
        }
      }

      // 缓存预加载的数据
      await documentCacheService.cacheDocument(uri, type, data);

    } catch (error) {
      throw new Error(`预加载文档失败: ${error.message}`);
    }
  }

  /**
   * 智能预加载策略：基于用户行为预测
   * @param {Array} recentDocuments - 最近访问的文档列表
   */
  intelligentPreload(recentDocuments) {
    if (!recentDocuments || recentDocuments.length === 0) {
      return;
    }

    // 预加载最近访问的文档（优先级8）
    recentDocuments.slice(0, 3).forEach(doc => {
      if (doc.uri && doc.type) {
        this.addToPreloadQueue(doc.uri, doc.type, 8);
      }
    });

    // 预加载同类型的其他文档（优先级6）
    const docTypes = [...new Set(recentDocuments.map(doc => doc.type))];
    recentDocuments.forEach(doc => {
      if (docTypes.includes(doc.type) && doc.uri) {
        this.addToPreloadQueue(doc.uri, doc.type, 6);
      }
    });
  }

  /**
   * 清理预加载队列
   */
  clearQueue() {
    this.preloadQueue = [];
    console.log('PreloadService: 预加载队列已清空');
  }

  /**
   * 获取预加载状态
   */
  getStatus() {
    return {
      queueLength: this.preloadQueue.length,
      currentPreloads: this.currentPreloads,
      preloadedCount: this.preloadHistory.size
    };
  }

  /**
   * 设置最大并发预加载数
   */
  setMaxConcurrentPreloads(max) {
    this.maxConcurrentPreloads = Math.max(1, Math.min(5, max));
  }
}

// 导出单例
const preloadService = new PreloadService();
export default preloadService;
