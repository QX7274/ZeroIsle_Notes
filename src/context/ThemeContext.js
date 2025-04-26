/**
 * 主题上下文
 * 提供主题切换功能
 */
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { lightTheme, darkTheme } from '../theme';
import { getTheme, setTheme as saveTheme } from '../services/storage';

// 创建主题上下文
const ThemeContext = createContext({
  theme: lightTheme,
  isDarkMode: false,
  themeType: 'light',
  toggleTheme: () => {},
  setThemeType: () => {},
});

// 主题提供者组件
export const ThemeProvider = ({ children }) => {
  // 获取系统主题
  const systemTheme = useColorScheme();
  // 主题类型状态
  const [themeType, setThemeType] = useState('system');
  // 当前主题状态
  const [theme, setTheme] = useState(systemTheme === 'dark' ? darkTheme : lightTheme);
  // 是否为深色主题
  const [isDarkMode, setIsDarkMode] = useState(systemTheme === 'dark');

  // 加载保存的主题
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedTheme = await getTheme();
        if (savedTheme) {
          setThemeType(savedTheme);
        }
      } catch (error) {
        console.error('加载主题失败:', error);
      }
    };

    loadTheme();
  }, []);

  // 监听主题类型变化
  useEffect(() => {
    let newTheme;
    let isDark;

    if (themeType === 'system') {
      newTheme = systemTheme === 'dark' ? darkTheme : lightTheme;
      isDark = systemTheme === 'dark';
    } else {
      newTheme = themeType === 'dark' ? darkTheme : lightTheme;
      isDark = themeType === 'dark';
    }

    setTheme(newTheme);
    setIsDarkMode(isDark);
  }, [themeType, systemTheme]);

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
      console.error('保存主题失败:', error);
    }
  };

  // 上下文值
  const contextValue = {
    theme,
    colors: theme.colors,
    isDarkMode,
    themeType,
    toggleTheme,
    setThemeType: handleSetThemeType,
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