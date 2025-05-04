/**
 * 样式常量
 * 提供全局样式常量，包括间距、排版等
 */

// 导入已有的常量
import { SPACING as DimensionsSpacing, FONT_SIZE } from '../utils/constants/dimensions';
import { COLORS } from '../utils/constants/colors';

// 导出间距常量
export const SPACING = {
  ...DimensionsSpacing
};

// 导出排版常量
export const TYPOGRAPHY = {
  FONT_SIZE_TINY: FONT_SIZE.CAPTION,
  FONT_SIZE_SMALL: FONT_SIZE.BODY_SMALL,
  FONT_SIZE_MEDIUM: FONT_SIZE.BODY,
  FONT_SIZE_LARGE: FONT_SIZE.TITLE_SMALL,
  FONT_SIZE_XLARGE: FONT_SIZE.TITLE,
  FONT_SIZE_XXLARGE: FONT_SIZE.TITLE_LARGE,
  
  FONT_WEIGHT_LIGHT: '300',
  FONT_WEIGHT_REGULAR: '400',
  FONT_WEIGHT_MEDIUM: '500',
  FONT_WEIGHT_BOLD: '700',
  
  LINE_HEIGHT_TIGHT: 1.2,
  LINE_HEIGHT_NORMAL: 1.5,
  LINE_HEIGHT_LOOSE: 1.8,
};

// 导出颜色常量
export const COLORS_CONSTANTS = COLORS;

// 导出边框常量
export const BORDERS = {
  RADIUS_SMALL: 4,
  RADIUS_MEDIUM: 8,
  RADIUS_LARGE: 16,
  RADIUS_XLARGE: 24,
  RADIUS_ROUND: 999,
  
  WIDTH_THIN: 0.5,
  WIDTH_NORMAL: 1,
  WIDTH_THICK: 2,
};

// 导出阴影常量
export const SHADOWS = {
  LIGHT: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  MEDIUM: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  HEAVY: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 5,
  },
};

// 导出动画常量
export const ANIMATIONS = {
  DURATION_SHORT: 200,
  DURATION_MEDIUM: 300,
  DURATION_LONG: 500,
};

// 导出默认样式
export default {
  SPACING,
  TYPOGRAPHY,
  COLORS: COLORS_CONSTANTS,
  BORDERS,
  SHADOWS,
  ANIMATIONS,
};
