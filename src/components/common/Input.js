/**
 * 通用输入框组件 - 增强版
 * 支持表单验证动画、实时反馈、无障碍访问和统一设计令牌
 */

import React, { useState, useEffect } from 'react';
import { View, TextInput, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withSpring,
  interpolateColor,
  Easing,
} from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../context/ThemeContext';
import { SPACING, RADIUS, BORDER, SIZE, ANIMATION, OPACITY } from '../../theme/tokens';

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);
const AnimatedView = Animated.View;

/**
 * 通用输入框组件
 * @param {string} label - 输入框标签
 * @param {string} value - 输入值
 * @param {function} onChangeText - 文本变化回调
 * @param {string} placeholder - 占位文本
 * @param {boolean} secureTextEntry - 是否为密码输入
 * @param {string} error - 错误信息
 * @param {boolean} disabled - 是否禁用
 * @param {string} size - 输入框大小：small, medium, large, xlarge
 * @param {object} style - 自定义样式
 * @param {object} inputStyle - 输入框自定义样式
 * @param {object} labelStyle - 标签自定义样式
 * @param {string} keyboardType - 键盘类型
 * @param {boolean} multiline - 是否多行输入
 * @param {number} numberOfLines - 多行输入的行数
 * @param {boolean} showSuccessIcon - 验证通过时显示成功图标
 * @param {boolean} touched - 是否已触碰(用于控制错误显示时机)
 * @param {function} onBlur - 失去焦点回调
 */
const Input = ({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  error,
  disabled = false,
  size = 'medium',
  style,
  inputStyle,
  labelStyle,
  keyboardType = 'default',
  multiline = false,
  numberOfLines = 1,
  showSuccessIcon = true,
  touched = false,
  onBlur,
  ...props
}) => {
  const { colors } = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  // Animation values
  const shakeOffset = useSharedValue(0);
  const borderColorProgress = useSharedValue(0);
  const errorOpacity = useSharedValue(0);
  const successScale = useSharedValue(0);

  // Shake animation when error appears
  useEffect(() => {
    if (error && touched) {
      // Shake animation
      shakeOffset.value = withSequence(
        withTiming(-10, { duration: 50 }),
        withTiming(10, { duration: 50 }),
        withTiming(-10, { duration: 50 }),
        withTiming(10, { duration: 50 }),
        withTiming(0, { duration: 50 })
      );
      // Show error text
      errorOpacity.value = withTiming(1, { duration: ANIMATION.duration.quick });
      // Hide success icon
      successScale.value = withTiming(0, { duration: ANIMATION.duration.quick });
    } else if (!error && value && touched) {
      // Show success icon
      successScale.value = withSpring(1, { damping: 12, stiffness: 180 });
      errorOpacity.value = withTiming(0, { duration: ANIMATION.duration.quick });
    } else {
      errorOpacity.value = withTiming(0, { duration: ANIMATION.duration.quick });
      successScale.value = withTiming(0, { duration: ANIMATION.duration.quick });
    }
  }, [error, touched, value]);

  // Border color animation
  useEffect(() => {
    if (error && touched) {
      borderColorProgress.value = withTiming(2, { duration: ANIMATION.duration.quick }); // Error
    } else if (isFocused) {
      borderColorProgress.value = withTiming(1, { duration: ANIMATION.duration.quick }); // Focused
    } else {
      borderColorProgress.value = withTiming(0, { duration: ANIMATION.duration.quick }); // Normal
    }
  }, [error, touched, isFocused]);

  // Animated styles
  const animatedContainerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeOffset.value }],
  }));

  const animatedInputStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      borderColorProgress.value,
      [0, 1, 2],
      [colors.border || '#E5E5EA', colors.primary || '#007AFF', colors.error || '#FF3B30']
    ),
  }));

  const animatedErrorStyle = useAnimatedStyle(() => ({
    opacity: errorOpacity.value,
    transform: [{ translateY: withSpring(errorOpacity.value === 1 ? 0 : -5) }],
  }));

  const animatedSuccessStyle = useAnimatedStyle(() => ({
    transform: [{ scale: successScale.value }],
    opacity: successScale.value,
  }));

  // 容器样式
  const containerStyle = [
    styles.container,
    {
      marginBottom: SPACING.md,
    },
    style,
  ];

  // 标签样式
  const labelTextStyle = [
    styles.label,
    {
      color: colors.text,
      marginBottom: SPACING.xs,
    },
    labelStyle,
  ];

  // 输入框样式
  const textInputStyle = [
    styles.input,
    {
      backgroundColor: colors.surface || colors.background, // Use surface if available
      borderWidth: BORDER.width.default,
      borderRadius: RADIUS.md,
      color: colors.text,
    },
  ];

  // 根据尺寸添加样式
  switch (size) {
    case 'small':
      textInputStyle.push({
        paddingHorizontal: SPACING.sm,
        paddingVertical: SPACING.xs,
        fontSize: 12,
        height: SIZE.input.sm,
      });
      break;
    case 'medium':
      textInputStyle.push({
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
        fontSize: 14,
        height: SIZE.input.md,
      });
      break;
    case 'large':
      textInputStyle.push({
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.md,
        fontSize: 16,
        height: SIZE.input.lg,
      });
      break;
    case 'xlarge':
      textInputStyle.push({
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.md,
        fontSize: 18,
        height: 60,
      });
      break;
    default:
      textInputStyle.push({
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
        fontSize: 14,
        height: SIZE.input.md,
      });
  }

  // 多行输入样式
  if (multiline) {
    textInputStyle.push({
      textAlignVertical: 'top',
      minHeight: numberOfLines * 20,
      height: 'auto', // Override fixed height
      paddingTop: SPACING.sm,
    });
  }

  // 禁用状态样式
  if (disabled) {
    textInputStyle.push({
      backgroundColor: colors.disabledBackground || '#F2F2F7',
      opacity: OPACITY.high,
      color: colors.textSecondary || '#8E8E93',
    });
  }

  // 自定义输入框样式
  if (inputStyle) {
    textInputStyle.push(inputStyle);
  }

  // 切换密码可见性
  const togglePasswordVisibility = () => {
    setIsPasswordVisible(!isPasswordVisible);
  };

  const handleFocus = () => setIsFocused(true);

  const handleBlur = (e) => {
    setIsFocused(false);
    onBlur && onBlur(e);
  };

  const isValid = !error && value && touched;

  return (
    <AnimatedView style={[containerStyle, animatedContainerStyle]}>
      {label && <Text style={labelTextStyle}>{label}</Text>}

      <View style={styles.inputContainer}>
        <AnimatedTextInput
          style={[textInputStyle, animatedInputStyle]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textSecondary || '#8E8E93'}
          secureTextEntry={secureTextEntry && !isPasswordVisible}
          editable={!disabled}
          onFocus={handleFocus}
          onBlur={handleBlur}
          keyboardType={keyboardType}
          multiline={multiline}
          numberOfLines={multiline ? numberOfLines : 1}
          accessible={true}
          accessibilityLabel={label || placeholder}
          accessibilityHint={error || placeholder}
          accessibilityState={{ disabled, invalid: !!error }}
          {...props}
        />

        {/* Password toggle */}
        {secureTextEntry && (
          <TouchableOpacity
            style={[styles.iconButton, { right: showSuccessIcon ? 40 : SPACING.sm }]}
            onPress={togglePasswordVisibility}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={isPasswordVisible ? '隐藏密码' : '显示密码'}
          >
            <Icon
              name={isPasswordVisible ? 'visibility-off' : 'visibility'}
              size={SIZE.icon.md}
              color={colors.textSecondary || '#8E8E93'}
            />
          </TouchableOpacity>
        )}

        {/* Success icon */}
        {showSuccessIcon && (
          <AnimatedView style={[styles.successIcon, { right: SPACING.sm }, animatedSuccessStyle]}>
            <Icon name="check-circle" size={SIZE.icon.md} color={colors.success || '#34C759'} />
          </AnimatedView>
        )}
      </View>

      {/* Error message with animation */}
      <AnimatedView
        style={[styles.errorContainer, animatedErrorStyle]}
        accessible={!!error}
        accessibilityLiveRegion="polite"
        accessibilityLabel={`错误: ${error}`}
      >
        {error && touched && (
          <View style={styles.errorContent}>
            <Icon name="error-outline" size={SIZE.icon.sm} color={colors.error || '#FF3B30'} style={styles.errorIcon} />
            <Text style={[styles.errorText, { color: colors.error || '#FF3B30' }]}>
              {error}
            </Text>
          </View>
        )}
      </AnimatedView>
    </AnimatedView>
  );
};

// 创建样式
const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  label: {
    fontWeight: '500',
    fontSize: 14,
  },
  inputContainer: {
    position: 'relative',
    width: '100%',
  },
  input: {
    width: '100%',
    paddingRight: 45, // Space for icons
  },
  iconButton: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    width: 40,
    height: '100%',
  },
  successIcon: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
  },
  errorContainer: {
    minHeight: 20,
    marginTop: 4,
  },
  errorContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  errorIcon: {
    marginRight: 4,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
  },
});

export default Input;
