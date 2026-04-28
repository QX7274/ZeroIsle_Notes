/**
 * 通用按钮组件
 * 支持多种样式变体和动画效果
 */

import React, { useState, useEffect } from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, View, Animated, Pressable } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import * as Animations from '../../utils/animations';
import Icon from 'react-native-vector-icons/MaterialIcons';

/**
 * 通用按钮组件
 * @param {string} title - 按钮文字
 * @param {function} onPress - 点击事件处理函数
 * @param {string} type - 按钮类型：primary, secondary, success, info, warning, error, outline, text, gradient
 * @param {string} size - 按钮大小：small, medium, large, xlarge
 * @param {boolean} disabled - 是否禁用
 * @param {boolean} loading - 是否显示加载状态
 * @param {boolean} fullWidth - 是否占满宽度
 * @param {object} style - 自定义样式
 * @param {object} textStyle - 文字自定义样式
 * @param {element|string} icon - 按钮图标（React元素或图标名称字符串）
 * @param {string} iconPosition - 图标位置：left, right
 * @param {object} iconStyle - 图标容器自定义样式
 * @param {string} animation - 动画类型：none, fade, scale, bounce
 * @param {number} animationDuration - 动画持续时间
 * @param {string} gradientType - 渐变类型：primary, secondary, success, info, warning, error
 * @param {boolean} elevated - 是否添加阴影效果
 * @param {string} shape - 按钮形状：rectangle, rounded, pill, circle
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
  animation = 'none',
  animationDuration = 300,
  gradientType = 'primary',
  elevated = true,
  shape = 'rounded',
  ...props
}) => {
  const { theme } = useTheme();
  const { colors, dimensions } = theme;

  // 创建动画值
  const [fadeAnim] = useState(new Animated.Value(0));
  const [scaleAnim] = useState(new Animated.Value(0.95));
  const [pressAnim] = useState(new Animated.Value(1));

  // 启动进入动画
  useEffect(() => {
    if (animation === 'fade') {
      Animations.fadeIn(fadeAnim, 1, animationDuration);
    } else if (animation === 'scale') {
      fadeAnim.setValue(1);
      Animations.scale(scaleAnim, 1, animationDuration);
    } else if (animation === 'bounce') {
      fadeAnim.setValue(1);
      Animations.bounce(scaleAnim, 1, animationDuration);
    } else {
      fadeAnim.setValue(1);
      scaleAnim.setValue(1);
    }
  }, []);

  // 处理按压动画
  const handlePressIn = () => {
    Animated.timing(pressAnim, {
      toValue: 0.97,
      duration: 100,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.timing(pressAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  // 根据类型和状态确定样式
  const buttonStyle = [styles.button];
  const buttonTextStyle = [styles.text];

  // 根据形状添加样式
  switch (shape) {
    case 'rectangle':
      buttonStyle.push({
        borderRadius: 0,
      });
      break;
    case 'rounded':
      buttonStyle.push({
        borderRadius: 8,
      });
      break;
    case 'pill':
      buttonStyle.push({
        borderRadius: 50,
      });
      break;
    case 'circle':
      buttonStyle.push({
        borderRadius: 100,
        aspectRatio: 1,
        padding: 0,
      });
      break;
    default:
      buttonStyle.push({
        borderRadius: 8,
      });
  }

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
    case 'gradient':
      // 渐变样式在LinearGradient中设置
      buttonStyle.push({
        backgroundColor: 'transparent', // 避免背景色覆盖渐变
      });
      buttonTextStyle.push({
        color: colors.card,
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

  // 添加阴影效果
  if (elevated && type !== 'outline' && type !== 'text') {
    const shadowColor = type === 'primary' ? colors.primary :
                        type === 'secondary' ? colors.secondary :
                        type === 'success' ? colors.success :
                        type === 'info' ? colors.info :
                        type === 'warning' ? colors.warning :
                        type === 'error' ? colors.error :
                        colors.shadow;

    buttonStyle.push({
      shadowColor,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.3,
      shadowRadius: 4.65,
      elevation: 6,
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

  // 动画样式
  const animatedStyle = {
    opacity: fadeAnim,
    transform: [
      { scale: animation === 'none' ? pressAnim : scaleAnim },
    ],
  };

  // 渲染按钮内容
  const renderButtonContent = () => {
    if (loading) {
      return (
        <ActivityIndicator
          size="small"
          color={iconColor}
        />
      );
    }

    // 渲染图标
    const renderIcon = () => {
      // 如果图标是字符串，使用Icon组件渲染
      if (typeof icon === 'string') {
        return (
          <Icon
            name={icon}
            size={iconSize}
            color={disabled ? colors.textDisabled : iconColor}
          />
        );
      }

      // 如果图标是React元素，使用cloneElement添加属性
      if (icon && React.isValidElement(icon)) {
        return React.cloneElement(icon, {
          size: icon.props.size || iconSize,
          color: icon.props.color || (disabled ? colors.textDisabled : iconColor),
        });
      }

      return null;
    };

    return (
      <>
        {icon && iconPosition === 'left' && (
          <View style={[styles.iconContainer, { marginRight: title ? 8 : 0 }, iconStyle]}>
            {renderIcon()}
          </View>
        )}
        {title && <Text style={buttonTextStyle}>{title}</Text>}
        {icon && iconPosition === 'right' && (
          <View style={[styles.iconContainer, { marginLeft: title ? 8 : 0 }, iconStyle]}>
            {renderIcon()}
          </View>
        )}
      </>
    );
  };

  // 渲染渐变按钮
  if (type === 'gradient') {
    try {
      const LinearGradient = require('react-native-linear-gradient').default;
      const gradientColors = colors.gradient[gradientType.toUpperCase()] || colors.gradient.PRIMARY;

      return (
        <Animated.View style={animatedStyle}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={onPress}
            disabled={disabled || loading}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            {...props}
          >
            <LinearGradient
              colors={gradientColors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={buttonStyle}
            >
              {renderButtonContent()}
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      );
    } catch (error) {
      console.warn('LinearGradient not available, falling back to default button');
      // 回退到普通按钮
      type = 'primary';
    }
  }

  // 渲染普通按钮
  return (
    <Animated.View style={animatedStyle}>
      <TouchableOpacity
        style={buttonStyle}
        onPress={onPress}
        disabled={disabled || loading}
        activeOpacity={0.8}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        {...props}
      >
        {renderButtonContent()}
      </TouchableOpacity>
    </Animated.View>
  );
};

// 创建样式
const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    overflow: 'hidden',
  },
  text: {
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  // 尺寸样式
  smallButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    minWidth: 80,
  },
  smallText: {
    fontSize: 12,
    fontWeight: '500',
  },
  mediumButton: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    minWidth: 120,
  },
  mediumText: {
    fontSize: 14,
    fontWeight: '600',
  },
  largeButton: {
    paddingVertical: 14,
    paddingHorizontal: 22,
    minWidth: 160,
  },
  largeText: {
    fontSize: 16,
    fontWeight: '600',
  },
  xlargeButton: {
    paddingVertical: 18,
    paddingHorizontal: 28,
    minWidth: 200,
  },
  xlargeText: {
    fontSize: 18,
    fontWeight: '700',
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default Button;
