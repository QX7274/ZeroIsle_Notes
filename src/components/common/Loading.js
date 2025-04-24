/**
 * 通用加载指示器组件
 */

import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { SPACING } from '../../utils/constants/dimensions';
import { useTheme } from '../../context/ThemeContext';

/**
 * 通用加载指示器组件
 * @param {string} text - 加载文本
 * @param {string} size - 指示器大小：small, large
 * @param {string} type - 加载器类型：fullscreen, inline
 * @param {object} style - 自定义样式
 */
const Loading = ({
  text,
  size = 'large',
  type = 'inline',
  style,
}) => {
  const { colors } = useTheme();
  // 获取动态样式
  const dynamicStyles = getStyles(colors);

  // 根据类型确定样式
  const containerStyle = [
    dynamicStyles.container,
    type === 'fullscreen' && dynamicStyles.fullscreen,
    style,
  ];

  return (
    <View style={containerStyle}>
      <ActivityIndicator
        size={size}
        color={colors.primary || '#007AFF'}
        style={dynamicStyles.indicator}
      />
      {text && <Text style={dynamicStyles.text}>{text}</Text>}
    </View>
  );
};

// 使用内联样式，因为我们需要访问动态的颜色主题
const getStyles = (colors) => ({
  container: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.MEDIUM,
  },
  fullscreen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    zIndex: 999,
  },
  indicator: {
    marginBottom: SPACING.SMALL,
  },
  text: {
    color: colors.text || '#000000',
    fontSize: 16,
    textAlign: 'center',
  },
});

// 创建一个空的StyleSheet，实际样式将在组件内部动态生成
const styles = StyleSheet.create({
  container: {},
  fullscreen: {},
  indicator: {},
  text: {},
});

export default Loading;