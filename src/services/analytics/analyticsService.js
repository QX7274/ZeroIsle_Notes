/**
 * 分析服务
 * 用于跟踪用户行为和应用性能
 */
import { Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';
import { ANALYTICS_EVENTS } from '../../config';

// 是否启用分析
const ANALYTICS_ENABLED = true;

// 分析数据队列
const eventQueue = [];

// 设备信息
let deviceInfo = null;

/**
 * 初始化设备信息
 */
const initDeviceInfo = async () => {
  try {
    deviceInfo = {
      appVersion: DeviceInfo.getVersion(),
      buildNumber: DeviceInfo.getBuildNumber(),
      deviceId: await DeviceInfo.getUniqueId(),
      deviceModel: DeviceInfo.getModel(),
      deviceBrand: DeviceInfo.getBrand(),
      osName: Platform.OS,
      osVersion: Platform.Version.toString(),
      isTablet: DeviceInfo.isTablet(),
      isEmulator: await DeviceInfo.isEmulator(),
    };
  } catch (error) {
    console.error('获取设备信息失败:', error);
    deviceInfo = {
      appVersion: 'unknown',
      deviceId: 'unknown',
      osName: Platform.OS,
      osVersion: Platform.Version.toString(),
    };
  }
};

// 初始化设备信息
initDeviceInfo();

/**
 * 跟踪事件
 * @param {string} eventName 事件名称
 * @param {Object} params 事件参数
 */
export const trackEvent = (eventName, params = {}) => {
  if (!ANALYTICS_ENABLED) return;

  try {
    const event = {
      eventName,
      params,
      timestamp: new Date().toISOString(),
      deviceInfo,
    };

    // 添加到队列
    eventQueue.push(event);

    // 如果队列过长，发送数据
    if (eventQueue.length >= 10) {
      sendEvents();
    }

    console.log(`[Analytics] 跟踪事件: ${eventName}`, params);
  } catch (error) {
    console.error('跟踪事件失败:', error);
  }
};

/**
 * 跟踪错误
 * @param {Error|string|any} error 错误对象、错误消息或任何值
 * @param {Object} context 错误上下文
 */
export const trackError = (error, context = {}) => {
  if (!ANALYTICS_ENABLED) return;

  try {
    // 防御性检查，确保 error 不为 undefined 或 null
    if (error === undefined || error === null) {
      error = '未知错误';
    }

    // 构建错误事件对象
    const errorEvent = {
      eventName: 'app_error',
      params: {
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : new Error().stack,
        errorName: error instanceof Error ? error.name : typeof error,
        ...context,
      },
      timestamp: new Date().toISOString(),
      deviceInfo: deviceInfo || {
        osName: Platform.OS,
        osVersion: Platform.Version.toString(),
      },
    };

    // 添加到队列
    eventQueue.push(errorEvent);

    // 错误立即发送
    sendEvents();

    console.log('[Analytics] 跟踪错误:', errorEvent.params.errorMessage, context);
  } catch (err) {
    console.error('跟踪错误失败:', err);
    // 确保即使跟踪错误失败，也不会影响应用
  }
};

/**
 * 跟踪屏幕访问
 * @param {string} screenName 屏幕名称
 * @param {Object} params 屏幕参数
 */
export const trackScreen = (screenName, params = {}) => {
  trackEvent('screen_view', {
    screen_name: screenName,
    ...params,
  });
};

/**
 * 跟踪用户行为
 * @param {string} action 行为名称
 * @param {Object} params 行为参数
 */
export const trackUserAction = (action, params = {}) => {
  trackEvent('user_action', {
    action,
    ...params,
  });
};

/**
 * 发送事件数据到服务器
 */
const sendEvents = async () => {
  if (eventQueue.length === 0) return;

  try {
    // 复制队列并清空
    const events = [...eventQueue];
    eventQueue.length = 0;

    // 这里应该实现发送到分析服务器的逻辑
    // 例如使用fetch或axios发送数据

    // 模拟发送
    console.log(`[Analytics] 发送 ${events.length} 个事件到服务器`);

    // 实际项目中应该实现真正的发送逻辑
    // await api.post('/analytics/events', { events });
  } catch (error) {
    console.error('发送分析数据失败:', error);

    // 失败时，将事件放回队列
    eventQueue.push(...events);
  }
};

/**
 * 设置用户标识
 * @param {string} userId 用户ID
 * @param {Object} userProperties 用户属性
 */
export const setUserId = (userId, userProperties = {}) => {
  if (!ANALYTICS_ENABLED) return;

  try {
    trackEvent('set_user_id', {
      user_id: userId,
      ...userProperties,
    });

    console.log(`[Analytics] 设置用户ID: ${userId}`);
  } catch (error) {
    console.error('设置用户ID失败:', error);
  }
};

/**
 * 清除用户标识
 */
export const clearUserId = () => {
  if (!ANALYTICS_ENABLED) return;

  try {
    trackEvent('clear_user_id');
    console.log('[Analytics] 清除用户ID');
  } catch (error) {
    console.error('清除用户ID失败:', error);
  }
};

// 导出分析服务
const analyticsService = {
  trackEvent,
  trackError,
  trackScreen,
  trackUserAction,
  setUserId,
  clearUserId,

  // 预定义事件
  events: ANALYTICS_EVENTS,
};

// 确保全局可访问
if (global) {
  global.analyticsService = analyticsService;
}

export default analyticsService;
