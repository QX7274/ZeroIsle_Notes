/**
 * 缓存服务
 * 提供应用缓存管理功能
 */
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';
import DeviceInfo from 'react-native-device-info';
import { CACHE_KEYS } from '../../utils/constants/config';

class CacheService {
  constructor() {
    this.cacheDir = Platform.OS === 'ios'
      ? RNFS.CachesDirectoryPath
      : RNFS.CachesDirectoryPath;
    this.tempDir = RNFS.TemporaryDirectoryPath;
    this.listeners = [];
  }

  /**
   * 获取缓存大小
   * @returns {Promise<number>} 缓存大小（字节）
   */
  async getCacheSize() {
    try {
      // 获取文件缓存大小
      const cacheDirStats = await RNFS.readDir(this.cacheDir);
      const tempDirStats = await RNFS.readDir(this.tempDir);

      // 计算文件缓存大小
      let cacheSize = 0;

      for (const file of cacheDirStats) {
        if (file.isFile()) {
          cacheSize += file.size;
        }
      }

      for (const file of tempDirStats) {
        if (file.isFile()) {
          cacheSize += file.size;
        }
      }

      // 获取AsyncStorage缓存大小（估计值）
      const keys = await AsyncStorage.getAllKeys();
      let asyncStorageSize = 0;

      for (const key of keys) {
        if (key.startsWith('cache_') || key.startsWith('temp_')) {
          const value = await AsyncStorage.getItem(key);
          if (value) {
            asyncStorageSize += value.length * 2; // 估计UTF-16编码每个字符2字节
          }
        }
      }

      return cacheSize + asyncStorageSize;
    } catch (error) {
      console.error('获取缓存大小失败:', error);
      return 0;
    }
  }

  /**
   * 清理缓存
   * @returns {Promise<boolean>} 是否成功清理
   */
  async clearCache() {
    try {
      // 清理文件缓存
      const cacheDirStats = await RNFS.readDir(this.cacheDir);
      const tempDirStats = await RNFS.readDir(this.tempDir);

      const deletePromises = [];

      // 删除缓存目录中的文件
      for (const file of cacheDirStats) {
        if (file.isFile() && !file.name.includes('important')) {
          deletePromises.push(RNFS.unlink(file.path));
        }
      }

      // 删除临时目录中的文件
      for (const file of tempDirStats) {
        if (file.isFile()) {
          deletePromises.push(RNFS.unlink(file.path));
        }
      }

      await Promise.all(deletePromises);

      // 清理AsyncStorage缓存
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key =>
        key.startsWith('cache_') ||
        key.startsWith('temp_') ||
        CACHE_KEYS.includes(key)
      );

      if (cacheKeys.length > 0) {
        await AsyncStorage.multiRemove(cacheKeys);
      }

      // 通知监听器
      this._notifyListeners({ type: 'cacheCleared' });

      return true;
    } catch (error) {
      console.error('清理缓存失败:', error);
      return false;
    }
  }

  /**
   * 检查更新
   * @returns {Promise<{hasUpdate: boolean, version: string, url: string}>} 更新信息
   */
  async checkForUpdates() {
    try {
      // 检查 DeviceInfo 是否可用
      if (!DeviceInfo || typeof DeviceInfo.getVersion !== 'function') {
        throw new Error('DeviceInfo 不可用');
      }

      // 获取当前版本
      const currentVersion = await DeviceInfo.getVersion();

      // 模拟API请求获取最新版本
      // 实际应用中应该从服务器获取
      const latestVersion = '1.1.0'; // 模拟最新版本
      const updateUrl = 'https://zeroislenotes.com/download'; // 模拟下载链接

      // 比较版本号
      const hasUpdate = this._compareVersions(latestVersion, currentVersion) > 0;

      return {
        hasUpdate,
        version: latestVersion,
        url: updateUrl
      };
    } catch (error) {
      console.error('检查更新失败:', error);
      return {
        hasUpdate: false,
        version: '1.0.0', // 提供默认版本号
        url: ''
      };
    }
  }

  /**
   * 比较版本号
   * @param {string} v1 版本1
   * @param {string} v2 版本2
   * @returns {number} 1: v1>v2, 0: v1=v2, -1: v1<v2
   */
  _compareVersions(v1, v2) {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const part1 = parts1[i] || 0;
      const part2 = parts2[i] || 0;

      if (part1 > part2) return 1;
      if (part1 < part2) return -1;
    }

    return 0;
  }

  /**
   * 添加监听器
   * @param {Function} listener 监听器函数
   * @returns {Function} 取消监听的函数
   */
  addListener(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  /**
   * 通知所有监听器
   * @param {Object} event 事件对象
   */
  _notifyListeners(event) {
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('通知缓存监听器失败:', error);
      }
    });
  }
}

// 导出单例
export const cacheService = new CacheService();
