/**
 * 文档缓存服务
 * 提供文档预加载、缓存管理和性能优化功能
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';

class DocumentCacheService {
  constructor() {
    this.cache = new Map();
    this.preloadQueue = [];
    this.isPreloading = false;
    this.maxCacheSize = 50 * 1024 * 1024; // 50MB
    this.maxCacheItems = 100;

    // 缓存键前缀
    this.CACHE_KEYS = {
      DOCUMENT_DATA: 'doc_cache_data_',
      DOCUMENT_META: 'doc_cache_meta_',
      LIBRARY_CACHE: 'doc_library_cache_',
      CACHE_INDEX: 'doc_cache_index',
    };

    this.init();
  }

  /**
   * 初始化缓存服务
   */
  async init() {
    try {
      console.log('DocumentCacheService: 初始化缓存服务');

      // 加载缓存索引
      await this.loadCacheIndex();

      // 预加载常用库
      this.preloadLibraries();

      console.log('DocumentCacheService: 缓存服务初始化完成');
    } catch (error) {
      console.error('DocumentCacheService: 初始化失败:', error);
    }
  }

  /**
   * 预加载外部库
   */
  async preloadLibraries() {
    try {
      console.log('DocumentCacheService: 开始预加载外部库');

      const libraries = [
        {
          name: 'docx-preview',
          urls: [
            'https://cdn.jsdelivr.net/npm/docx-preview@0.3.6/dist/docx-preview.min.js',
            'https://unpkg.com/docx-preview@0.3.6/dist/docx-preview.min.js',
          ],
        },
        {
          name: 'jszip',
          urls: [
            'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js',
            'https://unpkg.com/jszip@3.10.1/dist/jszip.min.js',
          ],
        },
        {
          name: 'fast-xml-parser',
          urls: [
            'https://cdn.jsdelivr.net/npm/fast-xml-parser@4.3.2/dist/fxparser.min.js',
            'https://unpkg.com/fast-xml-parser@4.3.2/dist/fxparser.min.js',
          ],
        },
      ];

      for (const library of libraries) {
        await this.preloadLibrary(library);
      }

      console.log('DocumentCacheService: 外部库预加载完成');
    } catch (error) {
      console.warn('DocumentCacheService: 预加载外部库失败:', error);
    }
  }

  /**
   * 预加载单个库
   */
  async preloadLibrary(library) {
    try {
      const cacheKey = this.CACHE_KEYS.LIBRARY_CACHE + library.name;

      // 检查是否已缓存
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached) {
        console.log(`DocumentCacheService: 库 ${library.name} 已缓存`);
        return;
      }

      // 尝试从多个URL加载
      for (const url of library.urls) {
        try {
          console.log(`DocumentCacheService: 预加载库 ${library.name} 从 ${url}`);

          const response = await fetch(url, {
            method: 'GET',
            headers: {
              'Accept': 'application/javascript, text/javascript, */*',
              'Cache-Control': 'max-age=3600',
            },
          });

          if (response.ok) {
            const content = await response.text();

            // 缓存库内容
            await AsyncStorage.setItem(cacheKey, JSON.stringify({
              content,
              url,
              timestamp: Date.now(),
              size: content.length,
            }));

            console.log(`DocumentCacheService: 库 ${library.name} 预加载成功`);
            break;
          }
        } catch (urlError) {
          console.warn(`DocumentCacheService: 从 ${url} 加载失败:`, urlError);
        }
      }
    } catch (error) {
      console.warn(`DocumentCacheService: 预加载库 ${library.name} 失败:`, error);
    }
  }

  /**
   * 获取缓存的库内容
   */
  async getCachedLibrary(libraryName) {
    try {
      const cacheKey = this.CACHE_KEYS.LIBRARY_CACHE + libraryName;
      const cached = await AsyncStorage.getItem(cacheKey);

      if (cached) {
        const data = JSON.parse(cached);

        // 检查缓存是否过期（24小时）
        const isExpired = Date.now() - data.timestamp > 24 * 60 * 60 * 1000;
        if (!isExpired) {
          console.log(`DocumentCacheService: 使用缓存的库 ${libraryName}`);
          return data.content;
        } else {
          console.log(`DocumentCacheService: 库 ${libraryName} 缓存已过期`);
          await AsyncStorage.removeItem(cacheKey);
        }
      }

      return null;
    } catch (error) {
      console.warn(`DocumentCacheService: 获取缓存库 ${libraryName} 失败:`, error);
      return null;
    }
  }

  /**
   * 缓存文档数据
   */
  async cacheDocument(documentId, data, metadata = {}) {
    try {
      console.log(`DocumentCacheService: 缓存文档 ${documentId}`);

      const cacheData = {
        data,
        metadata: {
          ...metadata,
          timestamp: Date.now(),
          size: JSON.stringify(data).length,
        },
      };

      // 检查缓存大小限制
      await this.enforceCacheLimits();

      // 存储数据和元数据
      await AsyncStorage.setItem(
        this.CACHE_KEYS.DOCUMENT_DATA + documentId,
        JSON.stringify(cacheData)
      );

      // 更新缓存索引
      await this.updateCacheIndex(documentId, cacheData.metadata);

      console.log(`DocumentCacheService: 文档 ${documentId} 缓存成功`);
    } catch (error) {
      console.error(`DocumentCacheService: 缓存文档 ${documentId} 失败:`, error);
    }
  }

  /**
   * 获取缓存的文档
   */
  async getCachedDocument(documentId) {
    try {
      const cacheKey = this.CACHE_KEYS.DOCUMENT_DATA + documentId;
      const cached = await AsyncStorage.getItem(cacheKey);

      if (cached) {
        const cacheData = JSON.parse(cached);

        // 检查缓存是否过期（7天）
        const isExpired = Date.now() - cacheData.metadata.timestamp > 7 * 24 * 60 * 60 * 1000;
        if (!isExpired) {
          console.log(`DocumentCacheService: 使用缓存的文档 ${documentId}`);

          // 更新访问时间
          cacheData.metadata.lastAccessed = Date.now();
          await AsyncStorage.setItem(cacheKey, JSON.stringify(cacheData));

          return cacheData.data;
        } else {
          console.log(`DocumentCacheService: 文档 ${documentId} 缓存已过期`);
          await this.removeCachedDocument(documentId);
        }
      }

      return null;
    } catch (error) {
      console.warn(`DocumentCacheService: 获取缓存文档 ${documentId} 失败:`, error);
      return null;
    }
  }

  /**
   * 移除缓存的文档
   */
  async removeCachedDocument(documentId) {
    try {
      await AsyncStorage.removeItem(this.CACHE_KEYS.DOCUMENT_DATA + documentId);
      await this.removeFromCacheIndex(documentId);
      console.log(`DocumentCacheService: 移除缓存文档 ${documentId}`);
    } catch (error) {
      console.warn(`DocumentCacheService: 移除缓存文档 ${documentId} 失败:`, error);
    }
  }

  /**
   * 加载缓存索引
   */
  async loadCacheIndex() {
    try {
      const index = await AsyncStorage.getItem(this.CACHE_KEYS.CACHE_INDEX);
      this.cacheIndex = index ? JSON.parse(index) : {};
    } catch (error) {
      console.warn('DocumentCacheService: 加载缓存索引失败:', error);
      this.cacheIndex = {};
    }
  }

  /**
   * 更新缓存索引
   */
  async updateCacheIndex(documentId, metadata) {
    try {
      this.cacheIndex[documentId] = metadata;
      await AsyncStorage.setItem(
        this.CACHE_KEYS.CACHE_INDEX,
        JSON.stringify(this.cacheIndex)
      );
    } catch (error) {
      console.warn('DocumentCacheService: 更新缓存索引失败:', error);
    }
  }

  /**
   * 从缓存索引中移除
   */
  async removeFromCacheIndex(documentId) {
    try {
      delete this.cacheIndex[documentId];
      await AsyncStorage.setItem(
        this.CACHE_KEYS.CACHE_INDEX,
        JSON.stringify(this.cacheIndex)
      );
    } catch (error) {
      console.warn('DocumentCacheService: 从缓存索引移除失败:', error);
    }
  }

  /**
   * 强制执行缓存限制
   */
  async enforceCacheLimits() {
    try {
      const entries = Object.entries(this.cacheIndex);

      // 按最后访问时间排序
      entries.sort((a, b) => (b[1].lastAccessed || 0) - (a[1].lastAccessed || 0));

      // 计算总大小
      let totalSize = entries.reduce((sum, [_, meta]) => sum + (meta.size || 0), 0);

      // 如果超过限制，移除最旧的条目
      while ((entries.length > this.maxCacheItems || totalSize > this.maxCacheSize) && entries.length > 0) {
        const [documentId, metadata] = entries.pop();
        await this.removeCachedDocument(documentId);
        totalSize -= (metadata.size || 0);
        console.log(`DocumentCacheService: 移除过期缓存 ${documentId}`);
      }
    } catch (error) {
      console.warn('DocumentCacheService: 强制执行缓存限制失败:', error);
    }
  }

  /**
   * 清理所有缓存
   */
  async clearAllCache() {
    try {
      console.log('DocumentCacheService: 清理所有缓存');

      // 获取所有缓存键
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key =>
        key.startsWith(this.CACHE_KEYS.DOCUMENT_DATA) ||
        key.startsWith(this.CACHE_KEYS.DOCUMENT_META) ||
        key.startsWith(this.CACHE_KEYS.LIBRARY_CACHE) ||
        key === this.CACHE_KEYS.CACHE_INDEX
      );

      // 批量删除
      await AsyncStorage.multiRemove(cacheKeys);

      // 重置索引
      this.cacheIndex = {};

      console.log(`DocumentCacheService: 清理了 ${cacheKeys.length} 个缓存项`);
    } catch (error) {
      console.error('DocumentCacheService: 清理缓存失败:', error);
    }
  }

  /**
   * 获取缓存统计信息
   */
  async getCacheStats() {
    try {
      const entries = Object.entries(this.cacheIndex);
      const totalSize = entries.reduce((sum, [_, meta]) => sum + (meta.size || 0), 0);

      return {
        itemCount: entries.length,
        totalSize,
        maxSize: this.maxCacheSize,
        maxItems: this.maxCacheItems,
        usagePercent: Math.round((totalSize / this.maxCacheSize) * 100),
      };
    } catch (error) {
      console.warn('DocumentCacheService: 获取缓存统计失败:', error);
      return {
        itemCount: 0,
        totalSize: 0,
        maxSize: this.maxCacheSize,
        maxItems: this.maxCacheItems,
        usagePercent: 0,
      };
    }
  }
}

// 创建单例实例
const documentCacheService = new DocumentCacheService();

module.exports = documentCacheService;
module.exports.default = documentCacheService;
module.exports.documentCacheService = documentCacheService;
module.exports.DocumentCacheService = DocumentCacheService;
export default documentCacheService;
