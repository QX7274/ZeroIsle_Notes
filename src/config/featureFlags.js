/**
 * 功能开关配置
 *
 * 用于控制新功能的启用/禁用，支持：
 * - 本地配置
 * - 远程配置（可选）
 * - 开发/生产环境区分
 */

import { Platform } from 'react-native';

// 默认功能开关配置（按平台）
const defaultFlags = {
  // 原生实现开关
  pdf_native: true,             // PDF 原生实现
  paged_note_native: true,      // 分页笔记原生实现
  infinite_canvas_native: true, // 无限画布原生实现

  // 其他功能开关
  // iOS：开启；Android：暂时关闭（待完全打通后开启）
  handwriting_recognition: Platform.OS === 'ios',
  auto_save: true,              // 自动保存
  cloud_sync: true,             // 云同步
  offline_mode: true,           // 离线模式
};

// 当前功能开关状态
let flags = { ...defaultFlags };

/**
 * 检查功能是否启用
 * @param {string} flagName - 功能名称
 * @returns {boolean} - 是否启用
 */
export const isFeatureEnabled = (flagName) => {
  return flags[flagName] === true;
};

/**
 * 获取所有功能开关状态
 * @returns {Object} - 功能开关对象
 */
export const getAllFlags = () => {
  return { ...flags };
};

/**
 * 设置功能开关状态
 * @param {string} flagName - 功能名称
 * @param {boolean} enabled - 是否启用
 */
export const setFeatureFlag = (flagName, enabled) => {
  flags[flagName] = enabled;
  console.log(`[FeatureFlags] ${flagName}: ${enabled ? '启用' : '禁用'}`);
};

/**
 * 批量设置功能开关
 * @param {Object} newFlags - 新的功能开关配置
 */
export const setFlags = (newFlags) => {
  flags = { ...flags, ...newFlags };
  console.log('[FeatureFlags] 批量更新:', newFlags);
};

/**
 * 重置为默认配置
 */
export const resetToDefault = () => {
  flags = { ...defaultFlags };
  console.log('[FeatureFlags] 重置为默认配置');
};

/**
 * 从远程配置刷新（可选实现）
 * 在实际项目中，可以从服务器获取配置
 */
export const refreshFlagsRemote = async () => {
  try {
    // 这里添加从服务器获取配置的逻辑（可选）：
    // 1) 读本地缓存端点
    const endpoint = (global.__featureFlagsEndpoint) || null;
    if (!endpoint) {
      console.log('[FeatureFlags] 未配置远程端点，跳过刷新');
      return;
    }
    const res = await fetch(endpoint, { method: 'GET' });
    if (!res.ok) {
      console.warn('[FeatureFlags] 远程配置请求失败:', res.status);
      return;
    }
    const remoteFlags = await res.json();
    if (remoteFlags && typeof remoteFlags === 'object') {
      setFlags(remoteFlags);
      console.log('[FeatureFlags] 已合并远程配置');
    } else {
      console.warn('[FeatureFlags] 远程配置格式无效');
    }
  } catch (error) {
    console.error('[FeatureFlags] 远程配置刷新失败:', error);
  }
};

// 开发环境调试
if (__DEV__) {
  // 在开发环境中，将功能开关暴露到全局对象，方便调试
  global.featureFlags = {
    isEnabled: isFeatureEnabled,
    setFlag: setFeatureFlag,
    setFlags,
    reset: resetToDefault,
    getAll: getAllFlags,
  };

  console.log('[FeatureFlags] 开发模式：功能开关已暴露到 global.featureFlags');
}

export default {
  isFeatureEnabled,
  getAllFlags,
  setFeatureFlag,
  setFlags,
  resetToDefault,
  refreshFlagsRemote,
};

