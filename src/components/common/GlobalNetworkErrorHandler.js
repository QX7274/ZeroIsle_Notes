/**
 * 全局网络错误处理器组件
 * 用于在所有页面显示网络错误弹窗
 */

import React, { useState, useEffect } from 'react';
import NetworkErrorAlert from './NetworkErrorAlert';
import networkErrorService from '../../services/networkErrorService';

const GlobalNetworkErrorHandler = () => {
  const [currentError, setCurrentError] = useState(null);
  const [currentOptions, setCurrentOptions] = useState(null);

  useEffect(() => {
    console.log('GlobalNetworkErrorHandler: 组件已挂载，正在注册全局错误监听器');

    // 添加全局错误监听器
    const handleGlobalError = (error, options) => {
      console.log('GlobalNetworkErrorHandler: 收到全局网络错误:', {
        error: error?.message || error,
        options,
        timestamp: new Date().toISOString(),
      });

      setCurrentError(error);
      setCurrentOptions(options);
    };

    networkErrorService.addGlobalErrorListener(handleGlobalError);
    console.log('GlobalNetworkErrorHandler: 全局错误监听器注册成功');

    // 清理监听器
    return () => {
      console.log('GlobalNetworkErrorHandler: 组件卸载，清理全局错误监听器');
      networkErrorService.removeGlobalErrorListener(handleGlobalError);
    };
  }, []);

  const handleDismiss = () => {
    console.log('GlobalNetworkErrorHandler: 用户关闭错误弹窗');
    setCurrentError(null);
    setCurrentOptions(null);
    networkErrorService.clearCurrentError();
  };

  const handleRetry = () => {
    console.log('GlobalNetworkErrorHandler: 用户点击重试按钮');
    try {
      if (currentOptions?.onRetry) {
        currentOptions.onRetry();
      }
    } finally {
      handleDismiss();
    }
  };

  if (!currentError) {
    return null;
  }

  return (
    <NetworkErrorAlert
      visible={true}
      error={currentError}
      onRetry={currentOptions?.onRetry ? handleRetry : undefined}
      onDismiss={handleDismiss}
    />
  );
};

export default GlobalNetworkErrorHandler;
