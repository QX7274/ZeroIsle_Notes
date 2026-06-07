/**
 * 主题上下文
 * 提供主题切换功能和现代主题支持
 * 支持动态主题颜色和自定义主题
 */
import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { useColorScheme } from 'react-native';
import { lightTheme, darkTheme } from '../theme';
import { modernLightTheme, modernDarkTheme } from '../theme/modernTheme';
// 确保这个导入不会导致循环依赖
import { updateThemeColors } from '../utils/constants/colors';
// 导入存储服务
import realmService from '../services/database/realmService';

// 定义主题存储键
const THEME_KEYS = {
  THEME: 'zeroislenotes_theme',
  THEME_STYLE: 'zeroislenotes_theme_style',
  CUSTOM_THEME: 'zeroislenotes_custom_theme',
};

// 主题存储函数
const getTheme = async () => {
  try {
    // 使用realmService作为唯一存储服务
    const realm = await realmService.getRealm();
    const item = realm.objects('StorageItem').filtered(`key = "${THEME_KEYS.THEME}"`);
    const theme = item.length > 0 ? item[0].value : null;
    return theme || 'system';
  } catch (error) {
    console.error('获取主题失败:', error);
    return 'system';
  }
};

const saveTheme = async (theme) => {
  try {
    // 使用realmService作为唯一存储服务
    const realm = await realmService.getRealm();
    realm.write(() => {
      const existingItem = realm.objects('StorageItem').filtered(`key = "${THEME_KEYS.THEME}"`);
      if (existingItem.length > 0) {
        existingItem[0].value = theme;
        existingItem[0].updated_at = new Date();
      } else {
        realm.create('StorageItem', {
          key: THEME_KEYS.THEME,
          value: theme,
          createdAt: new Date(),
          updated_at: new Date(),
        });
      }
    });
    return true;
  } catch (error) {
    console.error('保存主题失败:', error);
    return false;
  }
};

const getThemeStyle = async () => {
  try {
    // 使用realmService作为唯一存储服务
    const realm = await realmService.getRealm();
    const item = realm.objects('StorageItem').filtered(`key = "${THEME_KEYS.THEME_STYLE}"`);
    const style = item.length > 0 ? item[0].value : null;
    return style || 'classic';
  } catch (error) {
    console.error('获取主题风格失败:', error);
    return 'classic';
  }
};

const saveThemeStyle = async (style) => {
  try {
    // 使用realmService作为唯一存储服务
    const realm = await realmService.getRealm();
    realm.write(() => {
      const existingItem = realm.objects('StorageItem').filtered(`key = "${THEME_KEYS.THEME_STYLE}"`);
      if (existingItem.length > 0) {
        existingItem[0].value = style;
        existingItem[0].updated_at = new Date();
      } else {
        realm.create('StorageItem', {
          key: THEME_KEYS.THEME_STYLE,
          value: style,
          createdAt: new Date(),
          updated_at: new Date(),
        });
      }
    });
    return true;
  } catch (error) {
    console.error('保存主题风格失败:', error);
    return false;
  }
};

const getCustomTheme = async () => {
  try {
    // 使用realmService作为唯一存储服务
    const realm = await realmService.getRealm();
    const item = realm.objects('StorageItem').filtered(`key = "${THEME_KEYS.CUSTOM_THEME}"`);
    const customThemeStr = item.length > 0 ? item[0].value : null;
    return customThemeStr ? JSON.parse(customThemeStr) : { light: {}, dark: {} };
  } catch (error) {
    console.error('获取自定义主题失败:', error);
    return { light: {}, dark: {} };
  }
};

const saveCustomTheme = async (customTheme) => {
  try {
    const customThemeStr = JSON.stringify(customTheme);
    // 使用realmService作为唯一存储服务
    const realm = await realmService.getRealm();
    realm.write(() => {
      const existingItem = realm.objects('StorageItem').filtered(`key = "${THEME_KEYS.CUSTOM_THEME}"`);
      if (existingItem.length > 0) {
        existingItem[0].value = customThemeStr;
        existingItem[0].updated_at = new Date();
      } else {
        realm.create('StorageItem', {
          key: THEME_KEYS.CUSTOM_THEME,
          value: customThemeStr,
          createdAt: new Date(),
          updated_at: new Date(),
        });
      }
    });
    return true;
  } catch (error) {
    console.error('保存自定义主题失败:', error);
    return false;
  }
};
// 导入 lodash 的 merge 函数
import merge from 'lodash/merge';

// 默认主题配置
const DEFAULT_THEMES = {
  classic: {
    light: lightTheme,
    dark: darkTheme,
  },
  modern: {
    light: modernLightTheme,
    dark: modernDarkTheme,
  },
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
  getModeColor: () => {},
  getThemeByMode: () => {},
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
    dark: {},
  });

  // 当前主题状态
  const [theme, setTheme] = useState(systemTheme === 'dark' ? darkTheme : lightTheme);

  // 是否为深色主题
  const [isDarkMode, setIsDarkMode] = useState(systemTheme === 'dark');

  // 加载保存的主题设置
  useEffect(() => {
    const loadThemeSettings = async () => {
      try {

        // 添加超时机制，避免无限等待
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('加载主题设置超时')), 5000);
        });

        // 加载主题设置的Promise
        const loadSettingsPromise = (async () => {
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

          // 立即更新全局颜色常量，确保在应用启动时就设置正确的颜色
          const isDark = savedTheme === 'dark' || (savedTheme === 'system' && systemTheme === 'dark');
          updateThemeColors(isDark);

          return true;
        })();

        // 使用Promise.race确保不会无限等待
        await Promise.race([loadSettingsPromise, timeoutPromise]);
      } catch (error) {
        console.error('ThemeContext: 加载主题设置失败:', error);
        console.error('ThemeContext: 使用默认主题设置');

        // 使用默认设置
        const isDark = systemTheme === 'dark';
        updateThemeColors(isDark);
      }
    };

    loadThemeSettings();
  }, [systemTheme]);

  // 获取当前应该使用的主题模式（light/dark）
  const currentThemeMode = useMemo(() => {
    if (themeType === 'system') {
      return systemTheme || 'light';
    }
    return themeType;
  }, [themeType, systemTheme]);

  // 监听主题类型和风格变化
  useEffect(() => {
    try {
      // 确定是否为深色模式
      const isDark = currentThemeMode === 'dark';

      // 获取基础主题，添加错误处理
      let baseTheme;
      try {
        // 检查 themeStyle 和 currentThemeMode 是否有效
        if (!DEFAULT_THEMES[themeStyle]) {
          console.warn(`无效的主题风格: ${themeStyle}，使用 classic 风格`);
          baseTheme = DEFAULT_THEMES.classic[currentThemeMode] || lightTheme;
        } else if (!DEFAULT_THEMES[themeStyle][currentThemeMode]) {
          console.warn(`无效的主题模式: ${currentThemeMode}，使用 light 模式`);
          baseTheme = DEFAULT_THEMES[themeStyle].light || lightTheme;
        } else {
          baseTheme = DEFAULT_THEMES[themeStyle][currentThemeMode];
        }
      } catch (error) {
        console.error('获取基础主题失败:', error.message);
        baseTheme = lightTheme; // 使用默认浅色主题
      }

      // 合并自定义主题，添加错误处理
      let mergedTheme;
      try {
        const customColors = customTheme[currentThemeMode]?.colors || {};
        mergedTheme = merge({}, baseTheme, {
          colors: customColors,
        });
      } catch (error) {
        console.error('合并自定义主题失败:', error.message);
        mergedTheme = baseTheme; // 使用基础主题
      }

      // 更新全局颜色常量，添加错误处理
      try {
        updateThemeColors(isDark);
      } catch (error) {
        console.error('更新全局颜色常量失败:', error.message);
      }

      setTheme(mergedTheme);
      setIsDarkMode(isDark);
    } catch (error) {
      console.error('主题更新失败:', error.message);
      // 使用默认主题
      setTheme(lightTheme);
      setIsDarkMode(false);
    }
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
    if (!colorKey) {return fallback || theme.colors.text;}
    return theme.colors[colorKey] || fallback || theme.colors.text;
  }, [theme.colors]);

  /**
   * 获取指定主题模式对应的完整主题对象
   * @param {string} mode - 主题模式：light, dark
   * @returns {object} - 合并自定义颜色后的主题对象
   */
  const getThemeByMode = useCallback((mode = currentThemeMode) => {
    const normalizedMode = mode === 'dark' ? 'dark' : 'light';
    const themeSet = DEFAULT_THEMES[themeStyle] || DEFAULT_THEMES.classic;
    const baseTheme = themeSet[normalizedMode] || DEFAULT_THEMES.classic[normalizedMode];
    const customColors = customTheme[normalizedMode]?.colors || {};

    return merge({}, baseTheme, {
      colors: customColors,
    });
  }, [currentThemeMode, customTheme, themeStyle]);

  /**
   * 获取指定主题模式下的颜色值
   * @param {string} colorKey - 颜色键名
   * @param {string} mode - 主题模式：light, dark
   * @param {string} fallback - 备用颜色
   * @returns {string} - 对应的颜色值
   */
  const getModeColor = useCallback((colorKey, mode = currentThemeMode, fallback) => {
    const modeTheme = getThemeByMode(mode);

    if (!colorKey) {
      return fallback || modeTheme.colors.text;
    }

    return modeTheme.colors[colorKey] || fallback || modeTheme.colors.text;
  }, [currentThemeMode, getThemeByMode]);

  /**
   * 更新主题颜色
   * @param {string} colorKey - 颜色键名
   * @param {string} value - 颜色值
   * @param {string} mode - 主题模式：light, dark, both
   */
  const updateThemeColor = useCallback(async (colorKey, value, mode = 'both') => {
    if (!colorKey || !value) {return;}

    const newCustomTheme = { ...customTheme };

    if (mode === 'both' || mode === 'light') {
      newCustomTheme.light = {
        ...newCustomTheme.light,
        colors: {
          ...(newCustomTheme.light?.colors || {}),
          [colorKey]: value,
        },
      };
    }

    if (mode === 'both' || mode === 'dark') {
      newCustomTheme.dark = {
        ...newCustomTheme.dark,
        colors: {
          ...(newCustomTheme.dark?.colors || {}),
          [colorKey]: value,
        },
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
        colors: {},
      };
    }

    if (mode === 'both' || mode === 'dark') {
      newCustomTheme.dark = {
        ...newCustomTheme.dark,
        colors: {},
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
    if (!path) {return defaultValue;}

    try {
      const parts = path.split('.');
      let value = theme;

      for (const part of parts) {
        value = value[part];
        if (value === undefined) {return defaultValue;}
      }

      return value;
    } catch (error) {
      console.error('获取主题值失败:', error);
      return defaultValue;
    }
  }, [theme]);

  // 上下文值
  const contextValue = useMemo(() => {
    return {
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
      getModeColor,
      getThemeByMode,
      updateThemeColor,
      resetThemeColors,
      getThemeValue,
    };
  }, [
    theme,
    isDarkMode,
    themeType,
    themeStyle,
    customTheme,
    toggleTheme,
    handleSetThemeType,
    handleSetThemeStyle,
    getColor,
    getModeColor,
    getThemeByMode,
    updateThemeColor,
    resetThemeColors,
    getThemeValue,
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
  try {
    const context = useContext(ThemeContext);

    if (!context) {
      console.warn('useTheme: 主题上下文不存在，使用默认主题');
      // 返回默认主题，而不是抛出错误
      return {
        theme: lightTheme,
        colors: lightTheme.colors,
        dimensions: lightTheme.dimensions,
        typography: lightTheme.typography,
        isDarkMode: false,
        themeType: 'light',
        themeStyle: 'classic',
        toggleTheme: () => {},
        setThemeType: () => {},
        setThemeStyle: () => {},
        getColor: () => {},
        getModeColor: () => {},
        getThemeByMode: () => lightTheme,
        updateThemeColor: () => {},
        resetThemeColors: () => {},
        getThemeValue: () => {},
      };
    }

    if (!context.theme || !context.theme.colors) {
      console.warn('useTheme: 主题对象无效，使用默认主题');
      return {
        theme: lightTheme,
        colors: lightTheme.colors,
        dimensions: lightTheme.dimensions,
        typography: lightTheme.typography,
        isDarkMode: false,
        themeType: 'light',
        themeStyle: 'classic',
        toggleTheme: () => {},
        setThemeType: () => {},
        setThemeStyle: () => {},
        getColor: () => {},
        getModeColor: () => {},
        getThemeByMode: () => lightTheme,
        updateThemeColor: () => {},
        resetThemeColors: () => {},
        getThemeValue: () => {},
      };
    }

    return context;
  } catch (error) {
    console.error('useTheme: 获取主题上下文失败:', error.message);
    // 返回默认主题，而不是抛出错误
    return {
      theme: lightTheme,
      isDarkMode: false,
      themeType: 'light',
      themeStyle: 'classic',
      toggleTheme: () => {},
      setThemeType: () => {},
      getColor: () => {},
      getModeColor: () => {},
      getThemeByMode: () => lightTheme,
      updateThemeColor: () => {},
      resetThemeColors: () => {},
      getThemeValue: () => {},
    };
  }
};
