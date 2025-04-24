/**
 * 通用Toast提示组件
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { selectToast, hideToast } from '../../redux/slices/uiSlice';
import { SPACING } from '../../utils/constants/dimensions';
import { useTheme } from '../../context/ThemeContext';

/**
 * 通用Toast提示组件
 * 自动连接到Redux状态，显示全局Toast消息
 */
const Toast = () => {
  const toast = useSelector(selectToast);
  const dispatch = useDispatch();
  const fadeAnim = new Animated.Value(0);
  const { colors } = useTheme();
  // 获取动态样式
  const dynamicStyles = getStyles(colors);

  useEffect(() => {
    if (toast.visible) {
      // 显示Toast
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        easing: Easing.ease,
        useNativeDriver: true,
      }).start();

      // 设置自动隐藏
      const timer = setTimeout(() => {
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          easing: Easing.ease,
          useNativeDriver: true,
        }).start(() => {
          dispatch(hideToast());
        });
      }, 3000); // 3秒后自动隐藏

      return () => clearTimeout(timer);
    }
  }, [toast.visible, fadeAnim, dispatch]);

  if (!toast.visible) {
    return null;
  }

  // 根据类型确定样式
  const toastStyle = [dynamicStyles.toast];

  switch (toast.type) {
    case 'success':
      toastStyle.push(dynamicStyles.success);
      break;
    case 'error':
      toastStyle.push(dynamicStyles.error);
      break;
    case 'warning':
      toastStyle.push(dynamicStyles.warning);
      break;
    case 'info':
    default:
      toastStyle.push(dynamicStyles.info);
  }

  return (
    <Animated.View
      style={[
        dynamicStyles.container,
        { opacity: fadeAnim },
        { transform: [{ translateY: fadeAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [20, 0]
        })}] }
      ]}
    >
      <View style={toastStyle}>
        <Text style={dynamicStyles.text}>{toast.message}</Text>
      </View>
    </Animated.View>
  );
};

// 使用内联样式，因为我们需要访问动态的颜色主题
const getStyles = (colors) => ({
  container: {
    position: 'absolute',
    bottom: SPACING.XLARGE,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  toast: {
    paddingVertical: SPACING.MEDIUM,
    paddingHorizontal: SPACING.LARGE,
    borderRadius: 16, // 使用固定值
    minWidth: 200,
    maxWidth: '80%',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 16,
    textAlign: 'center',
  },
  info: {
    backgroundColor: colors.info || '#5AC8FA',
  },
  success: {
    backgroundColor: colors.success || '#34C759',
  },
  error: {
    backgroundColor: colors.error || '#FF3B30',
  },
  warning: {
    backgroundColor: colors.warning || '#FFCC00',
  },
});

// 创建一个空的StyleSheet，实际样式将在组件内部动态生成
const styles = StyleSheet.create({
  container: {},
  toast: {},
  text: {},
  info: {},
  success: {},
  error: {},
  warning: {},
});

export default Toast;