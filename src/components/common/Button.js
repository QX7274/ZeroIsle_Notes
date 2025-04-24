/**
 * 现代化通用按钮组件
 * 支持渐变背景、阴影效果和多种样式
 */

import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, View } from 'react-native';
import { SPACING, SHADOW } from '../../utils/constants/dimensions';
import { useTheme } from '../../context/ThemeContext';
import LinearGradient from 'react-native-linear-gradient';
import { createHorizontalGradient } from '../../utils/gradientUtils';

/**
 * 现代化按钮组件
 * @param {string} title - 按钮文字
 * @param {function} onPress - 点击事件处理函数
 * @param {string} type - 按钮类型：primary, secondary, outline, text, gradient
 * @param {boolean} disabled - 是否禁用
 * @param {boolean} loading - 是否显示加载状态
 * @param {string} size - 按钮大小：small, medium, large
 * @param {string} elevation - 阴影高度：none, small, medium, large
 * @param {boolean} rounded - 是否使用圆角
 * @param {string} gradientType - 渐变类型：primary, secondary, success, error, warning
 * @param {object} style - 自定义样式
 * @param {object} textStyle - 文字自定义样式
 * @param {object} gradientProps - 渐变属性
 */
const Button = ({
  title,
  onPress,
  type = 'primary',
  disabled = false,
  loading = false,
  size = 'medium',
  elevation = 'medium',
  rounded = false,
  gradientType = 'primary',
  style,
  textStyle,
  gradientProps,
  ...props
}) => {
  const { colors, isDarkMode } = useTheme();
  // 获取动态样式
  const dynamicStyles = getStyles(colors, isDarkMode);

  // 根据类型和状态确定样式
  const buttonStyle = [dynamicStyles.button];
  const buttonTextStyle = [dynamicStyles.text];

  // 根据大小添加样式
  switch (size) {
    case 'small':
      buttonStyle.push(dynamicStyles.smallButton);
      buttonTextStyle.push(dynamicStyles.smallText);
      break;
    case 'large':
      buttonStyle.push(dynamicStyles.largeButton);
      buttonTextStyle.push(dynamicStyles.largeText);
      break;
    default:
      // medium 是默认值，不需要额外样式
      break;
  }

  // 圆角样式
  if (rounded) {
    buttonStyle.push(dynamicStyles.roundedButton);
  }

  // 阴影样式
  if (elevation !== 'none' && type !== 'text' && type !== 'outline') {
    switch (elevation) {
      case 'small':
        buttonStyle.push(dynamicStyles.elevationSmall);
        break;
      case 'large':
        buttonStyle.push(dynamicStyles.elevationLarge);
        break;
      default:
        buttonStyle.push(dynamicStyles.elevationMedium);
        break;
    }
  }

  // 添加自定义样式
  if (style) {
    buttonStyle.push(style);
  }

  if (textStyle) {
    buttonTextStyle.push(textStyle);
  }

  // 禁用状态样式
  if (disabled) {
    buttonStyle.push(dynamicStyles.disabledButton);
    buttonTextStyle.push(dynamicStyles.disabledText);

    // 渲染禁用按钮
    return (
      <View style={[buttonStyle, { overflow: 'hidden' }]}>
        {loading ? (
          <ActivityIndicator
            size="small"
            color={colors.textSecondary}
          />
        ) : (
          <Text style={buttonTextStyle}>{title}</Text>
        )}
      </View>
    );
  }

  // 根据类型渲染不同的按钮
  if (type === 'gradient') {
    // 渐变按钮
    const gradientColors = colors.gradients[gradientType] || colors.gradients.primary;

    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={loading}
        activeOpacity={0.8}
        style={[buttonStyle, { overflow: 'hidden', backgroundColor: 'transparent' }]}
        {...props}
      >
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
          {...gradientProps}
        />
        {loading ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Text style={[buttonTextStyle, dynamicStyles.primaryText]}>
            {title}
          </Text>
        )}
      </TouchableOpacity>
    );
  } else if (type === 'outline') {
    // 轮廓按钮
    buttonStyle.push(dynamicStyles.outlineButton);
    buttonTextStyle.push(dynamicStyles.outlineText);

    return (
      <TouchableOpacity
        style={buttonStyle}
        onPress={onPress}
        disabled={loading}
        activeOpacity={0.7}
        {...props}
      >
        {loading ? (
          <ActivityIndicator
            size="small"
            color={colors.primary}
          />
        ) : (
          <Text style={buttonTextStyle}>{title}</Text>
        )}
      </TouchableOpacity>
    );
  } else if (type === 'text') {
    // 文本按钮
    buttonStyle.push(dynamicStyles.textButton);
    buttonTextStyle.push(dynamicStyles.textButtonText);

    return (
      <TouchableOpacity
        style={buttonStyle}
        onPress={onPress}
        disabled={loading}
        activeOpacity={0.5}
        {...props}
      >
        {loading ? (
          <ActivityIndicator
            size="small"
            color={colors.primary}
          />
        ) : (
          <Text style={buttonTextStyle}>{title}</Text>
        )}
      </TouchableOpacity>
    );
  } else {
    // 普通按钮 (primary, secondary)
    if (type === 'primary') {
      buttonStyle.push(dynamicStyles.primaryButton);
      buttonTextStyle.push(dynamicStyles.primaryText);
    } else if (type === 'secondary') {
      buttonStyle.push(dynamicStyles.secondaryButton);
      buttonTextStyle.push(dynamicStyles.secondaryText);
    }

    return (
      <TouchableOpacity
        style={buttonStyle}
        onPress={onPress}
        disabled={loading}
        activeOpacity={0.7}
        {...props}
      >
        {loading ? (
          <ActivityIndicator
            size="small"
            color="#FFFFFF"
          />
        ) : (
          <Text style={buttonTextStyle}>{title}</Text>
        )}
      </TouchableOpacity>
    );
  }
};

// 使用内联样式，因为我们需要访问动态的颜色主题
const getStyles = (colors, isDarkMode) => ({
  // 基础按钮样式
  button: {
    borderRadius: 10,
    paddingVertical: SPACING.MEDIUM,
    paddingHorizontal: SPACING.LARGE,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 120,
    flexDirection: 'row',
  },

  // 文本样式
  text: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },

  // 按钮大小变体
  smallButton: {
    paddingVertical: SPACING.SMALL,
    paddingHorizontal: SPACING.MEDIUM,
    minWidth: 80,
  },
  smallText: {
    fontSize: 14,
  },
  largeButton: {
    paddingVertical: SPACING.LARGE,
    paddingHorizontal: SPACING.XLARGE,
    minWidth: 160,
  },
  largeText: {
    fontSize: 18,
    fontWeight: '700',
  },

  // 圆角按钮
  roundedButton: {
    borderRadius: 50,
  },

  // 主要按钮样式
  primaryButton: {
    backgroundColor: colors.primary,
  },
  primaryText: {
    color: '#FFFFFF',
  },

  // 次要按钮样式
  secondaryButton: {
    backgroundColor: colors.secondary,
  },
  secondaryText: {
    color: '#FFFFFF',
  },

  // 轮廓按钮样式
  outlineButton: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  outlineText: {
    color: colors.primary,
  },

  // 文本按钮样式
  textButton: {
    backgroundColor: 'transparent',
    paddingVertical: SPACING.SMALL,
    paddingHorizontal: SPACING.SMALL,
    minWidth: 0,
  },
  textButtonText: {
    color: colors.primary,
    fontWeight: '500',
  },

  // 禁用状态
  disabledButton: {
    backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
    borderColor: 'transparent',
  },
  disabledText: {
    color: isDarkMode ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)',
  },

  // 阴影样式
  elevationSmall: {
    ...SHADOW.SMALL,
  },
  elevationMedium: {
    ...SHADOW.MEDIUM,
  },
  elevationLarge: {
    ...SHADOW.LARGE,
  },
});

// 创建一个空的StyleSheet，实际样式将在组件内部动态生成
const styles = StyleSheet.create({});

export default Button;