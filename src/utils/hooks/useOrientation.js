/**
 * 屏幕方向监听钩子
 * 用于监听屏幕方向变化，并返回当前屏幕方向
 */

import { useState, useEffect } from 'react';
import { Dimensions } from 'react-native';

/**
 * 屏幕方向枚举
 */
export const ORIENTATION = {
  PORTRAIT: 'portrait',
  LANDSCAPE: 'landscape',
};

/**
 * 屏幕方向监听钩子
 * @returns {Object} 包含当前屏幕方向的对象
 */
const useOrientation = () => {
  // 获取初始屏幕尺寸
  const [screenInfo, setScreenInfo] = useState(Dimensions.get('window'));

  // 根据屏幕尺寸判断当前方向
  const isPortrait = screenInfo.height >= screenInfo.width;
  const isLandscape = screenInfo.width > screenInfo.height;

  // 监听屏幕尺寸变化
  useEffect(() => {
    const onChange = ({ window }) => {
      setScreenInfo(window);
    };

    // 添加监听器
    const subscription = Dimensions.addEventListener('change', onChange);

    // 清理函数
    return () => {
      // 移除监听器
      subscription.remove();
    };
  }, []);

  return {
    orientation: isPortrait ? ORIENTATION.PORTRAIT : ORIENTATION.LANDSCAPE,
    isPortrait,
    isLandscape,
    screenWidth: screenInfo.width,
    screenHeight: screenInfo.height,
  };
};

export default useOrientation;
