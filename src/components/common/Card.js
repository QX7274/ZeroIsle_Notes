/**
 * 通用卡片组件
 * 支持多种样式变体和动画效果
 */

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import * as Animations from '../../utils/animations';

/**
 * 通用卡片组件
 * @param {React.ReactNode} children - 卡片内容
 * @param {function} onPress - 点击事件处理函数
 * @param {boolean} disabled - 是否禁用点击
 * @param {object} style - 自定义样式
 * @param {string} elevation - 阴影高度：none, small, medium, large, xlarge
 * @param {string} variant - 卡片变体：default, outlined, flat, gradient
 * @param {boolean} fullWidth - 是否占满宽度
 * @param {string} animation - 动画类型：none, fade, scale, pulse
 * @param {number} animationDuration - 动画持续时间
 * @param {string} gradientType - 渐变类型：primary, secondary, success, info, warning, error
 * @param {boolean} hoverable - 是否启用悬停效果
 */
const Card = ({
  children,
  onPress,
  disabled = false,
  style,
  elevation = 'medium',
  variant = 'default',
  fullWidth = false,
  animation = 'none',
  animationDuration = 300,
  gradientType = 'primary',
  hoverable = false,
  ...props
}) => {
  const { theme } = useTheme();
  const { colors, dimensions } = theme;

  // 创建动画值
  const [fadeAnim] = useState(new Animated.Value(0));
  const [scaleAnim] = useState(new Animated.Value(1));
  const [pressAnim] = useState(new Animated.Value(1));

  // 启动进入动画
  useEffect(() => {
    if (animation === 'fade') {
      Animations.fadeIn(fadeAnim, 1, animationDuration);
    } else if (animation === 'scale') {
      fadeAnim.setValue(1);
      Animations.scale(scaleAnim, 1, animationDuration);
    } else if (animation === 'pulse') {
      fadeAnim.setValue(1);
      Animations.pulse(scaleAnim, 0.98, 1.02, 2000);
    } else {
      fadeAnim.setValue(1);
    }
  }, []);

  // 处理按压动画
  const handlePressIn = () => {
    if (hoverable && !disabled) {
      Animated.timing(pressAnim, {
        toValue: 0.97,
        duration: 100,
        useNativeDriver: true,
      }).start();
    }
  };

  const handlePressOut = () => {
    if (hoverable && !disabled) {
      Animated.timing(pressAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  };

  // 卡片基础样式
  const cardStyle = [
    styles.card,
    {
      backgroundColor: colors.card,
      borderRadius: dimensions.BORDER_RADIUS.MEDIUM,
      padding: dimensions.SPACING.MEDIUM,
      marginVertical: dimensions.SPACING.SMALL,
    },
  ];

  // 根据变体添加样式
  switch (variant) {
    case 'outlined':
      cardStyle.push({
        backgroundColor: 'transparent',
        borderWidth: dimensions.BORDER_WIDTH.REGULAR,
        borderColor: colors.border,
      });
      break;
    case 'flat':
      cardStyle.push({
        backgroundColor: colors.background,
      });
      break;
    case 'gradient':
      // 渐变样式在LinearGradient中设置
      cardStyle.push({
        backgroundColor: 'transparent', // 避免背景色覆盖渐变
      });
      break;
    default:
      // 默认样式，不需要额外添加
      break;
  }

  // 根据elevation确定阴影样式
  if (variant !== 'outlined' && variant !== 'flat') {
    switch (elevation) {
      case 'none':
        // 不添加阴影
        break;
      case 'small':
        cardStyle.push({
          ...dimensions.SHADOW.SMALL,
          shadowColor: colors.shadow,
        });
        break;
      case 'medium':
        cardStyle.push({
          ...dimensions.SHADOW.MEDIUM,
          shadowColor: colors.shadow,
        });
        break;
      case 'large':
        cardStyle.push({
          ...dimensions.SHADOW.LARGE,
          shadowColor: colors.shadow,
        });
        break;
      case 'xlarge':
        cardStyle.push({
          ...dimensions.SHADOW.XLARGE,
          shadowColor: colors.shadow,
        });
        break;
      default:
        cardStyle.push({
          ...dimensions.SHADOW.MEDIUM,
          shadowColor: colors.shadow,
        });
    }
  }

  // 全宽样式
  if (fullWidth) {
    cardStyle.push({
      width: '100%',
      marginHorizontal: 0,
    });
  }

  // 禁用状态样式
  if (disabled) {
    cardStyle.push({
      opacity: 0.7,
    });
  }

  // 添加自定义样式
  if (style) {
    cardStyle.push(style);
  }

  // 动画样式
  const animatedStyle = {
    opacity: fadeAnim,
    transform: [
      { scale: animation === 'none' ? pressAnim : scaleAnim }
    ],
  };

  // 渲染卡片内容
  const renderCardContent = () => {
    // 如果是渐变卡片，需要导入LinearGradient
    if (variant === 'gradient') {
      // 由于LinearGradient可能需要额外安装，这里使用条件导入
      try {
        const LinearGradient = require('react-native-linear-gradient').default;
        const gradientColors = colors.gradient[gradientType.toUpperCase()] || colors.gradient.PRIMARY;

        return (
          <LinearGradient
            colors={gradientColors}
            style={styles.gradientContainer}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            {children}
          </LinearGradient>
        );
      } catch (error) {
        console.warn('LinearGradient not available, falling back to default card');
        return children;
      }
    }

    return children;
  };

  // 如果有onPress，则使用TouchableOpacity，否则使用View
  if (onPress) {
    return (
      <Animated.View style={[animatedStyle]}>
        <TouchableOpacity
          style={cardStyle}
          onPress={onPress}
          disabled={disabled}
          activeOpacity={hoverable ? 1 : 0.7}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          {...props}
        >
          {renderCardContent()}
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[cardStyle, animatedStyle]} {...props}>
      {renderCardContent()}
    </Animated.View>
  );
};

// 创建样式
const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
  },
  gradientContainer: {
    flex: 1,
    borderRadius: 8,
    overflow: 'hidden',
    padding: 16,
  },
});

export default Card;