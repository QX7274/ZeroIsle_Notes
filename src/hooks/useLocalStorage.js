/**
 * 本地存储钩子
 * 用于在React组件中使用本地存储
 */
import { useState, useEffect } from 'react';
import realmService from '../services/database/realmService';

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
        const realm = await realmService.getRealm();
        const item = realm.objects('StorageItem').filtered(`key = "${key}"`);
        const value = item.length > 0 ? item[0].value : null;
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

  // 返回一个包装版的setState函数，将新值保存到存储服务
  const setValue = async (value) => {
    try {
      // 允许值是一个函数，就像useState的setter一样
      const valueToStore = value instanceof Function ? value(storedValue) : value;

      // 保存到状态
      setStoredValue(valueToStore);

      // 保存到存储
      const realm = await realmService.getRealm();
      realm.write(() => {
        const existingItem = realm.objects('StorageItem').filtered(`key = "${key}"`);
        if (existingItem.length > 0) {
          existingItem[0].value = JSON.stringify(valueToStore);
          existingItem[0].updated_at = new Date();
        } else {
          realm.create('StorageItem', {
            key: key,
            value: JSON.stringify(valueToStore),
            createdAt: new Date(),
            updated_at: new Date(),
          });
        }
      });
    } catch (error) {
      console.error(`Error saving to storage for key ${key}:`, error);
    }
  };

  return [storedValue, setValue, loading];
}

export default useLocalStorage;
