/**
 * 设计令牌系统 (Design Tokens)
 *
 * 所有UI组件应从此文件引用设计变量，确保全局一致性。
 *
 * 使用方法:
 * import { SPACING, RADIUS, ELEVATION, ANIMATION } from '@/theme/tokens';
 *
 * const styles = StyleSheet.create({
 *   container: {
 *     padding: SPACING.md,
 *     borderRadius: RADIUS.lg,
 *     ...ELEVATION.md,
 *   }
 * });
 */

// ============================================================================
// 间距令牌 (Spacing)
// ============================================================================
export const SPACING = {
  /** 2px - 极小间距 */
  xxs: 2,
  /** 4px - 超小间距 */
  xs: 4,
  /** 8px - 小间距 */
  sm: 8,
  /** 12px - 中小间距 */
  ms: 12,
  /** 16px - 中等间距 (默认) */
  md: 16,
  /** 20px - 中大间距 */
  ml: 20,
  /** 24px - 大间距 */
  lg: 24,
  /** 32px - 超大间距 */
  xl: 32,
  /** 40px - 特大间距 */
  xxl: 40,
  /** 48px - 巨大间距 */
  xxxl: 48,
};

// ============================================================================
// 圆角令牌 (Border Radius)
// ============================================================================
export const RADIUS = {
  /** 0px - 无圆角 */
  none: 0,
  /** 2px - 微圆角 */
  xs: 2,
  /** 4px - 小圆角 */
  sm: 4,
  /** 8px - 中等圆角 */
  md: 8,
  /** 12px - 大圆角 */
  lg: 12,
  /** 16px - 超大圆角 */
  xl: 16,
  /** 20px - 特大圆角 */
  xxl: 20,
  /** 24px - 巨大圆角 */
  xxxl: 24,
  /** 9999px - 完全圆形 */
  full: 9999,
};

// ============================================================================
// 阴影/高度令牌 (Elevation)
// ============================================================================
export const ELEVATION = {
  /** 无阴影 */
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  /** 轻微阴影 - 用于微妙的区分 */
  xs: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
    elevation: 1,
  },
  /** 小阴影 - 用于卡片和列表项 */
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  /** 中等阴影 - 用于悬浮元素 */
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  /** 大阴影 - 用于弹出层 */
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  /** 超大阴影 - 用于模态框 */
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 16,
  },
  /** 特大阴影 - 用于最高层级元素 */
  xxl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 24,
  },
};

// ============================================================================
// 动画令牌 (Animation)
// ============================================================================
export const ANIMATION = {
  /** 持续时间 (毫秒) */
  duration: {
    /** 100ms - 即时响应 */
    instant: 100,
    /** 150ms - 快速 */
    fast: 150,
    /** 200ms - 较快 */
    quick: 200,
    /** 300ms - 标准 */
    normal: 300,
    /** 400ms - 较慢 */
    moderate: 400,
    /** 500ms - 慢速 */
    slow: 500,
    /** 700ms - 很慢 */
    slower: 700,
  },

  /** 缓动函数 */
  easing: {
    /** 标准缓动 */
    standard: 'cubic-bezier(0.4, 0, 0.2, 1)',
    /** 加速缓动 */
    accelerate: 'cubic-bezier(0.4, 0, 1, 1)',
    /** 减速缓动 */
    decelerate: 'cubic-bezier(0, 0, 0.2, 1)',
    /** 弹性缓动 */
    spring: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
    /** 线性 */
    linear: 'linear',
  },
};

// ============================================================================
// Z-Index 令牌 (层级)
// ============================================================================
export const Z_INDEX = {
  /** 基础层级 */
  base: 0,
  /** 悬浮元素 */
  float: 10,
  /** 下拉菜单 */
  dropdown: 100,
  /** 粘性元素 */
  sticky: 200,
  /** 固定元素 (Header/Footer) */
  fixed: 300,
  /** 抽屉/侧边栏 */
  drawer: 400,
  /** 模态遮罩 */
  overlay: 500,
  /** 模态框 */
  modal: 600,
  /** Toast 通知 */
  toast: 700,
  /** 工具提示 */
  tooltip: 800,
  /** 最高层级 */
  max: 9999,
};

// ============================================================================
// 尺寸令牌 (Size)
// ============================================================================
export const SIZE = {
  /** 图标尺寸 */
  icon: {
    xs: 12,
    sm: 16,
    md: 20,
    lg: 24,
    xl: 32,
    xxl: 40,
  },

  /** 头像尺寸 */
  avatar: {
    xs: 24,
    sm: 32,
    md: 40,
    lg: 48,
    xl: 64,
    xxl: 96,
  },

  /** 按钮高度 */
  button: {
    sm: 32,
    md: 40,
    lg: 48,
    xl: 56,
  },

  /** 输入框高度 */
  input: {
    sm: 36,
    md: 44,
    lg: 52,
  },

  /** 触摸目标最小尺寸 */
  touchTarget: 44,
};

// ============================================================================
// 边框令牌 (Border)
// ============================================================================
export const BORDER = {
  /** 边框宽度 */
  width: {
    none: 0,
    thin: 0.5,
    default: 1,
    medium: 1.5,
    thick: 2,
  },

  /** 边框样式 */
  style: {
    solid: 'solid',
    dashed: 'dashed',
    dotted: 'dotted',
  },
};

// ============================================================================
// 透明度令牌 (Opacity)
// ============================================================================
export const OPACITY = {
  /** 完全透明 */
  transparent: 0,
  /** 非常低 */
  lightest: 0.05,
  /** 很低 */
  lighter: 0.1,
  /** 低 */
  light: 0.2,
  /** 中低 */
  mediumLight: 0.4,
  /** 中等 */
  medium: 0.5,
  /** 中高 */
  mediumHigh: 0.6,
  /** 高 */
  high: 0.8,
  /** 很高 */
  higher: 0.9,
  /** 最高 */
  highest: 0.95,
  /** 完全不透明 */
  opaque: 1,
};

// ============================================================================
// 组件特定令牌
// ============================================================================
export const COMPONENT = {
  /** 卡片 */
  card: {
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    ...ELEVATION.sm,
  },

  /** 列表项 */
  listItem: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    minHeight: 48,
  },

  /** 底部标签栏 */
  tabBar: {
    height: 56,
    paddingBottom: SPACING.xs,
  },

  /** 顶部导航栏 */
  header: {
    height: 56,
    paddingHorizontal: SPACING.md,
  },

  /** 分隔线 */
  divider: {
    height: 1,
    marginVertical: SPACING.sm,
  },

  /** Toast 通知 */
  toast: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    minHeight: 48,
    maxWidth: 340,
  },

  /** 骨架屏 */
  skeleton: {
    borderRadius: RADIUS.sm,
    shimmerDuration: ANIMATION.duration.slow,
  },
};

// ============================================================================
// 默认导出
// ============================================================================
export default {
  SPACING,
  RADIUS,
  ELEVATION,
  ANIMATION,
  Z_INDEX,
  SIZE,
  BORDER,
  OPACITY,
  COMPONENT,
};
