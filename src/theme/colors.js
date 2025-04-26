/**
 * 应用颜色配置
 * 定义了应用中使用的所有颜色
 */

// 主色调
export const PRIMARY = {
  LIGHT: '#4A6FE3',
  DEFAULT: '#3F51B5',
  DARK: '#303F9F',
  CONTRAST: '#FFFFFF',
};

// 次要色调
export const SECONDARY = {
  LIGHT: '#FF8A65',
  DEFAULT: '#FF5722',
  DARK: '#E64A19',
  CONTRAST: '#FFFFFF',
};

// 成功状态
export const SUCCESS = {
  LIGHT: '#81C784',
  DEFAULT: '#4CAF50',
  DARK: '#388E3C',
  CONTRAST: '#FFFFFF',
};

// 信息状态
export const INFO = {
  LIGHT: '#64B5F6',
  DEFAULT: '#2196F3',
  DARK: '#1976D2',
  CONTRAST: '#FFFFFF',
};

// 警告状态
export const WARNING = {
  LIGHT: '#FFD54F',
  DEFAULT: '#FFC107',
  DARK: '#FFA000',
  CONTRAST: '#000000',
};

// 错误状态
export const ERROR = {
  LIGHT: '#E57373',
  DEFAULT: '#F44336',
  DARK: '#D32F2F',
  CONTRAST: '#FFFFFF',
};

// 中性色
export const NEUTRAL = {
  WHITE: '#FFFFFF',
  LIGHTEST: '#F5F5F5',
  LIGHTER: '#EEEEEE',
  LIGHT: '#E0E0E0',
  DEFAULT: '#9E9E9E',
  DARK: '#757575',
  DARKER: '#616161',
  DARKEST: '#424242',
  BLACK: '#212121',
};

// 背景色
export const BACKGROUND = {
  LIGHT: '#FFFFFF',
  DEFAULT: '#F5F5F5',
  DARK: '#303030',
};

// 文本色
export const TEXT = {
  LIGHT: {
    PRIMARY: 'rgba(0, 0, 0, 0.87)',
    SECONDARY: 'rgba(0, 0, 0, 0.6)',
    DISABLED: 'rgba(0, 0, 0, 0.38)',
    HINT: 'rgba(0, 0, 0, 0.38)',
  },
  DARK: {
    PRIMARY: 'rgba(255, 255, 255, 1)',
    SECONDARY: 'rgba(255, 255, 255, 0.7)',
    DISABLED: 'rgba(255, 255, 255, 0.5)',
    HINT: 'rgba(255, 255, 255, 0.5)',
  },
};

// 分隔线色
export const DIVIDER = {
  LIGHT: 'rgba(0, 0, 0, 0.12)',
  DARK: 'rgba(255, 255, 255, 0.12)',
};

// 阴影色
export const SHADOW = {
  LIGHT: 'rgba(0, 0, 0, 0.2)',
  DARK: 'rgba(0, 0, 0, 0.4)',
};

// 渐变色
export const GRADIENT = {
  PRIMARY: ['#4A6FE3', '#3F51B5'],
  SECONDARY: ['#FF8A65', '#FF5722'],
  SUCCESS: ['#81C784', '#4CAF50'],
  INFO: ['#64B5F6', '#2196F3'],
  WARNING: ['#FFD54F', '#FFC107'],
  ERROR: ['#E57373', '#F44336'],
};

// 透明度
export const OPACITY = {
  NONE: 0,
  LOWEST: 0.1,
  LOW: 0.3,
  MEDIUM: 0.5,
  HIGH: 0.7,
  HIGHEST: 0.9,
  FULL: 1,
};

// 导出所有颜色
export default {
  PRIMARY,
  SECONDARY,
  SUCCESS,
  INFO,
  WARNING,
  ERROR,
  NEUTRAL,
  BACKGROUND,
  TEXT,
  DIVIDER,
  SHADOW,
  GRADIENT,
  OPACITY,
};
