/**
 * 测试服务初始化修复
 * 用于验证服务初始化修复是否有效
 */

import { realmStorageService } from './storage/realmStorageService';
import apiCache from './api/apiCache';
import authStorage from './auth/authStorage';
import reminderMongoDBService from './reminder/reminderMongoDBService';
import { fixServiceInitialization } from './initFix';

/**
 * 测试服务初始化
 */
export const testServiceInitialization = async () => {
  console.log('开始测试服务初始化...');

  try {
    // 测试realmStorageService
    console.log('测试realmStorageService...');
    await realmStorageService.initialize();
    console.log('realmStorageService初始化成功');

    // 测试apiCache
    console.log('测试apiCache...');
    await apiCache.initialize();
    console.log('apiCache初始化成功');

    // 测试authStorage
    console.log('测试authStorage...');
    await authStorage.initialize();
    console.log('authStorage初始化成功');

    // 测试reminderMongoDBService
    console.log('测试reminderMongoDBService...');
    await reminderMongoDBService.initialize();
    console.log('reminderMongoDBService初始化成功');

    console.log('所有服务初始化测试成功');
    return true;
  } catch (error) {
    console.error('服务初始化测试失败:', error);
    
    // 尝试修复
    console.log('尝试修复服务初始化...');
    try {
      await fixServiceInitialization();
      console.log('服务初始化修复成功');
      
      // 再次测试
      console.log('再次测试服务初始化...');
      
      // 测试apiCache
      console.log('再次测试apiCache...');
      await apiCache.initialize();
      console.log('apiCache初始化成功');
      
      // 测试authStorage
      console.log('再次测试authStorage...');
      await authStorage.initialize();
      console.log('authStorage初始化成功');
      
      // 测试reminderMongoDBService
      console.log('再次测试reminderMongoDBService...');
      await reminderMongoDBService.initialize();
      console.log('reminderMongoDBService初始化成功');
      
      console.log('修复后所有服务初始化测试成功');
      return true;
    } catch (fixError) {
      console.error('服务初始化修复失败:', fixError);
      return false;
    }
  }
};

export default {
  testServiceInitialization
};
