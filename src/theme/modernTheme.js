/**
 * 现代化主题配置
 * 提供更现代、更美观的UI主题
 */
import colors from './colors';
import dimensions from './dimensions';
import typography from './typography';
import { DefaultTheme, DarkTheme } from '@react-navigation/native';

// 浅色主题
export const modernLightTheme = {
  ...DefaultTheme,
  dark: false,
  colors: {
    ...DefaultTheme.colors,
    // 主色调 - 使用渐变色的基础色
    primary: '#4361EE',
    secondary: '#3A0CA3',
    background: '#FFFFFF',
    card: '#FFFFFF',
    text: '#1A1A2E',
    border: '#E9ECEF',
    notification: '#F72585',
    // 自定义颜色
    success: '#4CC9F0',
    info: '#4895EF',
    warning: '#F8961E',
    error: '#F72585',
    textSecondary: '#6C757D',
    textDisabled: '#ADB5BD',
    textHint: '#6C757D',
    divider: '#E9ECEF',
    shadow: 'rgba(0, 0, 0, 0.1)',
    // 渐变色
    gradient: {
      primary: ['#4361EE', '#3A0CA3'],
      secondary: ['#7209B7', '#3A0CA3'],
      success: ['#4CC9F0', '#4895EF'],
      error: ['#F72585', '#B5179E'],
      warning: ['#F8961E', '#F3722C'],
    },
    // 卡片和表面
    surface: '#FFFFFF',
    surfaceVariant: '#F8F9FA',
    elevation: {
      level1: '#FFFFFF',
      level2: '#FFFFFF',
      level3: '#FFFFFF',
      level4: '#FFFFFF',
      level5: '#FFFFFF',
    },
  },
  // 尺寸
  dimensions: {
    ...dimensions,
    // 更新圆角尺寸，使用更大的值
    BORDER_RADIUS: {
      ...dimensions.BORDER_RADIUS,
      SMALL: 8,
      MEDIUM: 12,
      LARGE: 16,
      XLARGE: 24,
    },
    // 更新阴影，使用更柔和的阴影
    SHADOW: {
      SMALL: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
      },
      MEDIUM: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 4,
      },
      LARGE: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 8,
      },
      XLARGE: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1,
        shadowRadius: 16,
        elevation: 16,
      },
    },
  },
  // 排版
  typography: {
    ...typography,
    // 更新字体家族，使用更现代的字体
    FONT_FAMILY: {
      ...typography.FONT_FAMILY,
      REGULAR: 'System',
      MEDIUM: 'System',
      BOLD: 'System',
      LIGHT: 'System',
    },
  },
  // 动画
  animation: {
    scale: 1.0,
    timing: {
      fast: 200,
      normal: 300,
      slow: 500,
    },
  },
};

// 深色主题
export const modernDarkTheme = {
  ...DarkTheme,
  dark: true,
  colors: {
    ...DarkTheme.colors,
    // 主色调 - 使用渐变色的基础色
    primary: '#4CC9F0',
    secondary: '#7209B7',
    background: '#121212',
    card: '#1E1E1E',
    text: '#F8F9FA',
    border: '#2A2A2A',
    notification: '#F72585',
    // 自定义颜色
    success: '#4CC9F0',
    info: '#4895EF',
    warning: '#F8961E',
    error: '#F72585',
    textSecondary: '#ADB5BD',
    textDisabled: '#6C757D',
    textHint: '#ADB5BD',
    divider: '#2A2A2A',
    shadow: 'rgba(0, 0, 0, 0.3)',
    // 渐变色
    gradient: {
      primary: ['#4CC9F0', '#4361EE'],
      secondary: ['#7209B7', '#560BAD'],
      success: ['#4CC9F0', '#4895EF'],
      error: ['#F72585', '#B5179E'],
      warning: ['#F8961E', '#F3722C'],
    },
    // 卡片和表面
    surface: '#1E1E1E',
    surfaceVariant: '#2A2A2A',
    elevation: {
      level1: '#1E1E1E',
      level2: '#222222',
      level3: '#252525',
      level4: '#272727',
      level5: '#2A2A2A',
    },
  },
  // 尺寸
  dimensions: {
    ...dimensions,
    // 更新圆角尺寸，使用更大的值
    BORDER_RADIUS: {
      ...dimensions.BORDER_RADIUS,
      SMALL: 8,
      MEDIUM: 12,
      LARGE: 16,
      XLARGE: 24,
    },
    // 更新阴影，使用更强的阴影
    SHADOW: {
      SMALL: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.3,
        shadowRadius: 2,
        elevation: 2,
      },
      MEDIUM: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 4,
      },
      LARGE: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
      },
      XLARGE: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 16,
      },
    },
  },
  // 排版
  typography: {
    ...typography,
    // 更新字体家族，使用更现代的字体
    FONT_FAMILY: {
      ...typography.FONT_FAMILY,
      REGULAR: 'System',
      MEDIUM: 'System',
      BOLD: 'System',
      LIGHT: 'System',
    },
  },
  // 动画
  animation: {
    scale: 1.0,
    timing: {
      fast: 200,
      normal: 300,
      slow: 500,
    },
  },
};

// 导出主题
export default {
  light: modernLightTheme,
  dark: modernDarkTheme,
};
