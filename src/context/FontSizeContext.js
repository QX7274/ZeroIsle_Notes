/**
 * 字体大小上下文
 * 提供全局字体大小管理功能
 */
import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import realmService from '../services/database/realmService';

// 定义字体大小存储键
const FONT_SIZE_KEY = 'zeroislenotes_font_size';

// 字体大小配置
export const FONT_SIZES = {
  small: {
    heading1: 24,
    heading2: 20,
    heading3: 18,
    heading4: 16,
    heading5: 14,
    body: 14,
    caption: 12,
    button: 14,
    input: 14,
    label: 12,
    small: 10,
  },
  medium: {
    heading1: 28,
    heading2: 24,
    heading3: 20,
    heading4: 18,
    heading5: 16,
    body: 16,
    caption: 14,
    button: 16,
    input: 16,
    label: 14,
    small: 12,
  },
  large: {
    heading1: 32,
    heading2: 28,
    heading3: 24,
    heading4: 20,
    heading5: 18,
    body: 18,
    caption: 16,
    button: 18,
    input: 18,
    label: 16,
    small: 14,
  },
};

// 获取字体大小
const getFontSize = async () => {
  try {
    const realm = await realmService.getRealm();
    const item = realm.objects('StorageItem').filtered(`key = "${FONT_SIZE_KEY}"`);
    const fontSize = item.length > 0 ? item[0].value : null;
    return fontSize || 'medium';
  } catch (error) {
    console.error('获取字体大小失败:', error);
    return 'medium';
  }
};

// 保存字体大小
const saveFontSize = async (fontSize) => {
  try {
    const realm = await realmService.getRealm();
    realm.write(() => {
      const existingItem = realm.objects('StorageItem').filtered(`key = "${FONT_SIZE_KEY}"`);
      if (existingItem.length > 0) {
        existingItem[0].value = fontSize;
        existingItem[0].updated_at = new Date();
      } else {
        realm.create('StorageItem', {
          key: FONT_SIZE_KEY,
          value: fontSize,
          createdAt: new Date(),
          updated_at: new Date(),
        });
      }
    });
    return true;
  } catch (error) {
    console.error('保存字体大小失败:', error);
    return false;
  }
};

// 创建字体大小上下文
const FontSizeContext = createContext({
  fontSize: 'medium',
  fontSizes: FONT_SIZES.medium,
  setFontSize: () => {},
  getFontSizeValue: () => {},
});

/**
 * 字体大小提供者组件
 */
export const FontSizeProvider = ({ children }) => {
  // 字体大小状态
  const [fontSize, setFontSizeState] = useState('medium');

  // 加载保存的字体大小设置
  useEffect(() => {
    const loadFontSizeSettings = async () => {
      try {
        console.log('FontSizeContext: 开始加载字体大小设置...');

        // 添加超时机制
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('加载字体大小设置超时')), 3000);
        });

        // 加载字体大小设置的Promise
        const loadSettingsPromise = (async () => {
          const savedFontSize = await getFontSize();
          if (savedFontSize) {
            setFontSizeState(savedFontSize);
            console.log('FontSizeContext: 已加载字体大小:', savedFontSize);
          }
          return true;
        })();

        // 使用Promise.race确保不会无限等待
        await Promise.race([loadSettingsPromise, timeoutPromise]);
      } catch (error) {
        console.error('FontSizeContext: 加载字体大小设置失败:', error);
        console.error('FontSizeContext: 使用默认字体大小设置');
      }
    };

    loadFontSizeSettings();
  }, []);

  /**
   * 设置字体大小
   * @param {string} size - 字体大小：small, medium, large
   */
  const setFontSize = useCallback(async (size) => {
    if (!FONT_SIZES[size]) {
      console.warn(`无效的字体大小: ${size}，使用 medium`);
      size = 'medium';
    }

    setFontSizeState(size);

    try {
      await saveFontSize(size);
    } catch (error) {
      console.error('保存字体大小失败:', error);
    }
  }, []);

  /**
   * 获取字体大小值
   * @param {string} type - 字体类型：heading1, body, caption等
   * @returns {number} - 对应的字体大小值
   */
  const getFontSizeValue = useCallback((type) => {
    if (!type) {return FONT_SIZES[fontSize].body;}
    return FONT_SIZES[fontSize][type] || FONT_SIZES[fontSize].body;
  }, [fontSize]);

  // 当前字体大小配置
  const currentFontSizes = useMemo(() => {
    return FONT_SIZES[fontSize] || FONT_SIZES.medium;
  }, [fontSize]);

  // 上下文值
  const contextValue = useMemo(() => ({
    fontSize,
    fontSizes: currentFontSizes,
    setFontSize,
    getFontSizeValue,
  }), [fontSize, currentFontSizes, setFontSize, getFontSizeValue]);

  return (
    <FontSizeContext.Provider value={contextValue}>
      {children}
    </FontSizeContext.Provider>
  );
};

/**
 * 使用字体大小的钩子
 * @returns {object} 字体大小上下文
 */
export const useFontSize = () => {
  try {
    const context = useContext(FontSizeContext);
    if (!context) {
      console.warn('useFontSize: 字体大小上下文不存在，使用默认字体大小');
      // 返回默认字体大小，而不是抛出错误
      return {
        fontSize: 'medium',
        fontSizes: FONT_SIZES.medium,
        setFontSize: () => {},
        getFontSizeValue: () => FONT_SIZES.medium.body,
      };
    }
    return context;
  } catch (error) {
    console.error('useFontSize: 获取字体大小上下文失败:', error.message);
    // 返回默认字体大小，而不是抛出错误
    return {
      fontSize: 'medium',
      fontSizes: FONT_SIZES.medium,
      setFontSize: () => {},
      getFontSizeValue: () => FONT_SIZES.medium.body,
    };
  }
};
