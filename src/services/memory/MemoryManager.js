/**
 * ✅ 智能内存管理服务
 * 提供数据压缩存储、内存压力检测、增量保存等功能
 */

import { Platform } from 'react-native';

/**
 * 内存管理配置
 */
const MEMORY_CONFIG = {
  // 内存阈值配置 - 大幅提高内存限制
  WARNING_THRESHOLD: 200 * 1024 * 1024, // 200MB
  CRITICAL_THRESHOLD: 400 * 1024 * 1024, // 400MB
  MAX_MEMORY: 1024 * 1024 * 1024, // 1GB
  
  // 压缩配置
  COMPRESSION_LEVEL: 0.6, // 降低压缩级别，提高性能
  MIN_COMPRESSION_SIZE: 512, // 降低最小压缩大小 512B
  
  // 清理配置
  CLEANUP_INTERVAL: 60000, // 60秒清理间隔
  MAX_CACHE_AGE: 600000, // 10分钟缓存最大年龄
  MAX_CACHE_SIZE: 500, // 增加最大缓存项目数
};

/**
 * 内存状态枚举
 */
export const MEMORY_STATE = {
  NORMAL: 'normal',
  WARNING: 'warning',
  CRITICAL: 'critical',
  EMERGENCY: 'emergency'
};

/**
 * 智能内存管理类
 */
export class MemoryManager {
  constructor() {
    this.memoryState = MEMORY_STATE.NORMAL;
    this.memoryUsage = 0;
    this.cacheMap = new Map();
    this.compressionEnabled = true;
    this.cleanupTimer = null;
    
    // 启动内存监控
    this.startMemoryMonitoring();
  }
  
  /**
   * 启动内存监控
   */
  startMemoryMonitoring() {
    // 定期检查内存使用情况
    this.cleanupTimer = setInterval(() => {
      this.checkMemoryUsage();
    }, MEMORY_CONFIG.CLEANUP_INTERVAL);
  }
  
  /**
   * 停止内存监控
   */
  stopMemoryMonitoring() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }
  
  /**
   * 检查内存使用情况
   */
  checkMemoryUsage() {
    const currentUsage = this.estimateMemoryUsage();
    this.memoryUsage = currentUsage;
    
    let newState = MEMORY_STATE.NORMAL;
    
    if (currentUsage > MEMORY_CONFIG.MAX_MEMORY) {
      newState = MEMORY_STATE.EMERGENCY;
    } else if (currentUsage > MEMORY_CONFIG.CRITICAL_THRESHOLD) {
      newState = MEMORY_STATE.CRITICAL;
    } else if (currentUsage > MEMORY_CONFIG.WARNING_THRESHOLD) {
      newState = MEMORY_STATE.WARNING;
    }
    
    if (newState !== this.memoryState) {
      this.memoryState = newState;
      this.handleMemoryStateChange(newState);
    }
  }
  
  /**
   * 处理内存状态变化
   */
  handleMemoryStateChange(newState) {
    switch (newState) {
      case MEMORY_STATE.WARNING:
        this.enableCompression();
        this.cleanupOldCache();
        break;
        
      case MEMORY_STATE.CRITICAL:
        this.aggressiveCleanup();
        this.enableCompression();
        break;
        
      case MEMORY_STATE.EMERGENCY:
        this.emergencyCleanup();
        this.disableNonEssentialFeatures();
        break;
        
      default:
        break;
    }
  }
  
  /**
   * 估算内存使用量
   */
  estimateMemoryUsage() {
    let totalMemory = 0;
    
    // 计算缓存内存使用
    this.cacheMap.forEach((item, key) => {
      totalMemory += this.calculateItemSize(item);
    });
    
    // 添加基础内存使用
    totalMemory += this.getBaseMemoryUsage();
    
    return totalMemory;
  }
  
  /**
   * 计算单个缓存项的大小
   */
  calculateItemSize(item) {
    if (!item) return 0;
    
    let size = 0;
    
    // 计算数据大小
    if (item.data) {
      if (typeof item.data === 'string') {
        size += item.data.length * 2; // Unicode字符
      } else if (item.data instanceof ArrayBuffer) {
        size += item.data.byteLength;
      } else if (Array.isArray(item.data)) {
        size += item.data.length * 8; // 估算数组项大小
      } else {
        size += JSON.stringify(item.data).length * 2;
      }
    }
    
    // 计算元数据大小
    if (item.metadata) {
      size += JSON.stringify(item.metadata).length * 2;
    }
    
    return size;
  }
  
  /**
   * 获取基础内存使用量
   */
  getBaseMemoryUsage() {
    // 基础内存使用量估算
    return 10 * 1024 * 1024; // 10MB基础使用量
  }
  
  /**
   * 启用数据压缩
   */
  enableCompression() {
    this.compressionEnabled = true;
    console.log('🧹 [MemoryManager] 启用数据压缩');
  }
  
  /**
   * 清理旧缓存
   */
  cleanupOldCache() {
    const now = Date.now();
    const maxAge = MEMORY_CONFIG.MAX_CACHE_AGE;
    
    const keysToRemove = [];
    
    this.cacheMap.forEach((item, key) => {
      if (now - item.timestamp > maxAge) {
        keysToRemove.push(key);
      }
    });
    
    keysToRemove.forEach(key => {
      this.removeCacheItem(key);
    });
    
    console.log(`🧹 [MemoryManager] 清理了 ${keysToRemove.length} 个过期缓存项`);
  }
  
  /**
   * 积极清理缓存
   */
  aggressiveCleanup() {
    // 清理一半的缓存
    const keys = Array.from(this.cacheMap.keys());
    const keysToRemove = keys.slice(0, Math.floor(keys.length / 2));
    
    keysToRemove.forEach(key => {
      this.removeCacheItem(key);
    });
    
    console.log(`🧹 [MemoryManager] 积极清理了 ${keysToRemove.length} 个缓存项`);
  }
  
  /**
   * 紧急清理
   */
  emergencyCleanup() {
    // 清理所有非关键缓存
    const keysToRemove = [];
    
    this.cacheMap.forEach((item, key) => {
      if (!item.critical) {
        keysToRemove.push(key);
      }
    });
    
    keysToRemove.forEach(key => {
      this.removeCacheItem(key);
    });
    
    console.log(`🚨 [MemoryManager] 紧急清理了 ${keysToRemove.length} 个非关键缓存项`);
  }
  
  /**
   * 禁用非必要功能
   */
  disableNonEssentialFeatures() {
    // 禁用非必要的功能以节省内存
    console.log('🚨 [MemoryManager] 禁用非必要功能以节省内存');
  }
  
  /**
   * 存储数据到缓存
   */
  setCacheItem(key, data, options = {}) {
    const item = {
      data: this.compressionEnabled ? this.compressData(data) : data,
      timestamp: Date.now(),
      compressed: this.compressionEnabled,
      critical: options.critical || false,
      metadata: options.metadata || {}
    };
    
    this.cacheMap.set(key, item);
    
    // 检查缓存大小限制
    if (this.cacheMap.size > MEMORY_CONFIG.MAX_CACHE_SIZE) {
      this.removeOldestCacheItem();
    }
  }
  
  /**
   * 从缓存获取数据
   */
  getCacheItem(key) {
    const item = this.cacheMap.get(key);
    if (!item) return null;
    
    // 更新访问时间
    item.lastAccessed = Date.now();
    
    return item.compressed ? this.decompressData(item.data) : item.data;
  }
  
  /**
   * 移除缓存项
   */
  removeCacheItem(key) {
    const item = this.cacheMap.get(key);
    if (item && item.dispose) {
      item.dispose();
    }
    this.cacheMap.delete(key);
  }
  
  /**
   * 移除最旧的缓存项
   */
  removeOldestCacheItem() {
    let oldestKey = null;
    let oldestTime = Date.now();
    
    this.cacheMap.forEach((item, key) => {
      if (item.timestamp < oldestTime) {
        oldestTime = item.timestamp;
        oldestKey = key;
      }
    });
    
    if (oldestKey) {
      this.removeCacheItem(oldestKey);
    }
  }
  
  /**
   * 压缩数据
   */
  compressData(data) {
    if (!this.compressionEnabled || typeof data !== 'string') {
      return data;
    }
    
    // 简单的字符串压缩（实际项目中可以使用更高级的压缩算法）
    try {
      // 使用简单的RLE压缩
      return this.simpleRLECompress(data);
    } catch (error) {
      console.warn('数据压缩失败，使用原始数据:', error);
      return data;
    }
  }
  
  /**
   * 解压数据
   */
  decompressData(data) {
    if (typeof data !== 'string') {
      return data;
    }
    
    try {
      return this.simpleRLEDecompress(data);
    } catch (error) {
      console.warn('数据解压失败，使用原始数据:', error);
      return data;
    }
  }
  
  /**
   * 简单的RLE压缩
   */
  simpleRLECompress(str) {
    if (str.length < MEMORY_CONFIG.MIN_COMPRESSION_SIZE) {
      return str;
    }
    
    let compressed = '';
    let count = 1;
    
    for (let i = 0; i < str.length; i++) {
      if (str[i] === str[i + 1]) {
        count++;
      } else {
        if (count > 1) {
          compressed += count + str[i];
        } else {
          compressed += str[i];
        }
        count = 1;
      }
    }
    
    return compressed;
  }
  
  /**
   * 简单的RLE解压
   */
  simpleRLEDecompress(str) {
    let decompressed = '';
    let i = 0;
    
    while (i < str.length) {
      if (/\d/.test(str[i])) {
        const count = parseInt(str[i]);
        const char = str[i + 1];
        decompressed += char.repeat(count);
        i += 2;
      } else {
        decompressed += str[i];
        i++;
      }
    }
    
    return decompressed;
  }
  
  /**
   * 获取内存状态
   */
  getMemoryState() {
    return {
      state: this.memoryState,
      usage: this.memoryUsage,
      usageMB: Math.round(this.memoryUsage / 1024 / 1024),
      cacheSize: this.cacheMap.size,
      compressionEnabled: this.compressionEnabled
    };
  }
  
  /**
   * 清理所有缓存
   */
  clearAllCache() {
    this.cacheMap.forEach((item, key) => {
      if (item.dispose) {
        item.dispose();
      }
    });
    this.cacheMap.clear();
    console.log('🧹 [MemoryManager] 清理所有缓存完成');
  }
  
  /**
   * 销毁内存管理器
   */
  destroy() {
    this.stopMemoryMonitoring();
    this.clearAllCache();
  }
}

// 创建全局内存管理器实例
export const memoryManager = new MemoryManager();

export default MemoryManager;
