/**
 * nativeCommandMap 协议层回归测试
 *
 * 背景（本轮手写/工具栏优化）：JS 只通过协议命令名与原生对话，
 * 这里锁定「别名解析 / 归一化 / 命令 ID 查询」三件容易回归的事：
 *  - 别名顺序：协议名必须排在历史别名之前，避免旧命令抢占新命令；
 *  - interactionMode：'gesture_only' 等旧值必须收敛到 ink/gesture/mixed；
 *  - clearScope：'page' / 'document' 等旧值必须收敛到 canonical 值，
 *    因为原生只认 canonical 字符串。
 */

const {
  SURFACE_TYPES,
  SURFACE_COMPONENTS,
  HANDWRITING_PROTOCOL_COMMANDS,
  INTERACTION_MODES,
  CLEAR_TYPES,
  RECOGNITION_SELECTIONS,
  getSurfaceCommandNames,
  normalizeClearScope,
  normalizeInteractionMode,
  normalizeRecognitionSelection,
} = require('../nativeCommandMap');

describe('nativeCommandMap 协议定义', () => {
  it('三种手写表面都登记了对应的原生组件名', () => {
    expect(SURFACE_COMPONENTS[SURFACE_TYPES.PDF]).toBe('NativePDFView');
    expect(SURFACE_COMPONENTS[SURFACE_TYPES.PAGED]).toBe('NativePagedNoteView');
    expect(SURFACE_COMPONENTS[SURFACE_TYPES.INFINITE]).toBe('NativeInfiniteCanvasView');
  });

  it('协议命令集合覆盖本轮新增的交互模式命令', () => {
    expect(HANDWRITING_PROTOCOL_COMMANDS.setInteractionMode).toBe('setInteractionMode');
    expect(HANDWRITING_PROTOCOL_COMMANDS.lassoComplete).toBe('lassoComplete');
  });

  it('别名解析把协议名排在历史别名之前', () => {
    expect(getSurfaceCommandNames(SURFACE_TYPES.PAGED, 'setTool')).toEqual([
      'setTool',
      'setCurrentTool',
    ]);
    expect(getSurfaceCommandNames(SURFACE_TYPES.PDF, 'recognize')).toEqual([
      'recognize',
      'recognizeHandwriting',
    ]);
  });

  it('未知表面/命令返回空别名列表而不是抛错', () => {
    expect(getSurfaceCommandNames('unknown-surface', 'undo')).toEqual(['undo']);
    expect(getSurfaceCommandNames(SURFACE_TYPES.PAGED, 'nope')).toEqual(['nope']);
  });
});

describe('normalizeClearScope', () => {
  it('把旧值收敛到 canonical 清除范围', () => {
    expect(normalizeClearScope('page')).toBe(CLEAR_TYPES.CURRENT_PAGE);
    expect(normalizeClearScope('document')).toBe(CLEAR_TYPES.ENTIRE_DOCUMENT);
    expect(normalizeClearScope('all')).toBe(CLEAR_TYPES.ALL);
    expect(normalizeClearScope('current_view')).toBe(CLEAR_TYPES.CURRENT_VIEW);
  });

  it('canonical 值原样返回', () => {
    expect(normalizeClearScope(CLEAR_TYPES.CURRENT_PAGE)).toBe(CLEAR_TYPES.CURRENT_PAGE);
    expect(normalizeClearScope(CLEAR_TYPES.ENTIRE_DOCUMENT)).toBe(CLEAR_TYPES.ENTIRE_DOCUMENT);
  });

  it('未知值回落到当前页', () => {
    expect(normalizeClearScope(undefined)).toBe(CLEAR_TYPES.CURRENT_PAGE);
    expect(normalizeClearScope('whatever')).toBe(CLEAR_TYPES.CURRENT_PAGE);
  });
});

describe('normalizeInteractionMode', () => {
  it('保留三种 canonical 交互模式', () => {
    expect(normalizeInteractionMode(INTERACTION_MODES.INK)).toBe(INTERACTION_MODES.INK);
    expect(normalizeInteractionMode(INTERACTION_MODES.GESTURE)).toBe(INTERACTION_MODES.GESTURE);
    expect(normalizeInteractionMode(INTERACTION_MODES.MIXED)).toBe(INTERACTION_MODES.MIXED);
  });

  it("把旧的 'gesture_only' 收敛到 gesture", () => {
    expect(normalizeInteractionMode('gesture_only')).toBe(INTERACTION_MODES.GESTURE);
  });

  it('未知值回落到 mixed', () => {
    expect(normalizeInteractionMode(undefined)).toBe(INTERACTION_MODES.MIXED);
    expect(normalizeInteractionMode('nonsense')).toBe(INTERACTION_MODES.MIXED);
  });
});

describe('normalizeRecognitionSelection', () => {
  it('保留已知识别范围', () => {
    expect(normalizeRecognitionSelection(RECOGNITION_SELECTIONS.PAGE)).toBe('page');
    expect(normalizeRecognitionSelection('selection')).toBe('selection');
  });

  it('未知值回落到 latest', () => {
    expect(normalizeRecognitionSelection(undefined)).toBe(RECOGNITION_SELECTIONS.LATEST);
  });
});
