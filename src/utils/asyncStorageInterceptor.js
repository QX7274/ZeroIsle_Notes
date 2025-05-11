/**
 * AsyncStorage 拦截器
 * 拦截所有 AsyncStorage 调用，确保键不为 undefined
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

// 保存原始方法
const originalSetItem = AsyncStorage.setItem;
const originalGetItem = AsyncStorage.getItem;
const originalRemoveItem = AsyncStorage.removeItem;
const originalMergeItem = AsyncStorage.mergeItem;
const originalMultiGet = AsyncStorage.multiGet;
const originalMultiSet = AsyncStorage.multiSet;
const originalMultiRemove = AsyncStorage.multiRemove;
const originalMultiMerge = AsyncStorage.multiMerge;

/**
 * 确保键是有效的字符串
 * @param {any} key - 要检查的键
 * @returns {string} - 有效的字符串键
 */
const ensureValidKey = (key) => {
  if (key === undefined || key === null) {
    console.warn('AsyncStorage: 尝试使用 undefined 或 null 键，使用默认键代替');
    console.warn(new Error().stack); // 打印调用堆栈，帮助定位问题
    return 'default_key';
  }
  return String(key);
};

// 拦截 setItem 方法
AsyncStorage.setItem = (key, value) => {
  const safeKey = ensureValidKey(key);
  return originalSetItem.call(AsyncStorage, safeKey, value);
};

// 拦截 getItem 方法
AsyncStorage.getItem = (key) => {
  const safeKey = ensureValidKey(key);
  return originalGetItem.call(AsyncStorage, safeKey);
};

// 拦截 removeItem 方法
AsyncStorage.removeItem = (key) => {
  const safeKey = ensureValidKey(key);
  return originalRemoveItem.call(AsyncStorage, safeKey);
};

// 拦截 mergeItem 方法
AsyncStorage.mergeItem = (key, value) => {
  const safeKey = ensureValidKey(key);
  return originalMergeItem.call(AsyncStorage, safeKey, value);
};

// 拦截 multiGet 方法
AsyncStorage.multiGet = (keys) => {
  if (!Array.isArray(keys)) {
    console.warn('AsyncStorage.multiGet: keys 不是数组，使用空数组代替');
    return originalMultiGet.call(AsyncStorage, []);
  }
  const safeKeys = keys.map(ensureValidKey);
  return originalMultiGet.call(AsyncStorage, safeKeys);
};

// 拦截 multiSet 方法
AsyncStorage.multiSet = (keyValuePairs) => {
  if (!Array.isArray(keyValuePairs)) {
    console.warn('AsyncStorage.multiSet: keyValuePairs 不是数组，使用空数组代替');
    return originalMultiSet.call(AsyncStorage, []);
  }
  const safeKeyValuePairs = keyValuePairs.map(([key, value]) => [ensureValidKey(key), value]);
  return originalMultiSet.call(AsyncStorage, safeKeyValuePairs);
};

// 拦截 multiRemove 方法
AsyncStorage.multiRemove = (keys) => {
  if (!Array.isArray(keys)) {
    console.warn('AsyncStorage.multiRemove: keys 不是数组，使用空数组代替');
    return originalMultiRemove.call(AsyncStorage, []);
  }
  const safeKeys = keys.map(ensureValidKey);
  return originalMultiRemove.call(AsyncStorage, safeKeys);
};

// 拦截 multiMerge 方法
AsyncStorage.multiMerge = (keyValuePairs) => {
  if (!Array.isArray(keyValuePairs)) {
    console.warn('AsyncStorage.multiMerge: keyValuePairs 不是数组，使用空数组代替');
    return originalMultiMerge.call(AsyncStorage, []);
  }
  const safeKeyValuePairs = keyValuePairs.map(([key, value]) => [ensureValidKey(key), value]);
  return originalMultiMerge.call(AsyncStorage, safeKeyValuePairs);
};

export default AsyncStorage;
