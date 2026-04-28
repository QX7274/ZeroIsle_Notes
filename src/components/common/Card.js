/**
 * 通用卡片组件
 * 支持多种样式变体和动画效果
 */

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Image, Text, Dimensions } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// 辅助函数：格式化数字
const formatNumber = (num) => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
};
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
      { scale: animation === 'none' ? pressAnim : scaleAnim },
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

/**
 * 小红书风格卡片组件
 * @param {object} data - 卡片数据 { image, title, author, likes, comments }
 * @param {function} onPress - 点击事件
 * @param {object} style - 自定义样式
 */
export const XiaohongshuCard = ({ data, onPress, style }) => {
  const { theme } = useTheme();
  const { colors, dimensions } = theme;

  return (
    <TouchableOpacity
      style={[styles.xhsCard, style]}
      onPress={onPress}
      activeOpacity={0.9}
    >
      {/* 封面图片 */}
      <View style={styles.xhsImageContainer}>
        <Image
          source={{ uri: data.image }}
          style={styles.xhsImage}
          resizeMode="cover"
        />
        {/* 渐变遮罩 */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.6)']}
          style={styles.xhsGradientOverlay}
        />
        {/* 标题 */}
        <View style={styles.xhsTitleContainer}>
          <Text style={styles.xhsTitle} numberOfLines={2}>
            {data.title}
          </Text>
        </View>
      </View>

      {/* 底部信息栏 */}
      <View style={[styles.xhsFooter, { backgroundColor: colors.card }]}>
        <View style={styles.xhsAuthorContainer}>
          <Image
            source={{ uri: data.authorAvatar }}
            style={styles.xhsAvatar}
          />
          <Text style={[styles.xhsAuthorName, { color: colors.text }]} numberOfLines={1}>
            {data.author}
          </Text>
        </View>
        <View style={styles.xhsStatsContainer}>
          <View style={styles.xhsStatItem}>
            <Icon name="favorite-border" size={14} color={colors.textSecondary} />
            <Text style={[styles.xhsStatText, { color: colors.textSecondary }]}>
              {formatNumber(data.likes || 0)}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

/**
 * 抖音风格卡片组件
 * @param {object} data - 卡片数据 { video, cover, title, author, likes, comments, shares }
 * @param {function} onPress - 点击事件
 * @param {object} style - 自定义样式
 */
export const DouyinCard = ({ data, onPress, style }) => {
  const { theme } = useTheme();
  const { colors, dimensions } = theme;

  return (
    <TouchableOpacity
      style={[styles.dyCard, style]}
      onPress={onPress}
      activeOpacity={0.9}
    >
      {/* 视频封面 */}
      <View style={styles.dyVideoContainer}>
        <Image
          source={{ uri: data.cover }}
          style={styles.dyVideo}
          resizeMode="cover"
        />
        {/* 播放按钮 */}
        <View style={styles.dyPlayButton}>
          <Icon name="play-arrow" size={40} color="#fff" />
        </View>

        {/* 右侧互动栏 */}
        <View style={styles.dyInteractionBar}>
          {/* 头像 */}
          <View style={styles.dyAvatarContainer}>
            <Image
              source={{ uri: data.authorAvatar }}
              style={styles.dyAvatar}
            />
            <View style={styles.dyFollowButton}>
              <Icon name="add" size={16} color="#fff" />
            </View>
          </View>

          {/* 点赞 */}
          <View style={styles.dyInteractionItem}>
            <Icon name="favorite" size={32} color="#fff" />
            <Text style={styles.dyInteractionText}>
              {formatNumber(data.likes || 0)}
            </Text>
          </View>

          {/* 评论 */}
          <View style={styles.dyInteractionItem}>
            <Icon name="chat-bubble" size={32} color="#fff" />
            <Text style={styles.dyInteractionText}>
              {formatNumber(data.comments || 0)}
            </Text>
          </View>

          {/* 分享 */}
          <View style={styles.dyInteractionItem}>
            <Icon name="share" size={32} color="#fff" />
            <Text style={styles.dyInteractionText}>
              {formatNumber(data.shares || 0)}
            </Text>
          </View>
        </View>

        {/* 底部信息 */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.8)']}
          style={styles.dyBottomGradient}
        >
          <View style={styles.dyBottomInfo}>
            <Text style={styles.dyAuthorName}>@{data.author}</Text>
            <Text style={styles.dyTitle} numberOfLines={2}>
              {data.title}
            </Text>
          </View>
        </LinearGradient>
      </View>
    </TouchableOpacity>
  );
};

/**
 * 知乎风格卡片组件
 * @param {object} data - 卡片数据 { title, content, author, likes, comments, answers }
 * @param {function} onPress - 点击事件
 * @param {object} style - 自定义样式
 */
export const ZhihuCard = ({ data, onPress, style }) => {
  const { theme } = useTheme();
  const { colors, dimensions } = theme;

  return (
    <TouchableOpacity
      style={[styles.zhCard, { backgroundColor: colors.card }, style]}
      onPress={onPress}
      activeOpacity={0.9}
    >
      {/* 问题标题 */}
      <Text style={[styles.zhTitle, { color: colors.text }]} numberOfLines={2}>
        {data.title}
      </Text>

      {/* 回答内容预览 */}
      {data.content && (
        <Text style={[styles.zhContent, { color: colors.textSecondary }]} numberOfLines={3}>
          {data.content}
        </Text>
      )}

      {/* 图片（如果有） */}
      {data.image && (
        <Image
          source={{ uri: data.image }}
          style={styles.zhImage}
          resizeMode="cover"
        />
      )}

      {/* 底部信息栏 */}
      <View style={styles.zhFooter}>
        <View style={styles.zhAuthorContainer}>
          <Image
            source={{ uri: data.authorAvatar }}
            style={styles.zhAvatar}
          />
          <Text style={[styles.zhAuthorName, { color: colors.text }]}>
            {data.author}
          </Text>
        </View>

        <View style={styles.zhStatsContainer}>
          <View style={styles.zhStatItem}>
            <Icon name="thumb-up" size={16} color={colors.primary} />
            <Text style={[styles.zhStatText, { color: colors.textSecondary }]}>
              {formatNumber(data.likes || 0)} 赞同
            </Text>
          </View>
          <View style={styles.zhStatItem}>
            <Icon name="chat-bubble-outline" size={16} color={colors.textSecondary} />
            <Text style={[styles.zhStatText, { color: colors.textSecondary }]}>
              {formatNumber(data.comments || 0)} 评论
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
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

  // 小红书风格样式
  xhsCard: {
    width: (SCREEN_WIDTH - 36) / 2,
    marginBottom: 12,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  xhsImageContainer: {
    width: '100%',
    height: 240,
    position: 'relative',
  },
  xhsImage: {
    width: '100%',
    height: '100%',
  },
  xhsGradientOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
  },
  xhsTitleContainer: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
  },
  xhsTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  xhsFooter: {
    padding: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  xhsAuthorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  xhsAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 6,
  },
  xhsAuthorName: {
    fontSize: 12,
    flex: 1,
  },
  xhsStatsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  xhsStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  xhsStatText: {
    fontSize: 11,
    marginLeft: 2,
  },

  // 抖音风格样式
  dyCard: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH * 1.33, // 9:16 比例
    marginBottom: 0,
  },
  dyVideoContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
    backgroundColor: '#000',
  },
  dyVideo: {
    width: '100%',
    height: '100%',
  },
  dyPlayButton: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -30,
    marginTop: -30,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dyInteractionBar: {
    position: 'absolute',
    right: 12,
    bottom: 100,
    alignItems: 'center',
  },
  dyAvatarContainer: {
    position: 'relative',
    marginBottom: 20,
  },
  dyAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#fff',
  },
  dyFollowButton: {
    position: 'absolute',
    bottom: -8,
    left: '50%',
    marginLeft: -12,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FF2D55',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dyInteractionItem: {
    alignItems: 'center',
    marginBottom: 20,
  },
  dyInteractionText: {
    color: '#fff',
    fontSize: 12,
    marginTop: 4,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  dyBottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 200,
    justifyContent: 'flex-end',
  },
  dyBottomInfo: {
    padding: 16,
    paddingBottom: 24,
  },
  dyAuthorName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  dyTitle: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
  },

  // 知乎风格样式
  zhCard: {
    width: SCREEN_WIDTH - 24,
    marginHorizontal: 12,
    marginBottom: 12,
    padding: 16,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  zhTitle: {
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 26,
    marginBottom: 8,
  },
  zhContent: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 12,
  },
  zhImage: {
    width: '100%',
    height: 200,
    borderRadius: 4,
    marginBottom: 12,
  },
  zhFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  zhAuthorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  zhAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 8,
  },
  zhAuthorName: {
    fontSize: 13,
  },
  zhStatsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  zhStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 16,
  },
  zhStatText: {
    fontSize: 12,
    marginLeft: 4,
  },
});

export default Card;
