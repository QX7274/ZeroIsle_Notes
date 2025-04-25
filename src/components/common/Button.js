/**
 * 通用按钮组件
 */

import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { SPACING } from '../../utils/constants/dimensions';
import { useTheme } from '../../context/ThemeContext';

/**
 * 通用按钮组件
 * @param {string} title - 按钮文字
 * @param {function} onPress - 点击事件处理函数
 * @param {string} type - 按钮类型：primary, secondary, outline, text
 * @param {boolean} disabled - 是否禁用
 * @param {boolean} loading - 是否显示加载状态
 * @param {object} style - 自定义样式
 * @param {object} textStyle - 文字自定义样式
 */
const Button = ({
  title,
  onPress,
  type = 'primary',
  disabled = false,
  loading = false,
  style,
  textStyle,
  ...props
}) => {
  const { colors } = useTheme();
  // 获取动态样式
  const dynamicStyles = getStyles(colors);

  // 根据类型和状态确定样式
  const buttonStyle = [dynamicStyles.button];
  const buttonTextStyle = [dynamicStyles.text];

  // 根据类型添加样式
  switch (type) {
    case 'primary':
      buttonStyle.push(dynamicStyles.primaryButton);
      buttonTextStyle.push(dynamicStyles.primaryText);
      break;
    case 'secondary':
      buttonStyle.push(dynamicStyles.secondaryButton);
      buttonTextStyle.push(dynamicStyles.secondaryText);
      break;
    case 'outline':
      buttonStyle.push(dynamicStyles.outlineButton);
      buttonTextStyle.push(dynamicStyles.outlineText);
      break;
    case 'text':
      buttonStyle.push(dynamicStyles.textButton);
      buttonTextStyle.push(dynamicStyles.textButtonText);
      break;
    default:
      buttonStyle.push(dynamicStyles.primaryButton);
      buttonTextStyle.push(dynamicStyles.primaryText);
  }

  // 禁用状态样式
  if (disabled) {
    buttonStyle.push(dynamicStyles.disabledButton);
    buttonTextStyle.push(dynamicStyles.disabledText);
  }

  // 添加自定义样式
  if (style) {
    buttonStyle.push(style);
  }

  if (textStyle) {
    buttonTextStyle.push(textStyle);
  }

  return (
    <TouchableOpacity
      style={buttonStyle}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={type === 'primary' ? (colors.white || '#FFFFFF') : colors.primary}
        />
      ) : (
        <Text style={buttonTextStyle}>{title}</Text>
      )}
    </TouchableOpacity>
  );
};

// 使用内联样式，因为我们需要访问动态的颜色主题
const getStyles = (colors) => ({
  button: {
    borderRadius: 8, // 使用固定值
    paddingVertical: SPACING.MEDIUM,
    paddingHorizontal: SPACING.LARGE,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 120,
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
  },
  // 主要按钮样式
  primaryButton: {
    backgroundColor: colors.primary || '#007AFF',
  },
  primaryText: {
    color: colors.white || '#FFFFFF',
  },
  // 次要按钮样式
  secondaryButton: {
    backgroundColor: colors.secondary || '#5AC8FA',
  },
  secondaryText: {
    color: colors.white || '#FFFFFF',
  },
  // 轮廓按钮样式
  outlineButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.primary || '#007AFF',
  },
  outlineText: {
    color: colors.primary || '#007AFF',
  },
  // 文本按钮样式
  textButton: {
    backgroundColor: 'transparent',
    paddingVertical: SPACING.SMALL,
    paddingHorizontal: SPACING.SMALL,
    minWidth: 0,
  },
  textButtonText: {
    color: colors.primary || '#007AFF',
  },
  // 禁用状态
  disabledButton: {
    backgroundColor: colors.disabled || '#E5E5E5',
    borderColor: colors.disabled || '#E5E5E5',
  },
  disabledText: {
    color: colors.textLight || '#8E8E93',
  },
});

// 创建一个空的StyleSheet，实际样式将在组件内部动态生成
const styles = StyleSheet.create({
  button: {},
  text: {},
  primaryButton: {},
  primaryText: {},
  secondaryButton: {},
  secondaryText: {},
  outlineButton: {},
  outlineText: {},
  textButton: {},
  textButtonText: {},
  disabledButton: {},
  disabledText: {},
});

export default Button;