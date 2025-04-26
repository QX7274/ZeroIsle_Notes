/**
 * 主题配置
 * 导出应用的主题配置
 */
import colors from './colors';
import dimensions from './dimensions';
import typography from './typography';
import { DefaultTheme, DarkTheme } from '@react-navigation/native';

// 浅色主题
export const lightTheme = {
  ...DefaultTheme,
  dark: false,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.PRIMARY.DEFAULT,
    background: colors.BACKGROUND.LIGHT,
    card: colors.NEUTRAL.WHITE,
    text: colors.TEXT.LIGHT.PRIMARY,
    border: colors.DIVIDER.LIGHT,
    notification: colors.ERROR.DEFAULT,
    // 自定义颜色
    secondary: colors.SECONDARY.DEFAULT,
    success: colors.SUCCESS.DEFAULT,
    info: colors.INFO.DEFAULT,
    warning: colors.WARNING.DEFAULT,
    error: colors.ERROR.DEFAULT,
    textSecondary: colors.TEXT.LIGHT.SECONDARY,
    textDisabled: colors.TEXT.LIGHT.DISABLED,
    textHint: colors.TEXT.LIGHT.HINT,
    divider: colors.DIVIDER.LIGHT,
    shadow: colors.SHADOW.LIGHT,
  },
  // 尺寸
  dimensions,
  // 排版
  typography,
};

// 深色主题
export const darkTheme = {
  ...DarkTheme,
  dark: true,
  colors: {
    ...DarkTheme.colors,
    primary: colors.PRIMARY.LIGHT,
    background: colors.BACKGROUND.DARK,
    card: colors.NEUTRAL.DARKEST,
    text: colors.TEXT.DARK.PRIMARY,
    border: colors.DIVIDER.DARK,
    notification: colors.ERROR.LIGHT,
    // 自定义颜色
    secondary: colors.SECONDARY.LIGHT,
    success: colors.SUCCESS.LIGHT,
    info: colors.INFO.LIGHT,
    warning: colors.WARNING.LIGHT,
    error: colors.ERROR.LIGHT,
    textSecondary: colors.TEXT.DARK.SECONDARY,
    textDisabled: colors.TEXT.DARK.DISABLED,
    textHint: colors.TEXT.DARK.HINT,
    divider: colors.DIVIDER.DARK,
    shadow: colors.SHADOW.DARK,
  },
  // 尺寸
  dimensions,
  // 排版
  typography,
};

// 导出主题
export default {
  light: lightTheme,
  dark: darkTheme,
};
