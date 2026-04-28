/**
 * 文档缓存服务
 * 实现文档的后台加载和缓存机制
 */

import RNFS from 'react-native-fs';
import { logService } from '../../utils/logService';

class DocumentCacheService {
  constructor() {
    this.cache = new Map(); // 内存缓存
    this.loadingTasks = new Map(); // 正在加载的任务
    this.initialized = false;
  }

  /**
   * 初始化服务
   */
  async initialize() {
    if (this.initialized) {return;}

    try {
      // 创建缓存目录
      const cacheDir = `${RNFS.DocumentDirectoryPath}/document_cache`;
      const exists = await RNFS.exists(cacheDir);
      if (!exists) {
        await RNFS.mkdir(cacheDir);
      }

      this.cacheDir = cacheDir;
      this.initialized = true;
      console.log('文档缓存服务初始化成功');
    } catch (error) {
      logService.error('文档缓存服务初始化失败', error);
      throw error;
    }
  }

  /**
   * 生成缓存键
   * 支持本地文件路径和content URI
   */
  generateCacheKey(uri, type) {
    // 对于本地文件路径，使用文件名和修改时间作为键的一部分
    let keyBase = uri;

    // 如果是本地文件路径，尝试获取文件信息
    if (!uri.startsWith('content://') && !uri.startsWith('http')) {
      try {
        const fileName = uri.split('/').pop() || 'unknown';
        keyBase = `local_${fileName}_${uri.length}`;
      } catch (error) {
        // 如果获取文件信息失败，使用原始URI
        keyBase = uri;
      }
    }

    const key = `${type}_${encodeURIComponent(keyBase)}`;
    return key.replace(/[^a-zA-Z0-9_-]/g, '_');
  }

  /**
   * 获取缓存的文档数据
   */
  async getCachedDocument(uri, type) {
    await this.initialize();

    const cacheKey = this.generateCacheKey(uri, type);

    // 先检查内存缓存
    if (this.cache.has(cacheKey)) {
      console.log('从内存缓存获取文档:', cacheKey);
      return this.cache.get(cacheKey);
    }

    // 检查磁盘缓存
    try {
      const cacheFile = `${this.cacheDir}/${cacheKey}.json`;
      const exists = await RNFS.exists(cacheFile);

      if (exists) {
        const cachedData = await RNFS.readFile(cacheFile, 'utf8');
        const parsedData = JSON.parse(cachedData);

        // 检查缓存是否过期（24小时）
        const now = Date.now();
        if (now - parsedData.timestamp < 24 * 60 * 60 * 1000) {
          console.log('从磁盘缓存获取文档:', cacheKey);
          // 加载到内存缓存
          this.cache.set(cacheKey, parsedData);
          return parsedData;
        } else {
          // 删除过期缓存
          await RNFS.unlink(cacheFile);
        }
      }
    } catch (error) {
      console.warn('读取磁盘缓存失败:', error);
    }

    return null;
  }

  /**
   * 缓存文档数据
   * 支持本地文件路径的缓存
   */
  async cacheDocument(uri, type, data) {
    await this.initialize();

    const cacheKey = this.generateCacheKey(uri, type);

    // 对于本地文件路径，添加文件信息
    let fileInfo = {};
    if (!uri.startsWith('content://') && !uri.startsWith('http')) {
      try {
        const exists = await RNFS.exists(uri);
        if (exists) {
          const stats = await RNFS.stat(uri);
          fileInfo = {
            isLocalFile: true,
            fileSize: stats.size,
            lastModified: stats.mtime,
            filePath: uri,
          };
        }
      } catch (error) {
        console.warn('DocumentCacheService: 获取本地文件信息失败:', error);
      }
    }

    const cacheData = {
      uri,
      type,
      data,
      timestamp: Date.now(),
      ...fileInfo,
    };

    // 保存到内存缓存
    this.cache.set(cacheKey, cacheData);

    // 保存到磁盘缓存
    try {
      const cacheFile = `${this.cacheDir}/${cacheKey}.json`;
      await RNFS.writeFile(cacheFile, JSON.stringify(cacheData), 'utf8');
      console.log('文档已缓存:', cacheKey);
    } catch (error) {
      console.warn('保存磁盘缓存失败:', error);
    }
  }

  /**
   * 开始后台加载文档
   */
  async startBackgroundLoading(uri, type, loadFunction) {
    await this.initialize();

    const cacheKey = this.generateCacheKey(uri, type);

    // 检查是否已经在加载
    if (this.loadingTasks.has(cacheKey)) {
      console.log('文档已在后台加载中:', cacheKey);
      return this.loadingTasks.get(cacheKey);
    }

    // 检查是否已有缓存
    const cached = await this.getCachedDocument(uri, type);
    if (cached) {
      console.log('文档已缓存，无需后台加载:', cacheKey);
      return Promise.resolve(cached);
    }

    // 开始后台加载
    console.log('开始后台加载文档:', cacheKey);
    const loadingPromise = this.performBackgroundLoading(uri, type, loadFunction);
    this.loadingTasks.set(cacheKey, loadingPromise);

    return loadingPromise;
  }

  /**
   * 执行后台加载
   */
  async performBackgroundLoading(uri, type, loadFunction) {
    const cacheKey = this.generateCacheKey(uri, type);

    try {
      console.log('执行后台加载:', cacheKey);
      const data = await loadFunction();

      // 缓存加载结果
      await this.cacheDocument(uri, type, data);

      // 移除加载任务
      this.loadingTasks.delete(cacheKey);

      console.log('后台加载完成:', cacheKey);
      return { uri, type, data, timestamp: Date.now() };
    } catch (error) {
      console.error('后台加载失败:', cacheKey, error);
      this.loadingTasks.delete(cacheKey);
      throw error;
    }
  }

  /**
   * 获取加载状态
   */
  getLoadingStatus(uri, type) {
    const cacheKey = this.generateCacheKey(uri, type);
    return {
      isLoading: this.loadingTasks.has(cacheKey),
      isCached: this.cache.has(cacheKey),
    };
  }

  /**
   * 清理缓存
   */
  async clearCache() {
    await this.initialize();

    // 清理内存缓存
    this.cache.clear();
    this.loadingTasks.clear();

    // 清理磁盘缓存
    try {
      const files = await RNFS.readDir(this.cacheDir);
      for (const file of files) {
        if (file.name.endsWith('.json')) {
          await RNFS.unlink(file.path);
        }
      }
      console.log('缓存已清理');
    } catch (error) {
      console.warn('清理磁盘缓存失败:', error);
    }
  }

  /**
   * 获取缓存统计信息
   */
  getCacheStats() {
    return {
      memoryCache: this.cache.size,
      loadingTasks: this.loadingTasks.size,
    };
  }
}

// 创建单例实例
const documentCacheService = new DocumentCacheService();

export default documentCacheService;
