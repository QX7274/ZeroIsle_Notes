/**
 * 现代化主题配置
 * 提供更现代、更美观的UI主题
 * 采用更丰富的色彩、更大的圆角和更精致的阴影效果
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
    // 主色调 - 使用更现代的色彩方案
    primary: '#4361EE',
    secondary: '#3A0CA3',
    background: '#FFFFFF',
    card: '#FFFFFF',
    text: '#1A1A2E',
    border: '#E9ECEF',
    notification: '#F72585',
    // 自定义颜色 - 更鲜明的色彩
    success: '#06D6A0',
    info: '#4895EF',
    warning: '#FFD166',
    error: '#EF476F',
    textSecondary: '#6C757D',
    textDisabled: '#ADB5BD',
    textHint: '#6C757D',
    divider: '#E9ECEF',
    shadow: 'rgba(0, 0, 0, 0.1)',
    // 渐变色 - 更丰富的渐变效果
    gradient: {
      primary: ['#4361EE', '#3A0CA3'],
      secondary: ['#7209B7', '#3A0CA3'],
      success: ['#06D6A0', '#0CB885'],
      error: ['#EF476F', '#D64161'],
      warning: ['#FFD166', '#F9C74F'],
      info: ['#4895EF', '#4361EE'],
      cool: ['#4CC9F0', '#4361EE'],
      warm: ['#F72585', '#F8961E'],
      sunset: ['#F72585', '#F8961E'],
      ocean: ['#4CC9F0', '#06D6A0'],
      forest: ['#06D6A0', '#118AB2'],
      royal: ['#7209B7', '#3A0CA3'],
    },
    // 卡片和表面 - 增加微妙的层次感
    surface: '#FFFFFF',
    surfaceVariant: '#F8F9FA',
    surfaceAccent: '#F0F7FF',
    elevation: {
      level1: '#FFFFFF',
      level2: '#FAFAFA',
      level3: '#F5F5F5',
      level4: '#F0F0F0',
      level5: '#EBEBEB',
    },
    // 玻璃拟态效果颜色
    glass: {
      background: 'rgba(255, 255, 255, 0.7)',
      border: 'rgba(255, 255, 255, 0.8)',
      shadow: 'rgba(0, 0, 0, 0.05)',
    },
    // 强调色
    accent1: '#F72585',
    accent2: '#7209B7',
    accent3: '#4CC9F0',
  },
  // 尺寸
  dimensions: {
    ...dimensions,
    // 更新圆角尺寸，使用更大的值
    BORDER_RADIUS: {
      ...dimensions.BORDER_RADIUS,
      SMALL: 10,
      MEDIUM: 14,
      LARGE: 20,
      XLARGE: 28,
      PILL: 9999,
    },
    // 更新阴影，使用更精致的阴影
    SHADOW: {
      SMALL: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 2,
      },
      MEDIUM: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 4,
      },
      LARGE: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1,
        shadowRadius: 16,
        elevation: 8,
      },
      XLARGE: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.12,
        shadowRadius: 24,
        elevation: 16,
      },
    },
    // 更新间距，使布局更加宽松
    SPACING: {
      ...dimensions.SPACING,
      MEDIUM: 14,
      REGULAR: 18,
      LARGE: 26,
      XLARGE: 36,
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
    // 更新字体大小，使用更协调的比例
    FONT_SIZE: {
      ...typography.FONT_SIZE,
      REGULAR: dimensions.moderateScale(15),
      LARGE: dimensions.moderateScale(17),
      XLARGE: dimensions.moderateScale(20),
    },
  },
  // 动画
  animation: {
    scale: 1.0,
    timing: {
      fast: 180,
      normal: 250,
      slow: 400,
      verySlow: 600,
    },
    easing: {
      easeOut: 'cubic-bezier(0.2, 0.0, 0, 1.0)',
      easeIn: 'cubic-bezier(0.4, 0.0, 1, 1)',
      standard: 'cubic-bezier(0.4, 0.0, 0.2, 1)',
    },
  },
};

// 深色主题
export const modernDarkTheme = {
  ...DarkTheme,
  dark: true,
  colors: {
    ...DarkTheme.colors,
    // 主色调 - 使用更现代的色彩方案
    primary: '#4CC9F0',
    secondary: '#7209B7',
    background: '#121212',
    card: '#1E1E1E',
    text: '#F8F9FA',
    border: '#2A2A2A',
    notification: '#F72585',
    // 自定义颜色 - 更鲜明的色彩
    success: '#06D6A0',
    info: '#4895EF',
    warning: '#FFD166',
    error: '#EF476F',
    textSecondary: '#ADB5BD',
    textDisabled: '#6C757D',
    textHint: '#ADB5BD',
    divider: '#2A2A2A',
    shadow: 'rgba(0, 0, 0, 0.3)',
    // 渐变色 - 更丰富的渐变效果
    gradient: {
      primary: ['#4CC9F0', '#4361EE'],
      secondary: ['#7209B7', '#560BAD'],
      success: ['#06D6A0', '#0CB885'],
      error: ['#EF476F', '#D64161'],
      warning: ['#FFD166', '#F9C74F'],
      info: ['#4895EF', '#4361EE'],
      cool: ['#4CC9F0', '#4361EE'],
      warm: ['#F72585', '#F8961E'],
      sunset: ['#F72585', '#F8961E'],
      ocean: ['#4CC9F0', '#06D6A0'],
      forest: ['#06D6A0', '#118AB2'],
      royal: ['#7209B7', '#3A0CA3'],
    },
    // 卡片和表面 - 增加微妙的层次感
    surface: '#1E1E1E',
    surfaceVariant: '#2A2A2A',
    surfaceAccent: '#252836',
    elevation: {
      level1: '#1E1E1E',
      level2: '#222222',
      level3: '#252525',
      level4: '#272727',
      level5: '#2A2A2A',
    },
    // 玻璃拟态效果颜色
    glass: {
      background: 'rgba(30, 30, 30, 0.7)',
      border: 'rgba(40, 40, 40, 0.8)',
      shadow: 'rgba(0, 0, 0, 0.2)',
    },
    // 强调色
    accent1: '#F72585',
    accent2: '#7209B7',
    accent3: '#4CC9F0',
  },
  // 尺寸
  dimensions: {
    ...dimensions,
    // 更新圆角尺寸，使用更大的值
    BORDER_RADIUS: {
      ...dimensions.BORDER_RADIUS,
      SMALL: 10,
      MEDIUM: 14,
      LARGE: 20,
      XLARGE: 28,
      PILL: 9999,
    },
    // 更新阴影，使用更精致的阴影
    SHADOW: {
      SMALL: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 2,
      },
      MEDIUM: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 4,
      },
      LARGE: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 8,
      },
      XLARGE: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.35,
        shadowRadius: 24,
        elevation: 16,
      },
    },
    // 更新间距，使布局更加宽松
    SPACING: {
      ...dimensions.SPACING,
      MEDIUM: 14,
      REGULAR: 18,
      LARGE: 26,
      XLARGE: 36,
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
    // 更新字体大小，使用更协调的比例
    FONT_SIZE: {
      ...typography.FONT_SIZE,
      REGULAR: dimensions.moderateScale(15),
      LARGE: dimensions.moderateScale(17),
      XLARGE: dimensions.moderateScale(20),
    },
  },
  // 动画
  animation: {
    scale: 1.0,
    timing: {
      fast: 180,
      normal: 250,
      slow: 400,
      verySlow: 600,
    },
    easing: {
      easeOut: 'cubic-bezier(0.2, 0.0, 0, 1.0)',
      easeIn: 'cubic-bezier(0.4, 0.0, 1, 1)',
      standard: 'cubic-bezier(0.4, 0.0, 0.2, 1)',
    },
  },
};

// 导出主题
export default {
  light: modernLightTheme,
  dark: modernDarkTheme,
};
