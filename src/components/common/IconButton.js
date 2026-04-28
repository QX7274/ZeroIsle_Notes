/**
 * 通用图标按钮组件
 * 提供统一的按钮样式，支持图标和文字组合
 */
import React from 'react';
import { TouchableOpacity, StyleSheet, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Text } from './Typography';
import { useTheme } from '../../context/ThemeContext';

/**
 * 图标按钮组件
 * @param {Object} props - 组件属性
 * @param {string} props.icon - 图标名称（MaterialIcons）
 * @param {string} props.text - 按钮文字
 * @param {Function} props.onPress - 点击回调函数
 * @param {string} props.type - 按钮类型：'primary', 'secondary', 'outline', 'ghost'
 * @param {string} props.size - 按钮大小：'small', 'medium', 'large'
 * @param {boolean} props.disabled - 是否禁用
 * @param {Object} props.style - 自定义样式
 * @param {Object} props.textStyle - 文字自定义样式
 * @param {Object} props.iconStyle - 图标自定义样式
 */
const IconButton = ({
  icon,
  text,
  onPress,
  type = 'primary',
  size = 'medium',
  disabled = false,
  style,
  textStyle,
  iconStyle,
  ...rest
}) => {
  const { colors } = useTheme();

  // 根据类型和大小确定样式
  const getButtonStyle = () => {
    let buttonStyle = {};

    // 类型样式
    switch (type) {
      case 'primary':
        buttonStyle.backgroundColor = colors.primary;
        buttonStyle.borderColor = colors.primary;
        break;
      case 'secondary':
        buttonStyle.backgroundColor = colors.secondary;
        buttonStyle.borderColor = colors.secondary;
        break;
      case 'outline':
        buttonStyle.backgroundColor = 'transparent';
        buttonStyle.borderColor = colors.primary;
        buttonStyle.borderWidth = 1;
        break;
      case 'ghost':
        buttonStyle.backgroundColor = 'transparent';
        buttonStyle.borderColor = 'transparent';
        break;
      default:
        buttonStyle.backgroundColor = colors.primary;
        buttonStyle.borderColor = colors.primary;
    }

    // 大小样式
    switch (size) {
      case 'small':
        buttonStyle.paddingHorizontal = 8;
        buttonStyle.paddingVertical = 4;
        buttonStyle.borderRadius = 4;
        break;
      case 'medium':
        buttonStyle.paddingHorizontal = 12;
        buttonStyle.paddingVertical = 8;
        buttonStyle.borderRadius = 8;
        break;
      case 'large':
        buttonStyle.paddingHorizontal = 16;
        buttonStyle.paddingVertical = 12;
        buttonStyle.borderRadius = 12;
        break;
      default:
        buttonStyle.paddingHorizontal = 12;
        buttonStyle.paddingVertical = 8;
        buttonStyle.borderRadius = 8;
    }

    // 禁用样式
    if (disabled) {
      buttonStyle.opacity = 0.5;
    }

    return buttonStyle;
  };

  // 根据类型确定文字颜色
  const getTextColor = () => {
    switch (type) {
      case 'primary':
      case 'secondary':
        return 'white';
      case 'outline':
      case 'ghost':
        return 'primary';
      default:
        return 'white';
    }
  };

  // 根据大小确定图标大小
  const getIconSize = () => {
    switch (size) {
      case 'small':
        return 16;
      case 'medium':
        return 20;
      case 'large':
        return 24;
      default:
        return 20;
    }
  };

  // 根据大小确定文字大小
  const getTextSize = () => {
    switch (size) {
      case 'small':
        return 'small';
      case 'medium':
        return 'medium';
      case 'large':
        return 'large';
      default:
        return 'medium';
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.button,
        getButtonStyle(),
        style,
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      {...rest}
    >
      {icon && (
        <Icon
          name={icon}
          size={getIconSize()}
          color={type === 'outline' || type === 'ghost' ? colors.primary : '#fff'}
          style={[styles.icon, iconStyle]}
        />
      )}
      {text && (
        <Text
          variant="body"
          size={getTextSize()}
          color={getTextColor()}
          style={[styles.text, textStyle]}
        >
          {text}
        </Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  icon: {
    marginRight: 4,
  },
  text: {
    fontWeight: '500',
  },
});

export default IconButton;
