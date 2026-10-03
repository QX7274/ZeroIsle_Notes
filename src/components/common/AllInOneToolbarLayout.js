/**
 * AllInOneToolbarLayout —— 工具栏纯布局逻辑（无 React / 无 RN 依赖）
 *
 * 为什么单独抽成纯函数模块：
 * 1. 工具栏在手机 / 平板 / 桌面三种形态下要给出不同的按钮尺寸与分组间距，
 *    这些换算逻辑若能脱离组件单测，就不会被渲染层（Dimensions / 主题 / 弹窗状态）干扰；
 * 2. popover 的位置夹取（clamp）是「离屏即不可用」的高频回归点，必须能被穷举断言；
 * 3. 本文件不做任何 I/O、不读全局状态，任何输入都返回结果而不抛错，
 *    以便 UI 侧在拿到异常尺寸（旋转中、0 宽、NaN）时仍能安全渲染。
 */

/** 断点定义（单位：dp / pt）。语义为各 tier 的**下界**（含）。 */
export const TOOLBAR_BREAKPOINTS = {
  compact: 600,
  regular: 900,
  wide: 1200,
};

/** 无障碍最小可点区域（iOS HIG / Material 均为 44dp 级别） */
const MIN_TOUCH_TARGET = 44;

/** 各 tier 的基础尺寸表；hitSlop 是「向外扩的可点区域」，实际触达 = buttonSize + 2*hitSlop */
const TIER_PRESETS = {
  compact: {
    buttonSize: 36,
    iconSize: 18,
    hitSlop: 4,
    horizontalPadding: 8,
    showLabels: false,
    groupGap: 6,
  },
  regular: {
    buttonSize: 40,
    iconSize: 20,
    hitSlop: 4,
    horizontalPadding: 12,
    showLabels: false,
    groupGap: 10,
  },
  wide: {
    buttonSize: 44,
    iconSize: 22,
    hitSlop: 4,
    horizontalPadding: 16,
    showLabels: true,
    groupGap: 14,
  },
};

/** 每个工具组的横向额外开销（组边框 / 组内间距的估算余量） */
const GROUP_INNER_GAP = 4;
/** 单个按钮右侧的间距余量 */
const BUTTON_TRAILING_GAP = 2;

/**
 * 把任意输入归一为「可用的有限数字」。
 * 为什么要单独抽：屏幕尺寸在旋转动画帧里可能是 NaN / undefined / 0，
 * 一旦让 NaN 流进样式表，RN 会直接抛错或整块布局塌陷。
 */
const toFiniteNumber = (value, fallback) => {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
};

/** 归一化屏幕宽度：非法（undefined / NaN / 负数 / 非数字）一律回落到 compact 语义的最小宽度 0 */
const normalizeScreenWidth = (screenWidth) => {
  const n = toFiniteNumber(screenWidth, 0);
  return n > 0 ? n : 0;
};

/** 依据宽度判定 tier：断点为各档下界，等于断点即进入更高档 */
const resolveTier = (screenWidth) => {
  const w = normalizeScreenWidth(screenWidth);
  if (w >= TOOLBAR_BREAKPOINTS.wide) { return 'wide'; }
  if (w >= TOOLBAR_BREAKPOINTS.regular) { return 'regular'; }
  if (w >= TOOLBAR_BREAKPOINTS.compact) { return 'regular'; }
  return 'compact';
};

/**
 * 解析安全区（刘海 / home indicator）。
 * 为什么接受多种形状：RN 的 SafeAreaInsets 既可能是 {left,right}，
 * 也可能只给了 top/bottom，接口层还见过把数组当 insets 传的写法。
 */
const normalizeInsets = (insets) => {
  if (!insets || typeof insets !== 'object') {
    return { left: 0, right: 0 };
  }
  return {
    left: Math.max(0, toFiniteNumber(insets.left, 0)),
    right: Math.max(0, toFiniteNumber(insets.right, 0)),
  };
};

/**
 * 计算工具栏在某屏幕宽度下应采用的布局参数。
 *
 * @param {number} screenWidth 当前屏幕宽度（dp/pt）；非法值回落 compact 且不抛错
 * @param {{insets?: {left?: number, right?: number}, minTouchTarget?: number}} [options]
 * @returns {{tier: 'compact'|'regular'|'wide', buttonSize: number, iconSize: number,
 *            hitSlop: number, horizontalPadding: number, showLabels: boolean, groupGap: number}}
 */
export const resolveToolbarLayout = (screenWidth, options = {}) => {
  const opts = options && typeof options === 'object' ? options : {};
  const tier = resolveTier(screenWidth);
  const preset = TIER_PRESETS[tier];
  const insets = normalizeInsets(opts.insets);
  const minTouchTarget = Math.max(
    0,
    toFiniteNumber(opts.minTouchTarget, MIN_TOUCH_TARGET),
  );

  const buttonSize = preset.buttonSize;
  // 触达标准：实际可点范围 = buttonSize + 2*hitSlop。
  // 小屏按钮会小于 44，所以这里按「还差多少」反推 hitSlop，而不是写死一个魔法数。
  const requiredHitSlop = Math.ceil((minTouchTarget - buttonSize) / 2);
  const hitSlop = Math.max(preset.hitSlop, Math.max(0, requiredHitSlop));

  return {
    tier,
    buttonSize,
    iconSize: preset.iconSize,
    hitSlop,
    // 安全区直接叠加在左右内边距上，避免刘海机横向被裁切
    horizontalPadding: preset.horizontalPadding + insets.left + insets.right,
    showLabels: preset.showLabels,
    groupGap: preset.groupGap,
  };
};

/**
 * 估算「该布局渲染指定工具组」所需的总宽度（px）。
 *
 * 为什么需要：工具栏是单行容器，宽度超限只能横向滚动。
 * 但**只按组数估算会严重低估**：一个组里可能有 6 个按钮（绘图组），
 * 也可能只有 1 个（预设组）。若按「每组 1 个按钮」估算，宽屏永远算得出「放得下」，
 * 于是溢出提示永不出现、用户以为常用工具不存在 —— 这正是集成期实测发现的问题。
 *
 * 因此这里接受两种输入：
 *  - number：工具组数量（兼容旧调用与既有单测），按「每组 1 个按钮」的下界估算；
 *  - number[]：每组各自的按钮数量（推荐，调用方知道自己渲染了几个按钮）。
 *
 * @param {object} layout resolveToolbarLayout 的返回值（非法时按 compact 兜底）
 * @param {number|number[]} groups 工具组数量，或每组按钮数量数组
 * @returns {number} 像素宽度估计（始终为非负有限数）
 */
export const estimateToolbarWidth = (layout, groups) => {
  const safeLayout = layout && typeof layout === 'object' ? layout : {};
  const resolved = {
    buttonSize: Math.max(0, toFiniteNumber(safeLayout.buttonSize, TIER_PRESETS.compact.buttonSize)),
    horizontalPadding: Math.max(0, toFiniteNumber(safeLayout.horizontalPadding, TIER_PRESETS.compact.horizontalPadding)),
    groupGap: Math.max(0, toFiniteNumber(safeLayout.groupGap, TIER_PRESETS.compact.groupGap)),
  };

  // 把两种输入统一成「每组的按钮数」
  let perGroup;
  if (Array.isArray(groups)) {
    // 组内按钮数非法（负数/NaN/非数字）按 0 处理，不抛错
    perGroup = groups.map((n) => {
      const v = toFiniteNumber(n, 0);
      return v > 0 ? Math.floor(v) : 0;
    });
  } else {
    const rawCount = toFiniteNumber(groups, 0);
    const groupCount = rawCount > 0 ? Math.floor(rawCount) : 0;
    perGroup = groupCount > 0 ? new Array(groupCount).fill(1) : [];
  }

  const buttonCount = perGroup.reduce((sum, n) => sum + n, 0);
  if (buttonCount <= 0) {
    // 空工具栏也要占左右内边距
    return Math.round(resolved.horizontalPadding * 2);
  }

  let width = resolved.horizontalPadding * 2;
  width += buttonCount * (resolved.buttonSize + BUTTON_TRAILING_GAP + GROUP_INNER_GAP);
  // 组间距只在组与组之间出现，故为 组数 - 1
  width += Math.max(0, perGroup.length - 1) * resolved.groupGap;
  return Math.round(width);
};

/** popover 默认与屏幕边缘的安全距离 */
const DEFAULT_POPOVER_MARGIN = 8;

/** 归一化一个 {width,height} 尺寸对象 */
const normalizeSize = (size, fallbackWidth, fallbackHeight) => ({
  width: Math.max(0, toFiniteNumber(size && size.width, fallbackWidth)),
  height: Math.max(0, toFiniteNumber(size && size.height, fallbackHeight)),
});

/** 归一化 anchor 矩形；缺失时视为「屏幕左上角起一个 0 尺寸的锚点」 */
const normalizeAnchorRect = (anchorRect) => {
  const rect = anchorRect && typeof anchorRect === 'object' ? anchorRect : {};
  const width = Math.max(0, toFiniteNumber(rect.width, 0));
  const height = Math.max(0, toFiniteNumber(rect.height, 0));
  return {
    x: toFiniteNumber(rect.x, 0),
    y: toFiniteNumber(rect.y, 0),
    width,
    height,
  };
};

/**
 * 计算 popover 的挂载位置（左对齐 + 顶部定位 + 贴边策略）。
 *
 * 不变量（测试按此断言）：
 *  - left >= margin
 *  - left + popoverSize.width <= screenSize.width - margin（popover 比屏幕宽时退化为 left === margin）
 *  - top >= margin
 *
 * @param {{x:number,y:number,width:number,height:number}} anchorRect 触发按钮矩形
 * @param {{width:number,height:number}} popoverSize 弹层尺寸
 * @param {{width:number,height:number}} screenSize 屏幕尺寸
 * @param {{margin?: number}} [options]
 * @returns {{left:number, top:number, placement:'bottom'|'bottom-end'|'top'|'top-end'|'fill'}}
 */
export const resolvePopoverPosition = (anchorRect, popoverSize, screenSize, options = {}) => {
  const opts = options && typeof options === 'object' ? options : {};
  const margin = Math.max(0, toFiniteNumber(opts.margin, DEFAULT_POPOVER_MARGIN));

  const screen = normalizeSize(screenSize, 0, 0);
  const popover = normalizeSize(popoverSize, 0, 0);
  const anchor = normalizeAnchorRect(anchorRect);

  // popover 比屏幕可用宽度还宽：无法同时满足左右夹取，唯一自洽解是左贴 margin，
  // 并显式标记 placement='fill'，让调用方知道「这个弹层会被裁切」。
  if (popover.width + margin * 2 > screen.width || popover.width <= 0) {
    const isDegenerate = popover.width + margin * 2 > screen.width;
    return {
      left: margin,
      top: Math.max(margin, Math.min(anchor.y + anchor.height, Math.max(margin, screen.height - popover.height - margin))),
      placement: isDegenerate ? 'fill' : 'bottom',
    };
  }

  const anchorCenterX = anchor.x + anchor.width / 2;
  // 默认左对齐到锚点；只有当右侧会溢出时，才把弹层右缘对齐到锚点右缘（bottom-end）
  let left = anchor.x;
  const maxLeft = screen.width - popover.width - margin;
  let placement = 'bottom';
  if (left > maxLeft) {
    left = anchor.x + anchor.width - popover.width;
    placement = 'bottom-end';
  }
  // 二次夹取：无论上面走了哪条分支，都保证不越界
  left = Math.max(margin, Math.min(left, maxLeft));

  // 锚点中心超出屏幕中线时翻到锚点左侧（视觉上更像「右对齐」）
  const nearRightEdge = anchorCenterX > screen.width / 2;
  if (nearRightEdge && anchor.x + anchor.width + popover.width > screen.width - margin) {
    placement = anchor.y + anchor.height + popover.height + margin <= screen.height
      ? 'bottom-end'
      : 'top-end';
  }

  let top = anchor.y + anchor.height;
  const maxTop = screen.height - popover.height - margin;
  // 下方放不下时翻到锚点上方，仍放不下则上夹取
  if (top + popover.height + margin > screen.height && anchor.y - popover.height >= margin) {
    top = anchor.y - popover.height;
    if (placement === 'bottom') { placement = 'top'; }
  }
  top = Math.max(margin, Math.min(top, Math.max(margin, maxTop)));

  return { left, top, placement };
};

export default {
  TOOLBAR_BREAKPOINTS,
  resolveToolbarLayout,
  estimateToolbarWidth,
  resolvePopoverPosition,
};
