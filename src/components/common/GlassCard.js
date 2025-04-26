/**
 * 玻璃拟态卡片组件
 * 提供带有毛玻璃效果的卡片
 */
import React from 'react';
import { View, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '../../context/ThemeContext';

/**
 * 玻璃拟态卡片组件
 * @param {React.ReactNode} children - 卡片内容
 * @param {function} onPress - 点击事件处理函数
 * @param {boolean} disabled - 是否禁用点击
 * @param {object} style - 自定义样式
 * @param {string} intensity - 模糊强度：light, medium, dark
 * @param {string} tint - 模糊色调：light, dark, default
 * @param {boolean} fullWidth - 是否占满宽度
 * @param {number} borderRadius - 边框圆角
 */
const GlassCard = ({
  children,
  onPress,
  disabled = false,
  style,
  intensity = 'medium',
  tint = 'default',
  fullWidth = false,
  borderRadius,
  ...props
}) => {
  const { theme } = useTheme();
  const { colors, dimensions } = theme;

  // 获取模糊强度
  const getIntensity = () => {
    switch (intensity) {
      case 'light':
        return 50;
      case 'dark':
        return 100;
      case 'medium':
      default:
        return 75;
    }
  };

  // 获取模糊色调
  const getTint = () => {
    if (tint === 'default') {
      return theme.dark ? 'dark' : 'light';
    }
    return tint;
  };

  // 卡片基础样式
  const cardStyle = [
    styles.card,
    {
      borderRadius: borderRadius || dimensions.BORDER_RADIUS.MEDIUM,
      borderColor: colors.border,
    },
    fullWidth && styles.fullWidth,
    disabled && styles.disabled,
    style,
  ];

  // 内容容器样式
  const contentStyle = [
    styles.content,
    {
      padding: dimensions.SPACING.MEDIUM,
    },
  ];

  // 渲染卡片内容
  const renderContent = () => {
    // 在iOS上使用BlurView
    if (Platform.OS === 'ios') {
      return (
        <BlurView
          intensity={getIntensity()}
          tint={getTint()}
          style={[styles.blurView, { borderRadius: borderRadius || dimensions.BORDER_RADIUS.MEDIUM }]}
        >
          <View style={contentStyle}>{children}</View>
        </BlurView>
      );
    }

    // 在Android上使用半透明背景
    return (
      <View
        style={[
          styles.androidFallback,
          {
            backgroundColor: theme.dark
              ? 'rgba(30, 30, 30, 0.8)'
              : 'rgba(255, 255, 255, 0.8)',
            borderRadius: borderRadius || dimensions.BORDER_RADIUS.MEDIUM,
          },
        ]}
      >
        <View style={contentStyle}>{children}</View>
      </View>
    );
  };

  // 如果有onPress，则使用TouchableOpacity，否则使用View
  if (onPress) {
    return (
      <TouchableOpacity
        style={cardStyle}
        onPress={onPress}
        disabled={disabled}
        activeOpacity={0.8}
        {...props}
      >
        {renderContent()}
      </TouchableOpacity>
    );
  }

  return (
    <View style={cardStyle} {...props}>
      {renderContent()}
    </View>
  );
};

// 创建样式
const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    marginVertical: 8,
    marginHorizontal: 8,
    // 阴影
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  blurView: {
    overflow: 'hidden',
  },
  androidFallback: {
    overflow: 'hidden',
  },
  content: {
    width: '100%',
  },
  fullWidth: {
    width: '100%',
    marginHorizontal: 0,
  },
  disabled: {
    opacity: 0.7,
  },
});

export default GlassCard;
