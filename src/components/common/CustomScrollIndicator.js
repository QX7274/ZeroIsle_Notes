/**
 * 自定义滑动指示器组件
 * 支持流畅滑动、自动隐藏、页面分隔等功能
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  Dimensions,
  Platform
} from 'react-native';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const CustomScrollIndicator = ({
  // 滚动相关参数
  scrollOffset = 0,
  contentHeight = 0,
  visibleHeight = screenHeight,
  contentWidth = 0,
  visibleWidth = screenWidth,
  
  // 显示控制
  visible = true,
  autoHideDelay = 2000,
  
  // 样式配置
  position = 'right', // 'right' | 'bottom'
  backgroundColor = 'rgba(0, 0, 0, 0.4)',
  activeColor = 'rgba(0, 0, 0, 0.6)',
  borderRadius = 3,
  minSize = 30,
  maxSize = 100,
  
  // 工具栏相关
  toolbarHeight = 0,
  toolbarOffset = 20,
  
  // 页面分隔配置
  showPageDividers = false,
  pageHeight = screenHeight,
  dividerColor = 'rgba(255, 255, 255, 0.3)',
  dividerWidth = 1,
  
  // 动画配置
  animationDuration = 150,
  fadeInDuration = 200,
  fadeOutDuration = 300,
  
  // 回调
  onIndicatorPress,
  onIndicatorLongPress
}) => {
  // 动画值
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  
  // 状态
  const [isVisible, setIsVisible] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const hideTimeoutRef = useRef(null);
  const lastScrollTimeRef = useRef(0);
  
  // 计算指示器尺寸和位置
  const calculateIndicatorMetrics = () => {
    if (position === 'right') {
      const maxScroll = Math.max(0, contentHeight - visibleHeight);
      const scrollProgress = maxScroll > 0 ? scrollOffset / maxScroll : 0;
      
      // 指示器高度根据内容比例动态调整
      const indicatorHeight = Math.max(
        minSize,
        Math.min(maxSize, visibleHeight * (visibleHeight / contentHeight))
      );
      
      const maxIndicatorTop = visibleHeight - indicatorHeight;
      const indicatorTop = maxIndicatorTop * scrollProgress;
      
      return {
        size: indicatorHeight,
        position: indicatorTop + toolbarHeight + toolbarOffset,
        progress: scrollProgress
      };
    } else {
      const maxScroll = Math.max(0, contentWidth - visibleWidth);
      const scrollProgress = maxScroll > 0 ? scrollOffset / maxScroll : 0;
      
      // 指示器宽度根据内容比例动态调整
      const indicatorWidth = Math.max(
        minSize,
        Math.min(maxSize, visibleWidth * (visibleWidth / contentWidth))
      );
      
      const maxIndicatorLeft = visibleWidth - indicatorWidth;
      const indicatorLeft = maxIndicatorLeft * scrollProgress;
      
      return {
        size: indicatorWidth,
        position: indicatorLeft,
        progress: scrollProgress
      };
    }
  };
  
  // 渲染页面分隔线
  const renderPageDividers = () => {
    if (!showPageDividers || position !== 'right') return null;
    
    const dividers = [];
    const totalPages = Math.ceil(contentHeight / pageHeight);
    
    for (let i = 1; i < totalPages; i++) {
      // 计算分隔线位置，考虑工具栏高度和偏移
      const dividerTop = (i * pageHeight / contentHeight) * visibleHeight;
      const adjustedTop = dividerTop + toolbarHeight + toolbarOffset;
      
      // 确保分隔线在指示器范围内
      if (adjustedTop >= toolbarHeight + toolbarOffset && adjustedTop <= visibleHeight) {
        dividers.push(
          <View
            key={`divider-${i}`}
            style={[
              styles.pageDivider,
              {
                top: adjustedTop,
                backgroundColor: dividerColor,
                width: dividerWidth
              }
            ]}
          />
        );
      }
    }
    
    return dividers;
  };
  
  // 显示指示器
  const showIndicator = () => {
    if (!visible) return;
    
    setIsVisible(true);
    setIsActive(true);
    
    // 清除之前的隐藏定时器
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }
    
    // 动画显示 - 使用更流畅的缓动函数
    Animated.parallel([
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: fadeInDuration,
        useNativeDriver: true
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: fadeInDuration,
        useNativeDriver: true
      })
    ]).start();
  };
  
  // 隐藏指示器
  const hideIndicator = () => {
    setIsActive(false);
    
    // 延迟隐藏 - 使用更流畅的动画
    hideTimeoutRef.current = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: fadeOutDuration,
          useNativeDriver: true
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.8,
          duration: fadeOutDuration,
          useNativeDriver: true
        })
      ]).start(() => {
        setIsVisible(false);
      });
    }, autoHideDelay);
  };
  
  // 处理滚动更新
  useEffect(() => {
    if (!visible) return;
    
    const currentTime = Date.now();
    lastScrollTimeRef.current = currentTime;
    
    // 立即显示指示器
    showIndicator();
    
    // 清除之前的隐藏定时器
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }
    
    // 延迟隐藏指示器
    hideTimeoutRef.current = setTimeout(() => {
      hideIndicator();
    }, autoHideDelay);
    
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, [scrollOffset, visible, autoHideDelay]);
  
  // 组件卸载时清理
  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, []);
  
  // 如果不可见或内容不需要滚动，不渲染
  if (!visible || !isVisible) return null;
  
  const metrics = calculateIndicatorMetrics();
  const isVertical = position === 'right';
  
  return (
    <Animated.View
      style={[
        styles.container,
        isVertical ? styles.rightContainer : styles.bottomContainer,
        {
          opacity: opacityAnim,
          transform: [{ scale: scaleAnim }]
        }
      ]}
    >
      {/* 主指示器 */}
      <Animated.View
        style={[
          styles.indicator,
          {
            backgroundColor: isActive ? activeColor : backgroundColor,
            borderRadius,
            [isVertical ? 'height' : 'width']: metrics.size,
            [isVertical ? 'top' : 'left']: metrics.position
          }
        ]}
      />
      
      {/* 页面分隔线 */}
      {renderPageDividers()}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    zIndex: 1000,
  },
  rightContainer: {
    right: 8,
    top: 0,
    bottom: 0,
    width: 6,
  },
  bottomContainer: {
    bottom: 8,
    left: 0,
    right: 0,
    height: 6,
  },
  indicator: {
    position: 'absolute',
    minWidth: 6,
    minHeight: 6,
  },
  pageDivider: {
    position: 'absolute',
    right: 0,
    height: 2,
    borderRadius: 1,
  }
});

export default CustomScrollIndicator;
