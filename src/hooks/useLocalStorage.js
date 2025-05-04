/**
 * 本地存储钩子
 * 用于在React组件中使用本地存储
 */
import { useState, useEffect } from 'react';
import { storageService } from '../services/storage';

/**
 * 本地存储钩子
 * @param {string} key - 存储键
 * @param {any} initialValue - 初始值
 * @returns {Array} - [storedValue, setValue]
 */
function useLocalStorage(key, initialValue) {
  // 状态用于存储值
  const [storedValue, setStoredValue] = useState(initialValue);
  const [loading, setLoading] = useState(true);

  // 初始化从存储中读取值
  useEffect(() => {
    async function fetchStoredValue() {
      try {
        const value = await storageService.getItem(key);
        if (value !== null) {
          setStoredValue(JSON.parse(value));
        }
      } catch (error) {
        console.error(`Error reading from storage for key ${key}:`, error);
      } finally {
        setLoading(false);
      }
    }

    fetchStoredValue();
  }, [key]);

  // 返回一个包装版的setState函数，将新值保存到AsyncStorage
  const setValue = async (value) => {
    try {
      // 允许值是一个函数，就像useState的setter一样
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      
      // 保存到状态
      setStoredValue(valueToStore);
      
      // 保存到存储
      await storageService.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(`Error saving to storage for key ${key}:`, error);
    }
  };

  return [storedValue, setValue, loading];
}

export default useLocalStorage;
