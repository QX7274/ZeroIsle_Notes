/**
 * 通用卡片组件
 */

import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { SPACING } from '../../utils/constants/dimensions';
import { useTheme } from '../../context/ThemeContext';

/**
 * 通用卡片组件
 * @param {node} children - 卡片内容
 * @param {function} onPress - 点击事件处理函数
 * @param {boolean} disabled - 是否禁用点击
 * @param {object} style - 自定义样式
 * @param {string} elevation - 阴影高度：none, small, medium, large
 */
const Card = ({
  children,
  onPress,
  disabled = false,
  style,
  elevation = 'medium',
  ...props
}) => {
  const { colors } = useTheme();
  // 获取动态样式
  const dynamicStyles = getStyles(colors);

  // 根据elevation确定阴影样式
  const cardStyle = [dynamicStyles.card];

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

// 使用内联样式，因为我们需要访问动态的颜色主题
const getStyles = (colors) => ({
  card: {
    backgroundColor: colors.white || '#FFFFFF',
    borderRadius: 8, // 使用固定值
    padding: SPACING.MEDIUM,
    marginVertical: SPACING.SMALL,
  },
  elevationSmall: {
    elevation: 2,
    shadowColor: colors.shadow || '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  elevationMedium: {
    elevation: 4,
    shadowColor: colors.shadow || '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  elevationLarge: {
    elevation: 8,
    shadowColor: colors.shadow || '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
  },
});

// 创建一个空的StyleSheet，实际样式将在组件内部动态生成
const styles = StyleSheet.create({
  card: {},
  elevationSmall: {},
  elevationMedium: {},
  elevationLarge: {},
});

export default Card;