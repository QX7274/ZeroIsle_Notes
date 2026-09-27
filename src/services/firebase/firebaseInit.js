/**
 * Firebase 初始化模块
 * 负责初始化 Firebase 服务
 */
import { Platform } from 'react-native';
import { getApps, initializeApp } from '@react-native-firebase/app';
import messaging from '@react-native-firebase/messaging';

/**
 * 初始化 Firebase
 * @returns {Promise<boolean>} 初始化是否成功
 */
export const initializeFirebase = async () => {
  try {
    // 使用 getApps() 替代 firebase.apps.length，避免废弃API警告
    if (getApps().length === 0) {
      // 只有存在原生 Firebase 配置（android/app/google-services.json 或 iOS GoogleService-Info.plist）
      // 时才会注册默认 App；缺少配置时 initializeApp() 返回 rejected promise，
      // 这里显式 await 并降级，避免未处理的 Promise rejection 出现在冷启动链路上。
      try {
        await initializeApp();
        console.log('Firebase 初始化成功');
      } catch (initError) {
        console.warn(
          '缺少可用的 Firebase 配置，推送能力降级为本地通知:',
          initError?.message || initError,
        );
        return false;
      }
    } else {
      console.log('Firebase 已经初始化');
    }

    // 请求消息通知权限（仅iOS）
    if (Platform.OS === 'ios') {
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (enabled) {
        console.log('Firebase 消息通知权限已授予');
      } else {
        console.log('Firebase 消息通知权限被拒绝');
      }
    }

    return true;
  } catch (error) {
    console.error('Firebase 初始化失败:', error);
    return false;
  }
};

export default initializeFirebase;
