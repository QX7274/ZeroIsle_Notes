/**
 * 通用搜索栏组件
 * 用于在各个页面中提供搜索功能
 */
import React from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../context/ThemeContext';

/**
 * 通用搜索栏组件
 * @param {string} value - 搜索框的值
 * @param {function} onChangeText - 文本变化回调
 * @param {function} onSubmitEditing - 提交编辑回调
 * @param {string} placeholder - 占位符文本
 * @param {object} style - 自定义样式
 * @param {function} onFocus - 获取焦点回调
 * @param {function} onBlur - 失去焦点回调
 * @param {boolean} autoFocus - 是否自动获取焦点
 */
const SearchBar = ({
  value,
  onChangeText,
  onSubmitEditing,
  placeholder = '搜索...',
  style,
  onFocus,
  onBlur,
  autoFocus = false,
}) => {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
        style,
      ]}
    >
      <Icon name="search" size={20} color={colors.textSecondary} style={styles.icon} />
      <TextInput
        style={[styles.input, { color: colors.text }]}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmitEditing}
        onFocus={onFocus}
        onBlur={onBlur}
        autoFocus={autoFocus}
        returnKeyType="search"
        autoCapitalize="none"
      />
      {value ? (
        <TouchableOpacity
          onPress={() => onChangeText && onChangeText('')}
          style={styles.clearButton}
        >
          <Icon name="close" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    height: 40,
  },
  icon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    padding: 0,
  },
  clearButton: {
    padding: 4,
  },
});

export default SearchBar;
