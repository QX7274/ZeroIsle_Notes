/**
 * 认证工具函数
 * 处理认证相关的通用功能
 */
import { Alert } from 'react-native';
import { STORAGE_KEYS } from '../../utils/constants/config';
import { navigationRef } from '../../navigation/navigationRef';
import { CommonActions } from '@react-navigation/native';
import authStorage from './authStorage';
import tokenService from './tokenService';

// 防止多次处理未授权错误
let isHandlingUnauthorizedError = false;

/**
 * 处理未授权错误
 * 清除token和用户信息，并重置导航到登录页面
 */
export const handleUnauthorizedError = async () => {
  // 如果已经在处理未授权错误，则直接返回
  if (isHandlingUnauthorizedError) {
    console.log('已经在处理未授权错误，跳过');
    return;
  }

  // 设置标志，表示正在处理未授权错误
  isHandlingUnauthorizedError = true;

  console.log('处理未授权错误: 清除token和用户信息');

  try {
    // 使用tokenService清除所有令牌
    try {
      await tokenService.clearTokens();
      console.log('成功清除所有令牌');
    } catch (tokenError) {
      console.warn('清除令牌失败:', tokenError);
    }

    // 清除用户信息
    try {
      await authStorage.removeItem(STORAGE_KEYS.USER_INFO);
      console.log('成功清除用户信息');
    } catch (userInfoError) {
      console.warn('清除用户信息失败:', userInfoError);
    }

    try {
      await authStorage.removeItem(STORAGE_KEYS.USER);
      console.log('成功清除用户数据');
    } catch (userError) {
      console.warn('清除用户数据失败:', userError);
    }

    // 显示提示
    Alert.alert('登录已过期', '请重新登录');

    // 使用setTimeout确保Alert显示后再执行导航
    setTimeout(() => {
      // 尝试直接修改Redux状态
      try {
        // 从正确的位置导入store
        const { store } = require('../../store');
        if (store && typeof store.dispatch === 'function') {
          store.dispatch({ type: 'auth/logout/fulfilled' });
          console.log('已通过Redux状态重置认证状态');
        } else {
          console.error('Redux store不可用或dispatch不是函数');
        }
      } catch (reduxError) {
        console.warn('Redux状态重置失败:', reduxError);
      }

      // 重置导航到登录页面
      console.log('重置导航到登录页面');

      // 使用导航辅助函数
      try {
        const navigation = require('../../navigation/navigationRef');
        if (navigation && typeof navigation.reset === 'function') {
          // 使用reset方法重置导航状态
          navigation.reset({
            index: 0,
            routes: [{ name: 'Auth' }]
          });
          console.log('已使用导航辅助函数重置到Auth页面');
        } else if (navigation && typeof navigation.navigate === 'function') {
          // 备选方法：使用navigate方法
          navigation.navigate('Auth', {}, { reset: true });
          console.log('已使用导航辅助函数导航到Auth页面');
        } else if (navigationRef.current) {
          // 备选方法：直接使用navigationRef
          try {
            navigationRef.current.dispatch(
              CommonActions.reset({
                index: 0,
                routes: [{ name: 'Auth' }]
              })
            );
            console.log('已使用navigationRef重置到Auth页面');
          } catch (navRefError) {
            console.error('使用navigationRef重置失败:', navRefError);

            // 最后的备选方法：直接使用dispatch
            try {
              navigationRef.current.dispatch({
                type: 'RESET',
                payload: {
                  index: 0,
                  routes: [{ name: 'Auth' }]
                }
              });
              console.log('已使用dispatch重置到Auth页面');
            } catch (dispatchError) {
              console.error('使用dispatch重置失败:', dispatchError);
            }
          }
        } else {
          console.warn('导航引用不可用，无法重置导航');
        }
      } catch (navError) {
        console.error('所有导航方法都失败:', navError);
      }

      // 重置处理标志
      setTimeout(() => {
        isHandlingUnauthorizedError = false;
        console.log('重置未授权处理标志');
      }, 1000);
    }, 500);
  } catch (error) {
    console.error('处理未授权错误失败:', error);
    // 即使出错也要重置标志
    isHandlingUnauthorizedError = false;
  }
};

/**
 * 保存认证信息
 * @param {string} accessToken - 访问令牌
 * @param {string} refreshToken - 刷新令牌
 * @param {object} user - 用户信息
 */
export const saveAuthInfo = async (accessToken, refreshToken, user) => {
  try {
    // 使用tokenService保存令牌
    await tokenService.saveAccessToken(accessToken);

    if (refreshToken) {
      await tokenService.saveRefreshToken(refreshToken);
    }

    // 保存用户信息
    await authStorage.setItem(STORAGE_KEYS.USER_INFO, user);
    await authStorage.setItem(STORAGE_KEYS.USER, user); // 兼容旧版

    return true;
  } catch (error) {
    console.error('保存认证信息失败:', error);
    return false;
  }
};

/**
 * 获取认证信息
 * @returns {Promise<{token: string, refreshToken: string, user: object}>} 认证信息
 */
export const getAuthInfo = async () => {
  try {
    // 使用tokenService获取令牌
    const tokenData = await tokenService.getAccessToken();
    const refreshTokenData = await tokenService.getRefreshToken();

    // 获取用户信息
    let user = await authStorage.getItem(STORAGE_KEYS.USER_INFO);

    // 如果用户信息不存在，尝试从旧版存储键获取
    if (!user) {
      user = await authStorage.getItem(STORAGE_KEYS.USER);
    }

    return {
      token: tokenData ? tokenData.token : null,
      refreshToken: refreshTokenData ? refreshTokenData.token : null,
      user
    };
  } catch (error) {
    console.error('获取认证信息失败:', error);
    return { token: null, refreshToken: null, user: null };
  }
};

/**
 * 清除认证信息
 */
export const clearAuthInfo = async () => {
  try {
    // 使用tokenService清除所有令牌
    await tokenService.clearTokens();

    // 清除用户信息
    await authStorage.removeItem(STORAGE_KEYS.USER_INFO);
    await authStorage.removeItem(STORAGE_KEYS.USER);

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
