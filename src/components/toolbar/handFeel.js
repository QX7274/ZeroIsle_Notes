/**
 * 手写笔迹"手感"模型（纯数据 + 纯函数，无任何 React / 原生依赖）。
 *
 * 为什么要单独抽一个模块：
 * 1) 手感面板（UI）与工具栏（下发）都要用到同一套字段定义和归一化口径，
 *    如果各写一份，必然出现"面板显示 70%、原生拿到 0.7/undefined"这类不一致；
 * 2) 归一化必须是纯函数，才能在单测里穷举越界/非数字/缺字段，而不用挂载任何组件。
 *
 * 字段口径严格对齐 src/hooks/useNativeToolbarBridge.js 的 PROFILE_DEFAULTS 与
 * buildHandwritingToolConfig：0~1 的比例字段一律 clamp 到 [0,1]，
 * 笔触粗细复用工具栏的 1~50。
 */

// 与工具栏 STROKE_WIDTH_RANGE 同源：面板和工具栏必须给出同一个粗细范围
export const HAND_FEEL_STROKE_RANGE = Object.freeze({ min: 1, max: 50, step: 1 });

/**
 * 手感字段名清单。用常量数组而不是散落字符串，是为了：
 * - 预设/重置可以整体遍历下发，不会漏字段；
 * - 单测可以断言"下发载荷里的键一定属于这个集合"，防止把 size/color 等
 *   与手感无关的字段混进手感载荷里覆盖掉用户当前选择。
 */
export const HAND_FEEL_FIELDS = Object.freeze([
  'pressureSensitivity',
  'velocitySensitivity',
  'smoothing',
  'taperIn',
  'taperOut',
  'opacity',
  'strokeWidth',
]);

// 笔型显示名：面板要显示"当前笔型"，id 对用户没有意义
export const PEN_PROFILE_LABELS = Object.freeze({
  fountain: '钢笔',
  pencil: '铅笔',
  brush: '毛笔',
  marker: '马克笔',
});

/**
 * 与 useNativeToolbarBridge.PROFILE_DEFAULTS 完全一致的手感默认值。
 * 这里刻意复制一份而不是 import，原因是 bridge 模块会连带引入 react-native
 * 的原生模块（UIManager / findNodeHandle），纯函数模块不应被它拖进原生依赖；
 * 两者的一致性由 src/hooks/__tests__/useNativeToolbarBridge.handfeel.test.js 锁定。
 */
export const HAND_FEEL_PROFILE_DEFAULTS = Object.freeze({
  fountain: Object.freeze({
    penProfile: 'fountain',
    pressureSensitivity: 0.9,
    velocitySensitivity: 0.45,
    taperIn: 0.28,
    taperOut: 0.22,
    smoothing: 0.72,
  }),
  pencil: Object.freeze({
    penProfile: 'pencil',
    pressureSensitivity: 0.55,
    velocitySensitivity: 0.35,
    taperIn: 0.08,
    taperOut: 0.08,
    smoothing: 0.45,
  }),
  brush: Object.freeze({
    penProfile: 'brush',
    pressureSensitivity: 1,
    velocitySensitivity: 0.7,
    taperIn: 0.32,
    taperOut: 0.26,
    smoothing: 0.82,
  }),
  marker: Object.freeze({
    penProfile: 'marker',
    pressureSensitivity: 0.18,
    velocitySensitivity: 0.08,
    taperIn: 0,
    taperOut: 0,
    smoothing: 0.3,
  }),
});

// 荧光笔默认半透明：与工具栏 HIGHLIGHTER_CONFIG.opacity 保持一致
export const DEFAULT_HIGHLIGHTER_OPACITY = 0.4;

const PEN_PROFILE_IDS = Object.freeze(Object.keys(HAND_FEEL_PROFILE_DEFAULTS));

/**
 * 工具 id 到笔型 id 的映射。与 bridge 的 TOOL_TO_PROFILE 口径一致，
 * 额外兜住工具栏里可能出现的 size 段别名（如 stylus -> pen）。
 */
const TOOL_TO_PEN_PROFILE = Object.freeze({
  pen: 'fountain',
  pencil: 'pencil',
  brush: 'brush',
  highlighter: 'marker',
  stylus: 'fountain',
  fountain: 'fountain',
  marker: 'marker',
});

const FALLBACK_PEN_PROFILE = 'fountain';

/** 整体性预设（书写/标注/绘画/制图）的 id 顺序，面板按此渲染按钮。 */
export const HAND_FEEL_PRESET_ORDER = Object.freeze(['writing', 'annotating', 'drawing', 'drafting']);

/**
 * 四个整体预设。与 PROFILE_DEFAULTS 的差异只在于"一次改哪几项"：
 * 预设会一次性下发全部手感字段（含 opacity/strokeWidth），
 * 这样用户点一下就能得到一致的手感，而不是只改了压感、其它还是旧值。
 */
export const HAND_FEEL_PRESETS = Object.freeze({
  writing: Object.freeze({
    id: 'writing',
    label: '书写',
    // 临摹钢笔：压感高、平滑高，起收笔明显，粗细适中
    values: Object.freeze({
      pressureSensitivity: 0.9,
      velocitySensitivity: 0.45,
      smoothing: 0.72,
      taperIn: 0.28,
      taperOut: 0.22,
      opacity: 1,
      strokeWidth: 3,
    }),
  }),
  annotating: Object.freeze({
    id: 'annotating',
    label: '标注',
    // 批注要"看得见但不盖字"：半透明、细线、几乎不压感不锋利
    values: Object.freeze({
      pressureSensitivity: 0.2,
      velocitySensitivity: 0.1,
      smoothing: 0.3,
      taperIn: 0,
      taperOut: 0,
      opacity: DEFAULT_HIGHLIGHTER_OPACITY,
      strokeWidth: 2,
    }),
  }),
  drawing: Object.freeze({
    id: 'drawing',
    label: '绘画',
    // 毛笔：全压感 + 高速灵敏 + 强平滑 + 明显笔锋
    values: Object.freeze({
      pressureSensitivity: 1,
      velocitySensitivity: 0.7,
      smoothing: 0.82,
      taperIn: 0.32,
      taperOut: 0.26,
      opacity: 1,
      strokeWidth: 12,
    }),
  }),
  drafting: Object.freeze({
    id: 'drafting',
    label: '制图',
    // 制图求"稳定、可预期"：低压感、零笔锋、细线、满不透明
    values: Object.freeze({
      pressureSensitivity: 0.15,
      velocitySensitivity: 0.05,
      smoothing: 0.5,
      taperIn: 0,
      taperOut: 0,
      opacity: 1,
      strokeWidth: 1,
    }),
  }),
});

/**
 * 把任意值收窄成数字；非数字（含 null/undefined/空串/NaN）一律回退。
 * 注意 Number('') === 0，所以空串必须单独挡掉，否则会被当成合法的 0。
 */
export const toHandFeelNumber = (value, fallback) => {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  if (typeof value === 'boolean') {
    return fallback;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

/** 比例字段：clamp 到 [0,1]，非法值回退到 fallback。 */
export const clampUnit = (value, fallback = 0) => {
  const numeric = toHandFeelNumber(value, fallback);
  return Math.min(1, Math.max(0, numeric));
};

/** 粗细字段：clamp 到 [1,50] 并取整，非法值回退到 fallback。 */
export const clampStrokeWidth = (value, fallback = HAND_FEEL_STROKE_RANGE.min) => {
  const numeric = toHandFeelNumber(value, fallback);
  const bounded = Math.min(HAND_FEEL_STROKE_RANGE.max, Math.max(HAND_FEEL_STROKE_RANGE.min, numeric));
  return Math.round(bounded);
};

/** 从工具 id 或笔型 id 解析出合法笔型；解析不出来就回退到钢笔。 */
export const resolvePenProfile = (value) => {
  if (typeof value !== 'string' || !value) {
    return FALLBACK_PEN_PROFILE;
  }

  if (PEN_PROFILE_IDS.includes(value)) {
    return value;
  }

  return TOOL_TO_PEN_PROFILE[value] || FALLBACK_PEN_PROFILE;
};

/** 笔型显示名（面板标题用），未知笔型按钢笔显示。 */
export const getPenProfileLabel = (value) => PEN_PROFILE_LABELS[resolvePenProfile(value)] || PEN_PROFILE_LABELS[FALLBACK_PEN_PROFILE];

/** 取某笔型的手感默认值（返回新对象，调用方随便改都不会污染常量）。 */
export const getHandFeelDefaults = (penProfile) => {
  const resolved = resolvePenProfile(penProfile);
  const defaults = HAND_FEEL_PROFILE_DEFAULTS[resolved] || HAND_FEEL_PROFILE_DEFAULTS[FALLBACK_PEN_PROFILE];

  return {
    penProfile: resolved,
    pressureSensitivity: defaults.pressureSensitivity,
    velocitySensitivity: defaults.velocitySensitivity,
    smoothing: defaults.smoothing,
    taperIn: defaults.taperIn,
    taperOut: defaults.taperOut,
    opacity: resolved === 'marker' ? DEFAULT_HIGHLIGHTER_OPACITY : 1,
    strokeWidth: clampStrokeWidth(3),
  };
};

/** 取整体预设值（浅拷贝，避免调用方改到冻结常量）。 */
export const getHandFeelPreset = (presetId) => {
  const preset = HAND_FEEL_PRESETS[presetId];
  return preset ? { ...preset.values } : null;
};

/**
 * 把工具配置归一化成完整的 7 项手感状态。
 *
 * 面板所有滑块都读这份状态，因此必须"永远有值"：
 * 缺字段时按 笔型默认值 -> 通用兜底 的顺序补齐，而不是让滑块拿到 undefined。
 */
export const normalizeHandFeelState = (toolConfig) => {
  const config = toolConfig && typeof toolConfig === 'object' ? toolConfig : {};
  const penProfile = resolvePenProfile(config.penProfile || config.tool || config.type);
  const defaults = getHandFeelDefaults(penProfile);

  const opacityFallback = typeof config.opacity === 'number'
    ? config.opacity
    : defaults.opacity;
  const sizeFallback = typeof config.size === 'number'
    ? config.size
    : defaults.strokeWidth;

  return {
    penProfile,
    pressureSensitivity: clampUnit(config.pressureSensitivity, defaults.pressureSensitivity),
    velocitySensitivity: clampUnit(config.velocitySensitivity, defaults.velocitySensitivity),
    smoothing: clampUnit(config.smoothing, defaults.smoothing),
    taperIn: clampUnit(config.taperIn, defaults.taperIn),
    taperOut: clampUnit(config.taperOut, defaults.taperOut),
    opacity: clampUnit(opacityFallback, defaults.opacity),
    strokeWidth: clampStrokeWidth(config.strokeWidth ?? sizeFallback, defaults.strokeWidth),
  };
};

/**
 * 生成下发给原生 / 父组件的手感载荷。
 *
 * 白名单策略（只输出 HAND_FEEL_FIELDS 覆盖得到的字段）是刻意的：
 * 面板只知道手感，如果直接把状态整体展开，就会把 penProfile 之类
 * 不属于本面板职责的字段盖回去，导致"拖了一下不透明度，笔型被改回钢笔"。
 *
 * @param {object} currentState 面板当前完整手感状态
 * @param {object} patch 本次只改动的字段（可选）
 * @returns {object} 只含合法字段且已 clamp 的载荷
 */
export const buildHandFeelPatch = (currentState, patch) => {
  const base = normalizeHandFeelState(currentState);
  const merged = patch && typeof patch === 'object' ? { ...base, ...patch } : base;

  return {
    pressureSensitivity: clampUnit(merged.pressureSensitivity, base.pressureSensitivity),
    velocitySensitivity: clampUnit(merged.velocitySensitivity, base.velocitySensitivity),
    smoothing: clampUnit(merged.smoothing, base.smoothing),
    taperIn: clampUnit(merged.taperIn, base.taperIn),
    taperOut: clampUnit(merged.taperOut, base.taperOut),
    opacity: clampUnit(merged.opacity, base.opacity),
    strokeWidth: clampStrokeWidth(merged.strokeWidth, base.strokeWidth),
  };
};

export default {
  HAND_FEEL_FIELDS,
  HAND_FEEL_STROKE_RANGE,
  HAND_FEEL_PROFILE_DEFAULTS,
  HAND_FEEL_PRESETS,
  HAND_FEEL_PRESET_ORDER,
  DEFAULT_HIGHLIGHTER_OPACITY,
  PEN_PROFILE_LABELS,
  toHandFeelNumber,
  clampUnit,
  clampStrokeWidth,
  resolvePenProfile,
  getPenProfileLabel,
  getHandFeelDefaults,
  getHandFeelPreset,
  normalizeHandFeelState,
  buildHandFeelPatch,
};
