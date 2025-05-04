/**
 * 网络状态钩子
 * 用于监控网络连接状态
 */
import { useState, useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';

/**
 * 网络状态钩子
 * @returns {Object} - { isConnected, connectionType, isInternetReachable }
 */
function useNetworkStatus() {
  const [networkStatus, setNetworkStatus] = useState({
    isConnected: true,
    connectionType: 'unknown',
    isInternetReachable: true,
  });

  useEffect(() => {
    // 订阅网络状态变化
    const unsubscribe = NetInfo.addEventListener(state => {
      setNetworkStatus({
        isConnected: state.isConnected,
        connectionType: state.type,
        isInternetReachable: state.isInternetReachable,
      });
    });

    // 初始获取网络状态
    NetInfo.fetch().then(state => {
      setNetworkStatus({
        isConnected: state.isConnected,
        connectionType: state.type,
        isInternetReachable: state.isInternetReachable,
      });
    });

    // 清理订阅
    return () => {
      unsubscribe();
    };
  }, []);

  return networkStatus;
}

export default useNetworkStatus;
