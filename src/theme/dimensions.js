/**
 * 应用尺寸配置
 * 定义了应用中使用的所有尺寸
 */
import { Dimensions, PixelRatio, Platform } from 'react-native';

// 获取屏幕尺寸
export const SCREEN_WIDTH = Dimensions.get('window').width;
export const SCREEN_HEIGHT = Dimensions.get('window').height;

// 基准尺寸，用于计算响应式尺寸
const BASE_WIDTH = 375; // iPhone 6/7/8 的宽度
const BASE_HEIGHT = 667; // iPhone 6/7/8 的高度

// 计算响应式尺寸
export const scale = (size) => (SCREEN_WIDTH / BASE_WIDTH) * size;
export const verticalScale = (size) => (SCREEN_HEIGHT / BASE_HEIGHT) * size;
export const moderateScale = (size, factor = 0.5) => size + (scale(size) - size) * factor;

// 字体大小
export const FONT_SIZE = {
  TINY: moderateScale(8),
  SMALL: moderateScale(10),
  MEDIUM: moderateScale(12),
  REGULAR: moderateScale(14),
  LARGE: moderateScale(16),
  XLARGE: moderateScale(18),
  XXLARGE: moderateScale(22),
  XXXLARGE: moderateScale(26),
};

// 行高
export const LINE_HEIGHT = {
  TINY: moderateScale(12),
  SMALL: moderateScale(15),
  MEDIUM: moderateScale(18),
  REGULAR: moderateScale(20),
  LARGE: moderateScale(24),
  XLARGE: moderateScale(26),
  XXLARGE: moderateScale(32),
  XXXLARGE: moderateScale(38),
};

// 间距
export const SPACING = {
  TINY: moderateScale(2),
  XSMALL: moderateScale(4),
  SMALL: moderateScale(8),
  MEDIUM: moderateScale(12),
  REGULAR: moderateScale(16),
  LARGE: moderateScale(24),
  XLARGE: moderateScale(32),
  XXLARGE: moderateScale(48),
  XXXLARGE: moderateScale(64),
};

// 边框圆角
export const BORDER_RADIUS = {
  TINY: moderateScale(2),
  SMALL: moderateScale(4),
  MEDIUM: moderateScale(8),
  REGULAR: moderateScale(12),
  LARGE: moderateScale(16),
  XLARGE: moderateScale(24),
  XXLARGE: moderateScale(32),
  CIRCLE: 9999,
};

// 边框宽度
export const BORDER_WIDTH = {
  THIN: 0.5,
  REGULAR: 1,
  THICK: 2,
  XTHICK: 4,
};

// 阴影
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
  XLARGE: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.37,
    shadowRadius: 7.49,
    elevation: 12,
  },
};

// 图标尺寸
export const ICON_SIZE = {
  TINY: moderateScale(12),
  SMALL: moderateScale(16),
  MEDIUM: moderateScale(20),
  REGULAR: moderateScale(24),
  LARGE: moderateScale(32),
  XLARGE: moderateScale(48),
  XXLARGE: moderateScale(64),
};

// 按钮尺寸
export const BUTTON = {
  SMALL: {
    height: moderateScale(32),
    paddingHorizontal: SPACING.MEDIUM,
    borderRadius: BORDER_RADIUS.SMALL,
    fontSize: FONT_SIZE.SMALL,
  },
  MEDIUM: {
    height: moderateScale(40),
    paddingHorizontal: SPACING.REGULAR,
    borderRadius: BORDER_RADIUS.MEDIUM,
    fontSize: FONT_SIZE.MEDIUM,
  },
  LARGE: {
    height: moderateScale(48),
    paddingHorizontal: SPACING.LARGE,
    borderRadius: BORDER_RADIUS.REGULAR,
    fontSize: FONT_SIZE.REGULAR,
  },
  XLARGE: {
    height: moderateScale(56),
    paddingHorizontal: SPACING.XLARGE,
    borderRadius: BORDER_RADIUS.LARGE,
    fontSize: FONT_SIZE.LARGE,
  },
};

// 输入框尺寸
export const INPUT = {
  SMALL: {
    height: moderateScale(32),
    paddingHorizontal: SPACING.MEDIUM,
    borderRadius: BORDER_RADIUS.SMALL,
    fontSize: FONT_SIZE.SMALL,
  },
  MEDIUM: {
    height: moderateScale(40),
    paddingHorizontal: SPACING.REGULAR,
    borderRadius: BORDER_RADIUS.MEDIUM,
    fontSize: FONT_SIZE.MEDIUM,
  },
  LARGE: {
    height: moderateScale(48),
    paddingHorizontal: SPACING.LARGE,
    borderRadius: BORDER_RADIUS.REGULAR,
    fontSize: FONT_SIZE.REGULAR,
  },
  XLARGE: {
    height: moderateScale(56),
    paddingHorizontal: SPACING.XLARGE,
    borderRadius: BORDER_RADIUS.LARGE,
    fontSize: FONT_SIZE.LARGE,
  },
};

// 卡片尺寸
export const CARD = {
  PADDING: SPACING.REGULAR,
  BORDER_RADIUS: BORDER_RADIUS.REGULAR,
  MARGIN: SPACING.MEDIUM,
};

// 导出所有尺寸
export default {
  SCREEN_WIDTH,
  SCREEN_HEIGHT,
  scale,
  verticalScale,
  moderateScale,
  FONT_SIZE,
  LINE_HEIGHT,
  SPACING,
  BORDER_RADIUS,
  BORDER_WIDTH,
  SHADOW,
  ICON_SIZE,
  BUTTON,
  INPUT,
  CARD,
};
