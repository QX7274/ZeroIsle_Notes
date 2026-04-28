/**
 * 骨架屏加载组件
 *
 * 提供多种骨架屏变体，用于内容加载时的占位展示
 *
 * 导出组件:
 * - SkeletonBlock: 基础骨架块
 * - SkeletonText: 文本骨架
 * - SkeletonAvatar: 头像骨架
 * - SkeletonListItem: 列表项骨架
 * - SkeletonListCards: 卡片列表骨架
 * - SkeletonNoteCard: 笔记卡片骨架
 */

import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, Animated, Easing, Dimensions } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// 设计令牌
const SPACING = { xs: 4, sm: 8, md: 16, lg: 24 };
const RADIUS = { sm: 4, md: 8, lg: 12, xl: 16, full: 9999 };
const SIZE = {
  avatar: { xs: 24, sm: 32, md: 40, lg: 48, xl: 64 },
};

/**
 * 基础骨架块组件
 */
export const SkeletonBlock = ({
  width = '100%',
  height = 80,
  borderRadius = 12,
  style = {},
  animated = true,
}) => {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animated) {return;}

    const loop = Animated.loop(
      Animated.timing(shimmer, {
        toValue: 1,
        duration: 1500,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [shimmer, animated]);

  const translateX = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [-SCREEN_WIDTH, SCREEN_WIDTH],
  });

  return (
    <View style={[{ width, height, borderRadius, overflow: 'hidden', backgroundColor: '#eaeaea55' }, style]}>
      {animated && (
        <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateX }] }]}>
          <LinearGradient
            colors={['#ffffff00', '#ffffff55', '#ffffff00']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      )}
    </View>
  );
};

/**
 * 文本骨架屏
 */
export const SkeletonText = ({
  lines = 3,
  lineHeight = 14,
  spacing = SPACING.sm,
  lastLineWidth = '60%',
  style,
}) => {
  return (
    <View style={[styles.textContainer, style]}>
      {Array.from({ length: lines }).map((_, index) => (
        <SkeletonBlock
          key={index}
          width={index === lines - 1 ? lastLineWidth : '100%'}
          height={lineHeight}
          borderRadius={RADIUS.sm}
          style={{ marginBottom: index < lines - 1 ? spacing : 0 }}
        />
      ))}
    </View>
  );
};

/**
 * 头像骨架屏
 */
export const SkeletonAvatar = ({
  size = 'md',
  shape = 'circle',
  style,
}) => {
  const sizeValue = SIZE.avatar[size] || SIZE.avatar.md;
  const borderRadius = shape === 'circle' ? RADIUS.full : RADIUS.md;

  return (
    <SkeletonBlock
      width={sizeValue}
      height={sizeValue}
      borderRadius={borderRadius}
      style={style}
    />
  );
};

/**
 * 列表项骨架屏
 */
export const SkeletonListItem = ({
  height = 72,
  showAvatar = true,
  avatarSize = 'md',
  showTitle = true,
  showSubtitle = true,
  style,
}) => {
  const avatarSizeValue = SIZE.avatar[avatarSize] || SIZE.avatar.md;

  return (
    <View style={[styles.listItem, { minHeight: height }, style]}>
      {showAvatar && (
        <SkeletonAvatar size={avatarSize} style={styles.listItemAvatar} />
      )}
      <View style={styles.listItemContent}>
        {showTitle && (
          <SkeletonBlock
            width="60%"
            height={16}
            borderRadius={RADIUS.sm}
            style={{ marginBottom: showSubtitle ? SPACING.xs : 0 }}
          />
        )}
        {showSubtitle && (
          <SkeletonBlock width="40%" height={12} borderRadius={RADIUS.sm} />
        )}
      </View>
    </View>
  );
};

/**
 * 卡片列表骨架屏
 */
export const SkeletonListCards = ({
  count = 6,
  spacing = 12,
  cardHeight = 96,
  style = {},
}) => {
  const items = Array.from({ length: count });
  return (
    <View style={[{ padding: 16 }, style]}>
      {items.map((_, idx) => (
        <View key={idx} style={{ marginBottom: idx === count - 1 ? 0 : spacing }}>
          <SkeletonBlock height={cardHeight} borderRadius={14} />
        </View>
      ))}
    </View>
  );
};

/**
 * 笔记卡片骨架屏 - 专为笔记列表设计
 */
export const SkeletonNoteCard = ({ style }) => {
  return (
    <View style={[styles.noteCard, style]}>
      {/* 头部: 日期 + 更多按钮 */}
      <View style={styles.noteCardHeader}>
        <SkeletonBlock width="30%" height={12} borderRadius={RADIUS.sm} />
        <SkeletonBlock width={24} height={24} borderRadius={RADIUS.full} />
      </View>

      {/* 标题 */}
      <SkeletonBlock
        width="80%"
        height={18}
        borderRadius={RADIUS.sm}
        style={{ marginBottom: SPACING.sm }}
      />

      {/* 内容预览 */}
      <SkeletonText lines={2} lineHeight={14} />

      {/* 底部标签 */}
      <View style={styles.noteCardFooter}>
        <SkeletonBlock width={60} height={22} borderRadius={RADIUS.full} />
        <SkeletonBlock width={60} height={22} borderRadius={RADIUS.full} />
      </View>
    </View>
  );
};

/**
 * 笔记列表骨架屏
 */
export const SkeletonNoteList = ({ count = 3, style }) => {
  return (
    <View style={[styles.noteList, style]}>
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonNoteCard key={index} style={{ marginBottom: SPACING.md }} />
      ))}
    </View>
  );
};

/**
 * 详情页骨架屏
 */
export const SkeletonDetail = ({ style }) => {
  return (
    <View style={[styles.detailContainer, style]}>
      {/* 标题 */}
      <SkeletonBlock
        width="70%"
        height={28}
        borderRadius={RADIUS.sm}
        style={{ marginBottom: SPACING.md }}
      />

      {/* 元信息 */}
      <View style={styles.metaRow}>
        <SkeletonAvatar size="sm" />
        <SkeletonBlock width={100} height={14} borderRadius={RADIUS.sm} style={{ marginLeft: SPACING.sm }} />
        <SkeletonBlock width={80} height={14} borderRadius={RADIUS.sm} style={{ marginLeft: SPACING.md }} />
      </View>

      {/* 内容区域 */}
      <View style={{ marginTop: SPACING.lg }}>
        <SkeletonText lines={6} lineHeight={16} spacing={SPACING.sm} />
      </View>
    </View>
  );
};

// 样式
const styles = StyleSheet.create({
  textContainer: {
    width: '100%',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  listItemAvatar: {
    marginRight: SPACING.md,
  },
  listItemContent: {
    flex: 1,
    justifyContent: 'center',
  },
  noteCard: {
    padding: SPACING.md,
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderRadius: RADIUS.lg,
  },
  noteCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  noteCardFooter: {
    flexDirection: 'row',
    marginTop: SPACING.md,
    gap: SPACING.sm,
  },
  noteList: {
    width: '100%',
  },
  detailContainer: {
    padding: SPACING.md,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});

// 默认导出
export default SkeletonBlock;


