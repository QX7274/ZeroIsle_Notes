/**
 * React Native Paper 主题配置
 * 提供与应用主题一致的 Paper 组件主题
 */
import { MD3LightTheme, MD3DarkTheme } from 'react-native-paper';
import { BODY, FONT_FAMILY, FONT_WEIGHT } from './typography';
import { FONT_SIZE, LINE_HEIGHT } from './dimensions';

// 创建自定义字体配置，确保包含 bodySmall 变体
const createFonts = (isV3) => {
  if (isV3) {
    return {
      // 标题
      displayLarge: {
        fontFamily: FONT_FAMILY.REGULAR,
        fontSize: FONT_SIZE.XXXLARGE,
        fontWeight: FONT_WEIGHT.REGULAR,
        letterSpacing: 0,
        lineHeight: LINE_HEIGHT.XXXLARGE,
      },
      displayMedium: {
        fontFamily: FONT_FAMILY.REGULAR,
        fontSize: FONT_SIZE.XXLARGE,
        fontWeight: FONT_WEIGHT.REGULAR,
        letterSpacing: 0,
        lineHeight: LINE_HEIGHT.XXLARGE,
      },
      displaySmall: {
        fontFamily: FONT_FAMILY.REGULAR,
        fontSize: FONT_SIZE.XLARGE,
        fontWeight: FONT_WEIGHT.REGULAR,
        letterSpacing: 0,
        lineHeight: LINE_HEIGHT.XLARGE,
      },

      // 标题
      headlineLarge: {
        fontFamily: FONT_FAMILY.REGULAR,
        fontSize: FONT_SIZE.LARGE,
        fontWeight: FONT_WEIGHT.REGULAR,
        letterSpacing: 0,
        lineHeight: LINE_HEIGHT.LARGE,
      },
      headlineMedium: {
        fontFamily: FONT_FAMILY.REGULAR,
        fontSize: FONT_SIZE.REGULAR,
        fontWeight: FONT_WEIGHT.REGULAR,
        letterSpacing: 0,
        lineHeight: LINE_HEIGHT.REGULAR,
      },
      headlineSmall: {
        fontFamily: FONT_FAMILY.REGULAR,
        fontSize: FONT_SIZE.MEDIUM,
        fontWeight: FONT_WEIGHT.REGULAR,
        letterSpacing: 0,
        lineHeight: LINE_HEIGHT.MEDIUM,
      },

      // 标题
      titleLarge: {
        fontFamily: FONT_FAMILY.MEDIUM,
        fontSize: FONT_SIZE.REGULAR,
        fontWeight: FONT_WEIGHT.MEDIUM,
        letterSpacing: 0,
        lineHeight: LINE_HEIGHT.REGULAR,
      },
      titleMedium: {
        fontFamily: FONT_FAMILY.MEDIUM,
        fontSize: FONT_SIZE.MEDIUM,
        fontWeight: FONT_WEIGHT.MEDIUM,
        letterSpacing: 0,
        lineHeight: LINE_HEIGHT.MEDIUM,
      },
      titleSmall: {
        fontFamily: FONT_FAMILY.MEDIUM,
        fontSize: FONT_SIZE.SMALL,
        fontWeight: FONT_WEIGHT.MEDIUM,
        letterSpacing: 0,
        lineHeight: LINE_HEIGHT.SMALL,
      },

      // 正文
      bodyLarge: BODY.LARGE,
      bodyMedium: BODY.MEDIUM,
      bodySmall: BODY.SMALL,

      // 标签
      labelLarge: {
        fontFamily: FONT_FAMILY.MEDIUM,
        fontSize: FONT_SIZE.MEDIUM,
        fontWeight: FONT_WEIGHT.MEDIUM,
        letterSpacing: 0,
        lineHeight: LINE_HEIGHT.MEDIUM,
      },
      labelMedium: {
        fontFamily: FONT_FAMILY.MEDIUM,
        fontSize: FONT_SIZE.SMALL,
        fontWeight: FONT_WEIGHT.MEDIUM,
        letterSpacing: 0,
        lineHeight: LINE_HEIGHT.SMALL,
      },
      labelSmall: {
        fontFamily: FONT_FAMILY.MEDIUM,
        fontSize: FONT_SIZE.TINY,
        fontWeight: FONT_WEIGHT.MEDIUM,
        letterSpacing: 0,
        lineHeight: LINE_HEIGHT.TINY,
      },
    };
  }

  return {
    regular: BODY.MEDIUM,
    medium: {
      ...BODY.MEDIUM,
      fontWeight: FONT_WEIGHT.MEDIUM,
    },
    light: {
      ...BODY.MEDIUM,
      fontWeight: FONT_WEIGHT.LIGHT,
    },
    thin: {
      ...BODY.MEDIUM,
      fontWeight: FONT_WEIGHT.THIN,
    },
  };
};

// 创建 Paper 浅色主题
export const createPaperLightTheme = (appTheme) => {
  return {
    ...MD3LightTheme,
    colors: {
      ...MD3LightTheme.colors,
      primary: appTheme.colors.primary,
      onPrimary: appTheme.colors.onPrimary,
      primaryContainer: appTheme.colors.primaryContainer,
      onPrimaryContainer: appTheme.colors.onPrimaryContainer,
      secondary: appTheme.colors.secondary,
      onSecondary: appTheme.colors.onSecondary,
      secondaryContainer: appTheme.colors.secondaryContainer,
      onSecondaryContainer: appTheme.colors.onSecondaryContainer,
      tertiary: appTheme.colors.tertiary,
      onTertiary: appTheme.colors.onTertiary,
      tertiaryContainer: appTheme.colors.tertiaryContainer,
      onTertiaryContainer: appTheme.colors.onTertiaryContainer,
      error: appTheme.colors.error,
      onError: appTheme.colors.onError,
      errorContainer: appTheme.colors.errorContainer,
      onErrorContainer: appTheme.colors.onErrorContainer,
      background: appTheme.colors.background,
      onBackground: appTheme.colors.onBackground,
      surface: appTheme.colors.surface,
      onSurface: appTheme.colors.onSurface,
      surfaceVariant: appTheme.colors.surfaceVariant,
      onSurfaceVariant: appTheme.colors.onSurfaceVariant,
      outline: appTheme.colors.outline,
      outlineVariant: appTheme.colors.outlineVariant,
      shadow: appTheme.colors.shadow,
      scrim: appTheme.colors.scrim,
      inverseSurface: appTheme.colors.inverseSurface,
      inverseOnSurface: appTheme.colors.inverseOnSurface,
      inversePrimary: appTheme.colors.inversePrimary,
      elevation: appTheme.colors.elevation,
    },
    fonts: createFonts(true),
  };
};

// 创建 Paper 深色主题
export const createPaperDarkTheme = (appTheme) => {
  return {
    ...MD3DarkTheme,
    colors: {
      ...MD3DarkTheme.colors,
      primary: appTheme.colors.primary,
      onPrimary: appTheme.colors.onPrimary,
      primaryContainer: appTheme.colors.primaryContainer,
      onPrimaryContainer: appTheme.colors.onPrimaryContainer,
      secondary: appTheme.colors.secondary,
      onSecondary: appTheme.colors.onSecondary,
      secondaryContainer: appTheme.colors.secondaryContainer,
      onSecondaryContainer: appTheme.colors.onSecondaryContainer,
      tertiary: appTheme.colors.tertiary,
      onTertiary: appTheme.colors.onTertiary,
      tertiaryContainer: appTheme.colors.tertiaryContainer,
      onTertiaryContainer: appTheme.colors.onTertiaryContainer,
      error: appTheme.colors.error,
      onError: appTheme.colors.onError,
      errorContainer: appTheme.colors.errorContainer,
      onErrorContainer: appTheme.colors.onErrorContainer,
      background: appTheme.colors.background,
      onBackground: appTheme.colors.onBackground,
      surface: appTheme.colors.surface,
      onSurface: appTheme.colors.onSurface,
      surfaceVariant: appTheme.colors.surfaceVariant,
      onSurfaceVariant: appTheme.colors.onSurfaceVariant,
      outline: appTheme.colors.outline,
      outlineVariant: appTheme.colors.outlineVariant,
      shadow: appTheme.colors.shadow,
      scrim: appTheme.colors.scrim,
      inverseSurface: appTheme.colors.inverseSurface,
      inverseOnSurface: appTheme.colors.inverseOnSurface,
      inversePrimary: appTheme.colors.inversePrimary,
      elevation: appTheme.colors.elevation,
    },
    fonts: createFonts(true),
  };
};
