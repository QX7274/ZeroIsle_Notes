/**
 * 现代化卡片组件
 * 支持渐变边框、阴影效果和多种样式
 */

import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { SPACING, SHADOW, BORDER_RADIUS } from '../../utils/constants/dimensions';
import { useTheme } from '../../context/ThemeContext';
import LinearGradient from 'react-native-linear-gradient';

/**
 * 现代化卡片组件
 * @param {node} children - 卡片内容
 * @param {function} onPress - 点击事件处理函数
 * @param {boolean} disabled - 是否禁用点击
 * @param {object} style - 自定义样式
 * @param {object} contentStyle - 内容容器样式
 * @param {string} elevation - 阴影高度：none, small, medium, large
 * @param {string} variant - 卡片变体：default, outlined, gradient, glass
 * @param {string} gradientType - 渐变类型：primary, secondary, success, error, warning
 * @param {boolean} hoverable - 是否启用悬停效果
 * @param {number} borderRadius - 自定义圆角大小
 */
const Card = ({
  children,
  onPress,
  disabled = false,
  style,
  contentStyle,
  elevation = 'medium',
  variant = 'default',
  gradientType = 'primary',
  hoverable = false,
  borderRadius,
  ...props
}) => {
  const { colors, isDarkMode } = useTheme();
  // 获取动态样式
  const dynamicStyles = getStyles(colors, isDarkMode);

  // 基础卡片样式
  const cardStyle = [dynamicStyles.card];
  const contentContainerStyle = [dynamicStyles.contentContainer];

  // 自定义圆角
  if (borderRadius !== undefined) {
    cardStyle.push({ borderRadius });
  }

  // 根据variant确定卡片样式
  switch (variant) {
    case 'outlined':
      cardStyle.push(dynamicStyles.outlinedCard);
      break;
    case 'gradient':
      cardStyle.push(dynamicStyles.gradientCard);
      break;
    case 'glass':
      cardStyle.push(dynamicStyles.glassCard);
      break;
    default:
      // default样式不需要额外处理
      break;
  }

  // 根据elevation确定阴影样式
  if (variant !== 'outlined' && variant !== 'gradient') {
    switch (elevation) {
      case 'none':
        break;
      case 'small':
        cardStyle.push(dynamicStyles.elevationSmall);
        break;
      case 'medium':
        cardStyle.push(dynamicStyles.elevationMedium);
        break;
      case 'large':
        cardStyle.push(dynamicStyles.elevationLarge);
        break;
      default:
        cardStyle.push(dynamicStyles.elevationMedium);
    }
  }

  // 悬停效果
  if (hoverable && onPress) {
    cardStyle.push(dynamicStyles.hoverable);
  }

  // 添加自定义样式
  if (style) {
    cardStyle.push(style);
  }

  if (contentStyle) {
    contentContainerStyle.push(contentStyle);
  }

  // 渐变边框卡片
  if (variant === 'gradient') {
    const gradientColors = colors.gradients[gradientType] || colors.gradients.primary;

    const CardContainer = onPress ? TouchableOpacity : View;

    return (
      <CardContainer
        style={[cardStyle, { padding: 0, overflow: 'hidden' }]}
        onPress={onPress}
        disabled={disabled}
        activeOpacity={0.8}
        {...props}
      >
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={dynamicStyles.gradientBorder}
        >
          <View style={[contentContainerStyle, {
            backgroundColor: colors.cardBackground,
            margin: 2,
            borderRadius: (borderRadius !== undefined ? borderRadius : BORDER_RADIUS.MEDIUM) - 2,
          }]}>
            {children}
          </View>
        </LinearGradient>
      </CardContainer>
    );
  }

  // 玻璃效果卡片
  if (variant === 'glass') {
    const CardContainer = onPress ? TouchableOpacity : View;

    return (
      <CardContainer
        style={cardStyle}
        onPress={onPress}
        disabled={disabled}
        activeOpacity={0.8}
        {...props}
      >
        <View style={contentContainerStyle}>
          {children}
        </View>
      </CardContainer>
    );
  }

  // 标准卡片或轮廓卡片
  const CardContainer = onPress ? TouchableOpacity : View;

  return (
    <CardContainer
      style={cardStyle}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      {...props}
    >
      {children}
    </CardContainer>
  );
};

// 使用内联样式，因为我们需要访问动态的颜色主题
const getStyles = (colors, isDarkMode) => ({
  // 基础卡片样式
  card: {
    backgroundColor: colors.cardBackground,
    borderRadius: BORDER_RADIUS.MEDIUM,
    padding: SPACING.MEDIUM,
    marginVertical: SPACING.SMALL,
    overflow: 'hidden',
  },

  // 内容容器样式
  contentContainer: {
    flex: 1,
  },

  // 卡片变体
  outlinedCard: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
  },

  gradientCard: {
    backgroundColor: 'transparent',
  },

  glassCard: {
    backgroundColor: isDarkMode
      ? 'rgba(30, 30, 30, 0.7)'
      : 'rgba(255, 255, 255, 0.7)',
    backdropFilter: 'blur(10px)',
  },

  // 渐变边框
  gradientBorder: {
    flex: 1,
    padding: 0,
    borderRadius: BORDER_RADIUS.MEDIUM,
  },

  // 悬停效果
  hoverable: {
    transform: [{ scale: 1.01 }],
    transition: 'all 0.2s ease',
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

export default Card;