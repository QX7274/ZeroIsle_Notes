/**
 * Realm 上下文
 * 提供 Realm 数据库实例和操作方法
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import Realm from 'realm';
import realmService from '../services/database/realmService';
// 使用控制台日志代替 logService
import { appStateService } from '../services/app/appStateService';

// 创建上下文
const RealmContext = createContext(null);

/**
 * Realm 上下文提供者
 * @param {Object} props 组件属性
 * @returns {JSX.Element} 上下文提供者组件
 */
export const RealmProvider = ({ children }) => {
  const [realm, setRealm] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState(null);

  // 初始化 Realm
  useEffect(() => {
    let isMounted = true;
    let realmInstance = null;

    const initRealm = async () => {
      try {
        console.info('正在初始化 Realm...');

        // 初始化 Realm 服务
        await realmService.initialize();

        // 获取 Realm 实例
        realmInstance = await realmService.getRealm();

        if (isMounted) {
          setRealm(realmInstance);
          setIsReady(true);
          console.info('Realm 初始化成功');
        }
      } catch (err) {
        console.error('Realm 初始化失败', err);
        if (isMounted) {
          setError(err);
          setIsReady(true); // 即使出错也标记为就绪，以便应用可以继续运行
        }
      }
    };

    initRealm();

    // 监听应用状态变化
    const foregroundListener = appStateService.addListener('foreground', () => {
      // 应用回到前台时，检查 Realm 连接
      if (realmInstance && realmInstance.isClosed) {
        console.info('应用回到前台，Realm 已关闭，重新初始化');
        initRealm();
      }
    });

    // 清理函数
    return () => {
      isMounted = false;

      // 移除监听器
      foregroundListener();

      // 关闭 Realm 实例
      if (realmInstance && !realmInstance.isClosed) {
        try {
          realmInstance.close();
          console.info('Realm 实例已关闭');
        } catch (err) {
          console.error('关闭 Realm 实例失败', err);
        }
      }
    };
  }, []);

  /**
   * 重新连接 Realm
   * @returns {Promise<void>}
   */
  const reconnect = async () => {
    try {
      console.info('正在重新连接 Realm...');

      // 关闭现有实例
      if (realm && !realm.isClosed) {
        realm.close();
      }

      // 重新初始化 Realm 服务
      await realmService.initialize();

      // 获取新的 Realm 实例
      const newRealm = await realmService.getRealm();

      setRealm(newRealm);
      setError(null);
      console.info('Realm 重新连接成功');
    } catch (err) {
      console.error('Realm 重新连接失败', err);
      setError(err);
    }
  };

  /**
   * 执行 Realm 事务
   * @param {Function} callback 事务回调函数
   * @returns {Promise<*>} 事务结果
   */
  const transaction = async (callback) => {
    if (!realm) {
      throw new Error('Realm 实例不可用');
    }

    if (realm.isClosed) {
      await reconnect();
      if (!realm || realm.isClosed) {
        throw new Error('无法重新连接 Realm');
      }
    }

    try {
      let result;
      realm.beginTransaction();
      result = await callback(realm);
      realm.commitTransaction();
      return result;
    } catch (err) {
      if (realm.isInTransaction) {
        realm.cancelTransaction();
      }
      throw err;
    }
  };

  // 上下文值
  const contextValue = {
    realm,
    isReady,
    error,
    reconnect,
    transaction,
  };

  return (
    <RealmContext.Provider value={contextValue}>
      {children}
    </RealmContext.Provider>
  );
};

/**
 * 使用 Realm 上下文的钩子
 * @returns {Object} Realm 上下文
 */
export const useRealm = () => {
  const context = useContext(RealmContext);
  if (!context) {
    throw new Error('useRealm 必须在 RealmProvider 内部使用');
  }
  return context;
};

export default RealmContext;
