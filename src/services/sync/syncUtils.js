/**
 * 同步工具函数
 * 提供同步相关的工具函数
 */

import { logService } from '../../utils/logService';

/**
 * 计算两个对象之间的差异
 * @param {Object} oldObj 旧对象
 * @param {Object} newObj 新对象
 * @returns {Object} 差异对象
 */
export function calculateDiff(oldObj, newObj) {
  if (!oldObj || !newObj) {
    return newObj || {};
  }

  const diff = {};
  const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);

  for (const key of allKeys) {
    // 如果新对象中没有该属性，跳过
    if (newObj[key] === undefined) {
      continue;
    }

    // 如果旧对象中没有该属性或者值不同，添加到差异对象中
    if (oldObj[key] === undefined || !isEqual(oldObj[key], newObj[key])) {
      diff[key] = newObj[key];
    }
  }

  return diff;
}

/**
 * 比较两个值是否相等
 * @param {*} a 值A
 * @param {*} b 值B
 * @returns {boolean} 是否相等
 */
function isEqual(a, b) {
  if (a === b) {
    return true;
  }

  if (typeof a !== typeof b) {
    return false;
  }

  if (a === null || b === null) {
    return a === b;
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      return false;
    }
    for (let i = 0; i < a.length; i++) {
      if (!isEqual(a[i], b[i])) {
        return false;
      }
    }
    return true;
  }

  if (typeof a === 'object' && typeof b === 'object') {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);

    if (keysA.length !== keysB.length) {
      return false;
    }

    for (const key of keysA) {
      if (!keysB.includes(key) || !isEqual(a[key], b[key])) {
        return false;
      }
    }

    return true;
  }

  return false;
}

/**
 * 合并对象，处理冲突
 * @param {Object} localObj 本地对象
 * @param {Object} remoteObj 远程对象
 * @param {Object} options 选项
 * @param {string} options.strategy 冲突解决策略 ('local', 'remote', 'newer')
 * @param {string} options.timestampField 时间戳字段名
 * @returns {Object} 合并后的对象
 */
export function mergeWithConflictResolution(localObj, remoteObj, options = {}) {
  const { strategy = 'newer', timestampField = 'updated_at' } = options;

  if (!localObj) return remoteObj;
  if (!remoteObj) return localObj;

  // 如果策略是'local'，优先使用本地对象
  if (strategy === 'local') {
    return { ...remoteObj, ...localObj };
  }

  // 如果策略是'remote'，优先使用远程对象
  if (strategy === 'remote') {
    return { ...localObj, ...remoteObj };
  }

  // 如果策略是'newer'，根据时间戳决定
  if (strategy === 'newer') {
    const localTime = localObj[timestampField] ? new Date(localObj[timestampField]) : new Date(0);
    const remoteTime = remoteObj[timestampField] ? new Date(remoteObj[timestampField]) : new Date(0);

    if (localTime > remoteTime) {
      return { ...remoteObj, ...localObj };
    } else {
      return { ...localObj, ...remoteObj };
    }
  }

  // 默认返回合并对象
  return { ...localObj, ...remoteObj };
}

/**
 * 过滤对象，只保留指定字段
 * @param {Object} obj 原始对象
 * @param {Array<string>} fields 要保留的字段
 * @returns {Object} 过滤后的对象
 */
export function filterFields(obj, fields) {
  if (!obj || !fields || !Array.isArray(fields)) {
    return obj || {};
  }

  const result = {};
  fields.forEach(field => {
    if (obj[field] !== undefined) {
      result[field] = obj[field];
    }
  });

  return result;
}

/**
 * 创建同步操作对象
 * @param {string} type 操作类型 ('create', 'update', 'delete')
 * @param {string} collection 集合名称
 * @param {string} documentId 文档ID
 * @param {Object} data 操作数据
 * @returns {Object} 同步操作对象
 */
export function createSyncOperation(type, collection, documentId, data) {
  if (!type || !collection) {
    throw new Error('操作类型和集合名称不能为空');
  }

  return {
    type,
    collection,
    document_id: documentId,
    data: data || {},
    timestamp: new Date().toISOString()
  };
}

/**
 * 解析同步错误
 * @param {Error} error 错误对象
 * @returns {Object} 解析后的错误信息
 */
export function parseSyncError(error) {
  try {
    if (!error) {
      return { message: '未知错误' };
    }

    // 如果是网络错误
    if (error.message && error.message.includes('Network Error')) {
      return { type: 'network', message: '网络错误，请检查网络连接' };
    }

    // 如果是API错误
    if (error.response) {
      const { status, data } = error.response;
      return {
        type: 'api',
        status,
        message: data.message || `API错误: ${status}`,
        data
      };
    }

    // 如果是超时错误
    if (error.code === 'ECONNABORTED') {
      return { type: 'timeout', message: '请求超时，请稍后重试' };
    }

    // 其他错误
    return {
      type: 'unknown',
      message: error.message || '未知错误',
      error
    };
  } catch (parseError) {
    logService.error('解析同步错误失败', parseError);
    return { type: 'parse_error', message: '解析错误信息失败' };
  }
}

/**
 * 格式化同步状态
 * @param {Object} status 同步状态对象
 * @returns {string} 格式化后的状态描述
 */
export function formatSyncStatus(status) {
  if (!status) {
    return '未同步';
  }

  if (status.isSyncing) {
    return '同步中...';
  }

  if (status.lastSyncTime) {
    const lastSync = new Date(status.lastSyncTime);
    const now = new Date();
    const diffMs = now - lastSync;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
      return `${diffDays}天前同步`;
    }

    if (diffHours > 0) {
      return `${diffHours}小时前同步`;
    }

    if (diffMins > 0) {
      return `${diffMins}分钟前同步`;
    }

    return '刚刚同步';
  }

  return '未同步';
}
