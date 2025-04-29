/**
 * 主题上下文
 * 提供主题切换功能和现代主题支持
 * 支持动态主题颜色和自定义主题
 */
import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { useColorScheme } from 'react-native';
import { lightTheme, darkTheme } from '../theme';
import { modernLightTheme, modernDarkTheme } from '../theme/modernTheme';
import {
  getTheme,
  setTheme as saveTheme,
  getThemeStyle,
  setThemeStyle as saveThemeStyle,
  getCustomTheme,
  setCustomTheme as saveCustomTheme
} from '../services/storage';
// 导入 lodash 的 merge 函数
import merge from 'lodash/merge';

// 默认主题配置
const DEFAULT_THEMES = {
  classic: {
    light: lightTheme,
    dark: darkTheme
  },
  modern: {
    light: modernLightTheme,
    dark: modernDarkTheme
  }
};

// 创建主题上下文
const ThemeContext = createContext({
  theme: lightTheme,
  isDarkMode: false,
  themeType: 'light',
  themeStyle: 'classic',
  colors: lightTheme.colors,
  dimensions: lightTheme.dimensions,
  typography: lightTheme.typography,
  toggleTheme: () => {},
  setThemeType: () => {},
  setThemeStyle: () => {},
  getColor: () => {},
  updateThemeColor: () => {},
  resetThemeColors: () => {},
  getThemeValue: () => {},
});

/**
 * 主题提供者组件
 * 提供主题上下文和主题管理功能
 */
export const ThemeProvider = ({ children }) => {
  // 获取系统主题
  const systemTheme = useColorScheme();

  // 主题类型状态（light/dark/system）
  const [themeType, setThemeType] = useState('system');

  // 主题风格状态（classic/modern）
  const [themeStyle, setThemeStyle] = useState('classic');

  // 自定义主题颜色
  const [customTheme, setCustomTheme] = useState({
    light: {},
    dark: {}
  });

  // 当前主题状态
  const [theme, setTheme] = useState(systemTheme === 'dark' ? darkTheme : lightTheme);

  // 是否为深色主题
  const [isDarkMode, setIsDarkMode] = useState(systemTheme === 'dark');

  // 加载保存的主题设置
  useEffect(() => {
    const loadThemeSettings = async () => {
      try {
        // 加载主题类型（light/dark/system）
        const savedTheme = await getTheme();
        if (savedTheme) {
          setThemeType(savedTheme);
        }

        // 加载主题风格（classic/modern）
        const savedStyle = await getThemeStyle();
        if (savedStyle) {
          setThemeStyle(savedStyle);
        }

        // 加载自定义主题
        const savedCustomTheme = await getCustomTheme();
        if (savedCustomTheme) {
          setCustomTheme(savedCustomTheme);
        }
      } catch (error) {
        console.error('加载主题设置失败:', error);
      }
    };

    loadThemeSettings();
  }, []);

  // 获取当前应该使用的主题模式（light/dark）
  const currentThemeMode = useMemo(() => {
    if (themeType === 'system') {
      return systemTheme || 'light';
    }
    return themeType;
  }, [themeType, systemTheme]);

  // 监听主题类型和风格变化
  useEffect(() => {
    // 确定是否为深色模式
    const isDark = currentThemeMode === 'dark';

    // 获取基础主题
    const baseTheme = DEFAULT_THEMES[themeStyle][currentThemeMode];

    // 合并自定义主题
    const customColors = customTheme[currentThemeMode]?.colors || {};
    const mergedTheme = merge({}, baseTheme, {
      colors: customColors
    });

    setTheme(mergedTheme);
    setIsDarkMode(isDark);
  }, [themeStyle, currentThemeMode, customTheme]);

  /**
   * 切换主题（亮色/暗色）
   */
  const toggleTheme = useCallback(async () => {
    const newThemeType = isDarkMode ? 'light' : 'dark';
    setThemeType(newThemeType);
    try {
      await saveTheme(newThemeType);
    } catch (error) {
      console.error('保存主题失败:', error);
    }
  }, [isDarkMode]);

  /**
   * 设置主题类型
   * @param {string} type - 主题类型：light, dark, system
   */
  const handleSetThemeType = useCallback(async (type) => {
    setThemeType(type);
    try {
      await saveTheme(type);
    } catch (error) {
      console.error('保存主题类型失败:', error);
    }
  }, []);

  /**
   * 设置主题风格
   * @param {string} style - 主题风格：classic, modern
   */
  const handleSetThemeStyle = useCallback(async (style) => {
    setThemeStyle(style);
    try {
      await saveThemeStyle(style);
    } catch (error) {
      console.error('保存主题风格失败:', error);
    }
  }, []);

  /**
   * 获取主题颜色
   * @param {string} colorKey - 颜色键名
   * @param {string} fallback - 备用颜色
   * @returns {string} - 对应的颜色值
   */
  const getColor = useCallback((colorKey, fallback) => {
    if (!colorKey) return fallback || theme.colors.text;
    return theme.colors[colorKey] || fallback || theme.colors.text;
  }, [theme.colors]);

  /**
   * 更新主题颜色
   * @param {string} colorKey - 颜色键名
   * @param {string} value - 颜色值
   * @param {string} mode - 主题模式：light, dark, both
   */
  const updateThemeColor = useCallback(async (colorKey, value, mode = 'both') => {
    if (!colorKey || !value) return;

    const newCustomTheme = { ...customTheme };

    if (mode === 'both' || mode === 'light') {
      newCustomTheme.light = {
        ...newCustomTheme.light,
        colors: {
          ...(newCustomTheme.light?.colors || {}),
          [colorKey]: value
        }
      };
    }

    if (mode === 'both' || mode === 'dark') {
      newCustomTheme.dark = {
        ...newCustomTheme.dark,
        colors: {
          ...(newCustomTheme.dark?.colors || {}),
          [colorKey]: value
        }
      };
    }

    setCustomTheme(newCustomTheme);

    try {
      await saveCustomTheme(newCustomTheme);
    } catch (error) {
      console.error('保存自定义主题失败:', error);
    }
  }, [customTheme]);

  /**
   * 重置主题颜色
   * @param {string} mode - 主题模式：light, dark, both
   */
  const resetThemeColors = useCallback(async (mode = 'both') => {
    const newCustomTheme = { ...customTheme };

    if (mode === 'both' || mode === 'light') {
      newCustomTheme.light = {
        ...newCustomTheme.light,
        colors: {}
      };
    }

    if (mode === 'both' || mode === 'dark') {
      newCustomTheme.dark = {
        ...newCustomTheme.dark,
        colors: {}
      };
    }

    setCustomTheme(newCustomTheme);

    try {
      await saveCustomTheme(newCustomTheme);
    } catch (error) {
      console.error('重置主题颜色失败:', error);
    }
  }, [customTheme]);

  /**
   * 获取主题中的任意值
   * @param {string} path - 属性路径，例如 'dimensions.SPACING.MEDIUM'
   * @param {any} defaultValue - 默认值
   * @returns {any} - 对应的主题值
   */
  const getThemeValue = useCallback((path, defaultValue) => {
    if (!path) return defaultValue;

    try {
      const parts = path.split('.');
      let value = theme;

      for (const part of parts) {
        value = value[part];
        if (value === undefined) return defaultValue;
      }

      return value;
    } catch (error) {
      console.error('获取主题值失败:', error);
      return defaultValue;
    }
  }, [theme]);

  // 上下文值
  const contextValue = useMemo(() => ({
    theme,
    colors: theme.colors,
    dimensions: theme.dimensions,
    typography: theme.typography,
    isDarkMode,
    themeType,
    themeStyle,
    customTheme,
    toggleTheme,
    setThemeType: handleSetThemeType,
    setThemeStyle: handleSetThemeStyle,
    getColor,
    updateThemeColor,
    resetThemeColors,
    getThemeValue,
  }), [
    theme,
    isDarkMode,
    themeType,
    themeStyle,
    customTheme,
    toggleTheme,
    handleSetThemeType,
    handleSetThemeStyle,
    getColor,
    updateThemeColor,
    resetThemeColors,
    getThemeValue
  ]);

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};

/**
 * 使用主题的钩子
 * @returns {object} 主题上下文
 */
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};