/**
 * 颜色工具函数
 * 提供颜色处理和验证的辅助函数
 */

/**
 * 默认颜色数组
 * 用于在颜色数组无效或为空时提供备用颜色
 */
export const DEFAULT_COLORS = [
  // 基础颜色
  '#2196F3', // 蓝色
  '#4CAF50', // 绿色
  '#F44336', // 红色
  '#FFC107', // 黄色
  '#9C27B0', // 紫色
  '#FF9800', // 橙色
  '#03A9F4', // 浅蓝色
  '#E91E63', // 粉色
  '#3F51B5', // 靛蓝色
  '#009688', // 蓝绿色
  '#673AB7', // 深紫色
  '#FFEB3B', // 亮黄色
  '#CDDC39', // 酸橙色
  '#795548', // 棕色
  '#607D8B', // 蓝灰色
  '#FF5722', // 深橙色
];

/**
 * 验证颜色值是否有效
 * @param {string} color - 要验证的颜色值
 * @returns {boolean} 颜色是否有效
 */
export const isValidColor = (color) => {
  if (!color) return false;
  
  // 检查是否为有效的十六进制颜色
  if (typeof color === 'string') {
    return /^#([0-9A-F]{3}){1,2}$/i.test(color) || 
           /^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/i.test(color) ||
           /^rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*[\d.]+\s*\)$/i.test(color);
  }
  
  return false;
};

/**
 * 过滤颜色数组，移除无效的颜色
 * @param {Array} colors - 要过滤的颜色数组
 * @returns {Array} 过滤后的颜色数组
 */
export const filterValidColors = (colors) => {
  if (!Array.isArray(colors)) {
    console.warn('颜色数组无效:', colors);
    return [...DEFAULT_COLORS];
  }
  
  const validColors = colors.filter(color => isValidColor(color));
  
  // 如果没有有效颜色，返回默认颜色
  if (validColors.length === 0) {
    console.warn('颜色数组中没有有效颜色，使用默认颜色');
    return [...DEFAULT_COLORS];
  }
  
  return validColors;
};

/**
 * 获取安全的颜色数组
 * @param {Array} colors - 原始颜色数组
 * @returns {Array} 安全的颜色数组
 */
export const getSafeColorArray = (colors) => {
  try {
    // 如果颜色数组无效或为空，使用默认颜色
    if (!colors || !Array.isArray(colors) || colors.length === 0) {
      return [...DEFAULT_COLORS];
    }
    
    // 过滤无效颜色
    return filterValidColors(colors);
  } catch (error) {
    console.error('处理颜色数组失败:', error);
    return [...DEFAULT_COLORS];
  }
};

/**
 * 获取随机颜色
 * @param {Array} excludeColors - 要排除的颜色数组
 * @returns {string} 随机颜色
 */
export const getRandomColor = (excludeColors = []) => {
  const availableColors = DEFAULT_COLORS.filter(color => !excludeColors.includes(color));
  
  if (availableColors.length === 0) {
    // 如果所有颜色都被排除，生成随机颜色
    return `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`;
  }
  
  const randomIndex = Math.floor(Math.random() * availableColors.length);
  return availableColors[randomIndex];
};

export default {
  DEFAULT_COLORS,
  isValidColor,
  filterValidColors,
  getSafeColorArray,
  getRandomColor
};
