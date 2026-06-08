/**
 * 权限请求辅助模块
 * 处理应用程序所需的各种权限请求
 */
import { Platform, PermissionsAndroid } from 'react-native';
import { check, request, PERMISSIONS, RESULTS } from 'react-native-permissions';

/**
 * 检查通知权限
 * @returns {Promise<boolean>} 是否有通知权限
 */
export const checkNotificationPermission = async () => {
  try {
    // iOS平台
    if (Platform.OS === 'ios') {
      const result = await check(PERMISSIONS.IOS.NOTIFICATIONS);
      return result === RESULTS.GRANTED;
    }

    // Android平台
    if (Platform.OS === 'android') {
      // Android 13及以上需要明确请求通知权限
      if (Platform.Version >= 33) {
        if (PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS) {
          const result = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
          return result;
        }

        // 某些运行时可能不暴露该常量，避免因为权限常量缺失阻塞通知入口
        return true;
      }

      // Android 13以下默认有通知权限
      return true;
    }

    return false;
  } catch (error) {
    console.error('检查通知权限失败:', error);
    // 出错时默认返回true，避免阻塞应用
    return true;
  }
};

/**
 * 请求通知权限
 * @param {number} timeout - 超时时间（毫秒）
 * @returns {Promise<boolean>} 是否获得通知权限
 */
export const requestNotificationPermission = async (timeout = 5000) => {
  try {
    // 创建一个带超时的Promise
    const permissionPromise = new Promise(async (resolve) => {
      try {
        // iOS平台
        if (Platform.OS === 'ios') {
          const result = await request(PERMISSIONS.IOS.NOTIFICATIONS);
          resolve(result === RESULTS.GRANTED);
          return;
        }

        // Android平台
        if (Platform.OS === 'android') {
          // Android 13及以上需要明确请求通知权限
          if (Platform.Version >= 33) {
            if (PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS) {
              const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
              resolve(result === PermissionsAndroid.RESULTS.GRANTED);
              return;
            }

            // 某些运行时可能不暴露该常量，避免请求阶段触发原生异常
            resolve(true);
            return;
          }

          // Android 13以下默认有通知权限
          resolve(true);
          return;
        }

        resolve(false);
      } catch (error) {
        console.error('请求通知权限失败:', error);
        // 出错时默认返回true，避免阻塞应用
        resolve(true);
      }
    });

    // 创建一个超时Promise
    const timeoutPromise = new Promise((resolve) => {
      setTimeout(() => {
        console.log(`通知权限请求超时(${timeout}ms)，按非阻塞降级继续运行`);
        resolve(true); // 超时时默认返回true，避免阻塞应用
      }, timeout);
    });

    // 使用Promise.race确保不会无限等待
    return await Promise.race([permissionPromise, timeoutPromise]);
  } catch (error) {
    console.error('请求通知权限过程出错:', error);
    // 出错时默认返回true，避免阻塞应用
    return true;
  }
};

/**
 * 检查并请求通知权限
 * @param {number} timeout - 超时时间（毫秒）
 * @returns {Promise<boolean>} 是否获得通知权限
 */
export const checkAndRequestNotificationPermission = async (timeout = 5000) => {
  try {
    // 先检查是否已有权限
    const hasPermission = await checkNotificationPermission();
    if (hasPermission) {
      return true;
    }

    // 如果没有权限，请求权限
    return await requestNotificationPermission(timeout);
  } catch (error) {
    console.error('检查并请求通知权限失败:', error);
    // 出错时默认返回true，避免阻塞应用
    return true;
  }
};

export default {
  checkNotificationPermission,
  requestNotificationPermission,
  checkAndRequestNotificationPermission,
};
