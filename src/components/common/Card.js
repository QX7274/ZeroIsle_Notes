/**
 * 通用卡片组件
 */

import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

/**
 * 通用卡片组件
 * @param {React.ReactNode} children - 卡片内容
 * @param {function} onPress - 点击事件处理函数
 * @param {boolean} disabled - 是否禁用点击
 * @param {object} style - 自定义样式
 * @param {string} elevation - 阴影高度：none, small, medium, large, xlarge
 * @param {string} variant - 卡片变体：default, outlined, flat
 * @param {boolean} fullWidth - 是否占满宽度
 */
const Card = ({
  children,
  onPress,
  disabled = false,
  style,
  elevation = 'medium',
  variant = 'default',
  fullWidth = false,
  ...props
}) => {
  const { theme } = useTheme();
  const { colors, dimensions } = theme;

  // 卡片基础样式
  const cardStyle = [
    styles.card,
    {
      backgroundColor: colors.card,
      borderRadius: dimensions.BORDER_RADIUS.MEDIUM,
      padding: dimensions.SPACING.MEDIUM,
      marginVertical: dimensions.SPACING.SMALL,
    },
  ];

  // 根据变体添加样式
  switch (variant) {
    case 'outlined':
      cardStyle.push({
        backgroundColor: 'transparent',
        borderWidth: dimensions.BORDER_WIDTH.REGULAR,
        borderColor: colors.border,
      });
      break;
    case 'flat':
      cardStyle.push({
        backgroundColor: colors.background,
      });
      break;
    default:
      // 默认样式，不需要额外添加
      break;
  }

  // 根据elevation确定阴影样式
  if (variant !== 'outlined' && variant !== 'flat') {
    switch (elevation) {
      case 'none':
        // 不添加阴影
        break;
      case 'small':
        cardStyle.push(dimensions.SHADOW.SMALL);
        break;
      case 'medium':
        cardStyle.push(dimensions.SHADOW.MEDIUM);
        break;
      case 'large':
        cardStyle.push(dimensions.SHADOW.LARGE);
        break;
      case 'xlarge':
        cardStyle.push(dimensions.SHADOW.XLARGE);
        break;
      default:
        cardStyle.push(dimensions.SHADOW.MEDIUM);
    }
  }

  // 全宽样式
  if (fullWidth) {
    cardStyle.push({
      width: '100%',
      marginHorizontal: 0,
    });
  }

  // 禁用状态样式
  if (disabled) {
    cardStyle.push({
      opacity: 0.7,
    });
  }

  // 添加自定义样式
  if (style) {
    cardStyle.push(style);
  }

  // 如果有onPress，则使用TouchableOpacity，否则使用View
  if (onPress) {
    return (
      <TouchableOpacity
        style={cardStyle}
        onPress={onPress}
        disabled={disabled}
        activeOpacity={0.7}
        {...props}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return (
    <View style={cardStyle} {...props}>
      {children}
    </View>
  );
};

// 创建样式
const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
  },
});

export default Card;