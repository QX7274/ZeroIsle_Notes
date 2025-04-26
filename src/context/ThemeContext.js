/**
 * 主题上下文
 * 提供主题切换功能和现代主题支持
 */
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { lightTheme, darkTheme } from '../theme';
import { modernLightTheme, modernDarkTheme } from '../theme/modernTheme';
import { getTheme, setTheme as saveTheme, getThemeStyle, setThemeStyle as saveThemeStyle } from '../services/storage';

// 创建主题上下文
const ThemeContext = createContext({
  theme: lightTheme,
  isDarkMode: false,
  themeType: 'light',
  themeStyle: 'classic',
  toggleTheme: () => {},
  setThemeType: () => {},
  setThemeStyle: () => {},
});

// 主题提供者组件
export const ThemeProvider = ({ children }) => {
  // 获取系统主题
  const systemTheme = useColorScheme();
  // 主题类型状态（light/dark/system）
  const [themeType, setThemeType] = useState('system');
  // 主题风格状态（classic/modern）
  const [themeStyle, setThemeStyle] = useState('classic');
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
      } catch (error) {
        console.error('加载主题设置失败:', error);
      }
    };

    loadThemeSettings();
  }, []);

  // 监听主题类型和风格变化
  useEffect(() => {
    let newTheme;
    let isDark;

    // 确定是否为深色模式
    if (themeType === 'system') {
      isDark = systemTheme === 'dark';
    } else {
      isDark = themeType === 'dark';
    }

    // 根据主题风格和深色模式选择主题
    if (themeStyle === 'modern') {
      newTheme = isDark ? modernDarkTheme : modernLightTheme;
    } else {
      newTheme = isDark ? darkTheme : lightTheme;
    }

    setTheme(newTheme);
    setIsDarkMode(isDark);
  }, [themeType, themeStyle, systemTheme]);

  // 切换主题
  const toggleTheme = async () => {
    const newThemeType = isDarkMode ? 'light' : 'dark';
    setThemeType(newThemeType);
    try {
      await saveTheme(newThemeType);
    } catch (error) {
      console.error('保存主题失败:', error);
    }
  };

  // 设置主题类型
  const handleSetThemeType = async (type) => {
    setThemeType(type);
    try {
      await saveTheme(type);
    } catch (error) {
      console.error('保存主题类型失败:', error);
    }
  };

  // 设置主题风格
  const handleSetThemeStyle = async (style) => {
    setThemeStyle(style);
    try {
      await saveThemeStyle(style);
    } catch (error) {
      console.error('保存主题风格失败:', error);
    }
  };

  // 上下文值
  const contextValue = {
    theme,
    colors: theme.colors,
    isDarkMode,
    themeType,
    themeStyle,
    toggleTheme,
    setThemeType: handleSetThemeType,
    setThemeStyle: handleSetThemeStyle,
  };

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};

// 使用主题的钩子
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};