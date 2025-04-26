/**
 * 排版配置
 * 定义了应用中使用的所有字体样式
 */
import { Platform } from 'react-native';
import { FONT_SIZE, LINE_HEIGHT } from './dimensions';

// 字体家族
export const FONT_FAMILY = {
  REGULAR: Platform.select({
    ios: 'System',
    android: 'Roboto',
    default: 'System',
  }),
  MEDIUM: Platform.select({
    ios: 'System',
    android: 'Roboto-Medium',
    default: 'System',
  }),
  BOLD: Platform.select({
    ios: 'System',
    android: 'Roboto-Bold',
    default: 'System',
  }),
  LIGHT: Platform.select({
    ios: 'System',
    android: 'Roboto-Light',
    default: 'System',
  }),
};

// 字体权重
export const FONT_WEIGHT = {
  THIN: '100',
  EXTRA_LIGHT: '200',
  LIGHT: '300',
  REGULAR: '400',
  MEDIUM: '500',
  SEMI_BOLD: '600',
  BOLD: '700',
  EXTRA_BOLD: '800',
  BLACK: '900',
};

// 标题样式
export const HEADING = {
  H1: {
    fontFamily: FONT_FAMILY.BOLD,
    fontSize: FONT_SIZE.XXXLARGE,
    lineHeight: LINE_HEIGHT.XXXLARGE,
    fontWeight: FONT_WEIGHT.BOLD,
    letterSpacing: -0.5,
  },
  H2: {
    fontFamily: FONT_FAMILY.BOLD,
    fontSize: FONT_SIZE.XXLARGE,
    lineHeight: LINE_HEIGHT.XXLARGE,
    fontWeight: FONT_WEIGHT.BOLD,
    letterSpacing: -0.25,
  },
  H3: {
    fontFamily: FONT_FAMILY.BOLD,
    fontSize: FONT_SIZE.XLARGE,
    lineHeight: LINE_HEIGHT.XLARGE,
    fontWeight: FONT_WEIGHT.BOLD,
    letterSpacing: 0,
  },
  H4: {
    fontFamily: FONT_FAMILY.MEDIUM,
    fontSize: FONT_SIZE.LARGE,
    lineHeight: LINE_HEIGHT.LARGE,
    fontWeight: FONT_WEIGHT.MEDIUM,
    letterSpacing: 0.25,
  },
  H5: {
    fontFamily: FONT_FAMILY.MEDIUM,
    fontSize: FONT_SIZE.REGULAR,
    lineHeight: LINE_HEIGHT.REGULAR,
    fontWeight: FONT_WEIGHT.MEDIUM,
    letterSpacing: 0,
  },
  H6: {
    fontFamily: FONT_FAMILY.MEDIUM,
    fontSize: FONT_SIZE.MEDIUM,
    lineHeight: LINE_HEIGHT.MEDIUM,
    fontWeight: FONT_WEIGHT.MEDIUM,
    letterSpacing: 0.15,
  },
};

// 正文样式
export const BODY = {
  LARGE: {
    fontFamily: FONT_FAMILY.REGULAR,
    fontSize: FONT_SIZE.REGULAR,
    lineHeight: LINE_HEIGHT.REGULAR,
    fontWeight: FONT_WEIGHT.REGULAR,
    letterSpacing: 0.5,
  },
  MEDIUM: {
    fontFamily: FONT_FAMILY.REGULAR,
    fontSize: FONT_SIZE.MEDIUM,
    lineHeight: LINE_HEIGHT.MEDIUM,
    fontWeight: FONT_WEIGHT.REGULAR,
    letterSpacing: 0.25,
  },
  SMALL: {
    fontFamily: FONT_FAMILY.REGULAR,
    fontSize: FONT_SIZE.SMALL,
    lineHeight: LINE_HEIGHT.SMALL,
    fontWeight: FONT_WEIGHT.REGULAR,
    letterSpacing: 0.4,
  },
  TINY: {
    fontFamily: FONT_FAMILY.REGULAR,
    fontSize: FONT_SIZE.TINY,
    lineHeight: LINE_HEIGHT.TINY,
    fontWeight: FONT_WEIGHT.REGULAR,
    letterSpacing: 0.4,
  },
};

// 按钮样式
export const BUTTON = {
  LARGE: {
    fontFamily: FONT_FAMILY.MEDIUM,
    fontSize: FONT_SIZE.REGULAR,
    lineHeight: LINE_HEIGHT.REGULAR,
    fontWeight: FONT_WEIGHT.MEDIUM,
    letterSpacing: 0.75,
    textTransform: 'uppercase',
  },
  MEDIUM: {
    fontFamily: FONT_FAMILY.MEDIUM,
    fontSize: FONT_SIZE.MEDIUM,
    lineHeight: LINE_HEIGHT.MEDIUM,
    fontWeight: FONT_WEIGHT.MEDIUM,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  SMALL: {
    fontFamily: FONT_FAMILY.MEDIUM,
    fontSize: FONT_SIZE.SMALL,
    lineHeight: LINE_HEIGHT.SMALL,
    fontWeight: FONT_WEIGHT.MEDIUM,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
};

// 标签样式
export const LABEL = {
  LARGE: {
    fontFamily: FONT_FAMILY.MEDIUM,
    fontSize: FONT_SIZE.MEDIUM,
    lineHeight: LINE_HEIGHT.MEDIUM,
    fontWeight: FONT_WEIGHT.MEDIUM,
    letterSpacing: 0.1,
  },
  MEDIUM: {
    fontFamily: FONT_FAMILY.MEDIUM,
    fontSize: FONT_SIZE.SMALL,
    lineHeight: LINE_HEIGHT.SMALL,
    fontWeight: FONT_WEIGHT.MEDIUM,
    letterSpacing: 0.5,
  },
  SMALL: {
    fontFamily: FONT_FAMILY.MEDIUM,
    fontSize: FONT_SIZE.TINY,
    lineHeight: LINE_HEIGHT.TINY,
    fontWeight: FONT_WEIGHT.MEDIUM,
    letterSpacing: 0.5,
  },
};

// 导出所有排版样式
export default {
  FONT_FAMILY,
  FONT_WEIGHT,
  HEADING,
  BODY,
  BUTTON,
  LABEL,
};
