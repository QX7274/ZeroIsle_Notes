/**
 * 样式工具函数
 * 用于在React Native中创建一致的样式
 */

import { StyleSheet, Platform, Dimensions } from 'react-native';
import { SPACING, BORDER_RADIUS, SHADOW, FONT_SIZE } from './constants/dimensions';

const { width, height } = Dimensions.get('window');

/**
 * 创建阴影样式
 * @param {string} elevation - 阴影高度：small, medium, large
 * @param {string} color - 阴影颜色
 * @returns {Object} - 阴影样式对象
 */
export const createShadow = (elevation = 'medium', color = '#000000') => {
  switch (elevation) {
    case 'small':
      return {
        ...SHADOW.SMALL,
        shadowColor: color,
      };
    case 'large':
      return {
        ...SHADOW.LARGE,
        shadowColor: color,
      };
    case 'medium':
    default:
      return {
        ...SHADOW.MEDIUM,
        shadowColor: color,
      };
  }
};

/**
 * 创建渐变背景样式
 * @param {string} direction - 渐变方向：horizontal, vertical, diagonal, reverseDiagonal
 * @returns {Object} - 渐变样式对象
 */
export const createGradientBackground = (direction = 'horizontal') => {
  switch (direction) {
    case 'vertical':
      return {
        start: { x: 0, y: 0 },
        end: { x: 0, y: 1 },
      };
    case 'diagonal':
      return {
        start: { x: 0, y: 0 },
        end: { x: 1, y: 1 },
      };
    case 'reverseDiagonal':
      return {
        start: { x: 1, y: 0 },
        end: { x: 0, y: 1 },
      };
    case 'horizontal':
    default:
      return {
        start: { x: 0, y: 0 },
        end: { x: 1, y: 0 },
      };
  }
};

/**
 * 创建圆角样式
 * @param {string} size - 圆角大小：small, medium, large, xlarge, round
 * @returns {Object} - 圆角样式对象
 */
export const createBorderRadius = (size = 'medium') => {
  switch (size) {
    case 'small':
      return { borderRadius: BORDER_RADIUS.SMALL };
    case 'large':
      return { borderRadius: BORDER_RADIUS.LARGE };
    case 'xlarge':
      return { borderRadius: BORDER_RADIUS.XLARGE };
    case 'round':
      return { borderRadius: BORDER_RADIUS.ROUND };
    case 'medium':
    default:
      return { borderRadius: BORDER_RADIUS.MEDIUM };
  }
};

/**
 * 创建间距样式
 * @param {string} size - 间距大小：tiny, small, medium, large, xlarge, xxlarge
 * @param {string} type - 间距类型：margin, padding
 * @param {string} direction - 间距方向：all, horizontal, vertical, top, right, bottom, left
 * @returns {Object} - 间距样式对象
 */
export const createSpacing = (size = 'medium', type = 'margin', direction = 'all') => {
  let spacing;
  
  switch (size) {
    case 'tiny':
      spacing = SPACING.TINY;
      break;
    case 'small':
      spacing = SPACING.SMALL;
      break;
    case 'large':
      spacing = SPACING.LARGE;
      break;
    case 'xlarge':
      spacing = SPACING.XLARGE;
      break;
    case 'xxlarge':
      spacing = SPACING.XXLARGE;
      break;
    case 'medium':
    default:
      spacing = SPACING.MEDIUM;
      break;
  }
  
  const prefix = type === 'padding' ? 'padding' : 'margin';
  
  switch (direction) {
    case 'horizontal':
      return {
        [`${prefix}Horizontal`]: spacing,
      };
    case 'vertical':
      return {
        [`${prefix}Vertical`]: spacing,
      };
    case 'top':
      return {
        [`${prefix}Top`]: spacing,
      };
    case 'right':
      return {
        [`${prefix}Right`]: spacing,
      };
    case 'bottom':
      return {
        [`${prefix}Bottom`]: spacing,
      };
    case 'left':
      return {
        [`${prefix}Left`]: spacing,
      };
    case 'all':
    default:
      return {
        [prefix]: spacing,
      };
  }
};

/**
 * 创建字体样式
 * @param {string} size - 字体大小：title_large, title, title_small, body, body_small, caption
 * @param {string} weight - 字体粗细：normal, medium, semibold, bold
 * @param {string} color - 字体颜色
 * @returns {Object} - 字体样式对象
 */
export const createTypography = (size = 'body', weight = 'normal', color = '#000000') => {
  let fontSize;
  
  switch (size) {
    case 'title_large':
      fontSize = FONT_SIZE.TITLE_LARGE;
      break;
    case 'title':
      fontSize = FONT_SIZE.TITLE;
      break;
    case 'title_small':
      fontSize = FONT_SIZE.TITLE_SMALL;
      break;
    case 'body_small':
      fontSize = FONT_SIZE.BODY_SMALL;
      break;
    case 'caption':
      fontSize = FONT_SIZE.CAPTION;
      break;
    case 'body':
    default:
      fontSize = FONT_SIZE.BODY;
      break;
  }
  
  let fontWeight;
  
  switch (weight) {
    case 'medium':
      fontWeight = '500';
      break;
    case 'semibold':
      fontWeight = '600';
      break;
    case 'bold':
      fontWeight = '700';
      break;
    case 'normal':
    default:
      fontWeight = 'normal';
      break;
  }
  
  return {
    fontSize,
    fontWeight,
    color,
  };
};

/**
 * 创建响应式样式
 * @param {Object} styles - 样式对象
 * @returns {Object} - 响应式样式对象
 */
export const createResponsiveStyles = (styles) => {
  const isTablet = width > 600;
  
  return StyleSheet.create({
    ...styles,
    container: {
      ...styles.container,
      paddingHorizontal: isTablet ? SPACING.LARGE : SPACING.MEDIUM,
    },
    // 可以根据需要添加更多响应式样式
  });
};

/**
 * 创建玻璃效果样式
 * @param {boolean} isDarkMode - 是否为暗黑模式
 * @param {number} opacity - 不透明度
 * @returns {Object} - 玻璃效果样式对象
 */
export const createGlassEffect = (isDarkMode = false, opacity = 0.7) => {
  return {
    backgroundColor: isDarkMode 
      ? `rgba(30, 30, 30, ${opacity})` 
      : `rgba(255, 255, 255, ${opacity})`,
    backdropFilter: 'blur(10px)',
    ...createBorderRadius('medium'),
    ...createShadow('medium'),
  };
};

/**
 * 创建卡片样式
 * @param {Object} colors - 颜色对象
 * @param {boolean} isDarkMode - 是否为暗黑模式
 * @param {string} elevation - 阴影高度：small, medium, large
 * @returns {Object} - 卡片样式对象
 */
export const createCardStyle = (colors, isDarkMode = false, elevation = 'medium') => {
  return {
    backgroundColor: colors.cardBackground,
    ...createBorderRadius('medium'),
    ...createShadow(elevation, colors.shadow),
    padding: SPACING.MEDIUM,
    borderWidth: isDarkMode ? 1 : 0,
    borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
  };
};

/**
 * 创建按钮样式
 * @param {Object} colors - 颜色对象
 * @param {string} type - 按钮类型：primary, secondary, outline, text
 * @param {boolean} disabled - 是否禁用
 * @returns {Object} - 按钮样式对象
 */
export const createButtonStyle = (colors, type = 'primary', disabled = false) => {
  const baseStyle = {
    ...createBorderRadius('medium'),
    paddingVertical: SPACING.MEDIUM,
    paddingHorizontal: SPACING.LARGE,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  };
  
  if (disabled) {
    return {
      ...baseStyle,
      backgroundColor: 'rgba(0, 0, 0, 0.05)',
      opacity: 0.5,
    };
  }
  
  switch (type) {
    case 'secondary':
      return {
        ...baseStyle,
        backgroundColor: colors.secondary,
      };
    case 'outline':
      return {
        ...baseStyle,
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: colors.primary,
      };
    case 'text':
      return {
        ...baseStyle,
        backgroundColor: 'transparent',
        paddingVertical: SPACING.SMALL,
        paddingHorizontal: SPACING.SMALL,
      };
    case 'primary':
    default:
      return {
        ...baseStyle,
        backgroundColor: colors.primary,
        ...createShadow('small', colors.shadow),
      };
  }
};

/**
 * 创建输入框样式
 * @param {Object} colors - 颜色对象
 * @param {boolean} isFocused - 是否聚焦
 * @param {boolean} hasError - 是否有错误
 * @param {boolean} disabled - 是否禁用
 * @returns {Object} - 输入框样式对象
 */
export const createInputStyle = (colors, isFocused = false, hasError = false, disabled = false) => {
  const baseStyle = {
    ...createBorderRadius('medium'),
    borderWidth: 1,
    paddingHorizontal: SPACING.MEDIUM,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    fontSize: 16,
  };
  
  if (disabled) {
    return {
      ...baseStyle,
      backgroundColor: 'rgba(0, 0, 0, 0.05)',
      borderColor: colors.border,
      color: colors.textSecondary,
    };
  }
  
  if (hasError) {
    return {
      ...baseStyle,
      borderColor: colors.error,
      color: colors.text,
    };
  }
  
  if (isFocused) {
    return {
      ...baseStyle,
      borderColor: colors.primary,
      color: colors.text,
    };
  }
  
  return {
    ...baseStyle,
    borderColor: colors.border,
    color: colors.text,
  };
};

export default {
  createShadow,
  createGradientBackground,
  createBorderRadius,
  createSpacing,
  createTypography,
  createResponsiveStyles,
  createGlassEffect,
  createCardStyle,
  createButtonStyle,
  createInputStyle,
};
