/**
 * JavaScript Canvas Hook
 *
 * 为纯JS实现的视图提供绘图、撤销/重做等画布功能。
 * 使用 react-native-svg 进行渲染。
 */

import { useState, useCallback, useRef } from 'react';

export const useJavascriptCanvas = () => {
  const [strokes, setStrokes] = useState([]);
  const [currentTool, setCurrentTool] = useState('pen');
  const [currentColor, setCurrentColor] = useState('#000000');
  const [currentStrokeWidth, setCurrentStrokeWidth] = useState(3);
  const [selectedStrokes, setSelectedStrokes] = useState([]);

  const undoStack = useRef([]);
  const redoStack = useRef([]);
  const currentStrokePoints = useRef([]);
  const lassoPath = useRef([]);
  const isDrawing = useRef(false);

  // 清除画布
  const clear = useCallback((clearType = 'all') => {
    if (clearType === 'selected') {
      if (selectedStrokes.length > 0) {
        undoStack.current.push(strokes);
        redoStack.current = [];
        const newStrokes = strokes.filter((_, index) => !selectedStrokes.includes(index));
        setStrokes(newStrokes);
        setSelectedStrokes([]);
      }
    } else if (clearType === 'all') {
      if (strokes.length > 0) {
        undoStack.current.push(strokes);
        redoStack.current = [];
        setStrokes([]);
      }
    }
  }, [strokes, selectedStrokes]);

  // 撤销
  const undo = useCallback(() => {
    if (undoStack.current.length > 0) {
      const lastStrokes = undoStack.current.pop();
      redoStack.current.push(strokes);
      setStrokes(lastStrokes);
    }
  }, [strokes]);

  // 重做
  const redo = useCallback(() => {
    if (redoStack.current.length > 0) {
      const nextStrokes = redoStack.current.pop();
      undoStack.current.push(strokes);
      setStrokes(nextStrokes);
    }
  }, [strokes]);

  // 添加笔迹
  const addStroke = useCallback((newStroke) => {
    undoStack.current.push(strokes);
    redoStack.current = []; // 清空重做栈
    setStrokes(prevStrokes => [...prevStrokes, newStroke]);
  }, [strokes]);

  // 手势处理 - 开始
  const onTouchStart = useCallback((x, y) => {
    isDrawing.current = true;
    currentStrokePoints.current = [{ x, y }];

    if (currentTool === 'lasso') {
      lassoPath.current = [{ x, y }];
    }
  }, [currentTool]);

  // 手势处理 - 移动
  const onTouchMove = useCallback((x, y) => {
    if (!isDrawing.current) {return;}

    currentStrokePoints.current.push({ x, y });

    if (currentTool === 'lasso') {
      lassoPath.current.push({ x, y });
    }
  }, [currentTool]);

  // 手势处理 - 结束
  const onTouchEnd = useCallback(() => {
    if (!isDrawing.current) {return;}
    isDrawing.current = false;

    if (currentTool === 'lasso') {
      // 套索选择逻辑
      const selected = [];
      strokes.forEach((stroke, index) => {
        if (isStrokeInsideLasso(stroke.points, lassoPath.current)) {
          selected.push(index);
        }
      });
      setSelectedStrokes(selected);
      lassoPath.current = [];
    } else if (currentStrokePoints.current.length > 1) {
      // 添加新笔迹
      const newStroke = {
        tool: currentTool,
        color: currentColor,
        strokeWidth: currentStrokeWidth,
        points: [...currentStrokePoints.current],
      };
      addStroke(newStroke);
    }

    currentStrokePoints.current = [];
  }, [currentTool, currentColor, currentStrokeWidth, strokes, addStroke]);

  // 检查笔迹是否在套索内
  const isStrokeInsideLasso = (strokePoints, lassoPoints) => {
    if (!strokePoints || strokePoints.length === 0 || !lassoPoints || lassoPoints.length < 3) {
      return false;
    }

    // 简单的点在多边形内检测算法
    let insideCount = 0;
    for (const point of strokePoints) {
      if (isPointInPolygon(point, lassoPoints)) {
        insideCount++;
      }
    }

    // 如果超过一半的点在套索内，则认为笔迹被选中
    return insideCount > strokePoints.length / 2;
  };

  // 点在多边形内检测（射线法）
  const isPointInPolygon = (point, polygon) => {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x, yi = polygon[i].y;
      const xj = polygon[j].x, yj = polygon[j].y;

      const intersect = ((yi > point.y) !== (yj > point.y))
        && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
      if (intersect) {inside = !inside;}
    }
    return inside;
  };

  // 工具栏事件处理
  const onToolChange = useCallback((tool) => {
    setCurrentTool(tool);
    setSelectedStrokes([]); // 切换工具时清除选中状态
  }, []);
  const onColorChange = useCallback((color) => setCurrentColor(color), []);
  const onStrokeWidthChange = useCallback((width) => setCurrentStrokeWidth(width), []);

  return {
    strokes,
    selectedStrokes,
    currentTool,
    currentColor,
    currentStrokeWidth,
    currentStrokePoints: currentStrokePoints.current,
    lassoPath: lassoPath.current,
    addStroke,
    clear,
    undo,
    redo,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    toolbarProps: {
      onToolChange,
      onColorChange,
      onStrokeWidthChange,
      onClear: clear,
      onUndo: undo,
      onRedo: redo,
      canUndo: undoStack.current.length > 0,
      canRedo: redoStack.current.length > 0,
    },
  };
};

