/**
 * Native handwriting toolbar bridge.
 *
 * JS owns the single source of truth for toolbar state and only sends
 * normalized protocol commands / tool config snapshots to native surfaces.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { UIManager, findNodeHandle } from 'react-native';
import {
  DEFAULT_RECOGNITION_DEBOUNCE_MS,
  INTERACTION_MODES,
  SURFACE_COMPONENTS,
  getSurfaceCommandNames,
  normalizeClearScope,
  normalizeInteractionMode,
  normalizeRecognitionSelection,
} from '../config/nativeCommandMap';
import { recognizeHandwriting } from '../native/recognitionBridge';
// 手感字段口径与面板共用同一个纯函数模块，避免"面板显示 70%、原生拿到 0.7/undefined"
// 这类两端各写一份默认值导致的漂移（该模块无原生依赖，不会把 RN 拖进纯逻辑单测）。
import {
  DEFAULT_HIGHLIGHTER_OPACITY,
  HAND_FEEL_FIELDS,
  buildHandFeelPatch,
  normalizeHandFeelState,
} from '../components/toolbar/handFeel';

const PROFILE_DEFAULTS = Object.freeze({
  fountain: {
    penProfile: 'fountain',
    pressureSensitivity: 0.9,
    velocitySensitivity: 0.45,
    taperIn: 0.28,
    taperOut: 0.22,
    smoothing: 0.72,
  },
  pencil: {
    penProfile: 'pencil',
    pressureSensitivity: 0.55,
    velocitySensitivity: 0.35,
    taperIn: 0.08,
    taperOut: 0.08,
    smoothing: 0.45,
  },
  brush: {
    penProfile: 'brush',
    pressureSensitivity: 1,
    velocitySensitivity: 0.7,
    taperIn: 0.32,
    taperOut: 0.26,
    smoothing: 0.82,
  },
  marker: {
    penProfile: 'marker',
    pressureSensitivity: 0.18,
    velocitySensitivity: 0.08,
    taperIn: 0,
    taperOut: 0,
    smoothing: 0.3,
  },
});

const TOOL_TO_PROFILE = Object.freeze({
  pen: 'fountain',
  pencil: 'pencil',
  brush: 'brush',
  highlighter: 'marker',
});

const TOOL_TO_INTERACTION_MODE = Object.freeze({
  pan: INTERACTION_MODES.GESTURE,
  lasso: INTERACTION_MODES.MIXED,
  eraser: INTERACTION_MODES.MIXED,
  default: INTERACTION_MODES.MIXED,
});

const DEFAULT_TOOL_CONFIG = Object.freeze({
  tool: 'pen',
  color: '#000000',
  size: 2,
  opacity: 1,
  penProfile: 'fountain',
  shape: 'freehand',
  // 形状填充。工具栏的「填充」开关会传下来，但此前 bridge 归一化时没有这个字段，
  // 于是它在 JS 层就被丢掉，原生永远收不到 —— 即使原生实现了填充也不会生效。
  fill: false,
  pressureSensitivity: PROFILE_DEFAULTS.fountain.pressureSensitivity,
  velocitySensitivity: PROFILE_DEFAULTS.fountain.velocitySensitivity,
  taperIn: PROFILE_DEFAULTS.fountain.taperIn,
  taperOut: PROFILE_DEFAULTS.fountain.taperOut,
  smoothing: PROFILE_DEFAULTS.fountain.smoothing,
  recognitionEnabled: true,
  recognitionDebounceMs: DEFAULT_RECOGNITION_DEBOUNCE_MS,
  palmRejectionEnabled: true,
  fingerMode: 'gesture_only',
});

const toFiniteNumber = (value, fallback) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const clamp = (value, min, max, fallback) => {
  const numeric = toFiniteNumber(value, fallback);
  return Math.min(max, Math.max(min, numeric));
};

const normalizeColor = (value, fallback = DEFAULT_TOOL_CONFIG.color) => {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }
  return fallback;
};

const inferPenProfile = (tool, nextProfile, previousProfile) => {
  if (typeof nextProfile === 'string' && PROFILE_DEFAULTS[nextProfile]) {
    return nextProfile;
  }

  if (typeof previousProfile === 'string' && PROFILE_DEFAULTS[previousProfile]) {
    return previousProfile;
  }

  return TOOL_TO_PROFILE[tool] || DEFAULT_TOOL_CONFIG.penProfile;
};

export const buildHandwritingToolConfig = (partialConfig = {}, previousConfig = DEFAULT_TOOL_CONFIG) => {
  const mergedInput = partialConfig && typeof partialConfig === 'object'
    ? partialConfig
    : { tool: partialConfig };

  const tool = mergedInput.tool || mergedInput.type || previousConfig.tool || DEFAULT_TOOL_CONFIG.tool;
  const penProfile = inferPenProfile(tool, mergedInput.penProfile, previousConfig.penProfile);
  const profileDefaults = PROFILE_DEFAULTS[penProfile] || PROFILE_DEFAULTS.fountain;
  const defaultOpacity = tool === 'highlighter' ? 0.4 : previousConfig.opacity ?? DEFAULT_TOOL_CONFIG.opacity;

  return {
    ...DEFAULT_TOOL_CONFIG,
    ...previousConfig,
    ...profileDefaults,
    ...mergedInput,
    tool,
    color: normalizeColor(mergedInput.color ?? previousConfig.color),
    size: toFiniteNumber(mergedInput.size ?? mergedInput.strokeWidth ?? previousConfig.size, DEFAULT_TOOL_CONFIG.size),
    opacity: clamp(mergedInput.opacity ?? defaultOpacity, 0, 1, defaultOpacity),
    penProfile,
    shape: mergedInput.shape || previousConfig.shape || DEFAULT_TOOL_CONFIG.shape,
    // 必须显式保留 fill：否则 toolbar 的填充开关传到这一层就没了。
    fill: mergedInput.fill ?? previousConfig.fill ?? DEFAULT_TOOL_CONFIG.fill,
    pressureSensitivity: clamp(
      mergedInput.pressureSensitivity ?? previousConfig.pressureSensitivity ?? profileDefaults.pressureSensitivity,
      0,
      1,
      profileDefaults.pressureSensitivity
    ),
    velocitySensitivity: clamp(
      mergedInput.velocitySensitivity ?? previousConfig.velocitySensitivity ?? profileDefaults.velocitySensitivity,
      0,
      1,
      profileDefaults.velocitySensitivity
    ),
    taperIn: clamp(mergedInput.taperIn ?? previousConfig.taperIn ?? profileDefaults.taperIn, 0, 1, profileDefaults.taperIn),
    taperOut: clamp(mergedInput.taperOut ?? previousConfig.taperOut ?? profileDefaults.taperOut, 0, 1, profileDefaults.taperOut),
    smoothing: clamp(mergedInput.smoothing ?? previousConfig.smoothing ?? profileDefaults.smoothing, 0, 1, profileDefaults.smoothing),
    recognitionEnabled: mergedInput.recognitionEnabled ?? previousConfig.recognitionEnabled ?? DEFAULT_TOOL_CONFIG.recognitionEnabled,
    recognitionDebounceMs: Math.max(
      0,
      Math.round(
        toFiniteNumber(
          mergedInput.recognitionDebounceMs ?? previousConfig.recognitionDebounceMs,
          DEFAULT_RECOGNITION_DEBOUNCE_MS
        )
      )
    ),
    palmRejectionEnabled: mergedInput.palmRejectionEnabled ?? previousConfig.palmRejectionEnabled ?? DEFAULT_TOOL_CONFIG.palmRejectionEnabled,
    fingerMode: mergedInput.fingerMode || previousConfig.fingerMode || DEFAULT_TOOL_CONFIG.fingerMode,
  };
};

const resolveInteractionMode = (config) => {
  if (config?.interactionMode) {
    return normalizeInteractionMode(config.interactionMode);
  }

  return TOOL_TO_INTERACTION_MODE[config?.tool] || TOOL_TO_INTERACTION_MODE.default;
};

const getCommandId = (viewType, commandName) => {
  const componentName = SURFACE_COMPONENTS[viewType];
  if (!componentName) {
    return null;
  }

  const managerConfig = UIManager.getViewManagerConfig(componentName);
  const commandMap = managerConfig?.Commands;
  if (!commandMap) {
    return null;
  }

  const aliases = getSurfaceCommandNames(viewType, commandName);
  for (const alias of aliases) {
    if (commandMap[alias] !== undefined && commandMap[alias] !== null) {
      return commandMap[alias];
    }
  }

  return null;
};

const dispatchCommand = (viewRef, viewType, commandName, args = []) => {
  if (!viewRef?.current) {
    return false;
  }

  const nodeHandle = findNodeHandle(viewRef.current);
  if (!nodeHandle) {
    return false;
  }

  const commandId = getCommandId(viewType, commandName);
  if (commandId === null || commandId === undefined) {
    return false;
  }

  UIManager.dispatchViewManagerCommand(nodeHandle, commandId.toString(), args);
  return true;
};

/**
 * 手感字段白名单（对外导出，供面板/工具栏与测试共用）。
 * 复用 handFeel 模块的定义而不是在 bridge 里再写一份数组：
 * 一旦字段增删，两端会同时变化，不会出现"面板多了一个字段、bridge 悄悄丢掉"。
 */
export { HAND_FEEL_FIELDS };

/**
 * 生成一次"手感变更"的完整载荷。
 *
 * 与 buildHandwritingToolConfig 的分工：
 * - 这里只负责"手感这一层"的归一化（白名单 + clamp 到 [0,1]，strokeWidth 走 1~50）；
 * - 真正的合并仍由 buildHandwritingToolConfig 完成，所以本函数可以用它的返回值
 *   直接喂给 setToolConfig。
 *
 * 为什么以 currentConfig 为底而不是只输出 patch：
 * 面板上 7 个滑块是一组相互影响的参数，缺项必须按"当前笔型的默认值"补齐，
 * 否则父组件收到的载荷里会出现 undefined 而把原生侧的值清掉。
 *
 * @param {object} currentConfig 当前工具配置（工具/笔型/手感现状）
 * @param {object} patch 本次改动的字段；白名单之外的键一律丢弃
 * @returns {object} 只含合法手感字段的载荷
 */
export const buildHandFeelPayload = (currentConfig = {}, patch = {}) => {
  const current = currentConfig && typeof currentConfig === 'object' ? currentConfig : {};
  const patchInput = patch && typeof patch === 'object' ? patch : {};

  // 原生的粗细叫 size，面板叫 strokeWidth：这里显式对齐，避免"面板调了粗细、
  // 下发后原生仍是旧值"这种同源死接线。opacity 同理兜住荧光笔的半透明默认值。
  const baseState = normalizeHandFeelState({
    ...current,
    strokeWidth: current.strokeWidth ?? current.size,
    opacity: current.opacity ?? (current.tool === 'highlighter' ? DEFAULT_HIGHLIGHTER_OPACITY : undefined),
  });

  const sanitizedPatch = {};
  HAND_FEEL_FIELDS.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(patchInput, field)) {
      sanitizedPatch[field] = patchInput[field];
    }
  });

  // size 是原生别名，允许面板/调用方沿用；它不属于手感白名单，需单独映射过来
  if (
    !Object.prototype.hasOwnProperty.call(sanitizedPatch, 'strokeWidth') &&
    Object.prototype.hasOwnProperty.call(patchInput, 'size')
  ) {
    sanitizedPatch.strokeWidth = patchInput.size;
  }

  const payload = buildHandFeelPatch(baseState, sanitizedPatch);

  // 笔型是"手感默认值的来源"，显式传入时必须透传；不传时留给 bridge 沿用旧值，
  // 否则用户拖一下不透明度就会把当前笔型弹回默认钢笔。
  return typeof patchInput.penProfile === 'string' && PROFILE_DEFAULTS[patchInput.penProfile]
    ? { ...payload, penProfile: patchInput.penProfile }
    : payload;
};

export const useNativeToolbarBridge = (nativeViewRef, viewType, options = {}) => {
  const {
    onAIToolSelect: onAIToolSelectExternal,
    onBookmarkAdd: onBookmarkAddExternal,
    onBookmarkList: onBookmarkListExternal,
    onBookmarkNavigate: onBookmarkNavigateExternal,
    onHistoryStateChange,
    onRecognitionResult,
    canUndo: canUndoExternal,
    canRedo: canRedoExternal,
    historyState,
    currentPage = 1,
    totalPages = 1,
    initialToolConfig,
  } = options;

  // 内联对象是调用方的常规写法（renderHook({ initialToolConfig: {...} }) / 父组件直接传字面量），
  // 按引用做依赖会让 initialConfig 每次渲染都重算，进而让下方挂载 effect 每次重跑、
  // setCurrentToolConfig -> 再渲染 -> 无限更新（实测会刷出上千条 Maximum update depth）。
  // 这里改成按「序列化后的值」判断是否真的变了：内容相同的不同对象不再触发重算。
  const initialToolConfigKey = useMemo(() => {
    try {
      // 兜底成 '{}' 而不是 null：下面的 JSON.parse 需要拿到合法输入，
      // 且不可序列化的配置应当退化成"用默认初值"，而不是让渲染卡死。
      return JSON.stringify(initialToolConfig || {}) || '{}';
    } catch (error) {
      return '{}';
    }
  }, [initialToolConfig]);

  // 依赖就是 initialToolConfigKey 本身，函数体只从它派生输入。
  // 这样既保留「按值而非引用判断」的语义（修掉自激更新），也不需要
  // 用 eslint-disable 去压 exhaustive-deps —— 依赖列表与函数体真正读取的值一致。
  const initialConfig = useMemo(
    () => buildHandwritingToolConfig(JSON.parse(initialToolConfigKey)),
    [initialToolConfigKey]
  );

  const [canUndo, setCanUndo] = useState(Boolean(historyState?.canUndo ?? canUndoExternal));
  const [canRedo, setCanRedo] = useState(Boolean(historyState?.canRedo ?? canRedoExternal));
  const [currentToolConfig, setCurrentToolConfig] = useState(initialConfig);

  const currentToolConfigRef = useRef(initialConfig);
  const lastSentToolConfigRef = useRef('');
  const recognitionTimerRef = useRef(null);
  const pendingRecognitionRef = useRef(null);

  useEffect(() => {
    const undoState = historyState?.canUndo;
    if (typeof undoState === 'boolean') {
      setCanUndo(undoState);
    } else if (typeof canUndoExternal === 'boolean') {
      setCanUndo(canUndoExternal);
    }
  }, [historyState?.canUndo, canUndoExternal]);

  useEffect(() => {
    const redoState = historyState?.canRedo;
    if (typeof redoState === 'boolean') {
      setCanRedo(redoState);
    } else if (typeof canRedoExternal === 'boolean') {
      setCanRedo(canRedoExternal);
    }
  }, [historyState?.canRedo, canRedoExternal]);

  useEffect(() => {
    if (typeof onHistoryStateChange === 'function') {
      onHistoryStateChange({ canUndo, canRedo, viewType });
    }
  }, [canUndo, canRedo, viewType, onHistoryStateChange]);

  useEffect(() => () => {
    if (recognitionTimerRef.current) {
      clearTimeout(recognitionTimerRef.current);
    }
  }, []);

  const applyToolConfig = useCallback((nextConfigInput) => {
    const nextConfig = buildHandwritingToolConfig(nextConfigInput, currentToolConfigRef.current);
    currentToolConfigRef.current = nextConfig;
    setCurrentToolConfig(nextConfig);

    dispatchCommand(nativeViewRef, viewType, 'setTool', [nextConfig.tool]);
    dispatchCommand(nativeViewRef, viewType, 'setColor', [nextConfig.color]);
    dispatchCommand(nativeViewRef, viewType, 'setStrokeWidth', [nextConfig.size]);
    dispatchCommand(nativeViewRef, viewType, 'setInteractionMode', [resolveInteractionMode(nextConfig)]);

    const serializedConfig = JSON.stringify(nextConfig);
    if (serializedConfig !== lastSentToolConfigRef.current) {
      dispatchCommand(nativeViewRef, viewType, 'setToolConfig', [serializedConfig]);
      lastSentToolConfigRef.current = serializedConfig;
    }

    return nextConfig;
  }, [nativeViewRef, viewType]);

  // 挂载语义：只在首次挂载把初始配置推给原生。
  // 如果把它绑在 initialConfig 上，任何一次无关重渲染只要让 initialConfig 换了引用
  // （内联 initialToolConfig 必然如此）就会重新下发一次 setToolConfig，
  // 状态又被 setCurrentToolConfig 写回 -> 触发下一轮渲染，形成自激循环。
  const didApplyInitialConfigRef = useRef(false);
  useEffect(() => {
    if (didApplyInitialConfigRef.current) {
      return;
    }

    didApplyInitialConfigRef.current = true;
    applyToolConfig(initialConfig);
  }, [applyToolConfig, initialConfig]);

  const handleToolChange = useCallback((tool) => {
    const nextConfig = typeof tool === 'string' ? { tool } : tool;
    applyToolConfig(nextConfig);
  }, [applyToolConfig]);

  const handleColorChange = useCallback((color) => {
    applyToolConfig({ color });
  }, [applyToolConfig]);

  const handleStrokeWidthChange = useCallback((width) => {
    applyToolConfig({ size: width });
  }, [applyToolConfig]);

  const handleToolConfigChange = useCallback((config) => {
    applyToolConfig(config);
  }, [applyToolConfig]);

  const handleUndo = useCallback(() => {
    if (dispatchCommand(nativeViewRef, viewType, 'undo')) {
      setCanRedo(true);
    }
  }, [nativeViewRef, viewType]);

  const handleRedo = useCallback(() => {
    if (dispatchCommand(nativeViewRef, viewType, 'redo')) {
      setCanUndo(true);
    }
  }, [nativeViewRef, viewType]);

  const handleClear = useCallback((clearScope) => {
    const normalizedScope = normalizeClearScope(clearScope);
    if (dispatchCommand(nativeViewRef, viewType, 'clear', [normalizedScope])) {
      setCanUndo(true);
      setCanRedo(false);
    }
  }, [nativeViewRef, viewType]);

  const handleAIToolSelect = useCallback((tool) => {
    if (typeof onAIToolSelectExternal === 'function') {
      onAIToolSelectExternal(tool);
    }
  }, [onAIToolSelectExternal]);

  const handleBookmarkAdd = useCallback((bookmark) => {
    if (typeof onBookmarkAddExternal === 'function') {
      onBookmarkAddExternal(bookmark);
    }
  }, [onBookmarkAddExternal]);

  const handleBookmarkList = useCallback(() => {
    if (typeof onBookmarkListExternal === 'function') {
      onBookmarkListExternal();
    }
  }, [onBookmarkListExternal]);

  const handleBookmarkNavigate = useCallback((bookmark) => {
    if (typeof onBookmarkNavigateExternal === 'function') {
      onBookmarkNavigateExternal(bookmark);
    }

    if (bookmark?.pageNumber) {
      dispatchCommand(nativeViewRef, viewType, 'setPage', [bookmark.pageNumber - 1]);
    }
  }, [nativeViewRef, onBookmarkNavigateExternal, viewType]);

  const handleTextAdd = useCallback((textConfig) => {
    if (!textConfig?.text) {
      return;
    }
    // 必须把完整样式一起下发：原生需要 fontSize/color/bold/italic/underline/alignment
    // 才能按用户看到的样子落笔。此前只发 [text]，样式在桥这层就被丢掉了，
    // 结果「面板里调好的字号与颜色」在画布上完全无效。
    const style = {
      fontSize: Number.isFinite(Number(textConfig.fontSize)) ? Number(textConfig.fontSize) : 16,
      color: typeof textConfig.color === 'string' ? textConfig.color : undefined,
      bold: !!textConfig.style?.bold,
      italic: !!textConfig.style?.italic,
      underline: !!textConfig.style?.underline,
      alignment: textConfig.alignment || 'left',
    };
    dispatchCommand(nativeViewRef, viewType, 'addText', [textConfig.text, JSON.stringify(style)]);
  }, [nativeViewRef, viewType]);

  const handleImageUpload = useCallback((imageInfo) => {
    if (!imageInfo?.uri) {
      return;
    }
    // 图片元数据（宽高/文件名）同样要带上：原生需要宽高比来决定落图尺寸，
    // 只发 uri 会让原生只能按默认比例猜。
    const meta = {
      width: Number.isFinite(Number(imageInfo.width)) ? Number(imageInfo.width) : undefined,
      height: Number.isFinite(Number(imageInfo.height)) ? Number(imageInfo.height) : undefined,
      fileName: imageInfo.fileName,
      fileSize: Number.isFinite(Number(imageInfo.fileSize)) ? Number(imageInfo.fileSize) : undefined,
    };
    dispatchCommand(nativeViewRef, viewType, 'addImage', [imageInfo.uri, JSON.stringify(meta)]);
  }, [nativeViewRef, viewType]);

  const handleLassoSelect = useCallback((selectionPath) => {
    dispatchCommand(nativeViewRef, viewType, 'lassoUpdate', [JSON.stringify(selectionPath)]);
  }, [nativeViewRef, viewType]);

  const handleLassoComplete = useCallback((selectedItems) => {
    dispatchCommand(nativeViewRef, viewType, 'lassoComplete', [JSON.stringify(selectedItems)]);
  }, [nativeViewRef, viewType]);

  // ---- 选中笔迹的操作 ----
  // 一律把 strokeIds 数组序列化成 JSON 字符串下发（原生侧按此解析）：
  // 这样即使原生的 3 秒自动清除选中态先触发，用户刚才那次操作仍作用在他看到的笔迹上。
  const serializeStrokeIds = (strokeIds) => {
    if (Array.isArray(strokeIds)) {
      return JSON.stringify(strokeIds.filter((id) => typeof id === 'string' && id));
    }
    if (typeof strokeIds === 'string' && strokeIds) {
      return strokeIds;
    }
    return '[]';
  };

  const handleDeleteSelectedStrokes = useCallback((strokeIds) => {
    dispatchCommand(nativeViewRef, viewType, 'deleteSelectedStrokes', [serializeStrokeIds(strokeIds)]);
  }, [nativeViewRef, viewType]);

  const handleDuplicateSelectedStrokes = useCallback((strokeIds, offset) => {
    const dx = Number.isFinite(Number(offset?.dx)) ? Number(offset.dx) : 16;
    const dy = Number.isFinite(Number(offset?.dy)) ? Number(offset.dy) : 16;
    dispatchCommand(nativeViewRef, viewType, 'duplicateSelectedStrokes', [serializeStrokeIds(strokeIds), dx, dy]);
  }, [nativeViewRef, viewType]);

  const handleMoveSelectedStrokes = useCallback((strokeIds, offset) => {
    const dx = Number.isFinite(Number(offset?.dx)) ? Number(offset.dx) : 0;
    const dy = Number.isFinite(Number(offset?.dy)) ? Number(offset.dy) : 0;
    dispatchCommand(nativeViewRef, viewType, 'moveSelectedStrokes', [serializeStrokeIds(strokeIds), dx, dy]);
  }, [nativeViewRef, viewType]);

  const handleClearStrokeSelection = useCallback(() => {
    dispatchCommand(nativeViewRef, viewType, 'clearStrokeSelection', []);
  }, [nativeViewRef, viewType]);

  const requestRecognition = useCallback(async (request = {}) => {
    if (!currentToolConfigRef.current.recognitionEnabled) {
      return '';
    }

    const normalizedRequest = typeof request === 'string'
      ? { selection: request }
      : (request || {});

    const scope = normalizeRecognitionSelection(normalizedRequest.selection || normalizedRequest.scope);
    const payload = {
      scope,
      selection: scope,
      count: normalizedRequest.count || 5,
      strokeId: normalizedRequest.strokeId || null,
      strokeIds: Array.isArray(normalizedRequest.strokeIds) ? normalizedRequest.strokeIds : [],
      surfaceId: viewType,
      pageId: normalizedRequest.pageId || null,
      documentPage: normalizedRequest.documentPage || currentPage || null,
      bounds: normalizedRequest.bounds || null,
    };

    if (viewType === 'pdf') {
      dispatchCommand(
        nativeViewRef,
        viewType,
        'recognize',
        [JSON.stringify(payload)]
      );
      return '';
    }

    const reactTag = findNodeHandle(nativeViewRef?.current);
    if (!reactTag) {
      return '';
    }

    try {
      const text = await recognizeHandwriting(viewType, reactTag, {
        count: payload.count,
        strokeIds: payload.strokeIds,
      });

      if (typeof onRecognitionResult === 'function') {
        onRecognitionResult({
          surfaceId: viewType,
          scope,
          text,
          confidence: 0,
          bounds: payload.bounds,
          sourceStrokeIds: payload.strokeIds,
        });
      }

      return text;
    } catch (error) {
      console.error(`[useNativeToolbarBridge:${viewType}] recognition failed`, error);
      if (typeof onRecognitionResult === 'function') {
        onRecognitionResult({
          surfaceId: viewType,
          scope,
          text: '',
          confidence: 0,
          bounds: payload.bounds,
          sourceStrokeIds: payload.strokeIds,
          error,
        });
      }
      return '';
    }
  }, [currentPage, nativeViewRef, onRecognitionResult, viewType]);

  const cancelScheduledRecognition = useCallback(() => {
    if (recognitionTimerRef.current) {
      clearTimeout(recognitionTimerRef.current);
      recognitionTimerRef.current = null;
    }
    pendingRecognitionRef.current = null;
  }, []);

  const scheduleRecognition = useCallback((request = {}) => {
    if (!currentToolConfigRef.current.recognitionEnabled) {
      return;
    }

    pendingRecognitionRef.current = request;
    if (recognitionTimerRef.current) {
      clearTimeout(recognitionTimerRef.current);
    }

    recognitionTimerRef.current = setTimeout(() => {
      const pendingRequest = pendingRecognitionRef.current || {};
      pendingRecognitionRef.current = null;
      recognitionTimerRef.current = null;
      requestRecognition(pendingRequest);
    }, currentToolConfigRef.current.recognitionDebounceMs || DEFAULT_RECOGNITION_DEBOUNCE_MS);
  }, [requestRecognition]);

  const setInteractionMode = useCallback((mode) => {
    dispatchCommand(nativeViewRef, viewType, 'setInteractionMode', [normalizeInteractionMode(mode)]);
  }, [nativeViewRef, viewType]);

  const setViewport = useCallback((viewport) => {
    const didDispatch = dispatchCommand(nativeViewRef, viewType, 'setViewport', [JSON.stringify(viewport)]);
    if (!didDispatch && nativeViewRef?.current?.setNativeProps) {
      nativeViewRef.current.setNativeProps({ viewport });
    }
  }, [nativeViewRef, viewType]);

  const resetViewport = useCallback(() => {
    const didDispatch = dispatchCommand(nativeViewRef, viewType, 'resetViewport', []);
    if (!didDispatch) {
      setViewport({ x: 0, y: 0, scale: 1 });
    }
  }, [setViewport, nativeViewRef, viewType]);

  const exportAnnotations = useCallback((optionsPayload) => {
    const payload = typeof optionsPayload === 'string'
      ? optionsPayload
      : JSON.stringify(optionsPayload || {});
    dispatchCommand(nativeViewRef, viewType, 'exportAnnotations', [payload]);
  }, [nativeViewRef, viewType]);

  const importAnnotations = useCallback((payload) => {
    const serializedPayload = typeof payload === 'string' ? payload : JSON.stringify(payload || {});
    dispatchCommand(nativeViewRef, viewType, 'importAnnotations', [serializedPayload]);
  }, [nativeViewRef, viewType]);

  const toolbarProps = useMemo(() => ({
    onToolChange: handleToolChange,
    onToolConfigChange: handleToolConfigChange,
    onColorChange: handleColorChange,
    onStrokeWidthChange: handleStrokeWidthChange,
    onUndo: handleUndo,
    onRedo: handleRedo,
    onClear: handleClear,
    canUndo,
    canRedo,
    onAIToolSelect: handleAIToolSelect,
    onBookmarkAdd: handleBookmarkAdd,
    onBookmarkList: handleBookmarkList,
    onBookmarkNavigate: handleBookmarkNavigate,
    currentPage,
    totalPages,
    onTextAdd: handleTextAdd,
    onImageUpload: handleImageUpload,
    onLassoSelect: handleLassoSelect,
    onLassoComplete: handleLassoComplete,
    // 选中笔迹的操作：工具栏据此把「删除/复制/完成」从「暂不支持」变成真实功能。
    onDeleteSelectedStrokes: handleDeleteSelectedStrokes,
    onDuplicateSelectedStrokes: handleDuplicateSelectedStrokes,
    onMoveSelectedStrokes: handleMoveSelectedStrokes,
    onClearStrokeSelection: handleClearStrokeSelection,
    initialTool: currentToolConfig.tool,
    initialColor: currentToolConfig.color,
    initialStrokeWidth: currentToolConfig.size,
    currentTool: currentToolConfig.tool,
    currentColor: currentToolConfig.color,
    currentStrokeWidth: currentToolConfig.size,
    currentToolConfig,
    requestRecognition,
    scheduleRecognition,
    cancelScheduledRecognition,
    setToolConfig: applyToolConfig,
    setInteractionMode,
    setViewport,
    resetViewport,
    exportAnnotations,
    importAnnotations,
  }), [
    applyToolConfig,
    canRedo,
    canUndo,
    cancelScheduledRecognition,
    currentPage,
    currentToolConfig,
    exportAnnotations,
    handleAIToolSelect,
    handleBookmarkAdd,
    handleBookmarkList,
    handleBookmarkNavigate,
    handleClear,
    handleClearStrokeSelection,
    handleColorChange,
    handleDeleteSelectedStrokes,
    handleDuplicateSelectedStrokes,
    handleImageUpload,
    handleLassoComplete,
    handleLassoSelect,
    handleMoveSelectedStrokes,
    handleRedo,
    handleStrokeWidthChange,
    handleTextAdd,
    handleToolChange,
    handleToolConfigChange,
    handleUndo,
    importAnnotations,
    requestRecognition,
    resetViewport,
    scheduleRecognition,
    setInteractionMode,
    setViewport,
    totalPages,
  ]);

  return toolbarProps;
};

export default useNativeToolbarBridge;
