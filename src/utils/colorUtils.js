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
  if (color === undefined || color === null || color === '') {return false;}

  if (typeof color === 'string') {
    const trimmed = color.trim();
    if (trimmed === '') {return false;}

    return /^#([0-9A-F]{3}|[0-9A-F]{6})$/i.test(trimmed) ||
      /^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/i.test(trimmed) ||
      /^rgba\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*(0|1|0?\.\d+)\s*\)$/i.test(trimmed) ||
      isNamedColor(trimmed);
  }

  return false;
};

/**
 * 检查是否是命名颜色
 */
const isNamedColor = (color) => {
  const namedColors = [
    'black', 'white', 'red', 'green', 'blue', 'yellow', 'orange', 'purple',
    'pink', 'brown', 'gray', 'grey', 'transparent',
  ];

  return namedColors.includes(color.toLowerCase());
};

/**
 * 过滤颜色数组，移除无效的颜色（包括undefined）
 * @param {Array} colors - 要过滤的颜色数组
 * @returns {Array} 过滤后的颜色数组
 */
export const filterValidColors = (colors) => {
  if (!Array.isArray(colors)) {
    console.warn('颜色数组无效:', colors);
    return [...DEFAULT_COLORS];
  }

  // 过滤掉undefined、null和无效颜色
  const validColors = colors.filter(color => {
    if (color === undefined || color === null) {
      console.warn('发现undefined或null颜色值，已过滤');
      return false;
    }
    return isValidColor(color);
  });

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
    const randomValues = new Uint32Array(1);
    crypto.getRandomValues(randomValues);
    return `#${(randomValues[0] % 16777215).toString(16).padStart(6, '0')}`;
  }

  const randomValues = new Uint32Array(1);
  crypto.getRandomValues(randomValues);
  const randomIndex = randomValues[0] % availableColors.length;
  return availableColors[randomIndex];
};

/**
 * HSV转RGB
 * @param {number} h 色相 0-360
 * @param {number} s 饱和度 0-100
 * @param {number} v 明度 0-100
 * @returns {string} HEX颜色值
 */
export const hsvToRgb = (h, s, v) => {
  s = s / 100;
  v = v / 100;
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;

  if (h >= 0 && h < 60) {
    r = c; g = x; b = 0;
  } else if (h >= 60 && h < 120) {
    r = x; g = c; b = 0;
  } else if (h >= 120 && h < 180) {
    r = 0; g = c; b = x;
  } else if (h >= 180 && h < 240) {
    r = 0; g = x; b = c;
  } else if (h >= 240 && h < 300) {
    r = x; g = 0; b = c;
  } else if (h >= 300 && h < 360) {
    r = c; g = 0; b = x;
  }

  r = Math.round((r + m) * 255);
  g = Math.round((g + m) * 255);
  b = Math.round((b + m) * 255);

  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()}`;
};

const NAMED_COLOR_TO_HEX = {
  black: '#000000',
  white: '#FFFFFF',
  red: '#FF0000',
  green: '#008000',
  blue: '#0000FF',
  yellow: '#FFFF00',
  orange: '#FFA500',
  purple: '#800080',
  pink: '#FFC0CB',
  brown: '#A52A2A',
  gray: '#808080',
  grey: '#808080',
  transparent: '#000000',
};

const clamp255 = (n) => Math.max(0, Math.min(255, Number(n) || 0));

const parseColorToRgb = (color) => {
  if (!isValidColor(color) || typeof color !== 'string') {return null;}
  const c = color.trim();

  if (/^#([0-9A-F]{3}|[0-9A-F]{6})$/i.test(c)) {
    const hex = c.length === 4
      ? `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}`
      : c;
    return {
      r: parseInt(hex.slice(1, 3), 16),
      g: parseInt(hex.slice(3, 5), 16),
      b: parseInt(hex.slice(5, 7), 16),
    };
  }

  const rgbMatch = c.match(/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i);
  if (rgbMatch) {
    return { r: clamp255(rgbMatch[1]), g: clamp255(rgbMatch[2]), b: clamp255(rgbMatch[3]) };
  }

  const rgbaMatch = c.match(/^rgba\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(0|1|0?\.\d+)\s*\)$/i);
  if (rgbaMatch) {
    return { r: clamp255(rgbaMatch[1]), g: clamp255(rgbaMatch[2]), b: clamp255(rgbaMatch[3]) };
  }

  const namedHex = NAMED_COLOR_TO_HEX[c.toLowerCase()];
  if (namedHex) {
    return {
      r: parseInt(namedHex.slice(1, 3), 16),
      g: parseInt(namedHex.slice(3, 5), 16),
      b: parseInt(namedHex.slice(5, 7), 16),
    };
  }

  return null;
};

/**
 * RGB转HSV
 * @param {string} color 颜色值（HEX/RGB/RGBA/命名色）
 * @returns {object} {h, s, v}
 */
export const rgbToHsv = (color) => {
  const rgb = parseColorToRgb(color);
  if (!rgb) {return { h: 0, s: 0, v: 0 };}

  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const diff = max - min;

  let h = 0;
  const s = max === 0 ? 0 : (diff / max) * 100;
  const v = max * 100;

  if (diff !== 0) {
    if (max === r) {
      h = 60 * (((g - b) / diff) % 6);
    } else if (max === g) {
      h = 60 * ((b - r) / diff + 2);
    } else {
      h = 60 * ((r - g) / diff + 4);
    }
  }

  if (h < 0) {h += 360;}

  return { h, s, v };
};

export default {
  DEFAULT_COLORS,
  isValidColor,
  filterValidColors,
  getSafeColorArray,
  getRandomColor,
  hsvToRgb,
  rgbToHsv,
};
