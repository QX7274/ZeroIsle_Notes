/**
 * Native handwriting toolbar bridge.
 *
 * JS owns the single source of truth for toolbar state and only sends
 * normalized protocol commands / tool config snapshots to native surfaces.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { UIManager, findNodeHandle } from 'react-native';
import {
  CLEAR_TYPES,
  DEFAULT_RECOGNITION_DEBOUNCE_MS,
  INTERACTION_MODES,
  SURFACE_COMPONENTS,
  getSurfaceCommandNames,
  normalizeClearScope,
  normalizeInteractionMode,
  normalizeRecognitionSelection,
} from '../config/nativeCommandMap';
import { recognizeHandwriting } from '../native/recognitionBridge';

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

  const initialConfig = useMemo(
    () => buildHandwritingToolConfig(initialToolConfig || {}),
    [initialToolConfig]
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

  useEffect(() => {
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
    if (textConfig?.text) {
      dispatchCommand(nativeViewRef, viewType, 'addText', [textConfig.text]);
    }
  }, [nativeViewRef, viewType]);

  const handleImageUpload = useCallback((imageInfo) => {
    if (imageInfo?.uri) {
      dispatchCommand(nativeViewRef, viewType, 'addImage', [imageInfo.uri]);
    }
  }, [nativeViewRef, viewType]);

  const handleLassoSelect = useCallback((selectionPath) => {
    dispatchCommand(nativeViewRef, viewType, 'lassoUpdate', [JSON.stringify(selectionPath)]);
  }, [nativeViewRef, viewType]);

  const handleLassoComplete = useCallback((selectedItems) => {
    dispatchCommand(nativeViewRef, viewType, 'lassoComplete', [JSON.stringify(selectedItems)]);
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
    handleColorChange,
    handleImageUpload,
    handleLassoComplete,
    handleLassoSelect,
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
