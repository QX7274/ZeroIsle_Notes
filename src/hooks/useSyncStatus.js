/**
 * 同步状态钩子
 */

import { useState, useEffect, useCallback } from 'react';
import { offlineSyncService } from '../services/offline/offlineSyncService';
import { networkService } from '../services/network/networkService';
import { logService } from '../services/utils/logService';

/**
 * 使用同步状态的钩子
 * @returns {Object} 同步状态和操作方法
 */
const useSyncStatus = () => {
  const [syncStatus, setSyncStatus] = useState({
    isSyncing: false,
    lastSyncTime: null,
    queueLength: 0,
    isOnline: true,
    autoSyncEnabled: true,
  });
  const [error, setError] = useState(null);

  // 初始化
  useEffect(() => {
    let isMounted = true;
    
    const initialize = async () => {
      try {
        // 初始化离线同步服务
        await offlineSyncService.initialize();
        
        if (isMounted) {
          // 获取同步状态
          const status = offlineSyncService.getSyncStatus();
          setSyncStatus(status);
        }
      } catch (err) {
        logService.error('初始化同步状态失败', err);
        if (isMounted) {
          setError(err);
        }
      }
    };
    
    initialize();
    
    // 监听网络状态变化
    const networkListener = networkService.addNetworkListener((state) => {
      if (isMounted) {
        setSyncStatus(prevStatus => ({
          ...prevStatus,
          isOnline: state.isOnline,
        }));
      }
    });
    
    // 定期更新同步状态
    const statusInterval = setInterval(() => {
      if (isMounted) {
        try {
          const status = offlineSyncService.getSyncStatus();
          setSyncStatus(status);
        } catch (err) {
          logService.error('获取同步状态失败', err);
        }
      }
    }, 5000); // 每5秒更新一次
    
    return () => {
      isMounted = false;
      networkService.removeNetworkListener(networkListener);
      clearInterval(statusInterval);
    };
  }, []);

  /**
   * 手动同步
   * @returns {Promise<Object>} 同步结果
   */
  const syncNow = useCallback(async () => {
    try {
      setError(null);
      
      // 检查网络连接
      if (!networkService.isOnline()) {
        throw new Error('网络连接不可用');
      }
      
      // 执行同步
      const result = await offlineSyncService.syncWithServer();
      
      // 更新同步状态
      const status = offlineSyncService.getSyncStatus();
      setSyncStatus(status);
      
      return result;
    } catch (err) {
      logService.error('手动同步失败', err);
      setError(err);
      throw err;
    }
  }, []);

  /**
   * 切换自动同步
   * @param {boolean} enabled 是否启用
   * @returns {Promise<void>}
   */
  const toggleAutoSync = useCallback(async (enabled) => {
    try {
      if (enabled) {
        offlineSyncService.startAutoSync();
      } else {
        offlineSyncService.stopAutoSync();
      }
      
      // 更新同步状态
      const status = offlineSyncService.getSyncStatus();
      setSyncStatus(status);
    } catch (err) {
      logService.error(`${enabled ? '启用' : '禁用'}自动同步失败`, err);
      setError(err);
      throw err;
    }
  }, []);

  /**
   * 清理同步队列
   * @returns {Promise<number>} 清理的项数量
   */
  const cleanSyncQueue = useCallback(async () => {
    try {
      const result = await offlineSyncService.cleanSyncQueue();
      
      // 更新同步状态
      const status = offlineSyncService.getSyncStatus();
      setSyncStatus(status);
      
      return result;
    } catch (err) {
      logService.error('清理同步队列失败', err);
      setError(err);
      throw err;
    }
  }, []);

  /**
   * 刷新同步状态
   * @returns {Promise<void>}
   */
  const refreshStatus = useCallback(async () => {
    try {
      // 更新同步状态
      const status = offlineSyncService.getSyncStatus();
      setSyncStatus(status);
    } catch (err) {
      logService.error('刷新同步状态失败', err);
      setError(err);
    }
  }, []);

  return {
    // 状态
    ...syncStatus,
    error,
    
    // 方法
    syncNow,
    toggleAutoSync,
    cleanSyncQueue,
    refreshStatus,
  };
};

export default useSyncStatus;
