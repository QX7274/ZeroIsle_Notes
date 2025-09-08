import React, { forwardRef, useRef, useCallback, useState, useEffect, useMemo, useImperativeHandle } from 'react';
import { View, PanResponder, Dimensions } from 'react-native';
import Svg, { Path, G, Circle, Rect, Line, Polygon } from 'react-native-svg';
import { useTheme } from '@react-navigation/native';

// 导入必要的类
import { AdvancedStrokeData } from './AdvancedStrokeData';
import { ErrorHandlingManager } from '../../services/handwriting/ErrorHandlingManager';
import { HandwritingPerformanceMonitor } from '../../services/handwriting/HandwritingPerformanceMonitor';
import { ScaleManager } from '../../services/handwriting/ScaleManager';
import { HandwritingPersistence } from '../../services/handwriting/HandwritingPersistence';
import handwritingFileManager from '../../services/handwriting/HandwritingFileManager';
import { ScaleConsistencyManager } from '../../services/handwriting/ScaleConsistencyManager';
import { PerformanceOptimizer } from '../../services/handwriting/PerformanceOptimizer';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

/**
 * 通用手写引擎组件 - 简化版本，使用手动模式切换
 */
const UniversalHandwritingEngine = forwardRef(({
  // 基础配置
  width = screenWidth,
  height = screenHeight,
  backgroundColor = 'transparent',
  onStrokeStart,
  onStrokeUpdate,
  onStrokeEnd,
  onStrokesChange,
  tool = 'pen',
  strokeColor = '#000000',
  strokeWidth = 2,
  opacity = 1,
  disabled = false,
  // 高级功能
  enablePressure = true,
  enableTilt = true,
  enableEraser = true,
  enableShapes = true,
  // 缩放和变换
  initialScale = 1,
  offsetX = 0,
  offsetY = 0,
  // 文件类型和存储
  fileType = 'note', // 'pdf', 'note', 'canvas'
  documentId = null, // 文档ID，用于关联存储
  pageNumber = 1, // 页码
  filePath = null, // 文件路径（用于HandwritingFileManager）
  fileName = null, // 文件名（用于HandwritingFileManager）
  autoSave = true, // 自动保存
  autoSaveInterval = 2000, // 自动保存间隔
  // 文件类型特定配置
  infiniteCanvas = false, // 是否为无限画布
  pdfPageBounds = null, // PDF页面边界
  noteContentBounds = null, // 笔记内容边界
  canvasGridSize = 20, // 画布网格大小
  enableGrid = false, // 是否显示网格
  // 手写识别相关
  enableHandwritingRecognition = false, // 是否启用手写识别
  recognitionLanguage = 'zh-CN', // 识别语言
  // 性能优化
  maxStrokesInMemory = 500, // 内存中最大笔迹数
  enableStrokeOptimization = true, // 启用笔迹优化
  enableRealTimeRendering = true, // 启用实时渲染
  style,
  // 手动模式控制（从外部传入）
  isManualFingerMode = false,
  onModeToggle,
  // PDF边界信息
  pdfBounds = null,
  // 原始工具信息
  originalTool = null
}, ref) => {
  const { colors } = useTheme();
  
  // 状态管理
  const strokesRef = useRef([]);
  const currentStrokeRef = useRef(null);
  const isDrawingRef = useRef(false);
  const autoSaveTimerRef = useRef(null);

  // 错误处理管理器
  const errorHandlerRef = useRef(new ErrorHandlingManager());

  // 添加状态来触发实时渲染
  const [renderTrigger, setRenderTrigger] = useState(0);
  const [currentStroke, setCurrentStroke] = useState(null);

  // 形状识别相关状态
  const [isShapeMode, setIsShapeMode] = useState(false);
  const [pendingShape, setPendingShape] = useState(null);
  const [shapeTimeout, setShapeTimeout] = useState(null);
  const [lastMoveTime, setLastMoveTime] = useState(null);
  const [isStayingStill, setIsStayingStill] = useState(false);

  // 橡皮擦状态
  const [eraserPosition, setEraserPosition] = useState(null);

  // 形状绘制模式状态
  const [isShapeDrawingMode, setIsShapeDrawingMode] = useState(false);
  const [shapeDrawingType, setShapeDrawingType] = useState(null);
  const [shapeStartPoint, setShapeStartPoint] = useState(null);
  const [currentShapePreview, setCurrentShapePreview] = useState(null);

  // 性能监控
  const performanceMonitorRef = useRef(new HandwritingPerformanceMonitor());



  // 持久化管理器
  const persistenceRef = useRef(new HandwritingPersistence());
  const handwritingFileManagerRef = useRef(handwritingFileManager);

  // 缩放一致性管理器
  const scaleConsistencyRef = useRef(new ScaleConsistencyManager());

  // 性能优化器
  const performanceOptimizerRef = useRef(new PerformanceOptimizer());

  // 错误处理包装器
  const withErrorHandling = useCallback((fn, options = {}) => {
    return (...args) => {
      try {
        return fn(...args);
      } catch (error) {
        return errorHandlerRef.current.handleError(error, {
          context: options.context || 'unknown',
          args: options.includeArgs ? args : undefined
        });
      }
    };
  }, []);

  // 坐标验证
  const isCoordinateValid = useCallback((x, y) => {
    return typeof x === 'number' && typeof y === 'number' &&
           !isNaN(x) && !isNaN(y) &&
           isFinite(x) && isFinite(y);
  }, []);

  // 边界检测
  const isWithinBounds = useCallback((x, y) => {
    if (!pdfBounds) return true; // 没有边界限制时允许所有坐标

    const margin = 20; // 边界内缩20像素
    return x >= margin &&
           y >= margin &&
           x <= (pdfBounds.width - margin) &&
           y <= (pdfBounds.height - margin);
  }, [pdfBounds]);

  // 形状识别函数
  const recognizeShape = useCallback((stroke) => {
    if (!stroke || !stroke.points || stroke.points.length < 3) {
      return null;
    }

    const points = stroke.points;
    const firstPoint = points[0];
    const lastPoint = points[points.length - 1];

    // 计算边界框
    const minX = Math.min(...points.map(p => p.x));
    const maxX = Math.max(...points.map(p => p.x));
    const minY = Math.min(...points.map(p => p.y));
    const maxY = Math.max(...points.map(p => p.y));

    const width = maxX - minX;
    const height = maxY - minY;
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    // 检测圆形
    if (isCircleShape(points, centerX, centerY, Math.min(width, height) / 2)) {
      return {
        type: 'circle',
        center: { x: centerX, y: centerY },
        radius: Math.min(width, height) / 2,
        bounds: { minX, maxX, minY, maxY }
      };
    }

    // 检测矩形
    if (isRectangleShape(points, minX, maxX, minY, maxY)) {
      return {
        type: 'rectangle',
        bounds: { minX, maxX, minY, maxY },
        width,
        height
      };
    }

    // 检测直线
    if (isLineShape(points)) {
      return {
        type: 'line',
        start: firstPoint,
        end: lastPoint
      };
    }

    // 检测椭圆
    if (isEllipseShape(points, centerX, centerY, width, height)) {
      return {
        type: 'ellipse',
        center: { x: centerX, y: centerY },
        radiusX: width / 2,
        radiusY: height / 2,
        bounds: { minX, maxX, minY, maxY }
      };
    }

    // 检测三角形
    const triangle = detectTriangle(points);
    if (triangle) {
      return {
        type: 'triangle',
        points: triangle.points
      };
    }

    // 检测箭头
    const arrow = detectArrow(points);
    if (arrow) {
      return {
        type: 'arrow',
        start: arrow.start,
        end: arrow.end,
        headSize: arrow.headSize
      };
    }

    // 检测星形
    const star = detectStar(points, centerX, centerY);
    if (star) {
      return {
        type: 'star',
        center: { x: centerX, y: centerY },
        outerRadius: star.outerRadius,
        innerRadius: star.innerRadius,
        points: star.pointCount
      };
    }

    return null;
  }, []);

  // 检测是否为圆形
  const isCircleShape = useCallback((points, centerX, centerY, radius) => {
    let deviationSum = 0;
    for (const point of points) {
      const distance = Math.sqrt(Math.pow(point.x - centerX, 2) + Math.pow(point.y - centerY, 2));
      deviationSum += Math.abs(distance - radius);
    }
    const avgDeviation = deviationSum / points.length;
    return avgDeviation < radius * 0.2; // 允许20%的偏差
  }, []);

  // 检测是否为矩形
  const isRectangleShape = useCallback((points, minX, maxX, minY, maxY) => {
    const tolerance = 15; // 容差
    let cornerCount = 0;

    // 检查是否有足够的点接近四个角
    const corners = [
      { x: minX, y: minY },
      { x: maxX, y: minY },
      { x: maxX, y: maxY },
      { x: minX, y: maxY }
    ];

    for (const corner of corners) {
      const hasNearbyPoint = points.some(point =>
        Math.abs(point.x - corner.x) < tolerance && Math.abs(point.y - corner.y) < tolerance
      );
      if (hasNearbyPoint) cornerCount++;
    }

    return cornerCount >= 3; // 至少3个角被识别
  }, []);

  // 检测是否为直线
  const isLineShape = useCallback((points) => {
    if (points.length < 2) return false;

    const firstPoint = points[0];
    const lastPoint = points[points.length - 1];

    // 计算所有点到直线的距离
    let maxDeviation = 0;
    for (const point of points) {
      const deviation = pointToLineDistance(point, firstPoint, lastPoint);
      maxDeviation = Math.max(maxDeviation, deviation);
    }

    return maxDeviation < 10; // 最大偏差小于10像素
  }, []);

  // 计算点到直线的距离
  const pointToLineDistance = useCallback((point, lineStart, lineEnd) => {
    const A = point.x - lineStart.x;
    const B = point.y - lineStart.y;
    const C = lineEnd.x - lineStart.x;
    const D = lineEnd.y - lineStart.y;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;

    if (lenSq === 0) return Math.sqrt(A * A + B * B);

    const param = dot / lenSq;

    let xx, yy;

    if (param < 0) {
      xx = lineStart.x;
      yy = lineStart.y;
    } else if (param > 1) {
      xx = lineEnd.x;
      yy = lineEnd.y;
    } else {
      xx = lineStart.x + param * C;
      yy = lineStart.y + param * D;
    }

    const dx = point.x - xx;
    const dy = point.y - yy;

    return Math.sqrt(dx * dx + dy * dy);
  }, []);

  // 检测椭圆
  const isEllipseShape = useCallback((points, centerX, centerY, width, height) => {
    const radiusX = width / 2;
    const radiusY = height / 2;

    let deviationSum = 0;
    for (const point of points) {
      const normalizedX = (point.x - centerX) / radiusX;
      const normalizedY = (point.y - centerY) / radiusY;
      const ellipseValue = normalizedX * normalizedX + normalizedY * normalizedY;
      deviationSum += Math.abs(ellipseValue - 1);
    }

    const avgDeviation = deviationSum / points.length;
    return avgDeviation < 0.3 && Math.abs(width - height) > 20; // 椭圆需要有明显的长短轴差异
  }, []);

  // 检测三角形
  const detectTriangle = useCallback((points) => {
    if (points.length < 10) return null;

    // 寻找三个主要的角点
    const corners = findCorners(points, 3);
    if (corners.length !== 3) return null;

    // 验证是否形成三角形
    const distances = [
      Math.sqrt(Math.pow(corners[1].x - corners[0].x, 2) + Math.pow(corners[1].y - corners[0].y, 2)),
      Math.sqrt(Math.pow(corners[2].x - corners[1].x, 2) + Math.pow(corners[2].y - corners[1].y, 2)),
      Math.sqrt(Math.pow(corners[0].x - corners[2].x, 2) + Math.pow(corners[0].y - corners[2].y, 2))
    ];

    // 检查是否满足三角形不等式
    const [a, b, c] = distances.sort((x, y) => x - y);
    if (a + b > c * 0.8) { // 允许一些误差
      return { points: corners };
    }

    return null;
  }, []);

  // 检测箭头
  const detectArrow = useCallback((points) => {
    if (points.length < 15) return null;

    const firstPoint = points[0];
    const lastPoint = points[points.length - 1];

    // 检查是否有箭头形状的特征
    const mainLineLength = Math.sqrt(
      Math.pow(lastPoint.x - firstPoint.x, 2) +
      Math.pow(lastPoint.y - firstPoint.y, 2)
    );

    if (mainLineLength < 50) return null;

    // 检查末端是否有箭头特征
    const endPoints = points.slice(-Math.min(10, points.length));
    const hasArrowHead = checkArrowHead(endPoints, lastPoint);

    if (hasArrowHead) {
      return {
        start: firstPoint,
        end: lastPoint,
        headSize: mainLineLength * 0.1
      };
    }

    return null;
  }, []);

  // 检测星形
  const detectStar = useCallback((points, centerX, centerY) => {
    if (points.length < 20) return null;

    // 计算到中心的距离变化
    const distances = points.map(point =>
      Math.sqrt(Math.pow(point.x - centerX, 2) + Math.pow(point.y - centerY, 2))
    );

    // 寻找距离的峰值和谷值
    const peaks = [];
    const valleys = [];

    for (let i = 1; i < distances.length - 1; i++) {
      if (distances[i] > distances[i-1] && distances[i] > distances[i+1]) {
        peaks.push(distances[i]);
      }
      if (distances[i] < distances[i-1] && distances[i] < distances[i+1]) {
        valleys.push(distances[i]);
      }
    }

    // 星形应该有明显的峰谷交替
    if (peaks.length >= 3 && valleys.length >= 3) {
      const avgPeak = peaks.reduce((sum, p) => sum + p, 0) / peaks.length;
      const avgValley = valleys.reduce((sum, v) => sum + v, 0) / valleys.length;

      if (avgPeak / avgValley > 1.5) { // 峰谷比例足够大
        return {
          outerRadius: avgPeak,
          innerRadius: avgValley,
          pointCount: peaks.length
        };
      }
    }

    return null;
  }, []);

  // 辅助函数：寻找角点
  const findCorners = useCallback((points, maxCorners) => {
    const corners = [];
    const threshold = 30; // 角度阈值

    for (let i = 2; i < points.length - 2; i++) {
      const prev = points[i - 2];
      const curr = points[i];
      const next = points[i + 2];

      // 计算角度变化
      const angle1 = Math.atan2(curr.y - prev.y, curr.x - prev.x);
      const angle2 = Math.atan2(next.y - curr.y, next.x - curr.x);
      let angleDiff = Math.abs(angle2 - angle1) * 180 / Math.PI;

      if (angleDiff > 180) angleDiff = 360 - angleDiff;

      if (angleDiff > threshold) {
        corners.push(curr);
        if (corners.length >= maxCorners) break;
      }
    }

    return corners;
  }, []);

  // 辅助函数：检查箭头头部
  const checkArrowHead = useCallback((endPoints, tip) => {
    if (endPoints.length < 3) return false;

    // 检查末端点是否形成V形
    const beforeTip = endPoints[endPoints.length - 3];
    const angle = Math.atan2(tip.y - beforeTip.y, tip.x - beforeTip.x);

    // 简化的箭头检测
    return true; // 暂时简化
  }, []);

  // 创建形状笔迹
  const createShapeStroke = useCallback((shape, style) => {
    const shapeStroke = new AdvancedStrokeData(style);

    switch (shape.type) {
      case 'circle':
        // 创建圆形的点
        const { center, radius } = shape;
        const circlePoints = [];
        for (let i = 0; i <= 64; i++) {
          const angle = (i / 64) * 2 * Math.PI;
          const x = center.x + radius * Math.cos(angle);
          const y = center.y + radius * Math.sin(angle);
          circlePoints.push({ x, y, pressure: 1, tilt: 0, azimuth: 0, force: 0 });
        }
        shapeStroke.points = circlePoints;
        break;

      case 'rectangle':
        // 创建矩形的点
        const { bounds } = shape;
        const rectPoints = [
          { x: bounds.minX, y: bounds.minY, pressure: 1, tilt: 0, azimuth: 0, force: 0 },
          { x: bounds.maxX, y: bounds.minY, pressure: 1, tilt: 0, azimuth: 0, force: 0 },
          { x: bounds.maxX, y: bounds.maxY, pressure: 1, tilt: 0, azimuth: 0, force: 0 },
          { x: bounds.minX, y: bounds.maxY, pressure: 1, tilt: 0, azimuth: 0, force: 0 },
          { x: bounds.minX, y: bounds.minY, pressure: 1, tilt: 0, azimuth: 0, force: 0 }
        ];
        shapeStroke.points = rectPoints;
        break;

      case 'line':
        // 创建直线的点
        const { start, end } = shape;
        const linePoints = [
          { x: start.x, y: start.y, pressure: 1, tilt: 0, azimuth: 0, force: 0 },
          { x: end.x, y: end.y, pressure: 1, tilt: 0, azimuth: 0, force: 0 }
        ];
        shapeStroke.points = linePoints;
        break;

      case 'ellipse':
        // 创建椭圆的点
        const { center: ellipseCenter, radiusX, radiusY } = shape;
        const ellipsePoints = [];
        for (let i = 0; i <= 64; i++) {
          const angle = (i / 64) * 2 * Math.PI;
          const x = ellipseCenter.x + radiusX * Math.cos(angle);
          const y = ellipseCenter.y + radiusY * Math.sin(angle);
          ellipsePoints.push({ x, y, pressure: 1, tilt: 0, azimuth: 0, force: 0 });
        }
        shapeStroke.points = ellipsePoints;
        break;

      case 'triangle':
        // 创建三角形的点
        const trianglePoints = [
          ...shape.points.map(p => ({ x: p.x, y: p.y, pressure: 1, tilt: 0, azimuth: 0, force: 0 })),
          { x: shape.points[0].x, y: shape.points[0].y, pressure: 1, tilt: 0, azimuth: 0, force: 0 } // 闭合
        ];
        shapeStroke.points = trianglePoints;
        break;

      case 'arrow':
        // 创建箭头的点
        const { start: arrowStart, end: arrowEnd, headSize } = shape;
        const arrowPoints = [
          { x: arrowStart.x, y: arrowStart.y, pressure: 1, tilt: 0, azimuth: 0, force: 0 },
          { x: arrowEnd.x, y: arrowEnd.y, pressure: 1, tilt: 0, azimuth: 0, force: 0 }
        ];

        // 添加箭头头部
        const arrowAngle = Math.atan2(arrowEnd.y - arrowStart.y, arrowEnd.x - arrowStart.x);
        const headAngle = Math.PI / 6; // 30度

        const head1X = arrowEnd.x - headSize * Math.cos(arrowAngle - headAngle);
        const head1Y = arrowEnd.y - headSize * Math.sin(arrowAngle - headAngle);
        const head2X = arrowEnd.x - headSize * Math.cos(arrowAngle + headAngle);
        const head2Y = arrowEnd.y - headSize * Math.sin(arrowAngle + headAngle);

        arrowPoints.push(
          { x: head1X, y: head1Y, pressure: 1, tilt: 0, azimuth: 0, force: 0 },
          { x: arrowEnd.x, y: arrowEnd.y, pressure: 1, tilt: 0, azimuth: 0, force: 0 },
          { x: head2X, y: head2Y, pressure: 1, tilt: 0, azimuth: 0, force: 0 }
        );

        shapeStroke.points = arrowPoints;
        break;

      case 'star':
        // 创建星形的点
        const { center: starCenter, outerRadius, innerRadius, points: pointCount } = shape;
        const starPoints = [];

        for (let i = 0; i < pointCount * 2; i++) {
          const angle = (i / (pointCount * 2)) * 2 * Math.PI - Math.PI / 2;
          const radius = i % 2 === 0 ? outerRadius : innerRadius;
          const x = starCenter.x + radius * Math.cos(angle);
          const y = starCenter.y + radius * Math.sin(angle);
          starPoints.push({ x, y, pressure: 1, tilt: 0, azimuth: 0, force: 0 });
        }

        // 闭合星形
        if (starPoints.length > 0) {
          starPoints.push({ ...starPoints[0] });
        }

        shapeStroke.points = starPoints;
        break;

      default:
        return null;
    }

    // 更新边界框
    shapeStroke.points.forEach(point => {
      shapeStroke.updateBounds(point.x, point.y);
    });

    return shapeStroke;
  }, []);

  // 形状绘制开始
  const handleShapeDrawingStart = useCallback((event, shapeType) => {
    const { x, y } = event;
    if (!isCoordinateValid(x, y)) return;

    const transformed = transformCoordinates(x, y);
    setIsShapeDrawingMode(true);
    setShapeDrawingType(shapeType);
    setShapeStartPoint(transformed);
    setCurrentShapePreview(null);

    console.log('📐 开始绘制形状:', shapeType, '起点:', transformed);
  }, [isCoordinateValid, transformCoordinates]);

  // 形状绘制更新
  const handleShapeDrawingUpdate = useCallback((event) => {
    if (!isShapeDrawingMode || !shapeStartPoint) return;

    const { x, y } = event;
    if (!isCoordinateValid(x, y)) return;

    const transformed = transformCoordinates(x, y);

    // 创建预览形状
    const previewShape = createInteractiveShape(shapeDrawingType, shapeStartPoint, transformed);
    setCurrentShapePreview(previewShape);
  }, [isShapeDrawingMode, shapeStartPoint, shapeDrawingType, isCoordinateValid, transformCoordinates]);

  // 形状绘制结束
  const handleShapeDrawingEnd = useCallback(() => {
    if (!isShapeDrawingMode || !currentShapePreview) return;

    // 将预览形状转换为实际笔迹
    const shapeStroke = createShapeStroke(currentShapePreview, {
      color: strokeColor,
      width: strokeWidth,
      opacity,
      tool: shapeDrawingType,
      timestamp: Date.now()
    });

    if (shapeStroke) {
      strokesRef.current.push(shapeStroke);
      setRenderTrigger(prev => prev + 1);
      onStrokesChange?.(strokesRef.current);
      console.log('📐 完成形状绘制:', shapeDrawingType);
    }

    // 重置状态
    setIsShapeDrawingMode(false);
    setShapeDrawingType(null);
    setShapeStartPoint(null);
    setCurrentShapePreview(null);
    isDrawingRef.current = false;
  }, [isShapeDrawingMode, currentShapePreview, shapeDrawingType, strokeColor, strokeWidth, opacity, onStrokesChange]);

  // 创建交互式形状
  const createInteractiveShape = useCallback((shapeType, startPoint, endPoint) => {
    const width = Math.abs(endPoint.x - startPoint.x);
    const height = Math.abs(endPoint.y - startPoint.y);
    const centerX = (startPoint.x + endPoint.x) / 2;
    const centerY = (startPoint.y + endPoint.y) / 2;

    switch (shapeType) {
      case 'line':
        return {
          type: 'line',
          start: startPoint,
          end: endPoint
        };

      case 'rectangle':
        return {
          type: 'rectangle',
          bounds: {
            minX: Math.min(startPoint.x, endPoint.x),
            maxX: Math.max(startPoint.x, endPoint.x),
            minY: Math.min(startPoint.y, endPoint.y),
            maxY: Math.max(startPoint.y, endPoint.y)
          },
          width,
          height
        };

      case 'circle':
        const radius = Math.min(width, height) / 2;
        return {
          type: 'circle',
          center: { x: centerX, y: centerY },
          radius,
          bounds: {
            minX: centerX - radius,
            maxX: centerX + radius,
            minY: centerY - radius,
            maxY: centerY + radius
          }
        };

      case 'triangle':
        return {
          type: 'triangle',
          points: [
            { x: centerX, y: startPoint.y }, // 顶点
            { x: startPoint.x, y: endPoint.y }, // 左下
            { x: endPoint.x, y: endPoint.y } // 右下
          ]
        };

      case 'arrow':
        return {
          type: 'arrow',
          start: startPoint,
          end: endPoint,
          headSize: Math.min(width, height) * 0.2
        };

      default:
        return null;
    }
  }, []);

  // 渲染形状预览
  const renderShapePreview = useCallback((shape) => {
    const previewStyle = {
      stroke: strokeColor,
      strokeWidth: strokeWidth,
      fill: 'none',
      strokeDasharray: '5,5',
      opacity: 0.7
    };

    switch (shape.type) {
      case 'line':
        return (
          <Line
            x1={shape.start.x}
            y1={shape.start.y}
            x2={shape.end.x}
            y2={shape.end.y}
            {...previewStyle}
          />
        );

      case 'rectangle':
        return (
          <Rect
            x={shape.bounds.minX}
            y={shape.bounds.minY}
            width={shape.width}
            height={shape.height}
            {...previewStyle}
          />
        );

      case 'circle':
        return (
          <Circle
            cx={shape.center.x}
            cy={shape.center.y}
            r={shape.radius}
            {...previewStyle}
          />
        );

      case 'triangle':
        const points = shape.points.map(p => `${p.x},${p.y}`).join(' ');
        return (
          <Polygon
            points={points}
            {...previewStyle}
          />
        );

      case 'arrow':
        const arrowAngle = Math.atan2(shape.end.y - shape.start.y, shape.end.x - shape.start.x);
        const headAngle = Math.PI / 6;
        const head1X = shape.end.x - shape.headSize * Math.cos(arrowAngle - headAngle);
        const head1Y = shape.end.y - shape.headSize * Math.sin(arrowAngle - headAngle);
        const head2X = shape.end.x - shape.headSize * Math.cos(arrowAngle + headAngle);
        const head2Y = shape.end.y - shape.headSize * Math.sin(arrowAngle + headAngle);

        return (
          <G>
            <Line
              x1={shape.start.x}
              y1={shape.start.y}
              x2={shape.end.x}
              y2={shape.end.y}
              {...previewStyle}
            />
            <Line
              x1={shape.end.x}
              y1={shape.end.y}
              x2={head1X}
              y2={head1Y}
              {...previewStyle}
            />
            <Line
              x1={shape.end.x}
              y1={shape.end.y}
              x2={head2X}
              y2={head2Y}
              {...previewStyle}
            />
          </G>
        );

      default:
        return null;
    }
  }, [strokeColor, strokeWidth]);

  // 擦除功能 - 优化版本，减少卡顿
  const handleErase = useCallback((event) => {
    const { x, y } = event;
    if (!isCoordinateValid(x, y)) return;

    // 使用工具栏设置的橡皮擦大小，如果是橡皮擦工具则使用strokeWidth作为半径
    const eraseRadius = tool === 'eraser' ? strokeWidth : strokeWidth * 3;
    const transformed = transformCoordinates(x, y);

    // 更新橡皮擦位置用于视觉反馈
    setEraserPosition({ x: transformed.x, y: transformed.y, radius: eraseRadius });

    // 优化：使用简单的整体擦除而不是复杂的分割
    // 这样可以大大提高性能，减少卡顿
    const remainingStrokes = strokesRef.current.filter(stroke => {
      if (!stroke || !stroke.points) return true;

      // 快速检查：只检查笔迹的边界框是否与擦除区域相交
      const strokeBounds = getStrokeBounds(stroke);
      if (!strokeBounds) return true;

      // 如果边界框不相交，直接保留
      if (!isRectCircleIntersect(strokeBounds, transformed, eraseRadius)) {
        return true;
      }

      // 如果边界框相交，再进行精确检测
      return !stroke.points.some(point => {
        const distance = Math.sqrt(
          Math.pow(point.x - transformed.x, 2) +
          Math.pow(point.y - transformed.y, 2)
        );
        return distance <= eraseRadius;
      });
    });

    // 如果有笔迹被擦除，更新状态
    if (remainingStrokes.length !== strokesRef.current.length) {
      strokesRef.current = remainingStrokes;
      setRenderTrigger(prev => prev + 1);
      onStrokesChange?.(strokesRef.current);
      console.log(`🧽 擦除了 ${strokesRef.current.length - remainingStrokes.length} 个笔迹`);
    }
  }, [tool, strokeWidth, transformCoordinates, isCoordinateValid, onStrokesChange]);

  // 获取笔迹边界框
  const getStrokeBounds = useCallback((stroke) => {
    if (!stroke || !stroke.points || stroke.points.length === 0) return null;

    let minX = stroke.points[0].x;
    let maxX = stroke.points[0].x;
    let minY = stroke.points[0].y;
    let maxY = stroke.points[0].y;

    for (const point of stroke.points) {
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y);
      maxY = Math.max(maxY, point.y);
    }

    return { minX, maxX, minY, maxY };
  }, []);

  // 检查矩形和圆形是否相交
  const isRectCircleIntersect = useCallback((rect, circleCenter, circleRadius) => {
    // 找到矩形上距离圆心最近的点
    const closestX = Math.max(rect.minX, Math.min(circleCenter.x, rect.maxX));
    const closestY = Math.max(rect.minY, Math.min(circleCenter.y, rect.maxY));

    // 计算距离
    const distance = Math.sqrt(
      Math.pow(closestX - circleCenter.x, 2) +
      Math.pow(closestY - circleCenter.y, 2)
    );

    return distance <= circleRadius;
  }, []);

  // 分割笔迹方法 - 移除与擦除区域相交的部分（保留用于高精度擦除）
  const segmentStrokeByErase = useCallback((stroke, eraseCenter, eraseRadius) => {
    if (!stroke || !stroke.points || stroke.points.length === 0) {
      return [stroke];
    }

    const segments = [];
    let currentSegment = [];

    for (let i = 0; i < stroke.points.length; i++) {
      const point = stroke.points[i];
      const distance = Math.sqrt(
        Math.pow(point.x - eraseCenter.x, 2) +
        Math.pow(point.y - eraseCenter.y, 2)
      );

      if (distance > eraseRadius) {
        // 点在擦除区域外，添加到当前段
        currentSegment.push(point);
      } else {
        // 点在擦除区域内，结束当前段
        if (currentSegment.length > 1) {
          // 创建新的笔迹段
          const newStroke = {
            ...stroke,
            points: [...currentSegment],
            id: `${stroke.id}_segment_${segments.length}`
          };
          segments.push(newStroke);
        }
        currentSegment = [];
      }
    }

    // 处理最后一段
    if (currentSegment.length > 1) {
      const newStroke = {
        ...stroke,
        points: [...currentSegment],
        id: `${stroke.id}_segment_${segments.length}`
      };
      segments.push(newStroke);
    }

    // 如果没有有效段，返回空数组（完全擦除）
    // 如果只有一段且与原始笔迹相同，返回原始笔迹
    if (segments.length === 0) {
      return [];
    } else if (segments.length === 1 && segments[0].points.length === stroke.points.length) {
      return [stroke];
    } else {
      return segments;
    }
  }, []);

  // 坐标变换 - 考虑当前缩放状态
  const transformCoordinates = useCallback((x, y, scale = initialScale, offsetX_param = offsetX, offsetY_param = offsetY) => {
    if (!isCoordinateValid(x, y)) {
      throw new Error(`无效坐标: x=${x}, y=${y}`);
    }

    // 直接使用屏幕坐标，不进行额外变换
    // 让笔迹坐标与屏幕坐标保持一致
    return {
      x: x,
      y: y
    };
  }, [initialScale, offsetX, offsetY, isCoordinateValid]);

  // 开始绘制 - 添加边界检测和平滑处理
  const handleStrokeStart = useCallback(withErrorHandling(async (event) => {
    // 手动模式：不再进行自动检测
    if (isManualFingerMode) {
      console.log('👆 手指模式，跳过绘制逻辑');
      return; // 手指模式不绘制
    }

    // 橡皮擦模式：开始擦除
    if (tool === 'eraser') {
      console.log('🧽 橡皮擦模式，开始擦除');
      isDrawingRef.current = true;
      handleErase(event);
      return;
    }

    // 形状绘制模式：开始形状绘制
    const shapeTools = ['line', 'rectangle', 'circle', 'triangle', 'arrow'];
    if (shapeTools.includes(tool)) {
      console.log('📐 形状绘制模式，开始绘制:', tool);
      isDrawingRef.current = true;
      handleShapeDrawingStart(event, tool);
      return;
    }

    // 手写笔模式：进行绘制处理
    console.log('🖊️ 手写笔模式，开始绘制处理');

    const { x, y } = event;

    if (typeof x !== 'number' || typeof y !== 'number' || isNaN(x) || isNaN(y)) {
      throw new Error('无效的坐标数据: ' + JSON.stringify({ x, y }));
    }

    // 边界检测
    if (!isWithinBounds(x, y)) {
      console.log('🚫 坐标超出边界，停止绘制:', { x, y });
      return;
    }

    if (isDrawingRef.current) {
      console.warn('UniversalHandwritingEngine: 已在绘制中，忽略新的开始事件');
      return;
    }

    isDrawingRef.current = true;

    try {
      // 坐标变换
      const transformed = transformCoordinates(x, y);

      // 创建新笔迹
      const stroke = new AdvancedStrokeData({
        color: strokeColor,
        width: strokeWidth,
        opacity,
        tool,
        timestamp: Date.now()
      });

      // 添加第一个点
      stroke.addPoint(
        transformed.x, transformed.y,
        enablePressure ? (event.pressure || 1) : 1,
        enableTilt ? (event.tilt || 0) : 0,
        event.azimuth || 0,
        event.force || 0
      );

      currentStrokeRef.current = stroke;
      setCurrentStroke(stroke);

      onStrokeStart?.(stroke);
    } catch (error) {
      isDrawingRef.current = false;
      throw error;
    }
  }, { context: 'handleStrokeStart' }), [strokeColor, strokeWidth, opacity, tool, enablePressure, enableTilt, onStrokeStart, isCoordinateValid, transformCoordinates, initialScale, offsetX, offsetY, withErrorHandling, isManualFingerMode, isWithinBounds]);

  // 更新绘制 - 添加边界检测和平滑处理
  const handleStrokeUpdate = useCallback((event) => {
    try {
      // 橡皮擦模式：继续擦除
      if (tool === 'eraser' && isDrawingRef.current) {
        handleErase(event);
        return;
      }

      // 形状绘制模式：更新形状预览
      if (isShapeDrawingMode && isDrawingRef.current) {
        handleShapeDrawingUpdate(event);
        return;
      }

      if (!currentStrokeRef.current) return;

      const { x, y } = event;
      if (typeof x !== 'number' || typeof y !== 'number' || isNaN(x) || isNaN(y)) {
        return;
      }

      // 边界检测 - 如果超出边界则停止绘制
      if (!isWithinBounds(x, y)) {
        console.log('🚫 坐标超出边界，停止绘制更新:', { x, y });
        // 结束当前笔迹
        if (isDrawingRef.current) {
          isDrawingRef.current = false;
          strokesRef.current.push(currentStrokeRef.current);
          setCurrentStroke(null);
          currentStrokeRef.current = null;
          setRenderTrigger(prev => prev + 1);
          onStrokeEnd?.(strokesRef.current[strokesRef.current.length - 1]);
        }
        return;
      }

      // 坐标变换
      const transformed = transformCoordinates(x, y);

      // 平滑处理 - 检查距离，避免过密的点
      const lastPoint = currentStrokeRef.current.points[currentStrokeRef.current.points.length - 1];
      if (lastPoint) {
        const distance = Math.sqrt(
          Math.pow(transformed.x - lastPoint.x, 2) +
          Math.pow(transformed.y - lastPoint.y, 2)
        );

        // 检测是否停留在同一位置
        const currentTime = Date.now();
        if (distance < 5) { // 5像素内认为是停留
          if (!lastMoveTime) {
            setLastMoveTime(currentTime);
          } else if (currentTime - lastMoveTime > 2000 && !isStayingStill) {
            // 停留超过2秒，立即进行形状识别
            setIsStayingStill(true);
            const shape = recognizeShape(currentStrokeRef.current);
            if (shape) {
              console.log('🔍 立即识别到形状:', shape.type);
              const shapeStroke = createShapeStroke(shape, currentStrokeRef.current.style);
              if (shapeStroke) {
                currentStrokeRef.current = shapeStroke;
                setCurrentStroke(shapeStroke);
                onStrokeUpdate?.(shapeStroke);
              }
            }
          }
        } else {
          // 移动了，重置停留检测
          setLastMoveTime(null);
          setIsStayingStill(false);
        }

        // 如果距离太小且不是形状识别状态，跳过这个点
        if (distance < 2 && !isStayingStill) {
          return;
        }
      } else {
        setLastMoveTime(Date.now());
      }

      // 添加点
      currentStrokeRef.current.addPoint(
        transformed.x, transformed.y,
        enablePressure ? (event.pressure || 1) : 1,
        enableTilt ? (event.tilt || 0) : 0,
        event.azimuth || 0,
        event.force || 0
      );

      setCurrentStroke({ ...currentStrokeRef.current });
      onStrokeUpdate?.(currentStrokeRef.current);
    } catch (error) {
      console.error('UniversalHandwritingEngine: 笔迹更新失败:', error);
    }
  }, [enablePressure, enableTilt, onStrokeUpdate, transformCoordinates, isWithinBounds, onStrokeEnd]);

  // 结束绘制 - 简化版本
  const handleStrokeEnd = useCallback((event) => {
    try {
      // 橡皮擦模式：结束擦除
      if (tool === 'eraser' && isDrawingRef.current) {
        isDrawingRef.current = false;
        setEraserPosition(null); // 清除橡皮擦位置
        console.log('🧽 橡皮擦模式结束');
        return;
      }

      // 形状绘制模式：结束形状绘制
      if (isShapeDrawingMode && isDrawingRef.current) {
        handleShapeDrawingEnd();
        return;
      }

      if (!currentStrokeRef.current) return;

      const { x, y } = event;
      if (typeof x !== 'number' || typeof y !== 'number' || isNaN(x) || isNaN(y)) {
        return;
      }

      // 坐标变换
      const transformed = transformCoordinates(x, y);

      // 添加最后一个点
      currentStrokeRef.current.addPoint(
        transformed.x, transformed.y,
        enablePressure ? (event.pressure || 1) : 1,
        enableTilt ? (event.tilt || 0) : 0,
        event.azimuth || 0,
        event.force || 0
      );

      // 完成笔迹
      const completedStroke = currentStrokeRef.current;
      strokesRef.current.push(completedStroke);
      setCurrentStroke(null);
      currentStrokeRef.current = null;
      isDrawingRef.current = false;

      // 重置停留检测状态
      setLastMoveTime(null);
      setIsStayingStill(false);

      // 荧光笔自动消除功能 (检查原始工具类型)
      const isHighlighter = originalTool === 'highlighter' ||
                           (typeof originalTool === 'object' && originalTool?.type === 'highlighter') ||
                           tool === 'highlighter' ||
                           tool === 'marker';

      console.log('🔍 荧光笔检测:', {
        originalTool,
        tool,
        isHighlighter,
        originalToolType: typeof originalTool === 'object' ? originalTool?.type : originalTool
      });

      if (isHighlighter) {
        const strokeIndex = strokesRef.current.length - 1;

        // 添加淡出动画效果
        setTimeout(() => {
          // 检查笔迹是否还存在（可能已被用户删除）
          if (strokesRef.current[strokeIndex] === completedStroke) {
            // 先设置淡出状态
            if (strokesRef.current[strokeIndex]) {
              strokesRef.current[strokeIndex].isHighlighterFading = true;
              setRenderTrigger(prev => prev + 1);

              // 500ms后完全移除
              setTimeout(() => {
                if (strokesRef.current[strokeIndex] === completedStroke) {
                  strokesRef.current.splice(strokeIndex, 1);
                  setRenderTrigger(prev => prev + 1);
                  onStrokesChange?.(strokesRef.current);
                  console.log('✨ 荧光笔笔迹已自动消除');
                }
              }, 500);
            }
          }
        }, 2000); // 2秒后开始淡出
      }

      // 触发更新
      setRenderTrigger(prev => prev + 1);
      onStrokeEnd?.(strokesRef.current[strokesRef.current.length - 1]);
      onStrokesChange?.(strokesRef.current);
    } catch (error) {
      console.error('UniversalHandwritingEngine: 笔迹结束失败:', error);
      isDrawingRef.current = false;
    }
  }, [enablePressure, enableTilt, onStrokeEnd, onStrokesChange, transformCoordinates]);

  // PanResponder配置 - 简化版本
  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => !disabled,
    onMoveShouldSetPanResponder: () => !disabled && isDrawingRef.current,

    onPanResponderGrant: (event) => {
      if (disabled) return false;

      try {
        const { locationX, locationY } = event.nativeEvent;
        const gestureEvent = {
          x: locationX,
          y: locationY,
          nativeEvent: event.nativeEvent
        };

        // 基于手动模式设置决定行为
        if (isManualFingerMode) {
          // 手指模式：让事件传播到底层，支持滑动缩放
          console.log('👆 手指模式：允许底层手势操作');
          return false; // 让事件传播到底层
        } else {
          // 手写笔模式：处理绘制
          console.log('🖊️ 手写笔模式：开始绘制');
          handleStrokeStart(gestureEvent);
          return true; // 处理绘制事件
        }
      } catch (error) {
        console.error('UniversalHandwritingEngine: PanResponder Grant失败:', error);
        return false;
      }
    },

    onPanResponderMove: (event) => {
      if (disabled) return false;

      // 基于手动模式决定行为
      if (isManualFingerMode) {
        return false; // 手指模式：让事件传播
      }

      if (!isDrawingRef.current) return false;

      try {
        const { locationX, locationY } = event.nativeEvent;
        const gestureEvent = {
          x: locationX,
          y: locationY,
          nativeEvent: event.nativeEvent
        };

        handleStrokeUpdate(gestureEvent);
        return true;
      } catch (error) {
        console.error('UniversalHandwritingEngine: PanResponder Move失败:', error);
        return false;
      }
    },

    onPanResponderRelease: (event) => {
      if (disabled) return false;

      // 基于手动模式决定行为
      if (isManualFingerMode) {
        return false; // 手指模式：让事件传播
      }

      if (!isDrawingRef.current) return false;

      try {
        const { locationX, locationY } = event.nativeEvent;
        const gestureEvent = {
          x: locationX,
          y: locationY,
          nativeEvent: event.nativeEvent
        };

        handleStrokeEnd(gestureEvent);
        return true;
      } catch (error) {
        console.error('UniversalHandwritingEngine: PanResponder Release失败:', error);
        return false;
      }
    }
  }), [disabled, isManualFingerMode, handleStrokeStart, handleStrokeUpdate, handleStrokeEnd]);

  // 渲染笔迹 - 确保与文档内容位置一致
  const renderStrokes = useMemo(() => {
    const allStrokes = [...strokesRef.current];
    if (currentStroke) {
      allStrokes.push(currentStroke);
    }

    return allStrokes.map((stroke, index) => {
      if (!stroke || !stroke.points || stroke.points.length === 0) {
        return null;
      }

      // 确保 stroke 是 AdvancedStrokeData 实例
      let strokeInstance = stroke;
      if (!stroke.toSVGPath || typeof stroke.toSVGPath !== 'function') {
        try {
          // 检查 AdvancedStrokeData 是否已定义
          if (typeof AdvancedStrokeData === 'undefined' || !AdvancedStrokeData) {
            console.error('UniversalHandwritingEngine: AdvancedStrokeData 未定义');
            return null;
          }
          
          // 检查 fromJSON 方法是否存在
          if (typeof AdvancedStrokeData.fromJSON !== 'function') {
            console.error('UniversalHandwritingEngine: AdvancedStrokeData.fromJSON 方法未定义');
            return null;
          }
          
          // 尝试从 JSON 数据重建 AdvancedStrokeData 实例
          strokeInstance = AdvancedStrokeData.fromJSON(stroke);
        } catch (error) {
          console.warn('UniversalHandwritingEngine: 无法重建笔迹实例:', error);
          return null;
        }
      }

      // 根据压感调整笔迹宽度
      const dynamicWidth = enablePressure && strokeInstance.points.length > 0
        ? strokeInstance.style.width * (strokeInstance.points[strokeInstance.points.length - 1].pressure || 1)
        : strokeInstance.style.width;

      // 处理荧光笔淡出效果
      let strokeOpacity = strokeInstance.style.opacity;
      if (strokeInstance.isHighlighterFading) {
        strokeOpacity = strokeOpacity * 0.3; // 淡出时透明度降低
      }

      // 确保 strokeInstance 和 toSVGPath 方法存在
      if (!strokeInstance || typeof strokeInstance.toSVGPath !== 'function') {
        console.error('UniversalHandwritingEngine: 无效的笔迹实例或缺少 toSVGPath 方法');
        return null;
      }
      
      // 安全地调用 toSVGPath 方法
      let pathData;
      try {
        pathData = strokeInstance.toSVGPath();
      } catch (error) {
        console.error('UniversalHandwritingEngine: 调用 toSVGPath 失败:', error);
        return null;
      }
      
      return (
        <G key={`stroke-group-${index}-${strokeInstance.id}`}>
          <Path
            key={`stroke-${index}-${strokeInstance.id}`}
            d={pathData}
            stroke={strokeInstance.style.color}
            strokeWidth={dynamicWidth}
            strokeOpacity={strokeOpacity}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            // 笔迹直接渲染，不应用额外变换
            // 变换应该在容器级别处理，确保与文档内容同步
          />
        </G>
      );
    }).filter(Boolean);
  }, [enablePressure, currentStroke, renderTrigger]);

  // 自动保存功能
  const scheduleAutoSave = useCallback(() => {
    if (!autoSave) return;

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(async () => {
      try {
        if (strokesRef.current.length === 0) return;

        const handwritingData = {
          strokes: strokesRef.current.map(stroke => {
            if (stroke && typeof stroke.toJSON === 'function') {
              return stroke.toJSON();
            } else if (stroke && stroke.points && stroke.style) {
              // 处理没有toJSON方法但有基本属性的笔迹对象
              return {
                id: stroke.id || `stroke_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                points: stroke.points,
                style: stroke.style,
                bounds: stroke.bounds,
                isComplete: stroke.isComplete !== false, // 默认为完成状态
                timestamp: stroke.timestamp || Date.now(),
                transform: stroke.transform || { scale: 1, translateX: 0, translateY: 0, rotation: 0, skewX: 0, skewY: 0 },
                metadata: stroke.metadata || {}
              };
            } else {
              console.warn('UniversalHandwritingEngine: 跳过无效的笔迹对象:', stroke);
              return null;
            }
          }).filter(stroke => stroke !== null),
          metadata: {
            fileType: fileType || 'note',
            documentId: documentId || 'unknown',
            pageNumber: pageNumber || 1,
            timestamp: Date.now(),
            version: '1.0'
          }
        };

        // 优先使用文件管理器保存（如果有文件信息）
        if (filePath && fileName && handwritingFileManagerRef.current) {
          try {
            await handwritingFileManagerRef.current.saveHandwritingForFile(
              filePath,
              fileName,
              pageNumber,
              handwritingData.strokes,
              handwritingData.metadata
            );
            console.log(`UniversalHandwritingEngine: 文件关联保存成功 - ${fileName} 页面${pageNumber}: ${handwritingData.strokes.length} 个笔迹`);
          } catch (error) {
            console.error('UniversalHandwritingEngine: 文件关联保存失败，回退到传统方式:', error);
            // 回退到传统保存方式
            if (persistenceRef.current && typeof persistenceRef.current.saveHandwriting === 'function') {
              await persistenceRef.current.saveHandwriting(handwritingData);
              console.log('UniversalHandwritingEngine: 传统方式保存成功');
            }
          }
        } else if (persistenceRef.current && typeof persistenceRef.current.saveHandwriting === 'function') {
          await persistenceRef.current.saveHandwriting(handwritingData);
          console.log('UniversalHandwritingEngine: 传统方式保存成功');
        } else {
          console.warn('UniversalHandwritingEngine: 持久化服务不可用');
        }
      } catch (error) {
        console.error('UniversalHandwritingEngine: 保存失败:', error);
      }
    }, autoSaveInterval);
  }, [autoSave, autoSaveInterval, fileType, documentId, pageNumber]);

  // 手动保存函数（用于外部调用）
  const saveHandwritingToFile = useCallback(async () => {
    // 直接调用scheduleAutoSave中的逻辑
    if (strokesRef.current.length === 0) return;

    try {
      const handwritingData = {
        strokes: strokesRef.current.map(stroke => {
          if (stroke && typeof stroke.toJSON === 'function') {
            return stroke.toJSON();
          } else if (stroke && stroke.points && stroke.style) {
            // 处理没有toJSON方法但有基本属性的笔迹对象
            return {
              id: stroke.id || `stroke_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              points: stroke.points,
              style: stroke.style,
              bounds: stroke.bounds,
              isComplete: stroke.isComplete !== false, // 默认为完成状态
              timestamp: stroke.timestamp || Date.now(),
              transform: stroke.transform || { scale: 1, translateX: 0, translateY: 0, rotation: 0, skewX: 0, skewY: 0 },
              metadata: stroke.metadata || {}
            };
          } else {
            console.warn('UniversalHandwritingEngine: 跳过无效的笔迹对象:', stroke);
            return null;
          }
        }).filter(stroke => stroke !== null),
        metadata: {
          fileType: fileType || 'note',
          documentId: documentId || 'unknown',
          pageNumber: pageNumber || 1,
          timestamp: Date.now(),
          version: '1.0'
        }
      };

      // 优先使用文件管理器保存（如果有文件信息）
      if (filePath && fileName && handwritingFileManagerRef.current) {
        try {
          await handwritingFileManagerRef.current.saveHandwritingForFile(
            filePath,
            fileName,
            pageNumber,
            handwritingData.strokes,
            handwritingData.metadata
          );
          console.log(`UniversalHandwritingEngine: 手动文件关联保存成功 - ${fileName} 页面${pageNumber}: ${handwritingData.strokes.length} 个笔迹`);
        } catch (error) {
          console.error('UniversalHandwritingEngine: 手动文件关联保存失败，回退到传统方式:', error);
          // 回退到传统保存方式
          if (persistenceRef.current && typeof persistenceRef.current.saveHandwriting === 'function') {
            await persistenceRef.current.saveHandwriting(handwritingData);
            console.log('UniversalHandwritingEngine: 手动传统方式保存成功');
          }
        }
      } else if (persistenceRef.current && typeof persistenceRef.current.saveHandwriting === 'function') {
        await persistenceRef.current.saveHandwriting(handwritingData);
        console.log('UniversalHandwritingEngine: 手动传统方式保存成功');
      } else {
        console.warn('UniversalHandwritingEngine: 持久化服务不可用');
      }
    } catch (error) {
      console.error('UniversalHandwritingEngine: 保存失败:', error);
    }
  }, [fileType, documentId, pageNumber]);

  // 从文件加载手写数据
  const loadHandwritingFromFile = useCallback(async () => {
    try {
      let handwritingData = null;

      // 优先从文件管理器加载
      if (filePath && fileName && handwritingFileManagerRef.current) {
        try {
          handwritingData = await handwritingFileManagerRef.current.loadHandwritingForFile(filePath, fileName, pageNumber);
          if (handwritingData) {
            console.log(`UniversalHandwritingEngine: 从文件关联加载 - ${fileName} 页面${pageNumber}: ${handwritingData.strokes.length} 个笔迹`);
          }
        } catch (error) {
          console.error('UniversalHandwritingEngine: 文件关联加载失败，回退到传统方式:', error);
        }
      }

      // 如果文件管理器没有数据，尝试传统方式
      if (!handwritingData && persistenceRef.current) {
        handwritingData = await persistenceRef.current.loadHandwriting({
          fileType,
          documentId,
          pageNumber
        });
        if (handwritingData) {
          console.log(`UniversalHandwritingEngine: 从传统方式加载: ${handwritingData.strokes.length} 个笔迹`);
        }
      }

      if (handwritingData && handwritingData.strokes) {
        const loadedStrokes = handwritingData.strokes.map(strokeData =>
          AdvancedStrokeData.fromJSON(strokeData)
        );

        strokesRef.current = loadedStrokes;
        setRenderTrigger(prev => prev + 1);
        onStrokesChange?.(strokesRef.current);

        console.log(`UniversalHandwritingEngine: 已加载 ${loadedStrokes.length} 个笔迹`);
      } else {
        console.log('UniversalHandwritingEngine: 未找到手写数据，从空白开始');
      }
    } catch (error) {
      console.error('UniversalHandwritingEngine: 加载失败:', error);
    }
  }, [fileType, documentId, pageNumber, filePath, fileName, onStrokesChange]);

  // 组件挂载时加载数据
  useEffect(() => {
    if (documentId) {
      loadHandwritingFromFile();
    }
  }, [documentId, loadHandwritingFromFile]);

  // 笔迹变化时自动保存
  useEffect(() => {
    if (strokesRef.current.length > 0) {
      scheduleAutoSave();
    }
  }, [renderTrigger, scheduleAutoSave]);

  // 清理函数
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
      if (shapeTimeout) {
        clearTimeout(shapeTimeout);
      }
    };
  }, [shapeTimeout]);

  // 手动模式切换函数
  const toggleFingerMode = useCallback(() => {
    if (onModeToggle) {
      onModeToggle(!isManualFingerMode);
    }
    console.log(`模式切换: ${!isManualFingerMode ? '👆 手指模式' : '🖊️ 手写笔模式'}`);
  }, [isManualFingerMode, onModeToggle]);

  // 清除所有笔迹
  const clearStrokes = useCallback(() => {
    strokesRef.current = [];
    currentStrokeRef.current = null;
    setCurrentStroke(null);
    setRenderTrigger(prev => prev + 1);
    onStrokesChange?.(strokesRef.current);
    console.log('UniversalHandwritingEngine: 已清除所有笔迹');
  }, [onStrokesChange]);

  // 撤销最后一个笔迹
  const undoLastStroke = useCallback(() => {
    if (strokesRef.current.length > 0) {
      strokesRef.current.pop();
      setRenderTrigger(prev => prev + 1);
      onStrokesChange?.(strokesRef.current);
      console.log('UniversalHandwritingEngine: 已撤销最后一个笔迹');
    }
  }, [onStrokesChange]);

  // 设置笔迹数据
  const setStrokes = useCallback((newStrokes) => {
    if (!Array.isArray(newStrokes)) {
      console.warn('UniversalHandwritingEngine: setStrokes需要数组参数');
      return;
    }

    strokesRef.current = newStrokes;
    setRenderTrigger(prev => prev + 1);
    onStrokesChange?.(strokesRef.current);
    console.log(`UniversalHandwritingEngine: 已设置 ${newStrokes.length} 个笔迹`);
  }, [onStrokesChange]);

  // 暴露给父组件的方法
  useImperativeHandle(ref, () => ({
    clearStrokes,
    undoLastStroke,
    toggleFingerMode,
    setStrokes,
    getStrokes: () => strokesRef.current,
    saveToFile: saveHandwritingToFile,
    loadFromFile: loadHandwritingFromFile,
    isFingerMode: isManualFingerMode
  }), [clearStrokes, undoLastStroke, toggleFingerMode, setStrokes, saveHandwritingToFile, loadHandwritingFromFile, isManualFingerMode]);

  return (
    <View
      style={[
        {
          width,
          height,
          backgroundColor
        },
        style
      ]}
      {...panResponder.panHandlers}
    >
      <Svg
        width={width}
        height={height}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          // 确保在手指模式下事件能够穿透到底层
          pointerEvents: isManualFingerMode ? 'none' : 'auto'
        }}
      >
        {renderStrokes}

        {/* 橡皮擦指示器 */}
        {tool === 'eraser' && eraserPosition && (
          <G key="eraser-indicator">
            <Circle
              cx={eraserPosition.x}
              cy={eraserPosition.y}
              r={eraserPosition.radius}
              fill="rgba(255, 0, 0, 0.2)"
              stroke="rgba(255, 0, 0, 0.8)"
              strokeWidth="2"
              strokeDasharray="5,5"
            />
          </G>
        )}

        {/* 形状预览 */}
        {isShapeDrawingMode && currentShapePreview && (
          <G key="shape-preview">
            {renderShapePreview(currentShapePreview)}
          </G>
        )}
      </Svg>
    </View>
  );
});

UniversalHandwritingEngine.displayName = 'UniversalHandwritingEngine';

export default UniversalHandwritingEngine;
export { AdvancedStrokeData };
