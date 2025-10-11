/**
 * useDrawing Hook
 * 通用绘图逻辑Hook，提供完整的绘图、工具切换、撤销重做等功能
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  createPath,
  isStrokeIntersecting,
  getStrokesInRect,
  moveStroke,
  getToolConfig,
  simplifyStroke,
} from '../utils/drawing/strokeRenderer';

/**
 * useDrawing Hook
 * @param {Object} options - 配置选项
 * @param {string} options.noteId - 笔记ID
 * @param {Array} options.initialStrokes - 初始笔画数据
 * @param {string} options.canvasType - 画布类型: 'standard' | 'infinite' | 'paged'
 * @param {Function} options.onStrokesChange - 笔画变化回调
 * @param {number} options.currentPage - 当前页码（分页模式）
 * @returns {Object} 绘图相关的状态和方法
 */
export const useDrawing = ({
  noteId,
  initialStrokes = [],
  canvasType = 'standard',
  onStrokesChange,
  currentPage = 1,
} = {}) => {
  // ========== 状态管理 ==========
  const [strokes, setStrokes] = useState(initialStrokes);
  const [currentTool, setCurrentTool] = useState('pen');
  const [currentColor, setCurrentColor] = useState('#000000');
  const [currentStrokeWidth, setCurrentStrokeWidth] = useState(2);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentStroke, setCurrentStroke] = useState(null);

  // 历史记录（撤销/重做）
  const [history, setHistory] = useState([initialStrokes]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // 工具特殊配置
  const [toolConfig, setToolConfig] = useState(null);

  // 激光笔定时器
  const laserTimers = useRef(new Map());

  // 选择和移动工具状态
  const [selectedStrokes, setSelectedStrokes] = useState([]);
  const [selectionBox, setSelectionBox] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef(null);

  // 书签状态
  const [bookmarks, setBookmarks] = useState([]);

  // 当前笔画引用
  const currentStrokeRef = useRef(null);

  // ========== 历史记录管理 ==========
  
  /**
   * 添加到历史记录
   */
  const addToHistory = useCallback((newStrokes) => {
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(newStrokes);
      return newHistory;
    });
    setHistoryIndex(prev => prev + 1);
  }, [historyIndex]);

  /**
   * 撤销
   */
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setStrokes(history[newIndex]);
    }
  }, [historyIndex, history]);

  /**
   * 重做
   */
  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setStrokes(history[newIndex]);
    }
  }, [historyIndex, history]);

  // ========== 工具切换 ==========

  /**
   * 处理工具变化
   */
  const handleToolChange = useCallback((tool) => {
    console.log('[useDrawing] 工具变化:', tool);
    
    const config = getToolConfig(tool);
    setToolConfig(config);
    setCurrentTool(config.type);

    // 根据工具类型设置默认宽度
    if (config.defaultWidth && currentStrokeWidth === 2) {
      setCurrentStrokeWidth(config.defaultWidth);
    }

    // 特殊工具处理
    if (config.type === 'eraser') {
      console.log('[useDrawing] 橡皮擦模式，大小:', config.size || currentStrokeWidth);
    } else if (config.type === 'laser') {
      console.log('[useDrawing] 激光笔模式，消失时间:', config.fadeOutDuration);
    } else if (config.type === 'move' || config.type === 'lasso') {
      console.log('[useDrawing] 选择工具模式');
      setSelectedStrokes([]);
      setSelectionBox(null);
    }
  }, [currentStrokeWidth]);

  /**
   * 处理颜色变化
   */
  const handleColorChange = useCallback((color) => {
    console.log('[useDrawing] 颜色变化:', color);
    setCurrentColor(color);
  }, []);

  /**
   * 处理笔触粗细变化
   */
  const handleStrokeWidthChange = useCallback((width) => {
    console.log('[useDrawing] 粗细变化:', width);
    setCurrentStrokeWidth(width);
  }, []);

  // ========== 绘图逻辑 ==========

  /**
   * 开始绘制
   */
  const startDrawing = useCallback((x, y, pressure = 1.0) => {
    console.log('[useDrawing] 开始绘制:', { x, y, tool: currentTool });

    // 移动工具：开始选择
    if (currentTool === 'move' || currentTool === 'lasso') {
      setSelectionBox({ x, y, width: 0, height: 0 });
      dragStart.current = { x, y };
      return;
    }

    const config = toolConfig || getToolConfig(currentTool);

    const newStroke = {
      id: `stroke_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      tool: currentTool,
      color: currentColor,
      width: currentStrokeWidth,
      opacity: config.opacity || 1.0,
      points: [{ x, y, timestamp: Date.now(), pressure }],
      page: currentPage, // 分页模式
    };

    currentStrokeRef.current = newStroke;
    setCurrentStroke(newStroke);
    setIsDrawing(true);
  }, [currentTool, currentColor, currentStrokeWidth, toolConfig, currentPage]);

  /**
   * 更新绘制
   */
  const updateDrawing = useCallback((x, y, pressure = 1.0) => {
    if (!isDrawing && !selectionBox) return;

    // 移动工具：更新选择框
    if (selectionBox && dragStart.current) {
      const width = x - dragStart.current.x;
      const height = y - dragStart.current.y;
      setSelectionBox({
        x: width < 0 ? x : dragStart.current.x,
        y: height < 0 ? y : dragStart.current.y,
        width: Math.abs(width),
        height: Math.abs(height),
      });
      return;
    }

    if (!currentStrokeRef.current) return;

    const updatedStroke = {
      ...currentStrokeRef.current,
      points: [
        ...currentStrokeRef.current.points,
        { x, y, timestamp: Date.now(), pressure },
      ],
    };

    currentStrokeRef.current = updatedStroke;
    setCurrentStroke(updatedStroke);

    // 橡皮擦：实时删除相交的笔画
    if (currentTool === 'eraser') {
      const threshold = currentStrokeWidth;
      setStrokes(prevStrokes => {
        const filtered = prevStrokes.filter(stroke => {
          return !isStrokeIntersecting(
            updatedStroke.points,
            stroke.points,
            threshold
          );
        });
        return filtered;
      });
    }
  }, [isDrawing, currentTool, currentStrokeWidth, selectionBox]);

  /**
   * 结束绘制
   */
  const endDrawing = useCallback(() => {
    console.log('[useDrawing] 结束绘制');

    // 移动工具：完成选择
    if (selectionBox && dragStart.current) {
      const selected = getStrokesInRect(selectionBox, strokes);
      setSelectedStrokes(selected);
      setSelectionBox(null);
      dragStart.current = null;
      console.log('[useDrawing] 选中笔画:', selected.length);
      return;
    }

    if (!currentStrokeRef.current || !isDrawing) return;

    const finalStroke = currentStrokeRef.current;

    // 简化笔画点，优化性能
    const simplifiedStroke = {
      ...finalStroke,
      points: simplifyStroke(finalStroke.points, 1.5),
    };

    // 橡皮擦：不添加笔画，只删除
    if (currentTool === 'eraser') {
      setIsDrawing(false);
      setCurrentStroke(null);
      currentStrokeRef.current = null;
      addToHistory(strokes);
      return;
    }

    // 添加笔画
    const newStrokes = [...strokes, simplifiedStroke];
    setStrokes(newStrokes);
    addToHistory(newStrokes);

    // 激光笔：设置定时删除
    if (currentTool === 'laser') {
      const fadeOutDuration = toolConfig?.fadeOutDuration || 3000;
      const timer = setTimeout(() => {
        setStrokes(prev => prev.filter(s => s.id !== simplifiedStroke.id));
        laserTimers.current.delete(simplifiedStroke.id);
      }, fadeOutDuration);
      laserTimers.current.set(simplifiedStroke.id, timer);
    }

    setIsDrawing(false);
    setCurrentStroke(null);
    currentStrokeRef.current = null;

    // 触发回调
    if (onStrokesChange) {
      onStrokesChange(newStrokes);
    }
  }, [
    isDrawing,
    currentTool,
    strokes,
    toolConfig,
    selectionBox,
    onStrokesChange,
    addToHistory,
  ]);

  // ========== 清除功能 ==========

  /**
   * 清除
   * @param {string} mode - 清除模式: 'current_view' | 'selected' | 'current_page' | 'entire_document'
   */
  const handleClear = useCallback((mode = 'current_view') => {
    console.log('[useDrawing] 清除模式:', mode);

    switch (mode) {
      case 'selected':
        if (selectedStrokes.length > 0) {
          const newStrokes = strokes.filter(s => !selectedStrokes.includes(s.id));
          setStrokes(newStrokes);
          addToHistory(newStrokes);
          setSelectedStrokes([]);
        }
        break;

      case 'current_page':
        if (canvasType === 'paged') {
          const newStrokes = strokes.filter(s => s.page !== currentPage);
          setStrokes(newStrokes);
          addToHistory(newStrokes);
        } else {
          setStrokes([]);
          addToHistory([]);
        }
        break;

      case 'entire_document':
        setStrokes([]);
        addToHistory([]);
        setHistory([[]]);
        setHistoryIndex(0);
        break;

      case 'current_view':
      default:
        setStrokes([]);
        addToHistory([]);
        break;
    }
  }, [strokes, selectedStrokes, currentPage, canvasType, addToHistory]);

  // ========== 书签功能 ==========

  /**
   * 添加书签
   */
  const handleAddBookmark = useCallback((bookmark) => {
    console.log('[useDrawing] 添加书签:', bookmark);
    setBookmarks(prev => [...prev, bookmark]);
  }, []);

  /**
   * 删除书签
   */
  const handleDeleteBookmark = useCallback((bookmarkId) => {
    setBookmarks(prev => prev.filter(b => b.id !== bookmarkId));
  }, []);

  /**
   * 导航到书签
   */
  const handleNavigateToBookmark = useCallback((bookmark) => {
    console.log('[useDrawing] 导航到书签:', bookmark);
    // 父组件需要处理页面跳转
  }, []);

  // ========== 移动笔画 ==========

  /**
   * 移动选中的笔画
   */
  const handleMoveStrokes = useCallback((dx, dy) => {
    if (selectedStrokes.length === 0) return;

    setStrokes(prevStrokes =>
      prevStrokes.map(stroke => {
        if (selectedStrokes.includes(stroke.id)) {
          return moveStroke(stroke, dx, dy);
        }
        return stroke;
      })
    );
  }, [selectedStrokes]);

  // ========== 清理定时器 ==========
  useEffect(() => {
    return () => {
      // 清理所有激光笔定时器
      laserTimers.current.forEach(timer => clearTimeout(timer));
      laserTimers.current.clear();
    };
  }, []);

  // ========== 返回值 ==========

  return {
    // 传给工具栏的 props
    toolbarProps: {
      onToolChange: handleToolChange,
      onColorChange: handleColorChange,
      onStrokeWidthChange: handleStrokeWidthChange,
      onUndo: handleUndo,
      onRedo: handleRedo,
      canUndo: historyIndex > 0,
      canRedo: historyIndex < history.length - 1,
      onClear: handleClear,
      initialTool: currentTool,
      initialColor: currentColor,
      initialStrokeWidth: currentStrokeWidth,
      
      // AI工具（预留接口）
      onAIToolSelect: () => console.log('[useDrawing] AI工具选择'),
      onAIProcessResult: (result) => console.log('[useDrawing] AI处理结果:', result),
      
      // 书签
      onBookmarkAdd: handleAddBookmark,
      onBookmarkList: () => console.log('[useDrawing] 书签列表'),
      onBookmarkNavigate: handleNavigateToBookmark,
      currentNoteId: noteId,
      currentPage,
      
      // 图片上传（预留接口）
      onImageUpload: (image) => console.log('[useDrawing] 图片上传:', image),
      
      // 文本工具（预留接口）
      onTextAdd: (text) => console.log('[useDrawing] 添加文本:', text),
      
      // 模式切换
      onModeToggle: (isFingerMode) => {
        console.log('[useDrawing] 模式切换:', isFingerMode ? '手指' : '笔');
        handleToolChange(isFingerMode ? 'move' : 'pen');
      },
      isFingerMode: currentTool === 'move',
      showModeToggle: true,
    },

    // Canvas 手势处理
    canvasGestureHandlers: {
      onTouchStart: (e) => {
        const { locationX, locationY } = e.nativeEvent;
        startDrawing(locationX, locationY);
      },
      onTouchMove: (e) => {
        const { locationX, locationY } = e.nativeEvent;
        updateDrawing(locationX, locationY);
      },
      onTouchEnd: endDrawing,
      onTouchCancel: endDrawing,
    },

    // 暴露的状态
    strokes,
    currentStroke,
    isDrawing,
    currentTool,
    currentColor,
    currentStrokeWidth,
    selectedStrokes,
    selectionBox,
    bookmarks,

    // 工具方法
    setStrokes,
    handleMoveStrokes,
    handleDeleteBookmark,
    
    // 工具配置
    toolConfig: toolConfig || getToolConfig(currentTool),

    // 渲染辅助
    createPath,
  };
};

export default useDrawing;


