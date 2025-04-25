/**
 * 通用输入框组件
 */

import React, { useState } from 'react';
import { View, TextInput, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SPACING } from '../../utils/constants/dimensions';
import { useTheme } from '../../context/ThemeContext';

/**
 * 通用输入框组件
 * @param {string} label - 输入框标签
 * @param {string} value - 输入值
 * @param {function} onChangeText - 文本变化回调
 * @param {string} placeholder - 占位文本
 * @param {boolean} secureTextEntry - 是否为密码输入
 * @param {string} error - 错误信息
 * @param {boolean} disabled - 是否禁用
 * @param {object} style - 自定义样式
 * @param {object} inputStyle - 输入框自定义样式
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
  style,
  inputStyle,
  keyboardType = 'default',
  ...props
}) => {
  const { colors } = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  // 获取动态样式
  const dynamicStyles = getStyles(colors);

  // 容器样式
  const containerStyle = [
    dynamicStyles.container,
    style,
  ];

  // 输入框样式
  const textInputStyle = [
    dynamicStyles.input,
    isFocused && dynamicStyles.inputFocused,
    error && dynamicStyles.inputError,
    disabled && dynamicStyles.inputDisabled,
    inputStyle,
  ];

  // 切换密码可见性
  const togglePasswordVisibility = () => {
    setIsPasswordVisible(!isPasswordVisible);
  };

  return (
    <View style={containerStyle}>
      {label && <Text style={dynamicStyles.label}>{label}</Text>}

      <View style={dynamicStyles.inputContainer}>
        <TextInput
          style={textInputStyle}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textLight || '#8E8E93'}
          secureTextEntry={secureTextEntry && !isPasswordVisible}
          editable={!disabled}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          keyboardType={keyboardType}
          {...props}
        />

        {secureTextEntry && (
          <TouchableOpacity
            style={dynamicStyles.eyeIcon}
            onPress={togglePasswordVisibility}
            activeOpacity={0.7}
          >
            <Text style={dynamicStyles.eyeIconText}>
              {isPasswordVisible ? '隐藏' : '显示'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {error && <Text style={dynamicStyles.errorText}>{error}</Text>}
    </View>
  );
};

// 使用内联样式，因为我们需要访问动态的颜色主题
const getStyles = (colors) => ({
  container: {
    marginBottom: SPACING.MEDIUM,
    width: '100%',
  },
  label: {
    fontSize: 16,
    color: colors.text,
    marginBottom: SPACING.SMALL,
    fontWeight: '500',
  },
  inputContainer: {
    position: 'relative',
    width: '100%',
  },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8, // 使用固定值
    paddingHorizontal: SPACING.MEDIUM,
    paddingVertical: SPACING.MEDIUM,
    fontSize: 16,
    color: colors.text,
    width: '100%',
  },
  inputFocused: {
    borderColor: colors.primary,
  },
  inputError: {
    borderColor: colors.error || '#FF3B30',
  },
  inputDisabled: {
    backgroundColor: colors.disabled || '#E5E5E5',
    color: colors.textLight || '#8E8E93',
  },
  errorText: {
    color: colors.error || '#FF3B30',
    fontSize: 14,
    marginTop: SPACING.SMALL,
  },
  eyeIcon: {
    position: 'absolute',
    right: SPACING.MEDIUM,
    top: '50%',
    transform: [{ translateY: -10 }],
  },
  eyeIconText: {
    color: colors.primary,
    fontSize: 14,
  },
});

// 创建一个空的StyleSheet，实际样式将在组件内部动态生成
const styles = StyleSheet.create({
  container: {},
  label: {},
  inputContainer: {},
  input: {},
  inputFocused: {},
  inputError: {},
  inputDisabled: {},
  errorText: {},
  eyeIcon: {},
  eyeIconText: {},
});

export default Input;