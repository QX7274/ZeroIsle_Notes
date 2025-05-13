/**
 * 工具函数导出文件
 * 集中导出所有工具函数，方便引用
 */
import { Platform, PermissionsAndroid } from 'react-native';
import dateUtilsModule from './dateUtils';
import { validationUtils as validationUtilsModule } from './validationUtils';
import { storageService } from '../services/storage';
import EventEmitter from './eventEmitter';

// 存储工具 - 使用MongoDB存储服务
export const storage = {
  set: async (key, value) => {
    // 防御性检查：确保key不为undefined
    if (key === undefined || key === null) {
      console.error('存储错误: 键不能为undefined或null');
      return false;
    }

    // 确保key是字符串
    const safeKey = String(key);

    try {
      // 使用storageService
      if (storageService && typeof storageService.setItem === 'function') {
        await storageService.setItem(safeKey, JSON.stringify(value));
        return true;
      } else {
        console.error(`存储错误 [${safeKey}]: storageService不可用`);
        return false;
      }
    } catch (e) {
      console.error(`存储错误 [${safeKey}]:`, e);
      return false;
    }
  },
  get: async (key) => {
    // 防御性检查：确保key不为undefined
    if (key === undefined || key === null) {
      console.error('读取错误: 键不能为undefined或null');
      return null;
    }

    // 确保key是字符串
    const safeKey = String(key);

    try {
      // 使用storageService
      if (storageService && typeof storageService.getItem === 'function') {
        const value = await storageService.getItem(safeKey);
        return value ? JSON.parse(value) : null;
      } else {
        console.error(`读取错误 [${safeKey}]: storageService不可用`);
        return null;
      }
    } catch (e) {
      console.error(`读取错误 [${safeKey}]:`, e);
      return null;
    }
  },
  remove: async (key) => {
    // 防御性检查：确保key不为undefined
    if (key === undefined || key === null) {
      console.error('删除错误: 键不能为undefined或null');
      return false;
    }

    // 确保key是字符串
    const safeKey = String(key);

    try {
      // 使用storageService
      if (storageService && typeof storageService.removeItem === 'function') {
        await storageService.removeItem(safeKey);
        return true;
      } else {
        console.error(`删除错误 [${safeKey}]: storageService不可用`);
        return false;
      }
    } catch (e) {
      console.error(`删除错误 [${safeKey}]:`, e);
      return false;
    }
  }
};

// 日期工具
export const dateUtils = dateUtilsModule;

// 权限工具
export const permissionUtils = {
  check: async (permission) => {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.check(permission);
      return granted;
    }
    return true;
  },
  request: async (permission) => {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(permission);
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }
    return true;
  }
};

// 验证工具
export const validationUtils = validationUtilsModule;

// 事件发射器
export { default as EventEmitter } from './eventEmitter';