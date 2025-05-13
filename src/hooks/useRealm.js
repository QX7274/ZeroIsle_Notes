/**
 * Realm 数据库操作钩子
 */

import { useState, useCallback, useEffect } from 'react';
import { useRealm as useRealmContext } from '../context/RealmContext';
import { logService } from '../services/utils/logService';

/**
 * 使用 Realm 数据库操作的钩子
 * @param {string} collectionName 集合名称
 * @returns {Object} Realm 操作方法和状态
 */
const useRealm = (collectionName) => {
  const { realm, isReady, error: realmError, transaction } = useRealmContext();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState([]);

  // 初始化时加载数据
  useEffect(() => {
    if (isReady && realm && collectionName) {
      fetchAll();
    }
  }, [isReady, realm, collectionName]);

  /**
   * 获取所有文档
   * @param {Object} filter 过滤条件
   * @param {Object} options 选项
   * @returns {Promise<Array>} 文档数组
   */
  const fetchAll = useCallback(async (filter = {}, options = {}) => {
    if (!isReady || !realm) {
      return [];
    }

    setIsLoading(true);
    setError(null);

    try {
      const collection = realm.objects(collectionName);
      
      // 应用过滤条件
      let filteredResults = collection;
      if (Object.keys(filter).length > 0) {
        const filterString = Object.entries(filter)
          .map(([key, value]) => {
            if (typeof value === 'string') {
              return `${key} == "${value}"`;
            }
            return `${key} == ${value}`;
          })
          .join(' AND ');
        
        filteredResults = collection.filtered(filterString);
      }
      
      // 应用排序
      if (options.sort) {
        const { field, ascending = true } = options.sort;
        filteredResults = filteredResults.sorted(field, ascending);
      }
      
      // 转换为普通数组
      const resultsArray = Array.from(filteredResults);
      
      // 应用分页
      let paginatedResults = resultsArray;
      if (options.skip || options.limit) {
        const skip = options.skip || 0;
        const limit = options.limit || resultsArray.length;
        paginatedResults = resultsArray.slice(skip, skip + limit);
      }
      
      setResults(paginatedResults);
      setIsLoading(false);
      return paginatedResults;
    } catch (err) {
      logService.error(`获取 ${collectionName} 集合数据失败`, err);
      setError(err);
      setIsLoading(false);
      return [];
    }
  }, [isReady, realm, collectionName]);

  /**
   * 根据 ID 获取文档
   * @param {string} id 文档 ID
   * @returns {Promise<Object|null>} 文档对象
   */
  const fetchById = useCallback(async (id) => {
    if (!isReady || !realm) {
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = realm.objectForPrimaryKey(collectionName, id);
      setIsLoading(false);
      return result ? { ...result } : null;
    } catch (err) {
      logService.error(`获取 ${collectionName} 文档(ID: ${id})失败`, err);
      setError(err);
      setIsLoading(false);
      return null;
    }
  }, [isReady, realm, collectionName]);

  /**
   * 创建文档
   * @param {Object} data 文档数据
   * @returns {Promise<Object>} 创建的文档
   */
  const create = useCallback(async (data) => {
    if (!isReady || !realm) {
      throw new Error('Realm 未就绪');
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await transaction((realmInstance) => {
        return realmInstance.create(collectionName, data);
      });
      
      // 刷新数据
      fetchAll();
      
      setIsLoading(false);
      return { ...result };
    } catch (err) {
      logService.error(`创建 ${collectionName} 文档失败`, err);
      setError(err);
      setIsLoading(false);
      throw err;
    }
  }, [isReady, realm, collectionName, transaction, fetchAll]);

  /**
   * 更新文档
   * @param {string} id 文档 ID
   * @param {Object} data 更新数据
   * @returns {Promise<Object>} 更新后的文档
   */
  const update = useCallback(async (id, data) => {
    if (!isReady || !realm) {
      throw new Error('Realm 未就绪');
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await transaction((realmInstance) => {
        const obj = realmInstance.objectForPrimaryKey(collectionName, id);
        if (!obj) {
          throw new Error(`${collectionName} 文档(ID: ${id})不存在`);
        }
        
        // 更新对象属性
        Object.keys(data).forEach(key => {
          if (key !== '_id') { // 不更新主键
            obj[key] = data[key];
          }
        });
        
        return obj;
      });
      
      // 刷新数据
      fetchAll();
      
      setIsLoading(false);
      return { ...result };
    } catch (err) {
      logService.error(`更新 ${collectionName} 文档(ID: ${id})失败`, err);
      setError(err);
      setIsLoading(false);
      throw err;
    }
  }, [isReady, realm, collectionName, transaction, fetchAll]);

  /**
   * 删除文档
   * @param {string} id 文档 ID
   * @returns {Promise<boolean>} 是否成功
   */
  const remove = useCallback(async (id) => {
    if (!isReady || !realm) {
      throw new Error('Realm 未就绪');
    }

    setIsLoading(true);
    setError(null);

    try {
      await transaction((realmInstance) => {
        const obj = realmInstance.objectForPrimaryKey(collectionName, id);
        if (obj) {
          realmInstance.delete(obj);
        }
      });
      
      // 刷新数据
      fetchAll();
      
      setIsLoading(false);
      return true;
    } catch (err) {
      logService.error(`删除 ${collectionName} 文档(ID: ${id})失败`, err);
      setError(err);
      setIsLoading(false);
      throw err;
    }
  }, [isReady, realm, collectionName, transaction, fetchAll]);

  /**
   * 软删除文档
   * @param {string} id 文档 ID
   * @returns {Promise<Object>} 更新后的文档
   */
  const softDelete = useCallback(async (id) => {
    return update(id, {
      is_deleted: true,
      deleted_at: new Date(),
    });
  }, [update]);

  /**
   * 恢复软删除的文档
   * @param {string} id 文档 ID
   * @returns {Promise<Object>} 更新后的文档
   */
  const restore = useCallback(async (id) => {
    return update(id, {
      is_deleted: false,
      deleted_at: null,
    });
  }, [update]);

  return {
    // 状态
    isReady,
    isLoading,
    error: error || realmError,
    results,
    
    // 方法
    fetchAll,
    fetchById,
    create,
    update,
    remove,
    softDelete,
    restore,
  };
};

export default useRealm;
