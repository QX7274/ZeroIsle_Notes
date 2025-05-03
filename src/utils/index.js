/**
 * 工具函数导出文件
 * 集中导出所有工具函数，方便引用
 */
import { Platform, PermissionsAndroid } from 'react-native';
import dateUtilsModule from './dateUtils';
import { validationUtils as validationUtilsModule } from './validationUtils';
import * as storageService from '../services/storage';
import EventEmitter from './eventEmitter';

// 存储工具 - 从 services/storage.js 导入
export const storage = {
  set: async (key, value) => {
    try {
      // 使用通用的存储方法
      await storageService.setSettings({ [key]: value });
      return true;
    } catch (e) {
      console.error('存储错误:', e);
      return false;
    }
  },
  get: async (key) => {
    try {
      // 使用通用的获取方法
      const settings = await storageService.getSettings();
      return settings[key] || null;
    } catch (e) {
      console.error('读取错误:', e);
      return null;
    }
  },
  remove: async (key) => {
    try {
      // 获取当前设置，删除指定键，然后保存
      const settings = await storageService.getSettings();
      if (settings[key]) {
        delete settings[key];
        await storageService.setSettings(settings);
      }
      return true;
    } catch (e) {
      console.error('删除错误:', e);
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