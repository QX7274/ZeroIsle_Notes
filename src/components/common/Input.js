/**
 * 通用输入框组件
 */

import React, { useState } from 'react';
import { View, TextInput, Text, StyleSheet, TouchableOpacity } from 'react-native';
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
 * @param {string} size - 输入框大小：small, medium, large, xlarge
 * @param {object} style - 自定义样式
 * @param {object} inputStyle - 输入框自定义样式
 * @param {object} labelStyle - 标签自定义样式
 * @param {string} keyboardType - 键盘类型
 * @param {boolean} multiline - 是否多行输入
 * @param {number} numberOfLines - 多行输入的行数
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
  ...props
}) => {
  const { theme } = useTheme();
  const { colors, dimensions } = theme;
  const [isFocused, setIsFocused] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  // 容器样式
  const containerStyle = [
    styles.container,
    {
      marginBottom: dimensions.SPACING.MEDIUM,
    },
    style,
  ];

  // 标签样式
  const labelTextStyle = [
    styles.label,
    {
      color: colors.text,
      marginBottom: dimensions.SPACING.XSMALL,
      ...theme.typography.LABEL.SMALL,
    },
    labelStyle,
  ];

  // 输入框容器样式
  const inputContainerStyle = [
    styles.inputContainer,
  ];

  // 输入框样式
  const textInputStyle = [
    styles.input,
    {
      backgroundColor: colors.background,
      borderWidth: dimensions.BORDER_WIDTH.REGULAR,
      borderColor: colors.border,
      borderRadius: dimensions.BORDER_RADIUS.MEDIUM,
      color: colors.text,
    },
  ];

  // 根据尺寸添加样式
  switch (size) {
    case 'small':
      textInputStyle.push({
        paddingHorizontal: dimensions.SPACING.SMALL,
        paddingVertical: dimensions.SPACING.XSMALL,
        fontSize: dimensions.FONT_SIZE.TINY,
      });
      break;
    case 'medium':
      textInputStyle.push({
        paddingHorizontal: dimensions.SPACING.MEDIUM,
        paddingVertical: dimensions.SPACING.SMALL,
        fontSize: dimensions.FONT_SIZE.SMALL,
      });
      break;
    case 'large':
      textInputStyle.push({
        paddingHorizontal: dimensions.SPACING.REGULAR,
        paddingVertical: dimensions.SPACING.MEDIUM,
        fontSize: dimensions.FONT_SIZE.MEDIUM,
      });
      break;
    case 'xlarge':
      textInputStyle.push({
        paddingHorizontal: dimensions.SPACING.LARGE,
        paddingVertical: dimensions.SPACING.REGULAR,
        fontSize: dimensions.FONT_SIZE.REGULAR,
      });
      break;
    default:
      textInputStyle.push({
        paddingHorizontal: dimensions.SPACING.MEDIUM,
        paddingVertical: dimensions.SPACING.SMALL,
        fontSize: dimensions.FONT_SIZE.SMALL,
      });
  }

  // 多行输入样式
  if (multiline) {
    textInputStyle.push({
      textAlignVertical: 'top',
      minHeight: numberOfLines * 20, // 估计每行高度
    });
  }

  // 焦点状态样式
  if (isFocused) {
    textInputStyle.push({
      borderColor: colors.primary,
    });
  }

  // 错误状态样式
  if (error) {
    textInputStyle.push({
      borderColor: colors.error,
    });
  }

  // 禁用状态样式
  if (disabled) {
    textInputStyle.push({
      backgroundColor: colors.textDisabled,
      opacity: 0.7,
      color: colors.textSecondary,
    });
  }

  // 自定义输入框样式
  if (inputStyle) {
    textInputStyle.push(inputStyle);
  }

  // 错误文本样式
  const errorTextStyle = {
    color: colors.error,
    fontSize: dimensions.FONT_SIZE.SMALL,
    marginTop: dimensions.SPACING.XSMALL,
  };

  // 切换密码可见性
  const togglePasswordVisibility = () => {
    setIsPasswordVisible(!isPasswordVisible);
  };

  return (
    <View style={containerStyle}>
      {label && <Text style={labelTextStyle}>{label}</Text>}

      <View style={inputContainerStyle}>
        <TextInput
          style={textInputStyle}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textHint}
          secureTextEntry={secureTextEntry && !isPasswordVisible}
          editable={!disabled}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          keyboardType={keyboardType}
          multiline={multiline}
          numberOfLines={multiline ? numberOfLines : 1}
          {...props}
        />

        {secureTextEntry && (
          <TouchableOpacity
            style={[
              styles.eyeIcon,
              {
                right: dimensions.SPACING.MEDIUM,
              },
            ]}
            onPress={togglePasswordVisibility}
            activeOpacity={0.7}
          >
            <Text
              style={{
                color: colors.primary,
                fontSize: dimensions.FONT_SIZE.SMALL,
              }}
            >
              {isPasswordVisible ? '隐藏' : '显示'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {error && <Text style={errorTextStyle}>{error}</Text>}
    </View>
  );
};

// 创建样式
const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  label: {
    fontWeight: '500',
  },
  inputContainer: {
    position: 'relative',
    width: '100%',
  },
  input: {
    width: '100%',
  },
  eyeIcon: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    display: 'flex',
  },
});

export default Input;