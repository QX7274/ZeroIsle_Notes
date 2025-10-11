/**
 * 原生组件命令ID映射配置
 * 统一管理所有原生视图组件的命令ID
 */

export const NATIVE_COMMANDS = {
  // PDF 查看器命令
  pdf: {
    goToPage: 1,
    setDrawingTool: 2,
    setDrawingColor: 3,
    setDrawingWidth: 4,
    recognizeHandwriting: 5,
    addTextAnnotation: 6,
    exportPDF: 7,
    setToolConfig: 10,
    lassoSelect: 11,
    lassoComplete: 12,
    // PDF 不支持撤销/重做（原生实现）
    undo: null,
    redo: null,
    clear: null,
  },

  // 分页笔记命令
  paged: {
    recognizeHandwriting: 1,
    insertText: 2,
    exportNote: 3,
    undo: 4,
    redo: 5,
    clear: 6,
    setCurrentPage: 7,
    setCurrentTool: 8,
    setCurrentColor: 9,
    setCurrentStrokeWidth: 10,
    addPage: 11,
    deletePage: 12,
    setPageStyle: 13,
    setToolConfig: 15,
    lassoSelect: 16,
    lassoComplete: 17,
  },

  // 无限画布命令
  infinite: {
    recognizeHandwriting: 1,
    addTextElement: 2,
    exportCanvas: 3,
    undo: 4,
    redo: 5,
    clear: 6,
    setCurrentTool: 7,
    setCurrentColor: 8,
    setCurrentStrokeWidth: 9,
    setToolConfig: 10,
    setViewport: 11,
    resetViewport: 12,
    lassoSelect: 13,
    lassoComplete: 14,
  },
};

/**
 * 工具类型映射（确保与原生层一致）
 */
export const TOOL_TYPES = {
  PEN: 'pen',
  PENCIL: 'pencil',
  BRUSH: 'brush',
  HIGHLIGHTER: 'highlighter',
  LASER: 'laser',
  ERASER: 'eraser',
  SHAPE: 'shape',
  TEXT: 'text',
  LASSO: 'lasso',  // 套索工具（包含选择和移动功能）
};

/**
 * 清除范围类型
 */
export const CLEAR_TYPES = {
  CURRENT_VIEW: 'current_view',
  SELECTED: 'selected',
  CURRENT_PAGE: 'current_page',
  ENTIRE_DOCUMENT: 'entire_document',
};


