import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

/**
 * 通用缩放指示器组件
 * 在界面顶部居中位置显示当前缩放比例，只在进行缩放操作时显示
 */
const ZoomIndicator = ({ 
  scale = 1, 
  visible = false, 
  autoHideDelay = 2000,
  style,
  textStyle 
}) => {
  const { colors } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const hideTimeoutRef = useRef(null);

  // 格式化缩放比例显示
  const formatScale = (scaleValue) => {
    const percentage = Math.round(scaleValue * 100);
    return `${percentage}%`;
  };

  // 处理显示/隐藏动画
  useEffect(() => {
    if (visible) {
      // 清除之前的隐藏定时器
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }

      // 显示动画
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();

      // 设置自动隐藏定时器
      hideTimeoutRef.current = setTimeout(() => {
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start();
      }, autoHideDelay);
    } else {
      // 立即隐藏
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }

    // 清理定时器
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, [visible, fadeAnim, autoHideDelay]);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: colors.surface || colors.card,
          borderColor: colors.border,
          opacity: fadeAnim,
        },
        style,
      ]}
      pointerEvents="none" // 不拦截触摸事件
    >
      <Text
        style={[
          styles.text,
          {
            color: colors.text,
          },
          textStyle,
        ]}
      >
        {formatScale(scale)}
      </Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 80, // 距离顶部80px，避免与状态栏重叠
    left: '50%',
    transform: [{ translateX: -30 }], // 居中对齐（假设宽度约60px）
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    zIndex: 1000, // 确保在最上层
  },
  text: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    minWidth: 36, // 最小宽度确保居中
  },
});

export default ZoomIndicator;
