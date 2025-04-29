/**
 * 通用按钮组件
 */

import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

/**
 * 通用按钮组件
 * @param {string} title - 按钮文字
 * @param {function} onPress - 点击事件处理函数
 * @param {string} type - 按钮类型：primary, secondary, outline, text
 * @param {string} size - 按钮大小：small, medium, large, xlarge
 * @param {boolean} disabled - 是否禁用
 * @param {boolean} loading - 是否显示加载状态
 * @param {boolean} fullWidth - 是否占满宽度
 * @param {object} style - 自定义样式
 * @param {object} textStyle - 文字自定义样式
 * @param {element} icon - 按钮图标（React元素）
 * @param {string} iconPosition - 图标位置：left, right
 * @param {object} iconStyle - 图标容器自定义样式
 */
const Button = ({
  title,
  onPress,
  type = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  fullWidth = false,
  style,
  textStyle,
  icon = null,
  iconPosition = 'left',
  iconStyle,
  ...props
}) => {
  const { theme } = useTheme();
  const { colors, dimensions } = theme;

  // 根据类型和状态确定样式
  const buttonStyle = [styles.button];
  const buttonTextStyle = [styles.text];

  // 根据尺寸添加样式
  switch (size) {
    case 'small':
      buttonStyle.push(styles.smallButton);
      buttonTextStyle.push(styles.smallText);
      break;
    case 'medium':
      buttonStyle.push(styles.mediumButton);
      buttonTextStyle.push(styles.mediumText);
      break;
    case 'large':
      buttonStyle.push(styles.largeButton);
      buttonTextStyle.push(styles.largeText);
      break;
    case 'xlarge':
      buttonStyle.push(styles.xlargeButton);
      buttonTextStyle.push(styles.xlargeText);
      break;
    default:
      buttonStyle.push(styles.mediumButton);
      buttonTextStyle.push(styles.mediumText);
  }

  // 根据类型添加样式
  switch (type) {
    case 'primary':
      buttonStyle.push({
        backgroundColor: colors.primary,
      });
      buttonTextStyle.push({
        color: colors.card,
      });
      break;
    case 'secondary':
      buttonStyle.push({
        backgroundColor: colors.secondary,
      });
      buttonTextStyle.push({
        color: colors.card,
      });
      break;
    case 'success':
      buttonStyle.push({
        backgroundColor: colors.success,
      });
      buttonTextStyle.push({
        color: colors.card,
      });
      break;
    case 'info':
      buttonStyle.push({
        backgroundColor: colors.info,
      });
      buttonTextStyle.push({
        color: colors.card,
      });
      break;
    case 'warning':
      buttonStyle.push({
        backgroundColor: colors.warning,
      });
      buttonTextStyle.push({
        color: colors.text,
      });
      break;
    case 'error':
      buttonStyle.push({
        backgroundColor: colors.error,
      });
      buttonTextStyle.push({
        color: colors.card,
      });
      break;
    case 'outline':
      buttonStyle.push({
        backgroundColor: 'transparent',
        borderWidth: dimensions.BORDER_WIDTH.REGULAR,
        borderColor: colors.primary,
      });
      buttonTextStyle.push({
        color: colors.primary,
      });
      break;
    case 'text':
      buttonStyle.push({
        backgroundColor: 'transparent',
        paddingVertical: dimensions.SPACING.SMALL,
        paddingHorizontal: dimensions.SPACING.SMALL,
        minWidth: 0,
      });
      buttonTextStyle.push({
        color: colors.primary,
      });
      break;
    default:
      buttonStyle.push({
        backgroundColor: colors.primary,
      });
      buttonTextStyle.push({
        color: colors.card,
      });
  }

  // 禁用状态样式
  if (disabled) {
    buttonStyle.push({
      backgroundColor: type === 'outline' || type === 'text' ? 'transparent' : colors.textDisabled,
      borderColor: colors.textDisabled,
      opacity: 0.7,
    });
    buttonTextStyle.push({
      color: colors.textDisabled,
    });
  }

  // 全宽样式
  if (fullWidth) {
    buttonStyle.push({
      width: '100%',
    });
  }

  // 添加自定义样式
  if (style) {
    buttonStyle.push(style);
  }

  if (textStyle) {
    buttonTextStyle.push(textStyle);
  }

  // 确定图标颜色
  const iconColor = type === 'outline' || type === 'text'
    ? colors.primary
    : type === 'warning'
      ? colors.text
      : colors.card;

  // 确定图标大小
  let iconSize = 16;
  switch (size) {
    case 'small': iconSize = 14; break;
    case 'medium': iconSize = 16; break;
    case 'large': iconSize = 18; break;
    case 'xlarge': iconSize = 20; break;
    default: iconSize = 16;
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
          color={iconColor}
        />
      ) : (
        <>
          {icon && iconPosition === 'left' && (
            <View style={[styles.iconContainer, { marginRight: title ? 8 : 0 }, iconStyle]}>
              {React.cloneElement(icon, {
                size: icon.props.size || iconSize,
                color: icon.props.color || (disabled ? colors.textDisabled : iconColor)
              })}
            </View>
          )}
          {title && <Text style={buttonTextStyle}>{title}</Text>}
          {icon && iconPosition === 'right' && (
            <View style={[styles.iconContainer, { marginLeft: title ? 8 : 0 }, iconStyle]}>
              {React.cloneElement(icon, {
                size: icon.props.size || iconSize,
                color: icon.props.color || (disabled ? colors.textDisabled : iconColor)
              })}
            </View>
          )}
        </>
      )}
    </TouchableOpacity>
  );
};

// 创建样式
const styles = StyleSheet.create({
  button: {
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  text: {
    fontWeight: '600',
    textAlign: 'center',
  },
  // 尺寸样式
  smallButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    minWidth: 80,
  },
  smallText: {
    fontSize: 12,
  },
  mediumButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    minWidth: 120,
  },
  mediumText: {
    fontSize: 14,
  },
  largeButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    minWidth: 160,
  },
  largeText: {
    fontSize: 16,
  },
  xlargeButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    minWidth: 200,
  },
  xlargeText: {
    fontSize: 18,
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default Button;