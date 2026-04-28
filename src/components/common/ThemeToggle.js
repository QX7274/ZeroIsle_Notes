/**
 * 主题切换组件
 */
import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Text } from './Typography';

/**
 * 主题切换组件
 * @param {string} type - 切换类型：switch, button, icon
 * @param {object} style - 自定义样式
 */
const ThemeToggle = ({ type = 'switch', style }) => {
  const { isDarkMode, toggleTheme, themeType, setThemeType, theme } = useTheme();
  const { colors } = theme;

  const dynamicStyles = {
    container: {
      backgroundColor: colors.background,
      borderColor: colors.border,
      borderWidth: 1,
    },
    button: {
      // default transparent
    },
    activeButton: {
      backgroundColor: colors.primary + '20', // 20% opacity
    },
    switch: {
      backgroundColor: isDarkMode ? colors.primary : colors.border,
    },
    switchThumb: {
      backgroundColor: colors.card,
    },
    iconButton: {
      backgroundColor: colors.background,
    },
  };

  // 切换按钮
  if (type === 'button') {
    return (
      <View style={[styles.container, dynamicStyles.container, style]}>
        <TouchableOpacity
          style={[
            styles.button,
            themeType === 'light' && dynamicStyles.activeButton,
          ]}
          onPress={() => setThemeType('light')}
        >
          <Text
            size="small"
            color={themeType === 'light' ? 'primary' : 'text'}
            bold={themeType === 'light'}
          >
            浅色
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.button,
            themeType === 'system' && dynamicStyles.activeButton,
          ]}
          onPress={() => setThemeType('system')}
        >
          <Text
            size="small"
            color={themeType === 'system' ? 'primary' : 'text'}
            bold={themeType === 'system'}
          >
            跟随系统
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.button,
            themeType === 'dark' && dynamicStyles.activeButton,
          ]}
          onPress={() => setThemeType('dark')}
        >
          <Text
            size="small"
            color={themeType === 'dark' ? 'primary' : 'text'}
            bold={themeType === 'dark'}
          >
            深色
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  // 切换开关
  if (type === 'switch') {
    return (
      <TouchableOpacity
        style={[styles.switch, dynamicStyles.switch, style]}
        onPress={toggleTheme}
        activeOpacity={0.8}
      >
        <View
          style={[
            styles.switchThumb,
            isDarkMode && styles.switchThumbActive,
            dynamicStyles.switchThumb,
          ]}
        />
      </TouchableOpacity>
    );
  }

  // 切换图标
  return (
    <TouchableOpacity
      style={[styles.iconButton, dynamicStyles.iconButton, style]}
      onPress={toggleTheme}
      activeOpacity={0.7}
    >
      <Text size="large" center>
        {isDarkMode ? '🌙' : '☀️'}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    overflow: 'hidden',
    // backgroundColor removed, handled by dynamicStyles
  },
  button: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // activeButton removed, handled by dynamicStyles
  switch: {
    width: 50,
    height: 28,
    borderRadius: 14,
    // backgroundColor removed
    padding: 2,
    justifyContent: 'center',
  },
  // switchActive removed
  switchThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    // backgroundColor removed
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
    elevation: 2,
    transform: [{ translateX: 0 }],
  },
  switchThumbActive: {
    transform: [{ translateX: 22 }],
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    // backgroundColor removed
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default ThemeToggle;
