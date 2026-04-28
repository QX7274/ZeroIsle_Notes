/**
 * 通用Toast提示组件
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { selectToast, hideToast } from '../../redux/slices/uiSlice';
import token, { SPACING, RADIUS, ELEVATION, ANIMATION, COMPONENT, Z_INDEX, OPACITY } from '../../theme/tokens';
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
        duration: ANIMATION.duration.normal,
        easing: Easing.bezier(0.4, 0, 0.2, 1), // Standard easing
        useNativeDriver: true,
      }).start();

      // 设置自动隐藏
      const timer = setTimeout(() => {
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: ANIMATION.duration.normal,
          easing: Easing.bezier(0.4, 0, 0.2, 1),
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
        {
          transform: [{
            translateY: fadeAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [SPACING.xl, 0],
            }),
          }],
        },
      ]}
      pointerEvents="none" // 防止点击穿透阻挡下方交互
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
    bottom: SPACING.xl, // 使用token
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: Z_INDEX.toast, // 使用token
  },
  toast: {
    ...COMPONENT.toast, // 使用组件特定token (padding, radius, etc)
    ...ELEVATION.md,    // 使用阴影token
  },
  text: {
    color: '#FFFFFF',
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '500',
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

export default Toast;
