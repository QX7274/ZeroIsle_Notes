/**
 * 动画列表组件
 * 提供带有动画效果的列表
 */
import React, { useRef, useEffect } from 'react';
import { Animated, FlatList, StyleSheet, View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import * as Animations from '../../utils/animations';

/**
 * 动画列表组件
 * @param {Array} data - 列表数据
 * @param {function} renderItem - 渲染项函数
 * @param {string} animation - 动画类型：fade, slide, scale, stagger
 * @param {string} direction - 动画方向：up, down, left, right
 * @param {number} duration - 动画持续时间
 * @param {number} delay - 动画延迟时间
 * @param {number} itemDelay - 项目之间的延迟时间
 * @param {object} style - 自定义样式
 * @param {object} contentContainerStyle - 内容容器自定义样式
 * @param {boolean} showsVerticalScrollIndicator - 是否显示垂直滚动指示器
 * @param {boolean} showsHorizontalScrollIndicator - 是否显示水平滚动指示器
 */
const AnimatedList = ({
  data = [],
  renderItem,
  animation = 'fade',
  direction = 'up',
  duration = 500,
  delay = 0,
  itemDelay = 50,
  style,
  contentContainerStyle,
  showsVerticalScrollIndicator = false,
  showsHorizontalScrollIndicator = false,
  ...props
}) => {
  const { theme } = useTheme();
  const { colors, dimensions } = theme;
  
  // 创建动画值数组
  const animatedValues = useRef(
    data.map(() => Animations.createAnimatedValue(0))
  ).current;
  
  // 当数据变化时更新动画值数组
  useEffect(() => {
    if (animatedValues.length !== data.length) {
      // 如果数据长度变化，重新创建动画值数组
      animatedValues.length = 0;
      data.forEach(() => {
        animatedValues.push(Animations.createAnimatedValue(0));
      });
    }
    
    // 启动动画
    startAnimation();
  }, [data]);
  
  // 启动动画
  const startAnimation = () => {
    // 重置所有动画值
    animatedValues.forEach(value => value.setValue(0));
    
    // 延迟启动动画
    setTimeout(() => {
      // 根据动画类型启动不同的动画
      switch (animation) {
        case 'slide':
          Animations.stagger(animatedValues, 1, duration, itemDelay);
          break;
        case 'scale':
          Animations.stagger(animatedValues, 1, duration, itemDelay);
          break;
        case 'stagger':
          Animations.stagger(animatedValues, 1, duration, itemDelay);
          break;
        case 'fade':
        default:
          Animations.stagger(animatedValues, 1, duration, itemDelay);
          break;
      }
    }, delay);
  };
  
  // 获取动画样式
  const getAnimationStyle = (index) => {
    const animatedValue = animatedValues[index] || new Animated.Value(1);
    
    switch (animation) {
      case 'slide':
        // 滑动动画
        const translateValue = animatedValue.interpolate({
          inputRange: [0, 1],
          outputRange: getSlideOutputRange(),
        });
        
        return {
          opacity: animatedValue,
          transform: [
            direction === 'left' || direction === 'right'
              ? { translateX: translateValue }
              : { translateY: translateValue },
          ],
        };
      
      case 'scale':
        // 缩放动画
        return {
          opacity: animatedValue,
          transform: [
            { scale: animatedValue.interpolate({
              inputRange: [0, 1],
              outputRange: [0.8, 1],
            })},
          ],
        };
      
      case 'stagger':
        // 交错动画（结合淡入和滑动）
        const translateStaggerValue = animatedValue.interpolate({
          inputRange: [0, 1],
          outputRange: getSlideOutputRange(0.3), // 减小滑动距离
        });
        
        return {
          opacity: animatedValue,
          transform: [
            direction === 'left' || direction === 'right'
              ? { translateX: translateStaggerValue }
              : { translateY: translateStaggerValue },
          ],
        };
      
      case 'fade':
      default:
        // 淡入动画
        return {
          opacity: animatedValue,
        };
    }
  };
  
  // 获取滑动输出范围
  const getSlideOutputRange = (multiplier = 1) => {
    const distance = 100 * multiplier;
    
    switch (direction) {
      case 'up':
        return [distance, 0];
      case 'down':
        return [-distance, 0];
      case 'left':
        return [distance, 0];
      case 'right':
        return [-distance, 0];
      default:
        return [distance, 0];
    }
  };
  
  // 自定义渲染项
  const renderAnimatedItem = ({ item, index, ...rest }) => {
    return (
      <Animated.View style={[styles.itemContainer, getAnimationStyle(index)]}>
        {renderItem({ item, index, ...rest })}
      </Animated.View>
    );
  };
  
  return (
    <FlatList
      data={data}
      renderItem={renderAnimatedItem}
      style={[styles.list, style]}
      contentContainerStyle={[styles.contentContainer, contentContainerStyle]}
      showsVerticalScrollIndicator={showsVerticalScrollIndicator}
      showsHorizontalScrollIndicator={showsHorizontalScrollIndicator}
      {...props}
    />
  );
};

// 创建样式
const styles = StyleSheet.create({
  list: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
  },
  itemContainer: {
    width: '100%',
  },
});

export default AnimatedList;
