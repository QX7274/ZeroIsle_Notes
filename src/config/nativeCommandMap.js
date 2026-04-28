/**
 * Unified handwriting surface protocol.
 *
 * JS only talks to protocol command names. Native managers can keep
 * temporary legacy aliases while migrating their underlying IDs.
 */

export const SURFACE_TYPES = Object.freeze({
  PDF: 'pdf',
  PAGED: 'paged',
  INFINITE: 'infinite',
});

export const SURFACE_COMPONENTS = Object.freeze({
  [SURFACE_TYPES.PDF]: 'NativePDFView',
  [SURFACE_TYPES.PAGED]: 'NativePagedNoteView',
  [SURFACE_TYPES.INFINITE]: 'NativeInfiniteCanvasView',
});

export const HANDWRITING_PROTOCOL_COMMANDS = Object.freeze({
  setToolConfig: 'setToolConfig',
  setInteractionMode: 'setInteractionMode',
  undo: 'undo',
  redo: 'redo',
  clear: 'clear',
  recognize: 'recognize',
  setViewport: 'setViewport',
  resetViewport: 'resetViewport',
  exportAnnotations: 'exportAnnotations',
  importAnnotations: 'importAnnotations',
  lassoStart: 'lassoStart',
  lassoUpdate: 'lassoUpdate',
  lassoComplete: 'lassoComplete',
  addImage: 'addImage',
  addText: 'addText',
  setPage: 'setPage',
  addPage: 'addPage',
  setTool: 'setTool',
  setColor: 'setColor',
  setStrokeWidth: 'setStrokeWidth',
});

const LEGACY_ALIASES = Object.freeze({
  [SURFACE_TYPES.PDF]: {
    setToolConfig: ['setToolConfig'],
    setInteractionMode: ['setInteractionMode'],
    undo: ['undo'],
    redo: ['redo'],
    clear: ['clear'],
    recognize: ['recognize', 'recognizeHandwriting'],
    setViewport: ['setViewport', 'setZoom'],
    resetViewport: ['resetViewport'],
    exportAnnotations: ['exportAnnotations', 'exportPDF'],
    importAnnotations: ['importAnnotations'],
    lassoStart: ['lassoStart', 'lassoSelect'],
    lassoUpdate: ['lassoUpdate', 'lassoSelect'],
    lassoComplete: ['lassoComplete'],
    addImage: ['addImage'],
    addText: ['addText', 'addTextAnnotation'],
    setPage: ['setPage', 'goToPage'],
    addPage: ['addPage'],
    setTool: ['setTool', 'setDrawingTool'],
    setColor: ['setColor', 'setDrawingColor'],
    setStrokeWidth: ['setStrokeWidth', 'setDrawingWidth'],
  },
  [SURFACE_TYPES.PAGED]: {
    setToolConfig: ['setToolConfig'],
    setInteractionMode: ['setInteractionMode'],
    undo: ['undo'],
    redo: ['redo'],
    clear: ['clear'],
    recognize: ['recognize', 'recognizeHandwriting'],
    setViewport: ['setViewport'],
    resetViewport: ['resetViewport'],
    exportAnnotations: ['exportAnnotations', 'exportNote'],
    importAnnotations: ['importAnnotations', 'importNote'],
    lassoStart: ['lassoStart', 'lassoSelect'],
    lassoUpdate: ['lassoUpdate', 'lassoSelect'],
    lassoComplete: ['lassoComplete'],
    addImage: ['addImage'],
    addText: ['addText', 'insertText'],
    setPage: ['setPage', 'setCurrentPage'],
    addPage: ['addPage', 'addNewPage'],
    setTool: ['setTool', 'setCurrentTool'],
    setColor: ['setColor', 'setCurrentColor'],
    setStrokeWidth: ['setStrokeWidth', 'setCurrentStrokeWidth'],
  },
  [SURFACE_TYPES.INFINITE]: {
    setToolConfig: ['setToolConfig'],
    setInteractionMode: ['setInteractionMode'],
    undo: ['undo'],
    redo: ['redo'],
    clear: ['clear'],
    recognize: ['recognize', 'recognizeHandwriting'],
    setViewport: ['setViewport'],
    resetViewport: ['resetViewport'],
    exportAnnotations: ['exportAnnotations', 'exportCanvas'],
    importAnnotations: ['importAnnotations', 'importCanvas'],
    lassoStart: ['lassoStart', 'lassoSelect'],
    lassoUpdate: ['lassoUpdate', 'lassoSelect'],
    lassoComplete: ['lassoComplete'],
    addImage: ['addImage'],
    addText: ['addText', 'addTextElement'],
    setPage: ['setPage'],
    addPage: ['addPage'],
    setTool: ['setTool', 'setCurrentTool'],
    setColor: ['setColor', 'setCurrentColor'],
    setStrokeWidth: ['setStrokeWidth', 'setCurrentStrokeWidth'],
  },
});

export const TOOL_TYPES = Object.freeze({
  PEN: 'pen',
  PENCIL: 'pencil',
  BRUSH: 'brush',
  HIGHLIGHTER: 'highlighter',
  ERASER: 'eraser',
  LASSO: 'lasso',
  PAN: 'pan',
  SHAPE: 'shape',
  TEXT: 'text',
  LASER: 'laser',
});

export const CLEAR_TYPES = Object.freeze({
  STROKE: 'stroke',
  PAGE: 'page',
  DOCUMENT: 'document',
  ALL: 'all',
  CURRENT_VIEW: 'current_view',
  CURRENT_PAGE: 'current_page',
  ENTIRE_DOCUMENT: 'entire_document',
  SELECTED: 'selected',
});

export const INTERACTION_MODES = Object.freeze({
  INK: 'ink',
  GESTURE: 'gesture',
  MIXED: 'mixed',
});

export const RECOGNITION_SELECTIONS = Object.freeze({
  LATEST: 'latest',
  VISIBLE: 'visible',
  PAGE: 'page',
  SELECTION: 'selection',
});

export const DEFAULT_RECOGNITION_DEBOUNCE_MS = 180;

export const getSurfaceCommandNames = (viewType, commandName) => {
  const commandAliases = LEGACY_ALIASES[viewType]?.[commandName] || [];
  return [commandName, ...commandAliases].filter(Boolean);
};

export const normalizeClearScope = (scope) => {
  switch (scope) {
    case CLEAR_TYPES.CURRENT_VIEW:
      return CLEAR_TYPES.CURRENT_VIEW;
    case CLEAR_TYPES.CURRENT_PAGE:
    case CLEAR_TYPES.PAGE:
      return CLEAR_TYPES.CURRENT_PAGE;
    case CLEAR_TYPES.DOCUMENT:
    case CLEAR_TYPES.ENTIRE_DOCUMENT:
      return CLEAR_TYPES.ENTIRE_DOCUMENT;
    case CLEAR_TYPES.STROKE:
      return CLEAR_TYPES.STROKE;
    case CLEAR_TYPES.SELECTED:
      return CLEAR_TYPES.SELECTED;
    case CLEAR_TYPES.ALL:
      return CLEAR_TYPES.ALL;
    default:
      return CLEAR_TYPES.CURRENT_PAGE;
  }
};

export const normalizeInteractionMode = (mode) => {
  switch (mode) {
    case INTERACTION_MODES.INK:
    case INTERACTION_MODES.GESTURE:
    case INTERACTION_MODES.MIXED:
      return mode;
    case 'gesture_only':
      return INTERACTION_MODES.GESTURE;
    default:
      return INTERACTION_MODES.MIXED;
  }
};

export const normalizeRecognitionSelection = (selection) => {
  switch (selection) {
    case RECOGNITION_SELECTIONS.VISIBLE:
    case RECOGNITION_SELECTIONS.PAGE:
    case RECOGNITION_SELECTIONS.SELECTION:
      return selection;
    default:
      return RECOGNITION_SELECTIONS.LATEST;
  }
};

/**
 * Backward-compatible export for older imports.
 */
export const NATIVE_COMMANDS = LEGACY_ALIASES;
