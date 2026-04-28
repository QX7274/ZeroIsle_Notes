/**
 * 可访问性按钮组件
 * 提供完全可访问的按钮组件
 */
import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useAccessibility } from '../../context/AccessibilityContext';

/**
 * 可访问性按钮组件
 * @param {string} title - 按钮文字
 * @param {function} onPress - 点击事件处理函数
 * @param {string} type - 按钮类型：primary, secondary, success, warning, error, outline, text
 * @param {string} size - 按钮大小：small, medium, large, xlarge
 * @param {boolean} disabled - 是否禁用
 * @param {boolean} loading - 是否显示加载状态
 * @param {boolean} fullWidth - 是否占满宽度
 * @param {object} style - 自定义样式
 * @param {object} textStyle - 文字自定义样式
 * @param {string} accessibilityLabel - 可访问性标签
 * @param {string} accessibilityHint - 可访问性提示
 */
const AccessibleButton = ({
  title,
  onPress,
  type = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  fullWidth = false,
  style,
  textStyle,
  accessibilityLabel,
  accessibilityHint,
  children,
  ...props
}) => {
  const { theme } = useTheme();
  const { colors, dimensions } = theme;
  const { getAccessibilityProps } = useAccessibility();

  // 按钮类型样式
  const getTypeStyle = () => {
    switch (type) {
      case 'secondary':
        return {
          button: {
            backgroundColor: colors.secondary,
          },
          text: {
            color: '#FFFFFF',
          },
        };
      case 'success':
        return {
          button: {
            backgroundColor: colors.success,
          },
          text: {
            color: '#FFFFFF',
          },
        };
      case 'warning':
        return {
          button: {
            backgroundColor: colors.warning,
          },
          text: {
            color: '#FFFFFF',
          },
        };
      case 'error':
        return {
          button: {
            backgroundColor: colors.error,
          },
          text: {
            color: '#FFFFFF',
          },
        };
      case 'outline':
        return {
          button: {
            backgroundColor: 'transparent',
            borderWidth: 1,
            borderColor: colors.primary,
          },
          text: {
            color: colors.primary,
          },
        };
      case 'text':
        return {
          button: {
            backgroundColor: 'transparent',
            elevation: 0,
            shadowOpacity: 0,
          },
          text: {
            color: colors.primary,
          },
        };
      case 'primary':
      default:
        return {
          button: {
            backgroundColor: colors.primary,
          },
          text: {
            color: '#FFFFFF',
          },
        };
    }
  };

  // 按钮尺寸样式
  const getSizeStyle = () => {
    switch (size) {
      case 'small':
        return {
          button: {
            height: 36,
            paddingHorizontal: 12,
          },
          text: {
            fontSize: 14,
          },
        };
      case 'large':
        return {
          button: {
            height: 52,
            paddingHorizontal: 24,
          },
          text: {
            fontSize: 18,
          },
        };
      case 'xlarge':
        return {
          button: {
            height: 60,
            paddingHorizontal: 32,
          },
          text: {
            fontSize: 20,
          },
        };
      case 'medium':
      default:
        return {
          button: {
            height: 44,
            paddingHorizontal: 16,
          },
          text: {
            fontSize: 16,
          },
        };
    }
  };

  const typeStyle = getTypeStyle();
  const sizeStyle = getSizeStyle();

  // 按钮容器样式
  const buttonStyle = [
    styles.button,
    typeStyle.button,
    sizeStyle.button,
    {
      borderRadius: dimensions.BORDER_RADIUS.MEDIUM,
    },
    fullWidth && styles.fullWidth,
    disabled && styles.disabled,
    style,
  ];

  // 按钮文字样式
  const buttonTextStyle = [
    styles.text,
    typeStyle.text,
    sizeStyle.text,
    disabled && styles.disabledText,
    textStyle,
  ];

  // 可访问性属性
  const accessibilityProps = getAccessibilityProps(
    accessibilityLabel || title,
    accessibilityHint,
    true,
    false,
    disabled || loading
  );

  return (
    <TouchableOpacity
      style={buttonStyle}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
      {...accessibilityProps}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={type === 'outline' || type === 'text' ? colors.primary : '#FFFFFF'}
        />
      ) : (
        <>
          {children || <Text style={buttonTextStyle}>{title}</Text>}
        </>
      )}
    </TouchableOpacity>
  );
};

// 创建样式
const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 4,
    // 阴影
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  text: {
    fontWeight: '600',
    textAlign: 'center',
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.5,
  },
  disabledText: {
    opacity: 0.8,
  },
});

export default AccessibleButton;
