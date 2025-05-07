/**
 * 认证工具函数
 * 处理认证相关的通用功能
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../../config';
import { navigationRef } from '../../navigation/navigationRef';

/**
 * 处理未授权错误
 * 清除token和用户信息，并重置导航到登录页面
 */
export const handleUnauthorizedError = async () => {
  console.log('处理未授权错误: 清除token和用户信息');
  
  try {
    // 清除token和用户信息
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.AUTH_TOKEN,
      STORAGE_KEYS.USER_INFO,
      STORAGE_KEYS.TOKEN,
      STORAGE_KEYS.USER
    ]);
    
    // 重置导航到登录页面
    if (navigationRef.current) {
      console.log('重置导航到登录页面');
      // 使用正确的重置方法
      navigationRef.current.resetRoot({
        index: 0,
        routes: [{ name: 'Auth' }]
      });
    } else {
      console.warn('导航引用不可用，无法重置导航');
    }
  } catch (error) {
    console.error('处理未授权错误失败:', error);
  }
};

/**
 * 保存认证信息
 * @param {string} token - 认证令牌
 * @param {object} user - 用户信息
 */
export const saveAuthInfo = async (token, user) => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, token);
    await AsyncStorage.setItem(STORAGE_KEYS.USER_INFO, JSON.stringify(user));
    // 兼容旧版存储键
    await AsyncStorage.setItem(STORAGE_KEYS.TOKEN, token);
    await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    return true;
  } catch (error) {
    console.error('保存认证信息失败:', error);
    return false;
  }
};

/**
 * 获取认证信息
 * @returns {Promise<{token: string, user: object}>} 认证信息
 */
export const getAuthInfo = async () => {
  try {
    // 尝试从新版存储键获取
    let token = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
    let userStr = await AsyncStorage.getItem(STORAGE_KEYS.USER_INFO);
    
    // 如果新版存储键不存在，尝试从旧版存储键获取
    if (!token) {
      token = await AsyncStorage.getItem(STORAGE_KEYS.TOKEN);
    }
    
    if (!userStr) {
      userStr = await AsyncStorage.getItem(STORAGE_KEYS.USER);
    }
    
    const user = userStr ? JSON.parse(userStr) : null;
    
    return { token, user };
  } catch (error) {
    console.error('获取认证信息失败:', error);
    return { token: null, user: null };
  }
};

/**
 * 清除认证信息
 */
export const clearAuthInfo = async () => {
  try {
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.AUTH_TOKEN,
      STORAGE_KEYS.USER_INFO,
      STORAGE_KEYS.TOKEN,
      STORAGE_KEYS.USER
    ]);
    return true;
  } catch (error) {
    console.error('清除认证信息失败:', error);
    return false;
  }
};

export default {
  handleUnauthorizedError,
  saveAuthInfo,
  getAuthInfo,
  clearAuthInfo
};
