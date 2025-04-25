import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const lightTheme = {
  background: '#FFFFFF',
  cardBackground: '#F5F5F5',
  text: '#000000',
  textSecondary: '#666666',
  primary: '#007AFF',
  secondary: '#5856D6',
  border: '#E5E5E5',
  error: '#FF3B30',
  success: '#34C759',
  warning: '#FF9500',
  disabled: '#C7C7CC',
  wechat: '#07C160',
  qq: '#12B7F5',
};

const darkTheme = {
  background: '#000000',
  cardBackground: '#1C1C1E',
  text: '#FFFFFF',
  textSecondary: '#8E8E93',
  primary: '#0A84FF',
  secondary: '#5E5CE6',
  border: '#38383A',
  error: '#FF453A',
  success: '#32D74B',
  warning: '#FF9F0A',
  disabled: '#3A3A3C',
  wechat: '#07C160',
  qq: '#12B7F5',
};

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const systemTheme = useColorScheme();
  const [theme, setTheme] = useState(systemTheme === 'dark' ? darkTheme : lightTheme);
  const [isDarkMode, setIsDarkMode] = useState(systemTheme === 'dark');

  useEffect(() => {
    loadTheme();
  }, []);

  const loadTheme = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem('theme');
      if (savedTheme) {
        setIsDarkMode(savedTheme === 'dark');
        setTheme(savedTheme === 'dark' ? darkTheme : lightTheme);
      }
    } catch (error) {
      console.error('加载主题失败:', error);
    }
  };

  const toggleTheme = async () => {
    try {
      const newTheme = !isDarkMode;
      setIsDarkMode(newTheme);
      setTheme(newTheme ? darkTheme : lightTheme);
      await AsyncStorage.setItem('theme', newTheme ? 'dark' : 'light');
    } catch (error) {
      console.error('切换主题失败:', error);
    }
  };

  return (
    <ThemeContext.Provider value={{ colors: theme, isDarkMode, toggleTheme }}>
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