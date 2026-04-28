/**
 * 零屿笔记应用颜色常量
 * 基于苹果风格设计方案
 */

// 立即执行的函数，确保在导入时就初始化颜色
(function() {
  console.log('初始化颜色常量...');
  // 确保COLORS对象已经初始化
})();

const COLORS = {
  // 主色调
  PRIMARY: '#007AFF', // 蓝色，代表可靠和专业
  SECONDARY: '#FF9500', // 橙色，用于次要强调
  SUCCESS: '#4CD964', // 绿色，表示成功状态
  DANGER: '#FF3B30', // 红色，表示错误或警告

  // 中性色 - 亮模式
  BACKGROUND_LIGHT: '#FFFFFF',
  BACKGROUND: '#FFFFFF', // 默认使用亮模式背景色
  TEXT_PRIMARY_LIGHT: '#000000',
  TEXT_SECONDARY_LIGHT: '#8E8E93',
  BORDER_LIGHT: '#E5E5EA',
  DIVIDER_LIGHT: '#C7C7CC',

  // 中性色 - 暗模式
  BACKGROUND_DARK: '#000000',
  TEXT_PRIMARY_DARK: '#FFFFFF',
  TEXT_SECONDARY_DARK: '#8E8E93',
  BORDER_DARK: '#38383A',
  DIVIDER_DARK: '#333333',

  // 功能色
  INFO: '#32ADE6', // 信息提示
  WARNING: '#FFCC00', // 警告提示

  // 透明度变体
  PRIMARY_ALPHA_50: 'rgba(0, 122, 255, 0.5)',
  PRIMARY_ALPHA_20: 'rgba(0, 122, 255, 0.2)',

  // 特殊用途
  CARD_BACKGROUND: '#F2F2F7',
  INPUT_BACKGROUND: '#F2F2F7',
  PLACEHOLDER: '#C7C7CC',

  // 添加默认的文本和边框颜色
  TEXT_PRIMARY: '#000000', // 默认使用亮模式文本色
  TEXT_SECONDARY: '#8E8E93', // 默认使用亮模式次要文本色
  TEXT_TERTIARY: '#C7C7CC', // 第三级文本颜色，更浅
  BORDER: '#E5E5EA', // 默认使用亮模式边框色
  DIVIDER: '#C7C7CC', // 默认使用亮模式分隔线色
  SURFACE: '#FFFFFF', // 默认使用亮模式表面色
};

/**
 * 获取基于当前主题的颜色
 * @param {string} colorKey - 颜色键名
 * @param {boolean} isDarkMode - 是否为暗黑模式
 * @returns {string} - 对应主题的颜色值
 */
const getThemeColor = (colorKey, isDarkMode) => {
  switch (colorKey) {
    case 'BACKGROUND':
      return isDarkMode ? COLORS.BACKGROUND_DARK : COLORS.BACKGROUND_LIGHT;
    case 'TEXT_PRIMARY':
      return isDarkMode ? COLORS.TEXT_PRIMARY_DARK : COLORS.TEXT_PRIMARY_LIGHT;
    case 'TEXT_SECONDARY':
      return isDarkMode ? COLORS.TEXT_SECONDARY_DARK : COLORS.TEXT_SECONDARY_LIGHT;
    case 'TEXT_TERTIARY':
      return isDarkMode ? COLORS.TEXT_SECONDARY_DARK : COLORS.TEXT_TERTIARY;
    case 'BORDER':
      return isDarkMode ? COLORS.BORDER_DARK : COLORS.BORDER_LIGHT;
    case 'DIVIDER':
      return isDarkMode ? COLORS.DIVIDER_DARK : COLORS.DIVIDER_LIGHT;
    default:
      return COLORS[colorKey];
  }
};

// 根据当前主题更新颜色
const updateThemeColors = (isDarkMode) => {
  // 更新背景色
  COLORS.BACKGROUND = isDarkMode ? COLORS.BACKGROUND_DARK : COLORS.BACKGROUND_LIGHT;
  // 更新文本色
  COLORS.TEXT_PRIMARY = isDarkMode ? COLORS.TEXT_PRIMARY_DARK : COLORS.TEXT_PRIMARY_LIGHT;
  COLORS.TEXT_SECONDARY = isDarkMode ? COLORS.TEXT_SECONDARY_DARK : COLORS.TEXT_SECONDARY_LIGHT;
  COLORS.TEXT_TERTIARY = isDarkMode ? COLORS.TEXT_SECONDARY_DARK : COLORS.TEXT_TERTIARY;
  // 更新边框色
  COLORS.BORDER = isDarkMode ? COLORS.BORDER_DARK : COLORS.BORDER_LIGHT;
  COLORS.DIVIDER = isDarkMode ? COLORS.DIVIDER_DARK : COLORS.DIVIDER_LIGHT;
};

module.exports = {
  COLORS,
  getThemeColor,
  updateThemeColors,
};
module.exports.default = { COLORS, getThemeColor, updateThemeColors };
module.exports.COLORS = COLORS;
