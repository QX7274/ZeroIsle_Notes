/**
 * 应用颜色配置
 * 定义了应用中使用的所有颜色
 * 采用更现代化的配色方案
 */

// 主色调 - 使用更鲜明的蓝色
export const PRIMARY = {
  LIGHTEST: '#E3F2FD',
  LIGHTER: '#90CAF9',
  LIGHT: '#4A6FE3',
  DEFAULT: '#2196F3',
  DARK: '#1976D2',
  DARKER: '#0D47A1',
  CONTRAST: '#FFFFFF',
};

// 次要色调 - 使用更温暖的橙色
export const SECONDARY = {
  LIGHTEST: '#FFF3E0',
  LIGHTER: '#FFCC80',
  LIGHT: '#FF9800',
  DEFAULT: '#F57C00',
  DARK: '#E65100',
  DARKER: '#BF360C',
  CONTRAST: '#FFFFFF',
};

// 成功状态 - 使用更鲜明的绿色
export const SUCCESS = {
  LIGHTEST: '#E8F5E9',
  LIGHTER: '#A5D6A7',
  LIGHT: '#66BB6A',
  DEFAULT: '#4CAF50',
  DARK: '#388E3C',
  DARKER: '#1B5E20',
  CONTRAST: '#FFFFFF',
};

// 信息状态 - 使用更清新的蓝色
export const INFO = {
  LIGHTEST: '#E1F5FE',
  LIGHTER: '#81D4FA',
  LIGHT: '#29B6F6',
  DEFAULT: '#03A9F4',
  DARK: '#0288D1',
  DARKER: '#01579B',
  CONTRAST: '#FFFFFF',
};

// 警告状态 - 使用更明亮的黄色
export const WARNING = {
  LIGHTEST: '#FFFDE7',
  LIGHTER: '#FFF59D',
  LIGHT: '#FFEE58',
  DEFAULT: '#FFEB3B',
  DARK: '#FDD835',
  DARKER: '#F57F17',
  CONTRAST: '#000000',
};

// 错误状态 - 使用更鲜明的红色
export const ERROR = {
  LIGHTEST: '#FFEBEE',
  LIGHTER: '#EF9A9A',
  LIGHT: '#EF5350',
  DEFAULT: '#F44336',
  DARK: '#D32F2F',
  DARKER: '#B71C1C',
  CONTRAST: '#FFFFFF',
};

// 中性色 - 更精细的灰度梯度
export const NEUTRAL = {
  WHITE: '#FFFFFF',
  LIGHTEST: '#FAFAFA',
  LIGHTER: '#F5F5F5',
  LIGHT: '#EEEEEE',
  MEDIUM_LIGHT: '#E0E0E0',
  DEFAULT: '#9E9E9E',
  MEDIUM_DARK: '#757575',
  DARK: '#616161',
  DARKER: '#424242',
  DARKEST: '#212121',
  BLACK: '#000000',
};

// 背景色 - 更舒适的背景色调
export const BACKGROUND = {
  LIGHT: '#FFFFFF',
  LIGHT_ACCENT: '#F8F9FA',
  DEFAULT: '#F5F5F5',
  DARK_ACCENT: '#1E1E1E',
  DARK: '#121212',
};

// 文本色 - 更精细的文本色调
export const TEXT = {
  LIGHT: {
    PRIMARY: 'rgba(0, 0, 0, 0.87)',
    SECONDARY: 'rgba(0, 0, 0, 0.6)',
    TERTIARY: 'rgba(0, 0, 0, 0.54)',
    DISABLED: 'rgba(0, 0, 0, 0.38)',
    HINT: 'rgba(0, 0, 0, 0.38)',
    LINK: '#2196F3',
    LINK_HOVER: '#1976D2',
  },
  DARK: {
    PRIMARY: 'rgba(255, 255, 255, 1)',
    SECONDARY: 'rgba(255, 255, 255, 0.7)',
    TERTIARY: 'rgba(255, 255, 255, 0.6)',
    DISABLED: 'rgba(255, 255, 255, 0.5)',
    HINT: 'rgba(255, 255, 255, 0.5)',
    LINK: '#90CAF9',
    LINK_HOVER: '#64B5F6',
  },
};

// 分隔线色 - 更细微的分隔线
export const DIVIDER = {
  LIGHT: 'rgba(0, 0, 0, 0.12)',
  LIGHT_SUBTLE: 'rgba(0, 0, 0, 0.08)',
  DARK: 'rgba(255, 255, 255, 0.12)',
  DARK_SUBTLE: 'rgba(255, 255, 255, 0.08)',
};

// 阴影色 - 更丰富的阴影层次
export const SHADOW = {
  LIGHT: 'rgba(0, 0, 0, 0.1)',
  LIGHT_MEDIUM: 'rgba(0, 0, 0, 0.15)',
  MEDIUM: 'rgba(0, 0, 0, 0.2)',
  MEDIUM_DARK: 'rgba(0, 0, 0, 0.3)',
  DARK: 'rgba(0, 0, 0, 0.4)',
  DARKEST: 'rgba(0, 0, 0, 0.5)',
};

// 渐变色 - 更现代的渐变配色
export const GRADIENT = {
  PRIMARY: ['#2196F3', '#1976D2'],
  PRIMARY_ACCENT: ['#90CAF9', '#2196F3'],
  SECONDARY: ['#FF9800', '#F57C00'],
  SECONDARY_ACCENT: ['#FFCC80', '#FF9800'],
  SUCCESS: ['#4CAF50', '#388E3C'],
  SUCCESS_ACCENT: ['#A5D6A7', '#4CAF50'],
  INFO: ['#03A9F4', '#0288D1'],
  INFO_ACCENT: ['#81D4FA', '#03A9F4'],
  WARNING: ['#FFEB3B', '#FDD835'],
  WARNING_ACCENT: ['#FFF59D', '#FFEB3B'],
  ERROR: ['#F44336', '#D32F2F'],
  ERROR_ACCENT: ['#EF9A9A', '#F44336'],
  DARK: ['#424242', '#212121'],
  LIGHT: ['#FAFAFA', '#F5F5F5'],
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
