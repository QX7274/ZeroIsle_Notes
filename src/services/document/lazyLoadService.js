/**
 * 延迟加载服务
 * 处理大文件的按需加载，防止内存溢出
 */

import memoryGuard from '../memory/memoryGuard';
import RNFS from 'react-native-fs';

class LazyLoadService {
  constructor() {
    this.loadingFiles = new Map(); // 正在加载的文件
    this.loadedContent = new Map(); // 已加载的内容缓存
    this.maxCacheSize = 200 * 1024 * 1024; // 200MB缓存限制
    this.currentCacheSize = 0;
  }

  /**
   * 检查笔记是否需要延迟加载
   * @param {Object} note - 笔记对象
   * @returns {boolean} 是否需要延迟加载
   */
  needsLazyLoad(note) {
    return note && note._isDeferred === true;
  }

  /**
   * 延迟加载笔记内容
   * @param {Object} note - 笔记对象
   * @param {Function} onProgress - 进度回调
   * @returns {Promise<Object>} 加载后的笔记对象
   */
  async loadNoteContent(note, onProgress = null) {
    if (!this.needsLazyLoad(note)) {
      return note; // 不需要延迟加载
    }

    const fileUri = note._originalFileUri || note.file_uri;
    if (!fileUri) {
      throw new Error('没有找到文件路径');
    }

    // 检查是否正在加载
    if (this.loadingFiles.has(fileUri)) {
      console.log('LazyLoadService: 文件正在加载中，等待完成:', fileUri);
      return await this.loadingFiles.get(fileUri);
    }

    // 检查缓存
    if (this.loadedContent.has(fileUri)) {
      console.log('LazyLoadService: 从缓存获取文件内容:', fileUri);
      const cachedContent = this.loadedContent.get(fileUri);
      return { ...note, ...cachedContent, _isDeferred: false };
    }

    // 开始加载
    const loadPromise = this._performLoad(note, fileUri, onProgress);
    this.loadingFiles.set(fileUri, loadPromise);

    try {
      const result = await loadPromise;
      return result;
    } finally {
      this.loadingFiles.delete(fileUri);
    }
  }

  /**
   * 执行实际的加载操作
   * @param {Object} note - 笔记对象
   * @param {string} fileUri - 文件URI
   * @param {Function} onProgress - 进度回调
   * @returns {Promise<Object>} 加载结果
   */
  async _performLoad(note, fileUri, onProgress) {
    try {
      console.log('LazyLoadService: 开始延迟加载文件:', fileUri);

      if (onProgress) {
        onProgress({ stage: 'checking', progress: 10, message: '检查文件状态...' });
      }

      // 使用内存守护检查是否可以加载
      const filePath = fileUri.replace('file://', '');
      const loadResult = await memoryGuard.loadDeferredFile(filePath);

      if (!loadResult.success) {
        throw new Error(loadResult.error || '无法加载文件');
      }

      if (onProgress) {
        onProgress({ stage: 'loading', progress: 50, message: '正在加载文件内容...' });
      }

      // 根据文件类型加载内容
      const loadedContent = await this._loadFileContent(note, filePath, onProgress);

      if (onProgress) {
        onProgress({ stage: 'caching', progress: 90, message: '缓存文件内容...' });
      }

      // 缓存内容
      await this._cacheContent(fileUri, loadedContent);

      if (onProgress) {
        onProgress({ stage: 'completed', progress: 100, message: '文件加载完成' });
      }

      // 返回完整的笔记对象
      const fullNote = {
        ...note,
        ...loadedContent,
        _isDeferred: false,
        _loadedAt: Date.now(),
      };

      console.log('LazyLoadService: 文件加载完成:', fileUri);
      return fullNote;

    } catch (error) {
      console.error('LazyLoadService: 延迟加载失败:', error);

      // 返回原始笔记，但标记加载失败
      return {
        ...note,
        _loadError: error.message,
        _loadFailedAt: Date.now(),
      };
    }
  }

  /**
   * 根据文件类型加载内容
   * @param {Object} note - 笔记对象
   * @param {string} filePath - 文件路径
   * @param {Function} onProgress - 进度回调
   * @returns {Promise<Object>} 加载的内容
   */
  async _loadFileContent(note, filePath, onProgress) {
    const fileType = note.type || note.file_type;

    switch (fileType) {
      case 'pdf':
        return await this._loadPDFContent(filePath, onProgress);

      case 'ppt':
      case 'pptx':
        return await this._loadPPTContent(filePath, onProgress);

      case 'word':
      case 'docx':
        return await this._loadWordContent(filePath, onProgress);

      default:
        // 对于其他类型，只返回基本信息
        return {
          content: `${fileType}文件: ${note.file_name || '未命名'}`,
          file_path: filePath,
          file_uri: `file://${filePath}`,
        };
    }
  }

  /**
   * 加载PDF内容
   * @param {string} filePath - 文件路径
   * @param {Function} onProgress - 进度回调
   * @returns {Promise<Object>} PDF内容
   */
  async _loadPDFContent(filePath, onProgress) {
    // PDF文件不需要读取全部内容，只需要路径
    return {
      content: 'PDF文件已准备就绪',
      file_path: filePath,
      file_uri: `file://${filePath}`,
      pdfPath: filePath,
    };
  }

  /**
   * 加载PPT内容
   * @param {string} filePath - 文件路径
   * @param {Function} onProgress - 进度回调
   * @returns {Promise<Object>} PPT内容
   */
  async _loadPPTContent(filePath, onProgress) {
    // PPT文件不需要读取全部内容，只需要路径
    return {
      content: 'PPT文件已准备就绪',
      file_path: filePath,
      file_uri: `file://${filePath}`,
      pptPath: filePath,
    };
  }

  /**
   * 加载Word内容
   * @param {string} filePath - 文件路径
   * @param {Function} onProgress - 进度回调
   * @returns {Promise<Object>} Word内容
   */
  async _loadWordContent(filePath, onProgress) {
    // Word文件不需要读取全部内容，只需要路径
    return {
      content: 'Word文件已准备就绪',
      file_path: filePath,
      file_uri: `file://${filePath}`,
      wordPath: filePath,
    };
  }

  /**
   * 缓存内容
   * @param {string} fileUri - 文件URI
   * @param {Object} content - 内容对象
   */
  async _cacheContent(fileUri, content) {
    try {
      // 估算内容大小（简单估算）
      const contentSize = JSON.stringify(content).length * 2; // 粗略估算

      // 检查缓存空间
      if (this.currentCacheSize + contentSize > this.maxCacheSize) {
        await this._cleanupCache(contentSize);
      }

      // 添加到缓存
      this.loadedContent.set(fileUri, {
        ...content,
        _cachedAt: Date.now(),
        _cacheSize: contentSize,
      });

      this.currentCacheSize += contentSize;
      console.log(`LazyLoadService: 内容已缓存，当前缓存大小: ${Math.round(this.currentCacheSize / 1024 / 1024)}MB`);

    } catch (error) {
      console.error('LazyLoadService: 缓存内容失败:', error);
    }
  }

  /**
   * 清理缓存
   * @param {number} requiredSize - 需要的空间大小
   */
  async _cleanupCache(requiredSize) {
    console.log('LazyLoadService: 开始清理缓存...');

    // 按缓存时间排序，最旧的先清理
    const sortedEntries = Array.from(this.loadedContent.entries())
      .sort((a, b) => a[1]._cachedAt - b[1]._cachedAt);

    let freedSize = 0;
    for (const [fileUri, content] of sortedEntries) {
      if (freedSize >= requiredSize) {break;}

      this.loadedContent.delete(fileUri);
      freedSize += content._cacheSize || 0;
      this.currentCacheSize -= content._cacheSize || 0;

      console.log(`LazyLoadService: 清理缓存项: ${fileUri}`);
    }

    console.log(`LazyLoadService: 缓存清理完成，释放了 ${Math.round(freedSize / 1024 / 1024)}MB`);
  }

  /**
   * 获取缓存统计
   * @returns {Object} 缓存统计信息
   */
  getCacheStats() {
    return {
      cacheSize: this.currentCacheSize,
      cacheSizeMB: Math.round(this.currentCacheSize / 1024 / 1024),
      maxCacheSize: this.maxCacheSize,
      maxCacheSizeMB: Math.round(this.maxCacheSize / 1024 / 1024),
      cachedItemsCount: this.loadedContent.size,
      loadingItemsCount: this.loadingFiles.size,
      cacheUsagePercentage: Math.round((this.currentCacheSize / this.maxCacheSize) * 100),
    };
  }

  /**
   * 清空所有缓存
   */
  clearCache() {
    this.loadedContent.clear();
    this.loadingFiles.clear();
    this.currentCacheSize = 0;
    console.log('LazyLoadService: 所有缓存已清空');
  }
}

// 创建单例实例
const lazyLoadService = new LazyLoadService();

export default lazyLoadService;
