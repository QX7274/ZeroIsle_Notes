/**
 * 网络状态钩子
 * 用于监控网络连接状态
 */
import { useState, useEffect } from 'react';
import networkService from '../services/network/networkService';

/**
 * 网络状态钩子
 * @returns {Object} - { isOnline, isConnected, connectionType, isInternetReachable }
 */
function useNetworkStatus() {
  const [networkStatus, setNetworkStatus] = useState({
    isOnline: true,
    isConnected: true,
    connectionType: 'unknown',
    isInternetReachable: true,
  });

  useEffect(() => {
    // 订阅网络状态变化
    const unsubscribe = networkService.addNetworkListener(state => {
      const isOnline = Boolean(state?.isOnline);
      setNetworkStatus({
        isOnline,
        isConnected: isOnline,
        connectionType: state?.connectionType || 'unknown',
        isInternetReachable: isOnline,
      });
    });

    // 初始获取网络状态
    networkService.checkConnection().then(isOnlineState => {
      const isOnline = Boolean(isOnlineState);
      setNetworkStatus(prev => ({
        ...prev,
        isOnline,
        isConnected: isOnline,
        isInternetReachable: isOnline,
      }));
    });

    // 清理订阅
    return () => {
      unsubscribe();
    };
  }, []);

  return networkStatus;
}

export default useNetworkStatus;
