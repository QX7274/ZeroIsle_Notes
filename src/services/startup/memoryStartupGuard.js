/**
 * 启动时内存守护服务
 * 防止应用启动时因大文件导致内存溢出
 */

import memoryGuard from '../memory/memoryGuard';
import { realmService } from '../database/realmService';
import RNFS from 'react-native-fs';

class MemoryStartupGuard {
  constructor() {
    this.isInitialized = false;
    this.startupStats = null;
  }

  /**
   * 初始化启动内存守护
   * @returns {Promise<Object>} 初始化结果
   */
  async initialize() {
    if (this.isInitialized) {
      return this.startupStats;
    }

    console.log('MemoryStartupGuard: 开始初始化启动内存守护...');

    try {
      // 重置内存守护
      memoryGuard.reset();

      // 检查应用启动时的内存状态
      const memoryStats = await this.checkStartupMemory();

      // 清理可能的临时文件
      await this.cleanupTempFiles();

      // 检查大文件
      await this.checkLargeFiles();

      this.startupStats = {
        success: true,
        memoryStats,
        timestamp: new Date().toISOString(),
        message: '启动内存守护初始化成功',
      };

      this.isInitialized = true;
      console.log('MemoryStartupGuard: 初始化完成');

      return this.startupStats;

    } catch (error) {
      console.error('MemoryStartupGuard: 初始化失败:', error);

      this.startupStats = {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };

      return this.startupStats;
    }
  }

  /**
   * 检查启动时的内存状态
   * @returns {Promise<Object>} 内存状态
   */
  async checkStartupMemory() {
    try {
      console.log('MemoryStartupGuard: 检查启动内存状态...');

      // 获取设备内存信息（如果可用）
      let deviceMemory = null;
      try {
        if (global.performance && global.performance.memory) {
          deviceMemory = {
            used: global.performance.memory.usedJSHeapSize,
            total: global.performance.memory.totalJSHeapSize,
            limit: global.performance.memory.jsHeapSizeLimit,
          };
        }
      } catch (memError) {
        console.warn('MemoryStartupGuard: 无法获取设备内存信息');
      }

      // 检查缓存目录大小
      const cacheSize = await this.getCacheDirectorySize();

      const memoryStats = {
        deviceMemory,
        cacheSize,
        cacheSizeMB: Math.round(cacheSize / 1024 / 1024),
        memoryGuardStats: memoryGuard.getMemoryStats(),
      };

      console.log('MemoryStartupGuard: 内存状态检查完成:', memoryStats);
      return memoryStats;

    } catch (error) {
      console.error('MemoryStartupGuard: 检查内存状态失败:', error);
      return { error: error.message };
    }
  }

  /**
   * 获取缓存目录大小
   * @returns {Promise<number>} 缓存大小（字节）
   */
  async getCacheDirectorySize() {
    try {
      const cacheDir = RNFS.CachesDirectoryPath;
      const exists = await RNFS.exists(cacheDir);

      if (!exists) {
        return 0;
      }

      const files = await RNFS.readDir(cacheDir);
      let totalSize = 0;

      for (const file of files) {
        if (file.isFile()) {
          totalSize += file.size;
        }
      }

      return totalSize;
    } catch (error) {
      console.warn('MemoryStartupGuard: 获取缓存目录大小失败:', error);
      return 0;
    }
  }

  /**
   * 清理临时文件
   * @returns {Promise<void>}
   */
  async cleanupTempFiles() {
    try {
      console.log('MemoryStartupGuard: 开始清理临时文件...');

      const tempDirs = [
        RNFS.CachesDirectoryPath,
        `${RNFS.DocumentDirectoryPath}/temp`,
        `${RNFS.DocumentDirectoryPath}/converted_cache`,
      ];

      let cleanedSize = 0;
      let cleanedCount = 0;

      for (const dir of tempDirs) {
        try {
          const exists = await RNFS.exists(dir);
          if (!exists) {continue;}

          const files = await RNFS.readDir(dir);
          const now = Date.now();
          const maxAge = 24 * 60 * 60 * 1000; // 24小时

          for (const file of files) {
            // 删除超过24小时的临时文件
            if (file.isFile() && (now - new Date(file.mtime).getTime()) > maxAge) {
              try {
                await RNFS.unlink(file.path);
                cleanedSize += file.size;
                cleanedCount++;
                console.log(`MemoryStartupGuard: 删除临时文件: ${file.name}`);
              } catch (deleteError) {
                console.warn(`MemoryStartupGuard: 删除文件失败: ${file.path}`, deleteError);
              }
            }
          }
        } catch (dirError) {
          console.warn(`MemoryStartupGuard: 处理目录失败: ${dir}`, dirError);
        }
      }

      console.log(`MemoryStartupGuard: 临时文件清理完成，删除了 ${cleanedCount} 个文件，释放了 ${Math.round(cleanedSize / 1024 / 1024)}MB`);

    } catch (error) {
      console.error('MemoryStartupGuard: 清理临时文件失败:', error);
    }
  }

  /**
   * 检查大文件
   * @returns {Promise<void>}
   */
  async checkLargeFiles() {
    try {
      console.log('MemoryStartupGuard: 检查大文件...');

      // 检查持久化文档目录
      const persistentDocsDir = `${RNFS.DocumentDirectoryPath}/persistent_documents`;
      const exists = await RNFS.exists(persistentDocsDir);

      if (!exists) {
        console.log('MemoryStartupGuard: 持久化文档目录不存在');
        return;
      }

      const files = await RNFS.readDir(persistentDocsDir);
      let largeFileCount = 0;
      let totalLargeFileSize = 0;
      const largeFileThreshold = 500 * 1024 * 1024; // 500MB

      for (const file of files) {
        if (file.isFile() && file.size > largeFileThreshold) {
          largeFileCount++;
          totalLargeFileSize += file.size;

          console.log(`MemoryStartupGuard: 发现超大文件: ${file.name} (${Math.round(file.size / 1024 / 1024)}MB) - 超过500MB限制`);

          // 标记为延迟加载
          memoryGuard.deferredFiles.add(file.path);
        }
      }

      if (largeFileCount > 0) {
        console.log(`MemoryStartupGuard: 发现 ${largeFileCount} 个超大文件（>500MB），总大小 ${Math.round(totalLargeFileSize / 1024 / 1024)}MB，已标记为延迟加载`);
      } else {
        console.log('MemoryStartupGuard: 没有发现超大文件（>500MB）');
      }

    } catch (error) {
      console.error('MemoryStartupGuard: 检查大文件失败:', error);
    }
  }

  /**
   * 获取启动统计信息
   * @returns {Object} 启动统计
   */
  getStartupStats() {
    return this.startupStats;
  }

  /**
   * 检查是否需要内存警告
   * @returns {Object} 警告信息
   */
  checkMemoryWarning() {
    if (!this.startupStats || !this.startupStats.success) {
      return {
        needsWarning: true,
        level: 'error',
        message: '内存守护初始化失败，应用可能不稳定',
      };
    }

    const memoryStats = this.startupStats.memoryStats;

    // 检查缓存大小
    if (memoryStats.cacheSizeMB > 100) {
      return {
        needsWarning: true,
        level: 'warning',
        message: `缓存占用过大 (${memoryStats.cacheSizeMB}MB)，建议清理缓存`,
      };
    }

    // 检查延迟加载文件数量
    const deferredCount = memoryGuard.deferredFiles.size;
    if (deferredCount > 5) {
      return {
        needsWarning: true,
        level: 'info',
        message: `有 ${deferredCount} 个大文件将延迟加载，首次打开可能较慢`,
      };
    }

    return {
      needsWarning: false,
      message: '内存状态正常',
    };
  }

  /**
   * 重置启动守护
   */
  reset() {
    this.isInitialized = false;
    this.startupStats = null;
    memoryGuard.reset();
    console.log('MemoryStartupGuard: 已重置');
  }
}

// 创建单例实例
const memoryStartupGuard = new MemoryStartupGuard();

export default memoryStartupGuard;
