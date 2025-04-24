import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 现代化的亮色主题
const lightTheme = {
  // 基础颜色
  background: '#FFFFFF',
  cardBackground: '#F8F9FA',
  text: '#1A1A1A',
  textSecondary: '#6C757D',

  // 主色调
  primary: '#4361EE',
  secondary: '#3F37C9',

  // 状态颜色
  error: '#EF476F',
  success: '#06D6A0',
  warning: '#FFD166',
  info: '#118AB2',

  // 界面元素
  border: '#E9ECEF',
  disabled: '#CED4DA',
  shadow: 'rgba(0, 0, 0, 0.1)',

  // 社交媒体颜色
  wechat: '#07C160',
  qq: '#12B7F5',

  // 渐变色
  gradients: {
    primary: ['#4361EE', '#3A0CA3'],
    secondary: ['#4CC9F0', '#4361EE'],
    success: ['#06D6A0', '#1B9AAA'],
    error: ['#EF476F', '#F78C6B'],
    warning: ['#FFD166', '#F4A261'],
    card: ['#F8F9FA', '#E9ECEF'],
    button: ['#4361EE', '#3F37C9'],
    header: ['#4361EE', '#4CC9F0'],
  },

  // 透明度变体
  primaryAlpha: {
    50: 'rgba(67, 97, 238, 0.5)',
    20: 'rgba(67, 97, 238, 0.2)',
    10: 'rgba(67, 97, 238, 0.1)',
  },
};

// 现代化的暗色主题
const darkTheme = {
  // 基础颜色
  background: '#121212',
  cardBackground: '#1E1E1E',
  text: '#FFFFFF',
  textSecondary: '#ADB5BD',

  // 主色调
  primary: '#4CC9F0',
  secondary: '#4361EE',

  // 状态颜色
  error: '#F72585',
  success: '#06D6A0',
  warning: '#FFD166',
  info: '#118AB2',

  // 界面元素
  border: '#2A2A2A',
  disabled: '#495057',
  shadow: 'rgba(0, 0, 0, 0.3)',

  // 社交媒体颜色
  wechat: '#07C160',
  qq: '#12B7F5',

  // 渐变色
  gradients: {
    primary: ['#4CC9F0', '#4361EE'],
    secondary: ['#4361EE', '#3A0CA3'],
    success: ['#06D6A0', '#1B9AAA'],
    error: ['#F72585', '#B5179E'],
    warning: ['#FFD166', '#F4A261'],
    card: ['#1E1E1E', '#2A2A2A'],
    button: ['#4CC9F0', '#4361EE'],
    header: ['#121212', '#1E1E1E'],
  },

  // 透明度变体
  primaryAlpha: {
    50: 'rgba(76, 201, 240, 0.5)',
    20: 'rgba(76, 201, 240, 0.2)',
    10: 'rgba(76, 201, 240, 0.1)',
  },
};

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const systemTheme = useColorScheme();
  const [theme, setTheme] = useState(systemTheme === 'dark' ? darkTheme : lightTheme);
  const [isDarkMode, setIsDarkMode] = useState(systemTheme === 'dark');
  const [themeMode, setThemeMode] = useState('system'); // 'system', 'light', 'dark'

  // 监听系统主题变化
  useEffect(() => {
    if (themeMode === 'system') {
      setIsDarkMode(systemTheme === 'dark');
      setTheme(systemTheme === 'dark' ? darkTheme : lightTheme);
    }
  }, [systemTheme, themeMode]);

  // 初始加载主题
  useEffect(() => {
    loadTheme();
  }, []);

  // 从存储中加载主题设置
  const loadTheme = async () => {
    try {
      const savedThemeMode = await AsyncStorage.getItem('themeMode');
      if (savedThemeMode) {
        setThemeMode(savedThemeMode);

        if (savedThemeMode === 'dark') {
          setIsDarkMode(true);
          setTheme(darkTheme);
        } else if (savedThemeMode === 'light') {
          setIsDarkMode(false);
          setTheme(lightTheme);
        } else {
          // 系统模式
          setIsDarkMode(systemTheme === 'dark');
          setTheme(systemTheme === 'dark' ? darkTheme : lightTheme);
        }
      }
    } catch (error) {
      console.error('加载主题失败:', error);
    }
  };

  // 切换暗/亮模式
  const toggleTheme = async () => {
    try {
      const newIsDarkMode = !isDarkMode;
      setIsDarkMode(newIsDarkMode);
      setTheme(newIsDarkMode ? darkTheme : lightTheme);

      // 更新主题模式
      const newThemeMode = newIsDarkMode ? 'dark' : 'light';
      setThemeMode(newThemeMode);
      await AsyncStorage.setItem('themeMode', newThemeMode);
    } catch (error) {
      console.error('切换主题失败:', error);
    }
  };

  // 设置特定主题模式
  const setThemePreference = async (mode) => {
    try {
      setThemeMode(mode);
      await AsyncStorage.setItem('themeMode', mode);

      if (mode === 'system') {
        const isSystemDark = systemTheme === 'dark';
        setIsDarkMode(isSystemDark);
        setTheme(isSystemDark ? darkTheme : lightTheme);
      } else if (mode === 'dark') {
        setIsDarkMode(true);
        setTheme(darkTheme);
      } else {
        setIsDarkMode(false);
        setTheme(lightTheme);
      }
    } catch (error) {
      console.error('设置主题偏好失败:', error);
    }
  };

  // 获取渐变色字符串（用于线性渐变）
  const getGradient = (name, direction = 'to right') => {
    const colors = theme.gradients[name] || theme.gradients.primary;
    return `linear-gradient(${direction}, ${colors.join(', ')})`;
  };

  return (
    <ThemeContext.Provider
      value={{
        colors: theme,
        isDarkMode,
        themeMode,
        toggleTheme,
        setThemePreference,
        getGradient
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};