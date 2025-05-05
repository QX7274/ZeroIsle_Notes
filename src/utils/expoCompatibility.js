/**
 * 原生功能兼容层
 * 提供统一的API接口，使用React Native原生功能
 */
import { Platform } from 'react-native';
import { fileService } from '../services/file/fileService';

// Expo已移除，始终返回false
export const isExpoAvailable = () => false;

// 文件系统兼容层
export const FileSystem = {
  // 读取文件内容
  readAsStringAsync: async (fileUri) => {
    try {
      return await fileService.readFile(fileUri, 'utf8');
    } catch (error) {
      console.error('读取文件错误:', error);
      throw error;
    }
  },

  // 写入文件内容
  writeAsStringAsync: async (fileUri, contents) => {
    try {
      return await fileService.writeFile(fileUri, contents, 'utf8');
    } catch (error) {
      console.error('写入文件错误:', error);
      throw error;
    }
  },

  // 删除文件
  deleteAsync: async (fileUri, options = {}) => {
    try {
      return await fileService.deleteFile(fileUri);
    } catch (error) {
      console.error('删除文件错误:', error);
      throw error;
    }
  },

  // 获取文件信息
  getInfoAsync: async (fileUri, options = {}) => {
    try {
      const fileInfo = await fileService.stat(fileUri);
      return {
        exists: true,
        isDirectory: fileInfo.isDirectory(),
        size: fileInfo.size,
        modificationTime: fileInfo.mtime,
        uri: fileUri,
      };
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
      return await fileService.mkdir(dirUri, options);
    } catch (error) {
      console.error('创建目录错误:', error);
      throw error;
    }
  },

  // 读取目录内容
  readDirectoryAsync: async (dirUri) => {
    try {
      return await fileService.readDir(dirUri);
    } catch (error) {
      console.error('读取目录错误:', error);
      throw error;
    }
  },

  // 下载文件
  downloadAsync: async (uri, fileUri, options = {}) => {
    try {
      const filePath = await fileService.downloadFile(uri, fileUri);
      return {
        status: 200,
        uri: filePath,
      };
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
      // 简单实现随机字节生成
      const randomBytes = new Uint8Array(length);
      for (let i = 0; i < length; i++) {
        randomBytes[i] = Math.floor(Math.random() * 256);
      }
      return randomBytes;
    } catch (error) {
      console.error('生成随机字节错误:', error);
      throw error;
    }
  },

  // 计算哈希值
  digestStringAsync: async (algorithm, data) => {
    try {
      // 使用crypto-js库进行哈希计算
      const CryptoJS = require('crypto-js');

      let hash;
      switch (algorithm.toLowerCase()) {
        case 'md5':
          hash = CryptoJS.MD5(data);
          break;
        case 'sha1':
          hash = CryptoJS.SHA1(data);
          break;
        case 'sha256':
          hash = CryptoJS.SHA256(data);
          break;
        default:
          hash = CryptoJS.SHA256(data);
      }

      return hash.toString(CryptoJS.enc.Hex);
    } catch (error) {
      console.error('计算哈希值错误:', error);
      throw error;
    }
  },
};

// 触感反馈兼容层
import nativeHaptics from './nativeHaptics';
export const Haptics = {
  // 轻触反馈
  impactAsync: async (style) => {
    try {
      return nativeHaptics.impactAsync(style);
    } catch (error) {
      console.error('触感反馈错误:', error);
      return null;
    }
  },

  // 通知反馈
  notificationAsync: async (type) => {
    try {
      return nativeHaptics.notificationAsync(type);
    } catch (error) {
      console.error('触感反馈错误:', error);
      return null;
    }
  },

  // 选择反馈
  selectionAsync: async () => {
    try {
      return nativeHaptics.selectionAsync();
    } catch (error) {
      console.error('触感反馈错误:', error);
      return null;
    }
  },
};

// 导出常量
import { ImpactFeedbackStyle, NotificationFeedbackType } from './nativeHaptics';
export { ImpactFeedbackStyle, NotificationFeedbackType };
