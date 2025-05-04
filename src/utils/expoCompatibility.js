/**
 * Expo兼容性工具
 * 提供Expo组件的替代实现，在Expo不可用时使用
 */
import { Platform } from 'react-native';
import { fileService } from '../services/file/fileService';

// 检查Expo是否可用
export const isExpoAvailable = () => {
  try {
    // 尝试导入expo-modules-core
    require('expo-modules-core');
    return true;
  } catch (error) {
    return false;
  }
};

// 文件系统兼容层
export const FileSystem = {
  // 读取文件内容
  readAsStringAsync: async (fileUri) => {
    try {
      if (isExpoAvailable()) {
        const ExpoFileSystem = require('expo-file-system');
        return await ExpoFileSystem.readAsStringAsync(fileUri);
      } else {
        return await fileService.readFile(fileUri, 'utf8');
      }
    } catch (error) {
      console.error('读取文件错误:', error);
      throw error;
    }
  },

  // 写入文件内容
  writeAsStringAsync: async (fileUri, contents) => {
    try {
      if (isExpoAvailable()) {
        const ExpoFileSystem = require('expo-file-system');
        return await ExpoFileSystem.writeAsStringAsync(fileUri, contents);
      } else {
        return await fileService.writeFile(fileUri, contents, 'utf8');
      }
    } catch (error) {
      console.error('写入文件错误:', error);
      throw error;
    }
  },

  // 删除文件
  deleteAsync: async (fileUri, options = {}) => {
    try {
      if (isExpoAvailable()) {
        const ExpoFileSystem = require('expo-file-system');
        return await ExpoFileSystem.deleteAsync(fileUri, options);
      } else {
        return await fileService.deleteFile(fileUri);
      }
    } catch (error) {
      console.error('删除文件错误:', error);
      throw error;
    }
  },

  // 获取文件信息
  getInfoAsync: async (fileUri, options = {}) => {
    try {
      if (isExpoAvailable()) {
        const ExpoFileSystem = require('expo-file-system');
        return await ExpoFileSystem.getInfoAsync(fileUri, options);
      } else {
        const fileInfo = await fileService.stat(fileUri);
        return {
          exists: true,
          isDirectory: fileInfo.isDirectory(),
          size: fileInfo.size,
          modificationTime: fileInfo.mtime,
          uri: fileUri,
        };
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        return { exists: false, uri: fileUri };
      }
      console.error('获取文件信息错误:', error);
      throw error;
    }
  },

  // 创建目录
  makeDirectoryAsync: async (dirUri, options = {}) => {
    try {
      if (isExpoAvailable()) {
        const ExpoFileSystem = require('expo-file-system');
        return await ExpoFileSystem.makeDirectoryAsync(dirUri, options);
      } else {
        return await fileService.mkdir(dirUri, options);
      }
    } catch (error) {
      console.error('创建目录错误:', error);
      throw error;
    }
  },

  // 读取目录内容
  readDirectoryAsync: async (dirUri) => {
    try {
      if (isExpoAvailable()) {
        const ExpoFileSystem = require('expo-file-system');
        return await ExpoFileSystem.readDirectoryAsync(dirUri);
      } else {
        return await fileService.readDir(dirUri);
      }
    } catch (error) {
      console.error('读取目录错误:', error);
      throw error;
    }
  },

  // 下载文件
  downloadAsync: async (uri, fileUri, options = {}) => {
    try {
      if (isExpoAvailable()) {
        const ExpoFileSystem = require('expo-file-system');
        return await ExpoFileSystem.downloadAsync(uri, fileUri, options);
      } else {
        const filePath = await fileService.downloadFile(uri, fileUri);
        return {
          status: 200,
          uri: filePath,
        };
      }
    } catch (error) {
      console.error('下载文件错误:', error);
      throw error;
    }
  },

  // 目录常量
  documentDirectory: Platform.OS === 'ios'
    ? `${fileService.documentDirectory}/`
    : `${fileService.documentDirectory}/`,

  cacheDirectory: Platform.OS === 'ios'
    ? `${fileService.cacheDirectory}/`
    : `${fileService.cacheDirectory}/`,
};

// 加密工具兼容层
export const Crypto = {
  // 生成随机字符串
  getRandomBytesAsync: async (length) => {
    try {
      if (isExpoAvailable()) {
        const ExpoCrypto = require('expo-crypto');
        return await ExpoCrypto.getRandomBytesAsync(length);
      } else {
        // 简单实现随机字节生成
        const randomBytes = new Uint8Array(length);
        for (let i = 0; i < length; i++) {
          randomBytes[i] = Math.floor(Math.random() * 256);
        }
        return randomBytes;
      }
    } catch (error) {
      console.error('生成随机字节错误:', error);
      throw error;
    }
  },

  // 计算哈希值
  digestStringAsync: async (algorithm, data) => {
    try {
      if (isExpoAvailable()) {
        const ExpoCrypto = require('expo-crypto');
        return await ExpoCrypto.digestStringAsync(algorithm, data);
      } else {
        // 这里需要一个更完整的实现，可以使用第三方库
        // 简单实现，仅用于演示
        const hashCode = (str) => {
          let hash = 0;
          for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
          }
          return hash.toString(16);
        };

        return hashCode(data);
      }
    } catch (error) {
      console.error('计算哈希值错误:', error);
      throw error;
    }
  },
};

// 触感反馈兼容层
export const Haptics = {
  // 轻触反馈
  impactAsync: async (style) => {
    try {
      if (isExpoAvailable()) {
        const ExpoHaptics = require('expo-haptics');
        return await ExpoHaptics.impactAsync(style);
      } else {
        // 在没有Expo时，可以使用其他库或简单返回
        console.log('触感反馈不可用');
        return null;
      }
    } catch (error) {
      console.error('触感反馈错误:', error);
      return null;
    }
  },

  // 通知反馈
  notificationAsync: async (type) => {
    try {
      if (isExpoAvailable()) {
        const ExpoHaptics = require('expo-haptics');
        return await ExpoHaptics.notificationAsync(type);
      } else {
        console.log('触感反馈不可用');
        return null;
      }
    } catch (error) {
      console.error('触感反馈错误:', error);
      return null;
    }
  },

  // 选择反馈
  selectionAsync: async () => {
    try {
      if (isExpoAvailable()) {
        const ExpoHaptics = require('expo-haptics');
        return await ExpoHaptics.selectionAsync();
      } else {
        console.log('触感反馈不可用');
        return null;
      }
    } catch (error) {
      console.error('触感反馈错误:', error);
      return null;
    }
  },
};

// 导出常量
export const ImpactFeedbackStyle = {
  Light: 'light',
  Medium: 'medium',
  Heavy: 'heavy',
};

export const NotificationFeedbackType = {
  Success: 'success',
  Warning: 'warning',
  Error: 'error',
};
