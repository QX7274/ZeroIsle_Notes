/**
 * 渐变按钮组件
 * 提供带有渐变背景的按钮
 */
import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';

/**
 * 渐变按钮组件
 * @param {string} title - 按钮文字
 * @param {function} onPress - 点击事件处理函数
 * @param {string} type - 按钮类型：primary, secondary, success, warning, error
 * @param {string} size - 按钮大小：small, medium, large, xlarge
 * @param {boolean} disabled - 是否禁用
 * @param {boolean} loading - 是否显示加载状态
 * @param {boolean} fullWidth - 是否占满宽度
 * @param {array} colors - 自定义渐变颜色数组
 * @param {object} style - 自定义样式
 * @param {object} textStyle - 文字自定义样式
 */
const GradientButton = ({
  title,
  onPress,
  type = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  fullWidth = false,
  colors,
  style,
  textStyle,
  children,
  ...props
}) => {
  const { theme } = useTheme();
  const { colors: themeColors, dimensions } = theme;

  // 获取渐变颜色
  const getGradientColors = () => {
    if (colors && Array.isArray(colors) && colors.length >= 2) {
      return colors;
    }

    // 使用主题中定义的渐变色
    if (themeColors.gradient && themeColors.gradient[type]) {
      return themeColors.gradient[type];
    }

    // 默认渐变色
    switch (type) {
      case 'primary':
        return ['#4361EE', '#3A0CA3'];
      case 'secondary':
        return ['#7209B7', '#3A0CA3'];
      case 'success':
        return ['#4CC9F0', '#4895EF'];
      case 'warning':
        return ['#F8961E', '#F3722C'];
      case 'error':
        return ['#F72585', '#B5179E'];
      default:
        return ['#4361EE', '#3A0CA3'];
    }
  };

  // 按钮尺寸样式
  const getSizeStyle = () => {
    switch (size) {
      case 'small':
        return {
          button: styles.smallButton,
          text: styles.smallText,
        };
      case 'large':
        return {
          button: styles.largeButton,
          text: styles.largeText,
        };
      case 'xlarge':
        return {
          button: styles.xlargeButton,
          text: styles.xlargeText,
        };
      case 'medium':
      default:
        return {
          button: styles.mediumButton,
          text: styles.mediumText,
        };
    }
  };

  const sizeStyle = getSizeStyle();
  const gradientColors = getGradientColors();

  // 按钮容器样式
  const containerStyle = [
    styles.container,
    sizeStyle.button,
    fullWidth && styles.fullWidth,
    style,
  ];

  // 按钮文字样式
  const buttonTextStyle = [
    styles.text,
    sizeStyle.text,
    { color: '#FFFFFF' },
    textStyle,
  ];

  // 禁用状态样式
  const disabledStyle = {
    opacity: 0.5,
  };

  return (
    <TouchableOpacity
      style={containerStyle}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      {...props}
    >
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[
          styles.gradient,
          disabled && disabledStyle,
        ]}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <>
            {children || <Text style={buttonTextStyle}>{title}</Text>}
          </>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
};

// 创建样式
const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  gradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  text: {
    fontWeight: '600',
    textAlign: 'center',
  },
  fullWidth: {
    width: '100%',
  },
  // 尺寸样式
  smallButton: {
    height: 36,
    minWidth: 80,
  },
  smallText: {
    fontSize: 12,
    paddingHorizontal: 12,
  },
  mediumButton: {
    height: 44,
    minWidth: 120,
  },
  mediumText: {
    fontSize: 14,
    paddingHorizontal: 16,
  },
  largeButton: {
    height: 52,
    minWidth: 160,
  },
  largeText: {
    fontSize: 16,
    paddingHorizontal: 20,
  },
  xlargeButton: {
    height: 60,
    minWidth: 200,
  },
  xlargeText: {
    fontSize: 18,
    paddingHorizontal: 24,
  },
});

export default GradientButton;
