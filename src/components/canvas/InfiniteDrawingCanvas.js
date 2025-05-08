/**
 * 无限绘图画布组件
 * 基于InfiniteCanvas实现，但提供与DrawingCanvas兼容的接口
 */

import React, { useState, useRef, useCallback } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Svg, { Path, Rect, Circle, Line, Polygon, G } from 'react-native-svg';
import { GestureDetector, Gesture, GestureHandlerRootView } from 'react-native-gesture-handler';
import { captureRef } from 'react-native-view-shot';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle,
  runOnJS
} from 'react-native-reanimated';

// 工具类型
const TOOLS = {
  PEN: 'pen',
  PENCIL: 'pencil',
  HIGHLIGHTER: 'highlighter',
  ERASER: 'eraser',
  SHAPE: 'shape',
  TEXT: 'text',
  SELECT: 'select',
};

// 形状类型
const SHAPES = {
  LINE: 'line',
  RECTANGLE: 'rectangle',
  CIRCLE: 'circle',
  TRIANGLE: 'triangle',
  ARROW: 'arrow',
};

/**
 * 无限绘图画布组件
 * 提供与DrawingCanvas兼容的接口，但使用InfiniteCanvas的实现
 */
const InfiniteDrawingCanvas = ({
  width = Dimensions.get('window').width,
  height = 300,
  backgroundColor = 'transparent',
  onStrokeEnd,
  onScreenshotTaken,
}) => {
  // 绘图状态
  const [paths, setPaths] = useState([]);
  const [currentPath, setCurrentPath] = useState(null);
  const [history, setHistory] = useState([]);
  const [redoStack, setRedoStack] = useState([]);

  // 绘图设置
  const [tool, setTool] = useState({ type: TOOLS.PEN });
  const [color, setColor] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(2);

  // 引用
  const canvasRef = useRef(null);
  const svgRef = useRef(null);
  
  // 动画值
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  
  // 处理工具变更
  const handleToolChange = (newTool) => {
    setTool(newTool);
  };
  
  // 处理颜色变更
  const handleColorChange = (newColor) => {
    setColor(newColor);
  };
  
  // 处理线宽变更
  const handleStrokeWidthChange = (newWidth) => {
    setStrokeWidth(newWidth);
  };
  
  // 处理撤销
  const handleUndo = () => {
    if (paths.length === 0) return;
    
    const lastPath = paths[paths.length - 1];
    setRedoStack(prev => [...prev, lastPath]);
    setPaths(prev => prev.slice(0, -1));
  };
  
  // 处理重做
  const handleRedo = () => {
    if (redoStack.length === 0) return;
    
    const pathToRedo = redoStack[redoStack.length - 1];
    setPaths(prev => [...prev, pathToRedo]);
    setRedoStack(prev => prev.slice(0, -1));
  };
  
  // 处理清空
  const handleClear = () => {
    setPaths([]);
    setRedoStack([]);
  };
  
  // 处理截图
  const handleScreenshot = async () => {
    if (!canvasRef.current) return;
    
    try {
      const uri = await captureRef(canvasRef, {
        format: 'png',
        quality: 1,
      });
      
      if (onScreenshotTaken) {
        onScreenshotTaken(uri);
      }
    } catch (error) {
      console.error('截图失败:', error);
    }
  };
  
  // 处理绘制开始
  const handleDrawStart = (x, y) => {
    if (tool.type === TOOLS.SHAPE) {
      // 形状工具
      const newPath = {
        id: Date.now().toString(),
        tool: TOOLS.SHAPE,
        shape: tool.shape,
        color,
        strokeWidth,
        points: [{ x, y }],
      };
      setCurrentPath(newPath);
    } else {
      // 其他绘图工具
      const newPath = {
        id: Date.now().toString(),
        tool: tool.type,
        color: tool.type === TOOLS.ERASER ? 'white' : color,
        strokeWidth: tool.type === TOOLS.HIGHLIGHTER ? strokeWidth * 2 : strokeWidth,
        path: `M ${x} ${y}`,
        points: [{ x, y }],
      };
      setCurrentPath(newPath);
    }
  };
  
  // 处理绘制移动
  const handleDrawMove = (x, y) => {
    if (!currentPath) return;
    
    if (currentPath.tool === TOOLS.SHAPE) {
      // 更新形状
      const newPoints = [...currentPath.points, { x, y }];
      setCurrentPath({
        ...currentPath,
        points: newPoints,
      });
    } else {
      // 更新路径
      const newPath = `${currentPath.path} L ${x} ${y}`;
      const newPoints = [...currentPath.points, { x, y }];
      setCurrentPath({
        ...currentPath,
        path: newPath,
        points: newPoints,
      });
    }
  };
  
  // 处理绘制结束
  const handleDrawEnd = () => {
    if (!currentPath) return;
    
    // 添加到路径列表
    setPaths(prev => [...prev, currentPath]);
    
    // 回调
    if (onStrokeEnd) {
      onStrokeEnd(currentPath);
    }
    
    // 清空当前路径
    setCurrentPath(null);
  };
  
  // 创建手势响应器
  const panGesture = Gesture.Pan()
    .onStart((e) => {
      runOnJS(handleDrawStart)(e.x, e.y);
    })
    .onUpdate((e) => {
      runOnJS(handleDrawMove)(e.x, e.y);
    })
    .onEnd(() => {
      runOnJS(handleDrawEnd)();
    });
  
  // 渲染形状
  const renderShape = (shape) => {
    if (!shape || !shape.points || shape.points.length < 2) return null;
    
    const startPoint = shape.points[0];
    const endPoint = shape.points[shape.points.length - 1];
    
    switch (shape.shape) {
      case SHAPES.LINE:
        return (
          <Line
            key={shape.id}
            x1={startPoint.x}
            y1={startPoint.y}
            x2={endPoint.x}
            y2={endPoint.y}
            stroke={shape.color}
            strokeWidth={shape.strokeWidth}
          />
        );
      case SHAPES.RECTANGLE:
        const x = Math.min(startPoint.x, endPoint.x);
        const y = Math.min(startPoint.y, endPoint.y);
        const width = Math.abs(endPoint.x - startPoint.x);
        const height = Math.abs(endPoint.y - startPoint.y);
        
        return (
          <Rect
            key={shape.id}
            x={x}
            y={y}
            width={width}
            height={height}
            stroke={shape.color}
            strokeWidth={shape.strokeWidth}
            fill="none"
          />
        );
      case SHAPES.CIRCLE:
        const radius = Math.sqrt(
          Math.pow(endPoint.x - startPoint.x, 2) + Math.pow(endPoint.y - startPoint.y, 2)
        );
        
        return (
          <Circle
            key={shape.id}
            cx={startPoint.x}
            cy={startPoint.y}
            r={radius}
            stroke={shape.color}
            strokeWidth={shape.strokeWidth}
            fill="none"
          />
        );
      case SHAPES.TRIANGLE:
        const midX = (startPoint.x + endPoint.x) / 2;
        
        return (
          <Polygon
            key={shape.id}
            points={`${midX},${startPoint.y} ${startPoint.x},${endPoint.y} ${endPoint.x},${endPoint.y}`}
            stroke={shape.color}
            strokeWidth={shape.strokeWidth}
            fill="none"
          />
        );
      case SHAPES.ARROW:
        const angle = Math.atan2(endPoint.y - startPoint.y, endPoint.x - startPoint.x);
        const arrowLength = 15;
        const arrowAngle = Math.PI / 6; // 30度
        
        const arrowPoint1X = endPoint.x - arrowLength * Math.cos(angle - arrowAngle);
        const arrowPoint1Y = endPoint.y - arrowLength * Math.sin(angle - arrowAngle);
        const arrowPoint2X = endPoint.x - arrowLength * Math.cos(angle + arrowAngle);
        const arrowPoint2Y = endPoint.y - arrowLength * Math.sin(angle + arrowAngle);
        
        return (
          <G key={shape.id}>
            <Line
              x1={startPoint.x}
              y1={startPoint.y}
              x2={endPoint.x}
              y2={endPoint.y}
              stroke={shape.color}
              strokeWidth={shape.strokeWidth}
            />
            <Polygon
              points={`${endPoint.x},${endPoint.y} ${arrowPoint1X},${arrowPoint1Y} ${arrowPoint2X},${arrowPoint2Y}`}
              fill={shape.color}
              stroke={shape.color}
            />
          </G>
        );
      default:
        return null;
    }
  };
  
  // 渲染当前形状
  const renderCurrentShape = () => {
    if (!currentPath || currentPath.tool !== TOOLS.SHAPE || currentPath.points.length < 2) {
      return null;
    }
    
    return renderShape(currentPath);
  };
  
  // 动画样式
  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value }
      ]
    };
  });
  
  // 返回与DrawingCanvas兼容的接口
  return {
    canvasRef,
    paths,
    canUndo: paths.length > 0,
    canRedo: redoStack.length > 0,
    handleToolChange,
    handleColorChange,
    handleStrokeWidthChange,
    handleUndo,
    handleRedo,
    handleClear,
    handleScreenshot,
    render: () => (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <GestureDetector gesture={panGesture}>
          <Animated.View
            ref={canvasRef}
            style={[styles.canvas, { width, height, backgroundColor }, animatedStyle]}
          >
            <Svg ref={svgRef} width="100%" height="100%">
              {/* 已完成的路径 */}
              {paths.map((item) => {
                if (item.tool === TOOLS.SHAPE) {
                  return renderShape(item);
                } else {
                  return (
                    <Path
                      key={item.id}
                      d={item.path}
                      stroke={item.color}
                      strokeWidth={item.strokeWidth}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                      strokeOpacity={item.tool === TOOLS.HIGHLIGHTER ? 0.5 : 1}
                    />
                  );
                }
              })}
              
              {/* 当前绘制的路径 */}
              {currentPath && currentPath.tool !== TOOLS.SHAPE && (
                <Path
                  d={currentPath.path}
                  stroke={currentPath.color}
                  strokeWidth={currentPath.strokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                  strokeOpacity={currentPath.tool === TOOLS.HIGHLIGHTER ? 0.5 : 1}
                />
              )}
              
              {/* 当前绘制的形状 */}
              {renderCurrentShape()}
            </Svg>
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    ),
  };
};

const styles = StyleSheet.create({
  canvas: {
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    borderRadius: 16,
    margin: 8,
    backgroundColor: 'rgba(255,255,255,0.9)',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
});

export default InfiniteDrawingCanvas;
