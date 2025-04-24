/**
 * 零屿笔记应用颜色常量
 * 基于苹果风格设计方案
 */

export const COLORS = {
  // 主色调
  PRIMARY: '#007AFF', // 蓝色，代表可靠和专业
  SECONDARY: '#FF9500', // 橙色，用于次要强调
  SUCCESS: '#4CD964', // 绿色，表示成功状态
  DANGER: '#FF3B30', // 红色，表示错误或警告
  
  // 中性色 - 亮模式
  BACKGROUND_LIGHT: '#FFFFFF',
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
};

/**
 * 获取基于当前主题的颜色
 * @param {string} colorKey - 颜色键名
 * @param {boolean} isDarkMode - 是否为暗黑模式
 * @returns {string} - 对应主题的颜色值
 */
export const getThemeColor = (colorKey, isDarkMode) => {
  switch (colorKey) {
    case 'BACKGROUND':
      return isDarkMode ? COLORS.BACKGROUND_DARK : COLORS.BACKGROUND_LIGHT;
    case 'TEXT_PRIMARY':
      return isDarkMode ? COLORS.TEXT_PRIMARY_DARK : COLORS.TEXT_PRIMARY_LIGHT;
    case 'TEXT_SECONDARY':
      return isDarkMode ? COLORS.TEXT_SECONDARY_DARK : COLORS.TEXT_SECONDARY_LIGHT;
    case 'BORDER':
      return isDarkMode ? COLORS.BORDER_DARK : COLORS.BORDER_LIGHT;
    case 'DIVIDER':
      return isDarkMode ? COLORS.DIVIDER_DARK : COLORS.DIVIDER_LIGHT;
    default:
      return COLORS[colorKey];
  }
};