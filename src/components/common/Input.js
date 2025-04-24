/**
 * 现代化输入框组件
 * 支持浮动标签、动画效果和多种样式
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform
} from 'react-native';
import { SPACING, BORDER_RADIUS } from '../../utils/constants/dimensions';
import { useTheme } from '../../context/ThemeContext';
import Icon from 'react-native-vector-icons/MaterialIcons';

/**
 * 现代化输入框组件
 * @param {string} label - 输入框标签
 * @param {string} value - 输入值
 * @param {function} onChangeText - 文本变化回调
 * @param {string} placeholder - 占位文本
 * @param {boolean} secureTextEntry - 是否为密码输入
 * @param {string} error - 错误信息
 * @param {boolean} disabled - 是否禁用
 * @param {string} variant - 输入框变体：default, outlined, filled, underlined
 * @param {string} leftIcon - 左侧图标名称
 * @param {string} rightIcon - 右侧图标名称
 * @param {function} onLeftIconPress - 左侧图标点击回调
 * @param {function} onRightIconPress - 右侧图标点击回调
 * @param {boolean} floatingLabel - 是否使用浮动标签
 * @param {object} style - 自定义样式
 * @param {object} inputStyle - 输入框自定义样式
 * @param {object} labelStyle - 标签自定义样式
 * @param {string} keyboardType - 键盘类型
 */
const Input = ({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  error,
  disabled = false,
  variant = 'default',
  leftIcon,
  rightIcon,
  onLeftIconPress,
  onRightIconPress,
  floatingLabel = false,
  style,
  inputStyle,
  labelStyle,
  keyboardType = 'default',
  ...props
}) => {
  const { colors, isDarkMode } = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  // 动画值
  const labelAnim = useRef(new Animated.Value(value ? 1 : 0)).current;
  const borderAnim = useRef(new Animated.Value(0)).current;

  // 获取动态样式
  const dynamicStyles = getStyles(colors, isDarkMode);

  // 处理焦点变化
  useEffect(() => {
    Animated.timing(labelAnim, {
      toValue: (isFocused || value) ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();

    Animated.timing(borderAnim, {
      toValue: isFocused ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [isFocused, value, labelAnim, borderAnim]);

  // 计算标签位置和大小
  const labelStyle_animated = {
    top: labelAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [floatingLabel ? 16 : 0, floatingLabel ? -8 : 0],
    }),
    fontSize: labelAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [16, 12],
    }),
    color: isFocused
      ? colors.primary
      : (error ? colors.error : colors.textSecondary),
  };

  // 计算边框颜色
  const borderColor = borderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [
      error ? colors.error : colors.border,
      error ? colors.error : colors.primary,
    ],
  });

  // 容器样式
  const containerStyle = [
    dynamicStyles.container,
    style,
  ];

  // 输入框容器样式
  const inputContainerStyle = [
    dynamicStyles.inputContainer,
    variant === 'outlined' && dynamicStyles.outlinedContainer,
    variant === 'filled' && dynamicStyles.filledContainer,
    variant === 'underlined' && dynamicStyles.underlinedContainer,
    isFocused && !error && dynamicStyles.inputContainerFocused,
    error && dynamicStyles.inputContainerError,
    disabled && dynamicStyles.inputContainerDisabled,
    variant === 'outlined' && {
      borderColor: borderColor,
    },
    variant === 'underlined' && {
      borderBottomColor: borderColor,
    },
  ];

  // 输入框样式
  const textInputStyle = [
    dynamicStyles.input,
    variant === 'filled' && dynamicStyles.filledInput,
    variant === 'underlined' && dynamicStyles.underlinedInput,
    (leftIcon || (variant === 'outlined' && floatingLabel)) && dynamicStyles.inputWithLeftIcon,
    (secureTextEntry || rightIcon) && dynamicStyles.inputWithRightIcon,
    disabled && dynamicStyles.inputDisabled,
    inputStyle,
  ];

  // 切换密码可见性
  const togglePasswordVisibility = () => {
    setIsPasswordVisible(!isPasswordVisible);
  };

  // 处理焦点
  const handleFocus = () => {
    setIsFocused(true);
    if (props.onFocus) {
      props.onFocus();
    }
  };

  // 处理失焦
  const handleBlur = () => {
    setIsFocused(false);
    if (props.onBlur) {
      props.onBlur();
    }
  };

  return (
    <View style={containerStyle}>
      {label && !floatingLabel && (
        <Text style={[dynamicStyles.label, labelStyle]}>
          {label}
        </Text>
      )}

      <View style={inputContainerStyle}>
        {leftIcon && (
          <TouchableOpacity
            style={dynamicStyles.leftIcon}
            onPress={onLeftIconPress}
            disabled={!onLeftIconPress}
          >
            <Icon
              name={leftIcon}
              size={20}
              color={isFocused ? colors.primary : colors.textSecondary}
            />
          </TouchableOpacity>
        )}

        {floatingLabel && (
          <Animated.Text
            style={[
              dynamicStyles.floatingLabel,
              labelStyle_animated,
              labelStyle
            ]}
          >
            {label}
          </Animated.Text>
        )}

        <TextInput
          style={textInputStyle}
          value={value}
          onChangeText={onChangeText}
          placeholder={floatingLabel && (isFocused || value) ? placeholder : (floatingLabel ? label : placeholder)}
          placeholderTextColor={colors.textSecondary}
          secureTextEntry={secureTextEntry && !isPasswordVisible}
          editable={!disabled}
          onFocus={handleFocus}
          onBlur={handleBlur}
          keyboardType={keyboardType}
          {...props}
        />

        {secureTextEntry && (
          <TouchableOpacity
            style={dynamicStyles.rightIcon}
            onPress={togglePasswordVisibility}
            activeOpacity={0.7}
          >
            <Icon
              name={isPasswordVisible ? 'visibility' : 'visibility-off'}
              size={20}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        )}

        {rightIcon && !secureTextEntry && (
          <TouchableOpacity
            style={dynamicStyles.rightIcon}
            onPress={onRightIconPress}
            disabled={!onRightIconPress}
          >
            <Icon
              name={rightIcon}
              size={20}
              color={isFocused ? colors.primary : colors.textSecondary}
            />
          </TouchableOpacity>
        )}
      </View>

      {error && <Text style={dynamicStyles.errorText}>{error}</Text>}
    </View>
  );
};

// 使用内联样式，因为我们需要访问动态的颜色主题
const getStyles = (colors, isDarkMode) => ({
  // 基础容器样式
  container: {
    marginBottom: SPACING.MEDIUM,
    width: '100%',
    position: 'relative',
  },

  // 标签样式
  label: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: SPACING.SMALL,
    fontWeight: '500',
  },

  floatingLabel: {
    position: 'absolute',
    left: SPACING.MEDIUM,
    backgroundColor: 'transparent',
    paddingHorizontal: 4,
    zIndex: 1,
    fontWeight: '500',
  },

  // 输入框容器样式
  inputContainer: {
    position: 'relative',
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: BORDER_RADIUS.MEDIUM,
    backgroundColor: colors.background,
  },

  // 输入框容器变体
  outlinedContainer: {
    backgroundColor: 'transparent',
  },

  filledContainer: {
    borderWidth: 0,
    backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
    borderTopLeftRadius: BORDER_RADIUS.MEDIUM,
    borderTopRightRadius: BORDER_RADIUS.MEDIUM,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderBottomWidth: 2,
    borderBottomColor: colors.border,
  },

  underlinedContainer: {
    borderWidth: 0,
    borderRadius: 0,
    borderBottomWidth: 1,
    backgroundColor: 'transparent',
  },

  // 输入框容器状态
  inputContainerFocused: {
    borderColor: colors.primary,
  },

  inputContainerError: {
    borderColor: colors.error,
  },

  inputContainerDisabled: {
    backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
    borderColor: colors.border,
  },

  // 输入框样式
  input: {
    flex: 1,
    paddingHorizontal: SPACING.MEDIUM,
    paddingVertical: SPACING.MEDIUM,
    fontSize: 16,
    color: colors.text,
    height: Platform.OS === 'ios' ? 44 : 48,
  },

  // 输入框变体
  filledInput: {
    paddingTop: SPACING.LARGE,
  },

  underlinedInput: {
    paddingHorizontal: 0,
  },

  // 输入框状态
  inputWithLeftIcon: {
    paddingLeft: 40,
  },

  inputWithRightIcon: {
    paddingRight: 40,
  },

  inputDisabled: {
    color: colors.textSecondary,
  },

  // 图标样式
  leftIcon: {
    position: 'absolute',
    left: SPACING.MEDIUM,
    zIndex: 2,
  },

  rightIcon: {
    position: 'absolute',
    right: SPACING.MEDIUM,
    zIndex: 2,
  },

  // 错误文本
  errorText: {
    color: colors.error,
    fontSize: 12,
    marginTop: SPACING.TINY,
    marginLeft: SPACING.SMALL,
  },
});

// 创建一个空的StyleSheet，实际样式将在组件内部动态生成
const styles = StyleSheet.create({});

export default Input;