/**
 * AllInOneToolbarPrefs —— 工具栏偏好持久化的纯逻辑层
 *
 * 为什么单独抽一个文件：工具栏此前是「异步读 AsyncStorage + 1 秒防抖写」的竞态链。
 * 读回来的 lastColor/lastStrokeWidth 一定早于防抖写触发，于是刚读到的用户偏好
 * 会被「默认值」原样写回存储 —— 用户下次启动看到的还是默认颜色，偏好永远存不住。
 * 这里用一个 loaded（首次加载是否已结束）语义把「落盘」与「回填」卡住：
 *   1) loaded 为 false 时 canPersist() 恒为 false，组件不应落盘；
 *   2) 用户已经动手改过的字段（touched）永不被迟到的加载结果覆盖。
 *
 * 刻意不 import react-native / AsyncStorage：纯函数才能被单测穷举脏数据，
 * storage 由调用方注入（组件传 AsyncStorage，测试传假实现）。
 */

// 与 AllInOneToolbar 内的 STORAGE_KEYS 保持同值；工具栏侧继续用自己的常量（共享区域不可改），
// 这里导出是为了让「持久化契约」只有一个可测试的定义处。
const STORAGE_KEYS = Object.freeze({
  TOOLBAR_PREFERENCES: '@zeroislenotes:toolbar_preferences',
  RECENT_COLORS: '@zeroislenotes:recent_colors',
  CURRENT_PRESET: '@zeroislenotes:current_preset',
  // ColorPicker 内部维护的「最近使用」用的是另一条 key（历史遗留，两边各写各的）。
  // 工具栏的「最近」条必须把它一起读进来，否则用户在取色器里选过的颜色
  // 永远不会出现在工具栏上——功能看起来在、实际不联动（集成期复核发现）。
  // 这里选择「读两处、写自己的」，而不是改 ColorPicker 的 key：
  // 改 key 会让已升级用户的旧数据一次性丢失，读两处则新旧数据都可见。
  PICKER_RECENT_COLORS: '@zeroislenotes:picker_recent_colors',
});

// 与工具栏 useState 初值保持一致：非法/缺失数据一律回落到这里。
const DEFAULT_PREFERENCES = Object.freeze({
  lastColor: '#000000',
  lastStrokeWidth: 2,
  lastTool: 'pen',
  showRuler: false,
  showGrid: false,
});

// 偏好里允许被持久化的字段全集；用于「哪些字段算用户动过」的比对。
const PREFERENCE_FIELDS = Object.freeze([
  'lastColor',
  'lastStrokeWidth',
  'lastTool',
  'showRuler',
  'showGrid',
]);

// 笔触粗细合法区间，与 STROKE_WIDTH_RANGE 同值（clamp 用）。
const STROKE_WIDTH_RANGE = Object.freeze({ min: 1, max: 50, step: 1 });

// 合法工具 id：必须与 AllInOneToolbar 的 DRAWING_TOOLS 对齐。
// 'pan' 是 WS-A 新增的手掌/平移工具，属于用户可以主动选中的状态，故一并视为合法。
const VALID_TOOL_IDS = Object.freeze([
  'pen',
  'pencil',
  'brush',
  'highlighter',
  'laser',
  'eraser',
  'shape',
  'text',
  'lasso',
  'pan',
  'undo',
  'redo',
  'clear',
]);

const MAX_RECENT_COLORS = 10;

// 只接受 #RGB / #RRGGBB / #RRGGBBAA（RN 支持的十六进制写法），其余一律判为非法。
const HEX_COLOR_RE = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/;

/**
 * 把任意输入规整成对象。
 * 存储里可能存着半个 JSON、数组、数字 —— 这些都必须被当成「没有数据」而不是抛错，
 * 否则一次脏写就能让工具栏挂载即崩。
 */
const coerceObject = (raw) => {
  if (raw === null || raw === undefined) {
    return null;
  }

  let value = raw;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch (error) {
      return null;
    }
  }

  if (typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value;
};

/** 颜色规整：3 位缩写展开成 6 位，统一大写；非法返回 null。 */
const normalizeColor = (color) => {
  if (typeof color !== 'string') {
    return null;
  }

  const trimmed = color.trim();
  if (!HEX_COLOR_RE.test(trimmed)) {
    return null;
  }

  const upper = trimmed.toUpperCase();
  if (upper.length === 4) {
    return `#${upper[1]}${upper[1]}${upper[2]}${upper[2]}${upper[3]}${upper[3]}`;
  }

  return upper;
};

/** 粗细规整：接受数字或数字字符串，clamp 到 [1,50]；NaN/Infinity/空值返回 null。 */
const clampStrokeWidth = (value) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const num = Number(value);
  if (!Number.isFinite(num)) {
    return null;
  }

  return Math.min(STROKE_WIDTH_RANGE.max, Math.max(STROKE_WIDTH_RANGE.min, Math.round(num)));
};

/**
 * 只保留合法字段：未知字段直接丢弃，非法值回落默认值，绝不因为脏数据抛错。
 * 返回值恒为「字段齐全」的对象，调用方可以放心直接 spread。
 */
const sanitizeToolbarPreferences = (raw) => {
  const result = { ...DEFAULT_PREFERENCES };
  const source = coerceObject(raw);
  if (!source) {
    return result;
  }

  const color = normalizeColor(source.lastColor);
  if (color) {
    result.lastColor = color;
  }

  const width = clampStrokeWidth(source.lastStrokeWidth);
  if (width !== null) {
    result.lastStrokeWidth = width;
  }

  if (typeof source.lastTool === 'string' && VALID_TOOL_IDS.includes(source.lastTool)) {
    result.lastTool = source.lastTool;
  }

  if (typeof source.showRuler === 'boolean') {
    result.showRuler = source.showRuler;
  }

  if (typeof source.showGrid === 'boolean') {
    result.showGrid = source.showGrid;
  }

  return result;
};

/**
 * 合并「默认值」与「刚从存储读到的值」。
 *
 * 关键语义：只有当 loaded 里确实存在某个字段且它合法时才覆盖默认值；
 * 因此「空存储 / 部分字段的旧版本数据」不会把默认值抹成 undefined。
 */
const mergeLoadedPreferences = (defaults, loaded) => {
  const merged = sanitizeToolbarPreferences(defaults);
  const source = coerceObject(loaded);
  if (!source) {
    return merged;
  }

  if (normalizeColor(source.lastColor)) {
    merged.lastColor = normalizeColor(source.lastColor);
  }

  const width = clampStrokeWidth(source.lastStrokeWidth);
  if (width !== null) {
    merged.lastStrokeWidth = width;
  }

  if (typeof source.lastTool === 'string' && VALID_TOOL_IDS.includes(source.lastTool)) {
    merged.lastTool = source.lastTool;
  }

  if (typeof source.showRuler === 'boolean') {
    merged.showRuler = source.showRuler;
  }

  if (typeof source.showGrid === 'boolean') {
    merged.showGrid = source.showGrid;
  }

  return merged;
};

/** 最近颜色列表规整：非法项丢弃、去重（保留首次出现的顺序）、限制长度。 */
const sanitizeRecentColors = (raw) => {
  // 存储里既可能是数组，也可能是数组的 JSON 字符串；两者都要能读，
  // 且字符串解析失败时必须退化成空列表而不是抛错。
  let source = raw;
  if (typeof source === 'string') {
    try {
      source = JSON.parse(source);
    } catch (error) {
      source = null;
    }
  }

  const candidates = Array.isArray(source) ? source : [];

  const seen = new Set();
  const result = [];
  candidates.forEach((item) => {
    const color = normalizeColor(item);
    if (!color || seen.has(color)) {
      return;
    }
    seen.add(color);
    result.push(color);
  });

  return result.slice(0, MAX_RECENT_COLORS);
};

/** 供 UI 渲染的最近颜色：先规整再截取 maxVisible 个。 */
const pickRecentColors = (recentColors, maxVisible = MAX_RECENT_COLORS) => {
  const list = sanitizeRecentColors(recentColors);
  const limit = Number.isFinite(Number(maxVisible)) && Number(maxVisible) >= 0
    ? Math.floor(Number(maxVisible))
    : MAX_RECENT_COLORS;

  return list.slice(0, limit);
};

/** 色块列表：给每个颜色一个稳定的 key（同色重复也不会撞 key）。 */
const toSwatchList = (colors) => {
  const list = Array.isArray(colors) ? colors : [];

  return list
    .map((color, index) => {
      const normalized = normalizeColor(color);
      return normalized ? { color: normalized, key: `${normalized}-${index}` } : null;
    })
    .filter(Boolean);
};

/** 把颜色插到最近颜色队首（去重 + 限长），非法颜色原样返回旧列表。 */
const addRecentColor = (recentColors, color, maxCount = MAX_RECENT_COLORS) => {
  const list = sanitizeRecentColors(recentColors);
  const normalized = normalizeColor(color);
  if (!normalized) {
    return list;
  }

  const limit = Number.isFinite(Number(maxCount)) && Number(maxCount) > 0
    ? Math.floor(Number(maxCount))
    : MAX_RECENT_COLORS;

  return [normalized, ...list.filter((item) => item !== normalized)].slice(0, limit);
};

/**
 * 由「当前实际值」反推哪些字段已经被用户/父组件动过。
 *
 * 为什么需要它：加载完成前用户可能已经点了颜色，此时磁盘值属于「迟到的旧值」，
 * 覆盖它就是缺陷 1 的另一种形态。用「当前值 != 默认值」判定 touched，
 * 可以在不改动标记外任何 JSX 的前提下拿到 isUserTouched 语义。
 */
const deriveTouchedFields = (current, defaults = DEFAULT_PREFERENCES) => {
  const base = sanitizeToolbarPreferences(defaults);
  const live = coerceObject(current) || {};

  return PREFERENCE_FIELDS.filter((field) => {
    if (!Object.prototype.hasOwnProperty.call(live, field)) {
      return false;
    }

    const sanitized = sanitizeToolbarPreferences({ [field]: live[field] });
    return sanitized[field] !== base[field];
  });
};

/**
 * 偏好加载器工厂。
 *
 * 修的就是缺陷 1：loadPreferences 与 savePreferences 之间没有「是否已加载完成」的标志，
 * 1 秒防抖把 AsyncStorage 读回的颜色/粗细再次覆盖成默认值。
 *
 * 返回对象：
 *   canPersist()                 —— 首次加载结束前恒为 false；组件用它拦住落盘
 *   load()                       —— 只真正读一次磁盘（并发调用共享同一个 Promise）
 *   isTouched(field)             —— 该字段是否已被用户改过
 *   markUserTouched(field)       —— 标记字段被用户改过（此后迟到的加载值不再覆盖它）
 *   mergeIfNotTouched(loaded, fallback) —— 按 touched 语义合并
 */
const createPreferencesLoader = ({ storage, readDefaultPrefs, now } = {}) => {
  const clock = typeof now === 'function' ? now : () => Date.now();
  const readDefaults = typeof readDefaultPrefs === 'function'
    ? readDefaultPrefs
    : () => ({ ...DEFAULT_PREFERENCES });

  const state = {
    loaded: false,
    loadedAt: null,
    inFlight: null,
    snapshot: null,
    touched: new Set(),
  };

  const safeGetItem = (key) => {
    if (!storage || typeof storage.getItem !== 'function') {
      return Promise.resolve(null);
    }

    try {
      return Promise.resolve(storage.getItem(key)).catch(() => null);
    } catch (error) {
      return Promise.resolve(null);
    }
  };

  const buildResult = (applied, error) => {
    const snapshot = state.snapshot || {
      preferences: sanitizeToolbarPreferences(readDefaults()),
      recentColors: [],
      currentPreset: null,
    };

    return {
      applied: !!applied,
      preferences: { ...snapshot.preferences },
      recentColors: [...snapshot.recentColors],
      currentPreset: snapshot.currentPreset,
      touchedFields: Array.from(state.touched),
      loadedAt: state.loadedAt,
      error: error || null,
    };
  };

  const load = () => {
    if (state.loaded) {
      return Promise.resolve(buildResult(false, null));
    }

    if (state.inFlight) {
      return state.inFlight;
    }

    state.inFlight = Promise.all([
      safeGetItem(STORAGE_KEYS.TOOLBAR_PREFERENCES),
      safeGetItem(STORAGE_KEYS.RECENT_COLORS),
      safeGetItem(STORAGE_KEYS.CURRENT_PRESET),
      safeGetItem(STORAGE_KEYS.PICKER_RECENT_COLORS),
    ]).then(([rawPrefs, rawColors, rawPreset, rawPickerColors]) => {
      state.snapshot = {
        preferences: mergeLoadedPreferences(readDefaults(), rawPrefs),
        // 合并两处来源：工具栏自己写的在前（更新），ColorPicker 写的在后。
        // 去重与上限由 sanitizeRecentColors 统一处理。
        recentColors: sanitizeRecentColors(
          [...sanitizeRecentColors(rawColors), ...sanitizeRecentColors(rawPickerColors)]
        ),
        currentPreset: typeof rawPreset === 'string' && rawPreset ? rawPreset : null,
      };
      // 只有走到这里才算「首次加载结束」。之前每一刻都不能落盘。
      state.loaded = true;
      state.loadedAt = clock();
      state.inFlight = null;

      return buildResult(true, null);
    }).catch((error) => {
      // 读取失败也必须把 loaded 置位：否则本次会话永远不会保存任何偏好。
      // 磁盘此时本来就不可读，用当前会话值落盘不会造成「可读数据的丢失」。
      state.snapshot = {
        preferences: sanitizeToolbarPreferences(readDefaults()),
        recentColors: [],
        currentPreset: null,
      };
      state.loaded = true;
      state.loadedAt = clock();
      state.inFlight = null;

      return buildResult(true, error);
    });

    return state.inFlight;
  };

  const canPersist = () => state.loaded === true;

  const markUserTouched = (field) => {
    if (PREFERENCE_FIELDS.includes(field)) {
      state.touched.add(field);
    }
  };

  const isTouched = (field) => state.touched.has(field);

  /** 加载值覆盖回退值，但用户已经动过的字段保留用户值。 */
  const mergeIfNotTouched = (loadedPreferences, fallbackPreferences) => {
    const merged = sanitizeToolbarPreferences(fallbackPreferences);
    const parsed = coerceObject(loadedPreferences);
    if (!parsed) {
      return merged;
    }

    PREFERENCE_FIELDS.forEach((field) => {
      if (state.touched.has(field)) {
        return;
      }
      if (!Object.prototype.hasOwnProperty.call(parsed, field)) {
        return;
      }
      merged[field] = sanitizeToolbarPreferences(parsed)[field];
    });

    return merged;
  };

  return {
    canPersist,
    isTouched,
    load,
    markUserTouched,
    mergeIfNotTouched,
    getLoadedAt: () => state.loadedAt,
    isLoaded: canPersist,
  };
};

module.exports = {
  DEFAULT_PREFERENCES,
  MAX_RECENT_COLORS,
  PREFERENCE_FIELDS,
  STORAGE_KEYS,
  STROKE_WIDTH_RANGE,
  VALID_TOOL_IDS,
  addRecentColor,
  clampStrokeWidth,
  createPreferencesLoader,
  deriveTouchedFields,
  mergeLoadedPreferences,
  normalizeColor,
  pickRecentColors,
  sanitizeRecentColors,
  sanitizeToolbarPreferences,
  toSwatchList,
};
