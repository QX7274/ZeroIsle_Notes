/**
 * 工具函数导出文件
 * 集中导出所有工具函数，方便引用
 */
import { Platform, PermissionsAndroid } from 'react-native';
import dateUtilsModule from './dateUtils';
import { validationUtils as validationUtilsModule } from './validationUtils';
import { storageService } from '../services/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import EventEmitter from './EventEmitter';

// 存储工具 - 直接使用AsyncStorage作为备选
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
      // 首先尝试使用storageService
      if (storageService && typeof storageService.setItem === 'function') {
        await storageService.setItem(safeKey, JSON.stringify(value));
      } else {
        // 备选方案：直接使用AsyncStorage
        await AsyncStorage.setItem(safeKey, JSON.stringify(value));
      }
      return true;
    } catch (e) {
      console.error(`存储错误 [${safeKey}]:`, e);
      // 备选方案：直接使用AsyncStorage
      try {
        await AsyncStorage.setItem(safeKey, JSON.stringify(value));
        return true;
      } catch (innerError) {
        console.error(`备选存储也失败 [${safeKey}]:`, innerError);
        return false;
      }
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
      // 首先尝试使用storageService
      if (storageService && typeof storageService.getItem === 'function') {
        const value = await storageService.getItem(safeKey);
        return value ? JSON.parse(value) : null;
      } else {
        // 备选方案：直接使用AsyncStorage
        const value = await AsyncStorage.getItem(safeKey);
        return value ? JSON.parse(value) : null;
      }
    } catch (e) {
      console.error(`读取错误 [${safeKey}]:`, e);
      // 备选方案：直接使用AsyncStorage
      try {
        const value = await AsyncStorage.getItem(safeKey);
        return value ? JSON.parse(value) : null;
      } catch (innerError) {
        console.error(`备选读取也失败 [${safeKey}]:`, innerError);
        return null;
      }
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
      // 首先尝试使用storageService
      if (storageService && typeof storageService.removeItem === 'function') {
        await storageService.removeItem(safeKey);
      } else {
        // 备选方案：直接使用AsyncStorage
        await AsyncStorage.removeItem(safeKey);
      }
      return true;
    } catch (e) {
      console.error(`删除错误 [${safeKey}]:`, e);
      // 备选方案：直接使用AsyncStorage
      try {
        await AsyncStorage.removeItem(safeKey);
        return true;
      } catch (innerError) {
        console.error(`备选删除也失败 [${safeKey}]:`, innerError);
        return false;
      }
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
export { default as EventEmitter } from './EventEmitter';