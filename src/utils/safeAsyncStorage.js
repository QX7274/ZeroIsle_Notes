/**
 * 安全的 AsyncStorage 包装器
 * 确保所有键都是有效的字符串，防止 undefined 键的问题
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * 确保键是有效的字符串
 * @param {any} key - 要检查的键
 * @returns {string} - 有效的字符串键
 */
const ensureValidKey = (key) => {
  if (key === undefined || key === null) {
    console.warn('SafeAsyncStorage: 尝试使用 undefined 或 null 键，使用默认键代替');
    return 'default_key';
  }
  return String(key);
};

/**
 * 安全的 AsyncStorage 包装器
 */
const SafeAsyncStorage = {
  /**
   * 设置键值对
   * @param {any} key - 键
   * @param {any} value - 值
   * @returns {Promise<void>}
   */
  setItem: async (key, value) => {
    const safeKey = ensureValidKey(key);
    return AsyncStorage.setItem(safeKey, value);
  },

  /**
   * 获取键对应的值
   * @param {any} key - 键
   * @returns {Promise<string>}
   */
  getItem: async (key) => {
    const safeKey = ensureValidKey(key);
    return AsyncStorage.getItem(safeKey);
  },

  /**
   * 移除键值对
   * @param {any} key - 键
   * @returns {Promise<void>}
   */
  removeItem: async (key) => {
    const safeKey = ensureValidKey(key);
    return AsyncStorage.removeItem(safeKey);
  },

  /**
   * 获取所有键
   * @returns {Promise<string[]>}
   */
  getAllKeys: async () => {
    return AsyncStorage.getAllKeys();
  },

  /**
   * 批量获取键值对
   * @param {any[]} keys - 键数组
   * @returns {Promise<[string, string | null][]>}
   */
  multiGet: async (keys) => {
    const safeKeys = keys.map(ensureValidKey);
    return AsyncStorage.multiGet(safeKeys);
  },

  /**
   * 批量设置键值对
   * @param {[any, string][]} keyValuePairs - 键值对数组
   * @returns {Promise<void>}
   */
  multiSet: async (keyValuePairs) => {
    const safeKeyValuePairs = keyValuePairs.map(([key, value]) => [ensureValidKey(key), value]);
    return AsyncStorage.multiSet(safeKeyValuePairs);
  },

  /**
   * 批量移除键值对
   * @param {any[]} keys - 键数组
   * @returns {Promise<void>}
   */
  multiRemove: async (keys) => {
    const safeKeys = keys.map(ensureValidKey);
    return AsyncStorage.multiRemove(safeKeys);
  },

  /**
   * 清除所有键值对
   * @returns {Promise<void>}
   */
  clear: async () => {
    return AsyncStorage.clear();
  },

  /**
   * 合并键值对
   * @param {any} key - 键
   * @param {any} value - 值
   * @returns {Promise<void>}
   */
  mergeItem: async (key, value) => {
    const safeKey = ensureValidKey(key);
    return AsyncStorage.mergeItem(safeKey, value);
  },

  /**
   * 批量合并键值对
   * @param {[any, string][]} keyValuePairs - 键值对数组
   * @returns {Promise<void>}
   */
  multiMerge: async (keyValuePairs) => {
    const safeKeyValuePairs = keyValuePairs.map(([key, value]) => [ensureValidKey(key), value]);
    return AsyncStorage.multiMerge(safeKeyValuePairs);
  },

  /**
   * 刷新 AsyncStorage
   * @returns {Promise<void>}
   */
  flushGetRequests: () => {
    return AsyncStorage.flushGetRequests();
  }
};

export default SafeAsyncStorage;
