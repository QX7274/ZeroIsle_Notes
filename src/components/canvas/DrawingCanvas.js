import React, { useRef, useState, useEffect } from 'react';
import { View, StyleSheet, PanResponder, Dimensions } from 'react-native';
import Svg, { Path, Rect, Circle, Polygon, Line, Text as SvgText } from 'react-native-svg';
import { captureRef } from 'react-native-view-shot';

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

const DrawingCanvas = ({
  width = Dimensions.get('window').width,
  height = 300,
  backgroundColor = 'transparent',
  onStrokeEnd,
  onScreenshotTaken,
}) => {
  // 绘图状态
  const [paths, setPaths] = useState([]);
  const [currentPath, setCurrentPath] = useState(null);
  const [currentPoints, setCurrentPoints] = useState([]);
  const [history, setHistory] = useState([]);
  const [redoStack, setRedoStack] = useState([]);

  // 绘图设置
  const [tool, setTool] = useState({ type: TOOLS.PEN });
  const [color, setColor] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(2);

  // 引用
  const canvasRef = useRef(null);

  // 创建路径字符串
  const createPathString = (points) => {
    if (points.length < 1) return '';

    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      path += ` L ${points[i].x} ${points[i].y}`;
    }
    return path;
  };

  // 创建平滑路径字符串
  const createSmoothPathString = (points) => {
    if (points.length < 2) return createPathString(points);

    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length - 1; i++) {
      const xc = (points[i].x + points[i + 1].x) / 2;
      const yc = (points[i].y + points[i + 1].y) / 2;
      path += ` Q ${points[i].x} ${points[i].y}, ${xc} ${yc}`;
    }

    const lastPoint = points[points.length - 1];
    path += ` L ${lastPoint.x} ${lastPoint.y}`;
    return path;
  };

  // 创建形状路径
  const createShapePath = (startPoint, endPoint, shapeType) => {
    switch (shapeType) {
      case SHAPES.LINE:
        return {
          type: 'line',
          x1: startPoint.x,
          y1: startPoint.y,
          x2: endPoint.x,
          y2: endPoint.y,
        };
      case SHAPES.RECTANGLE:
        return {
          type: 'rectangle',
          x: Math.min(startPoint.x, endPoint.x),
          y: Math.min(startPoint.y, endPoint.y),
          width: Math.abs(endPoint.x - startPoint.x),
          height: Math.abs(endPoint.y - startPoint.y),
        };
      case SHAPES.CIRCLE:
        const radius = Math.sqrt(
          Math.pow(endPoint.x - startPoint.x, 2) + Math.pow(endPoint.y - startPoint.y, 2)
        );
        return {
          type: 'circle',
          cx: startPoint.x,
          cy: startPoint.y,
          r: radius,
        };
      case SHAPES.TRIANGLE:
        return {
          type: 'triangle',
          points: `${startPoint.x},${endPoint.y} ${(startPoint.x + endPoint.x) / 2},${startPoint.y} ${endPoint.x},${endPoint.y}`,
        };
      case SHAPES.ARROW:
        const angle = Math.atan2(endPoint.y - startPoint.y, endPoint.x - startPoint.x);
        const arrowLength = 15;
        const arrowAngle = Math.PI / 6; // 30度

        const arrowPoint1 = {
          x: endPoint.x - arrowLength * Math.cos(angle - arrowAngle),
          y: endPoint.y - arrowLength * Math.sin(angle - arrowAngle),
        };

        const arrowPoint2 = {
          x: endPoint.x - arrowLength * Math.cos(angle + arrowAngle),
          y: endPoint.y - arrowLength * Math.sin(angle + arrowAngle),
        };

        return {
          type: 'arrow',
          line: {
            x1: startPoint.x,
            y1: startPoint.y,
            x2: endPoint.x,
            y2: endPoint.y,
          },
          arrowHead: `${endPoint.x},${endPoint.y} ${arrowPoint1.x},${arrowPoint1.y} ${arrowPoint2.x},${arrowPoint2.y}`,
        };
      default:
        return null;
    }
  };

  // 处理工具变更
  const handleToolChange = (newTool) => {
    setTool(newTool);
  };

  // 处理颜色变更
  const handleColorChange = (newColor) => {
    setColor(newColor);
  };

  // 处理笔触粗细变更
  const handleStrokeWidthChange = (newWidth) => {
    setStrokeWidth(newWidth);
  };

  // 撤销
  const handleUndo = () => {
    if (paths.length === 0) return;

    const newPaths = [...paths];
    const removedPath = newPaths.pop();

    setRedoStack([...redoStack, removedPath]);
    setPaths(newPaths);
    setHistory([...history, newPaths]);
  };

  // 重做
  const handleRedo = () => {
    if (redoStack.length === 0) return;

    const newRedoStack = [...redoStack];
    const pathToRestore = newRedoStack.pop();

    const newPaths = [...paths, pathToRestore];
    setRedoStack(newRedoStack);
    setPaths(newPaths);
    setHistory([...history, newPaths]);
  };

  // 清除画布
  const handleClear = () => {
    setHistory([...history, paths]);
    setPaths([]);
    setRedoStack([]);
  };

  // 截图
  const handleScreenshot = async () => {
    try {
      if (canvasRef.current) {
        const uri = await captureRef(canvasRef, {
          format: 'png',
          quality: 1,
        });

        if (onScreenshotTaken) {
          onScreenshotTaken(uri);
        }
      }
    } catch (error) {
      console.error('截图失败:', error);
    }
  };

  // 创建手势响应器
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,

      onPanResponderGrant: (evt, gestureState) => {
        const { locationX, locationY } = evt.nativeEvent;

        // 保存当前路径状态用于撤销/重做
        setHistory([...history, paths]);
        setRedoStack([]);

        if (tool.type === TOOLS.SHAPE) {
          // 形状绘制开始点
          setCurrentPoints([{ x: locationX, y: locationY }]);
        } else if (tool.type === TOOLS.ERASER) {
          // 橡皮擦
          const newPath = {
            id: Date.now().toString(),
            color: backgroundColor,
            strokeWidth: strokeWidth * 2,
            path: `M ${locationX} ${locationY}`,
            points: [{ x: locationX, y: locationY }],
            tool: TOOLS.ERASER,
          };
          setCurrentPath(newPath);
          setCurrentPoints([{ x: locationX, y: locationY }]);
        } else {
          // 其他绘图工具
          const newPath = {
            id: Date.now().toString(),
            color: color,
            strokeWidth,
            path: `M ${locationX} ${locationY}`,
            points: [{ x: locationX, y: locationY }],
            tool: tool.type,
          };
          setCurrentPath(newPath);
          setCurrentPoints([{ x: locationX, y: locationY }]);
        }
      },

      onPanResponderMove: (evt, gestureState) => {
        const { locationX, locationY } = evt.nativeEvent;

        if (tool.type === TOOLS.SHAPE) {
          // 形状绘制，只需要起点和终点
          if (currentPoints.length === 1) {
            setCurrentPoints([...currentPoints, { x: locationX, y: locationY }]);
          } else {
            const newPoints = [...currentPoints];
            newPoints[1] = { x: locationX, y: locationY };
            setCurrentPoints(newPoints);
          }
        } else {
          // 其他绘图工具
          const newPoints = [...currentPoints, { x: locationX, y: locationY }];
          setCurrentPoints(newPoints);

          let pathString;
          if (tool.type === TOOLS.PEN) {
            pathString = createSmoothPathString(newPoints);
          } else {
            pathString = createPathString(newPoints);
          }

          setCurrentPath({
            ...currentPath,
            path: pathString,
            points: newPoints,
          });
        }
      },

      onPanResponderRelease: () => {
        if (tool.type === TOOLS.SHAPE && currentPoints.length >= 2) {
          // 完成形状绘制
          const startPoint = currentPoints[0];
          const endPoint = currentPoints[currentPoints.length - 1];
          const shapePath = createShapePath(startPoint, endPoint, tool.shape);

          if (shapePath) {
            const newShape = {
              id: Date.now().toString(),
              color: color,
              strokeWidth,
              shape: shapePath,
              tool: tool.type,
              shapeType: tool.shape,
            };

            setPaths([...paths, newShape]);
            if (onStrokeEnd) {
              onStrokeEnd(newShape);
            }
          }
        } else if (currentPath) {
          // 完成其他绘图
          setPaths([...paths, currentPath]);
          if (onStrokeEnd) {
            onStrokeEnd(currentPath);
          }
        }

        setCurrentPath(null);
        setCurrentPoints([]);
      },
    })
  ).current;

  // 渲染形状
  const renderShape = (shape) => {
    if (!shape || !shape.shape) return null;

    switch (shape.shapeType) {
      case SHAPES.LINE:
        return (
          <Line
            key={shape.id}
            x1={shape.shape.x1}
            y1={shape.shape.y1}
            x2={shape.shape.x2}
            y2={shape.shape.y2}
            stroke={shape.color}
            strokeWidth={shape.strokeWidth}
          />
        );
      case SHAPES.RECTANGLE:
        return (
          <Rect
            key={shape.id}
            x={shape.shape.x}
            y={shape.shape.y}
            width={shape.shape.width}
            height={shape.shape.height}
            stroke={shape.color}
            strokeWidth={shape.strokeWidth}
            fill="none"
          />
        );
      case SHAPES.CIRCLE:
        return (
          <Circle
            key={shape.id}
            cx={shape.shape.cx}
            cy={shape.shape.cy}
            r={shape.shape.r}
            stroke={shape.color}
            strokeWidth={shape.strokeWidth}
            fill="none"
          />
        );
      case SHAPES.TRIANGLE:
        return (
          <Polygon
            key={shape.id}
            points={shape.shape.points}
            stroke={shape.color}
            strokeWidth={shape.strokeWidth}
            fill="none"
          />
        );
      case SHAPES.ARROW:
        return (
          <React.Fragment key={shape.id}>
            <Line
              x1={shape.shape.line.x1}
              y1={shape.shape.line.y1}
              x2={shape.shape.line.x2}
              y2={shape.shape.line.y2}
              stroke={shape.color}
              strokeWidth={shape.strokeWidth}
            />
            <Polygon
              points={shape.shape.arrowHead}
              fill={shape.color}
            />
          </React.Fragment>
        );
      default:
        return null;
    }
  };

  // 渲染当前形状
  const renderCurrentShape = () => {
    if (tool.type !== TOOLS.SHAPE || currentPoints.length < 2) return null;

    const startPoint = currentPoints[0];
    const endPoint = currentPoints[currentPoints.length - 1];
    const shapePath = createShapePath(startPoint, endPoint, tool.shape);

    if (!shapePath) return null;

    switch (tool.shape) {
      case SHAPES.LINE:
        return (
          <Line
            x1={shapePath.x1}
            y1={shapePath.y1}
            x2={shapePath.x2}
            y2={shapePath.y2}
            stroke={color}
            strokeWidth={strokeWidth}
          />
        );
      case SHAPES.RECTANGLE:
        return (
          <Rect
            x={shapePath.x}
            y={shapePath.y}
            width={shapePath.width}
            height={shapePath.height}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="none"
          />
        );
      case SHAPES.CIRCLE:
        return (
          <Circle
            cx={shapePath.cx}
            cy={shapePath.cy}
            r={shapePath.r}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="none"
          />
        );
      case SHAPES.TRIANGLE:
        return (
          <Polygon
            points={shapePath.points}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="none"
          />
        );
      case SHAPES.ARROW:
        return (
          <React.Fragment>
            <Line
              x1={shapePath.line.x1}
              y1={shapePath.line.y1}
              x2={shapePath.line.x2}
              y2={shapePath.line.y2}
              stroke={color}
              strokeWidth={strokeWidth}
            />
            <Polygon
              points={shapePath.arrowHead}
              fill={color}
            />
          </React.Fragment>
        );
      default:
        return null;
    }
  };

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
      <View
        ref={canvasRef}
        style={[styles.canvas, { width, height, backgroundColor }]}
        {...panResponder.panHandlers}
      >
        <Svg width="100%" height="100%">
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
          {currentPath && (
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
      </View>
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

export default DrawingCanvas;
