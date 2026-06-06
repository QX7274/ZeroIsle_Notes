/**
 * 消息工具函数
 * 提供显示消息提示的功能
 */
import { Platform, ToastAndroid } from 'react-native';

// 全局消息回调函数
let globalMessageCallback = null;

const NOISY_MESSAGE_PATTERNS = [
  '获取群组邀请失败',
  '群组邀请失败',
  '获取群组列表失败',
  '获取群组详情失败',
  '获取群组成员失败',
  '创建群组失败',
  '加入群组失败',
  '邀请用户失败',
  '删除群组失败',
  '网络错误且无缓存',
  '离线状态下无法完成请求',
  '无法完成请求',
  '网络连接失败',
  '请求已保存到离线队列',
];

const isNoisyMessage = (message) => {
  const normalized = String(message || '').toLowerCase().replace(/\s+/g, '');
  if (!normalized) {
    return true;
  }

  return NOISY_MESSAGE_PATTERNS.some((pattern) => normalized.includes(String(pattern).toLowerCase().replace(/\s+/g, '')))
    || /error[:：]/.test(normalized)
    || /群组.*失败/.test(normalized)
    || /邀请.*失败/.test(normalized);
};

/**
 * 设置全局消息回调函数
 * 用于在不同UI框架中显示消息
 * @param {Function} callback 回调函数，接收消息文本和类型
 */
export const setMessageCallback = (callback) => {
  if (typeof callback === 'function') {
    globalMessageCallback = callback;
  }
};

/**
 * 显示消息提示
 * @param {string} message 消息内容
 * @param {string} type 消息类型: 'info', 'success', 'warning', 'error'
 * @param {number} duration 显示时长(毫秒)
 */
export const showMessage = (message, type = 'info', duration = 2000) => {
  if (!message) {return;}

  if (isNoisyMessage(message)) {
    return;
  }

  // 如果有全局回调，使用全局回调
  if (globalMessageCallback) {
    globalMessageCallback(message, type, duration);
    return;
  }

  // 否则使用平台原生方法
  if (Platform.OS === 'android') {
    // Android使用ToastAndroid
    ToastAndroid.show(message, duration <= 2000 ? ToastAndroid.SHORT : ToastAndroid.LONG);
  } else {
    // iOS没有内置的Toast，只打印到控制台
    console.log(`[${type.toUpperCase()}] ${message}`);
  }
};

/**
 * 显示成功消息
 * @param {string} message 消息内容
 * @param {number} duration 显示时长(毫秒)
 */
export const showSuccess = (message, duration = 2000) => {
  showMessage(message, 'success', duration);
};

/**
 * 显示警告消息
 * @param {string} message 消息内容
 * @param {number} duration 显示时长(毫秒)
 */
export const showWarning = (message, duration = 2000) => {
  showMessage(message, 'warning', duration);
};

/**
 * 显示错误消息
 * @param {string} message 消息内容
 * @param {number} duration 显示时长(毫秒)
 */
export const showError = (message, duration = 2000) => {
  showMessage(message, 'error', duration);
};

/**
 * 显示信息消息
 * @param {string} message 消息内容
 * @param {number} duration 显示时长(毫秒)
 */
export const showInfo = (message, duration = 2000) => {
  showMessage(message, 'info', duration);
};

export default {
  setMessageCallback,
  showMessage,
  showSuccess,
  showWarning,
  showError,
  showInfo,
};
