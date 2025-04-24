/**
 * 零屿笔记应用尺寸常量
 * 用于保持UI在不同设备上的一致性
 */

import { Dimensions, Platform, StatusBar } from 'react-native';

const { width, height } = Dimensions.get('window');

// 设备类型判断
export const isIOS = Platform.OS === 'ios';
export const isAndroid = Platform.OS === 'android';
export const isTablet = width > 600; // 简单判断是否为平板

// 屏幕尺寸
export const SCREEN_WIDTH = width;
export const SCREEN_HEIGHT = height;

// 状态栏高度
export const STATUS_BAR_HEIGHT = isIOS ? 44 : StatusBar.currentHeight;

// 导航栏高度
export const HEADER_HEIGHT = isIOS ? 44 : 56;

// 底部标签栏高度
export const TAB_BAR_HEIGHT = isIOS ? 49 : 56;

// 安全区域
export const SAFE_AREA_BOTTOM = isIOS ? 34 : 0;

// 字体大小
export const FONT_SIZE = {
  TITLE_LARGE: 34,
  TITLE: 28,
  TITLE_SMALL: 22,
  BODY: 17,
  BODY_SMALL: 15,
  CAPTION: 13,
};

// 间距
export const SPACING = {
  TINY: 4,
  SMALL: 8,
  MEDIUM: 16,
  LARGE: 24,
  XLARGE: 32,
  XXLARGE: 48,
};

// 为了兼容现有代码，添加小写版本的spacing
export const spacing = {
  tiny: 4,
  small: 8,
  medium: 16,
  large: 24,
  extraLarge: 32, // 对应XLARGE
  xxlarge: 48,
};

// 为了兼容现有代码，添加小写版本的borderRadius
export const borderRadius = {
  small: 4,
  medium: 8,
  large: 16,
  xlarge: 24,
  round: 999,
};


// 圆角
export const BORDER_RADIUS = {
  SMALL: 4,
  MEDIUM: 8,
  LARGE: 16,
  XLARGE: 24,
  ROUND: 999, // 用于圆形
};

// 阴影 (iOS风格)
export const SHADOW = {
  SMALL: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    elevation: 2,
  },
  MEDIUM: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.23,
    shadowRadius: 2.62,
    elevation: 4,
  },
  LARGE: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
};

// 响应式尺寸计算
export const getResponsiveSize = (size) => {
  const standardScreenWidth = 375; // iPhone 8/X 宽度作为标准
  const scale = SCREEN_WIDTH / standardScreenWidth;
  return Math.round(size * scale);
};