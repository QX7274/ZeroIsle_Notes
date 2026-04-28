/**
 * 绘图引擎组件
 * 基于Skia的高性能绘图引擎，支持多种绘图工具和效果
 */

import React from 'react';
import { Rect, Line, Circle, Path, Picture, Skia } from '@shopify/react-native-skia';

// 绘图工具配置
export const DRAWING_TOOLS = {
  pen: {
    name: '钢笔',
    strokeWidth: 2,
    opacity: 1.0,
    strokeCap: 'round',
    strokeJoin: 'round',
    smoothing: true,
  },
  pencil: {
    name: '铅笔',
    strokeWidth: 1.5,
    opacity: 0.8,
    strokeCap: 'round',
    strokeJoin: 'round',
    smoothing: true,
  },
  brush: {
    name: '画笔',
    strokeWidth: 4,
    opacity: 0.9,
    strokeCap: 'round',
    strokeJoin: 'round',
    smoothing: false,
  },
  highlighter: {
    name: '荧光笔',
    strokeWidth: 8,
    opacity: 0.3,
    strokeCap: 'butt',
    strokeJoin: 'miter',
    smoothing: false,
  },
  eraser: {
    name: '橡皮擦',
    strokeWidth: 10,
    opacity: 1.0,
    strokeCap: 'round',
    strokeJoin: 'round',
    smoothing: false,
    blendMode: 'clear',
  },
};

// 导入现有的样式配置
import { noteStyles } from '../note/NoteStyleModal';

/**
 * ✅ 增强的绘图引擎类 - 支持离屏渲染和高级优化
 */
export class DrawingEngine {
  constructor(canvasWidth, canvasHeight) {
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
    this.strokeCache = new Map();

    // ✅ 离屏渲染缓存
    this.surfaceCache = new Map(); // 存储每个笔画的Surface
    this.pictureCache = new Map(); // 存储每个笔画的Picture
    this.layerCache = new Map();   // 存储分层渲染的缓存

    // ✅ 性能优化配置
    this.maxCacheSize = 100; // 最大缓存笔画数
    this.compressionLevel = 0.8; // 压缩级别
    this.memoryThreshold = 50 * 1024 * 1024; // 50MB内存阈值
  }

  /**
   * 创建笔画路径 - 支持高级平滑和动态宽度
   */
  createStrokePath(points, tool = 'pen', smoothing = true) {
    if (!points || points.length < 2) {return null;}

    // 如果启用了平滑且点数足够，使用高级平滑算法
    if (smoothing && points.length > 2) {
      return this.createAdvancedSmoothPath(points, tool);
    } else {
      // 直线连接
      const path = Skia.Path.Make();
      path.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        path.lineTo(points[i].x, points[i].y);
      }
      return path;
    }
  }

  /**
   * 创建高级平滑路径 - 使用 Catmull-Rom 样条曲线
   * 支持动态宽度和笔锋效果
   */
  createAdvancedSmoothPath(points, tool = 'pen') {
    if (points.length < 2) {
      const path = Skia.Path.Make();
      path.moveTo(points[0].x, points[0].y);
      if (points.length === 1) {
        path.addCircle(points[0].x, points[0].y, 1);
      }
      return path;
    }

    // 增强点数据：计算速度和宽度
    const enhancedPoints = this.enhancePointsWithWidth(points, tool);

    // 使用 Catmull-Rom 样条曲线创建平滑路径
    const path = Skia.Path.Make();
    const numPoints = enhancedPoints.length;

    if (numPoints === 2) {
      // 两点时直接连接
      path.moveTo(enhancedPoints[0].x, enhancedPoints[0].y);
      path.lineTo(enhancedPoints[1].x, enhancedPoints[1].y);
      return path;
    }

    // 计算插值点，创建平滑曲线
    const tension = 0.5; // Catmull-Rom 张力参数（0-1）
    const segments = Math.max(4, Math.floor(numPoints * 1.5)); // 插值段数

    path.moveTo(enhancedPoints[0].x, enhancedPoints[0].y);

    for (let i = 0; i < numPoints - 1; i++) {
      const p0 = i > 0 ? enhancedPoints[i - 1] : enhancedPoints[i];
      const p1 = enhancedPoints[i];
      const p2 = enhancedPoints[i + 1];
      const p3 = i < numPoints - 2 ? enhancedPoints[i + 2] : p2;

      // Catmull-Rom 样条曲线插值
      for (let t = 0; t <= 1; t += 1 / segments) {
        const point = this.catmullRomInterpolate(p0, p1, p2, p3, t, tension);

        // 根据位置计算当前点的宽度（支持笔锋效果）
        const position = (i + t) / (numPoints - 1);
        const currentWidth = this.calculateDynamicWidth(
          p1.width,
          position,
          tool
        );

        // 使用小线段绘制，每个线段可以有不同宽度
        if (t === 0) {
          path.moveTo(point.x, point.y);
        } else {
          path.lineTo(point.x, point.y);
        }
      }
    }

    return path;
  }

  /**
   * Catmull-Rom 样条曲线插值
   */
  catmullRomInterpolate(p0, p1, p2, p3, t, tension = 0.5) {
    const t2 = t * t;
    const t3 = t2 * t;

    // Catmull-Rom 矩阵系数
    const m1 = (p2.x - p0.x) * tension;
    const m2 = (p3.x - p1.x) * tension;

    const x = (2 * t3 - 3 * t2 + 1) * p1.x +
              (t3 - 2 * t2 + t) * m1 +
              (-2 * t3 + 3 * t2) * p2.x +
              (t3 - t2) * m2;

    const y = (2 * t3 - 3 * t2 + 1) * p1.y +
              (t3 - 2 * t2 + t) * ((p2.y - p0.y) * tension) +
              (-2 * t3 + 3 * t2) * p2.y +
              (t3 - t2) * ((p3.y - p1.y) * tension);

    return { x, y };
  }

  /**
   * 增强点数据：计算每个点的速度和动态宽度
   */
  enhancePointsWithWidth(points, tool = 'pen') {
    if (!points || points.length === 0) {return [];}

    const enhanced = [];
    const baseWidth = DRAWING_TOOLS[tool]?.strokeWidth || 2;

    for (let i = 0; i < points.length; i++) {
      const point = points[i];
      const prevPoint = i > 0 ? points[i - 1] : point;

      // 计算速度（像素/毫秒）
      let speed = 0;
      if (i > 0 && point.timestamp && prevPoint.timestamp) {
        const dx = point.x - prevPoint.x;
        const dy = point.y - prevPoint.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const dt = point.timestamp - prevPoint.timestamp;
        speed = dt > 0 ? distance / dt : 0;
      }

      // 获取压力值（0-1）
      const pressure = point.pressure || point.force || 1.0;

      // 计算动态宽度
      const dynamicWidth = this.calculateDynamicWidth(
        baseWidth,
        0, // 位置稍后在绘制时计算
        tool,
        speed,
        pressure
      );

      enhanced.push({
        ...point,
        speed,
        width: dynamicWidth,
        originalWidth: baseWidth,
      });
    }

    return enhanced;
  }

  /**
   * 计算动态宽度 - 综合考虑速度、压力和笔锋效果
   */
  calculateDynamicWidth(
    baseWidth,
    position = 0.5,
    tool = 'pen',
    speed = 0,
    pressure = 1.0
  ) {
    const toolConfig = DRAWING_TOOLS[tool];
    if (!toolConfig) {return baseWidth;}

    // 速度影响：速度越快，笔触越细（模拟真实笔触）
    const maxSpeed = 10; // 最大速度（像素/毫秒）
    const normalizedSpeed = Math.min(1, speed / maxSpeed);
    const speedFactor = 1 - normalizedSpeed * 0.3; // 最快时减少30%宽度

    // 压力影响（如果支持压感）
    const pressureFactor = this.getPressureFactor(pressure, tool);

    // 笔锋效果：起笔和收笔时变细
    const taperStart = 0.1; // 前10%
    const taperEnd = 0.1;   // 后10%
    let taperFactor = 1.0;

    if (position < taperStart) {
      // 起笔笔锋：逐渐变细
      taperFactor = 0.3 + (position / taperStart) * 0.7; // 从30%逐渐增加到100%
    } else if (position > 1 - taperEnd) {
      // 收笔笔锋：逐渐变细
      const endProgress = (1 - position) / taperEnd;
      taperFactor = 0.3 + endProgress * 0.7; // 从100%逐渐减少到30%
    }

    // 组合所有因子
    let finalWidth = baseWidth * speedFactor * pressureFactor * taperFactor;

    // 确保最小宽度
    const minWidth = baseWidth * 0.2;
    finalWidth = Math.max(minWidth, finalWidth);

    return finalWidth;
  }

  /**
   * 获取压力因子
   */
  getPressureFactor(pressure, tool) {
    // 标准化压力值到 0-1
    const normalizedPressure = Math.max(0, Math.min(1, pressure));

    switch (tool) {
      case 'pen':
        // 钢笔：压力范围 0.7-1.3
        return 0.7 + normalizedPressure * 0.6;
      case 'pencil':
        // 铅笔：压力范围 0.5-1.5（更敏感）
        return 0.5 + normalizedPressure * 1.0;
      case 'brush':
        // 画笔：压力范围 0.4-1.6（非常敏感）
        return 0.4 + normalizedPressure * 1.2;
      case 'highlighter':
        // 荧光笔：不受压力影响
        return 1.0;
      case 'eraser':
        // 橡皮擦：压力范围 0.8-1.2
        return 0.8 + normalizedPressure * 0.4;
      default:
        return 1.0;
    }
  }

  /**
   * 计算压感宽度（保留向后兼容）
   * @deprecated 使用 calculateDynamicWidth 代替
   */
  calculatePressureWidth(baseWidth, pressure, tool = 'pen') {
    return this.calculateDynamicWidth(baseWidth, 0.5, tool, 0, pressure);
  }

  /**
   * 获取工具配置
   */
  getToolConfig(tool) {
    return DRAWING_TOOLS[tool] || DRAWING_TOOLS.pen;
  }

  /**
   * 缓存笔画路径
   */
  cacheStrokePath(strokeId, path) {
    this.strokeCache.set(strokeId, path);
  }

  /**
   * 获取缓存的笔画路径
   */
  getCachedStrokePath(strokeId) {
    return this.strokeCache.get(strokeId);
  }

  // ✅ 离屏渲染核心方法

  /**
   * 创建笔画的离屏Surface
   */
  createStrokeSurface(stroke) {
    if (!stroke || !stroke.points || stroke.points.length < 2) {return null;}

    // 检查是否已有缓存
    if (this.surfaceCache.has(stroke.id)) {
      return this.surfaceCache.get(stroke.id);
    }

    try {
      // 创建离屏Surface
      const surface = Skia.Surface.MakeOffscreen(this.canvasWidth, this.canvasHeight);
      if (!surface) {return null;}

      const canvas = surface.getCanvas();
      const toolConfig = this.getToolConfig(stroke.tool);

      // 设置绘制属性
      const paint = Skia.Paint();
      paint.setColor(Skia.Color(stroke.color));
      paint.setStrokeWidth(stroke.width);
      paint.setStyle(Skia.PaintStyle.Stroke);
      paint.setStrokeCap(Skia.StrokeCap.Round);
      paint.setStrokeJoin(Skia.StrokeJoin.Round);
      paint.setBlendMode(Skia.BlendMode.SrcOver);

      // 绘制笔画路径（支持动态宽度）
      const path = this.createStrokePath(stroke.points, stroke.tool, toolConfig.smoothing);
      if (path) {
        // 如果点数据包含宽度信息，使用平均宽度或最大宽度
        let strokeWidth = stroke.width || toolConfig.strokeWidth;
        if (stroke.points && stroke.points.length > 0 && stroke.points[0].width) {
          // 使用所有点的平均宽度
          const avgWidth = stroke.points.reduce((sum, p) => sum + (p.width || strokeWidth), 0) / stroke.points.length;
          strokeWidth = avgWidth;
        }
        paint.setStrokeWidth(strokeWidth);
        canvas.drawPath(path, paint);
      }

      surface.flush();

      // 缓存Surface
      this.surfaceCache.set(stroke.id, surface);

      // 内存管理
      this.manageMemory();

      return surface;
    } catch (error) {
      console.error('创建笔画Surface失败:', error);
      return null;
    }
  }

  /**
   * 创建笔画的Picture对象
   */
  createStrokePicture(stroke) {
    if (!stroke || !stroke.points || stroke.points.length < 2) {return null;}

    // 检查是否已有缓存
    if (this.pictureCache.has(stroke.id)) {
      return this.pictureCache.get(stroke.id);
    }

    try {
      const picture = Skia.Picture.Make((canvas) => {
        const toolConfig = this.getToolConfig(stroke.tool);

        // 设置绘制属性
        const paint = Skia.Paint();
        paint.setColor(Skia.Color(stroke.color));
        paint.setStrokeWidth(stroke.width);
        paint.setStyle(Skia.PaintStyle.Stroke);
        paint.setStrokeCap(Skia.StrokeCap.Round);
        paint.setStrokeJoin(Skia.StrokeJoin.Round);
        paint.setBlendMode(Skia.BlendMode.SrcOver);

        // 绘制笔画路径（支持动态宽度）
        const path = this.createStrokePath(stroke.points, stroke.tool, toolConfig.smoothing);
        if (path) {
          // 如果点数据包含宽度信息，使用平均宽度
          let strokeWidth = stroke.width || toolConfig.strokeWidth;
          if (stroke.points && stroke.points.length > 0 && stroke.points[0].width) {
            const avgWidth = stroke.points.reduce((sum, p) => sum + (p.width || strokeWidth), 0) / stroke.points.length;
            strokeWidth = avgWidth;
          }
          paint.setStrokeWidth(strokeWidth);
          canvas.drawPath(path, paint);
        }
      });

      // 缓存Picture
      this.pictureCache.set(stroke.id, picture);

      return picture;
    } catch (error) {
      console.error('创建笔画Picture失败:', error);
      return null;
    }
  }

  /**
   * 创建分层渲染的Picture
   */
  createLayerPicture(strokes) {
    if (!strokes || strokes.length === 0) {return null;}

    const layerKey = strokes.map(s => s.id).join('_');

    // 检查是否已有缓存
    if (this.layerCache.has(layerKey)) {
      return this.layerCache.get(layerKey);
    }

    try {
      const picture = Skia.Picture.Make((canvas) => {
        strokes.forEach(stroke => {
          const toolConfig = this.getToolConfig(stroke.tool);

          // 设置绘制属性
          const paint = Skia.Paint();
          paint.setColor(Skia.Color(stroke.color));
          paint.setStrokeWidth(stroke.width);
          paint.setStyle(Skia.PaintStyle.Stroke);
          paint.setStrokeCap(Skia.StrokeCap.Round);
          paint.setStrokeJoin(Skia.StrokeJoin.Round);
          paint.setBlendMode(Skia.BlendMode.SrcOver);

          // 绘制笔画路径
          const path = this.createStrokePath(stroke.points, stroke.tool, toolConfig.smoothing);
          if (path) {
            canvas.drawPath(path, paint);
          }
        });
      });

      // 缓存分层Picture
      this.layerCache.set(layerKey, picture);

      return picture;
    } catch (error) {
      console.error('创建分层Picture失败:', error);
      return null;
    }
  }

  /**
   * 内存管理 - 清理旧缓存
   */
  manageMemory() {
    // 检查缓存大小
    if (this.surfaceCache.size > this.maxCacheSize) {
      // 清理最旧的缓存
      const oldestKeys = Array.from(this.surfaceCache.keys()).slice(0, 10);
      oldestKeys.forEach(key => {
        const surface = this.surfaceCache.get(key);
        if (surface) {
          surface.dispose();
        }
        this.surfaceCache.delete(key);
      });
    }

    // 检查内存使用
    const estimatedMemory = this.estimateMemoryUsage();
    if (estimatedMemory > this.memoryThreshold) {
      this.clearOldCache();
    }
  }

  /**
   * 估算内存使用量
   */
  estimateMemoryUsage() {
    // 简单估算：每个Surface约占用 width * height * 4 bytes
    const surfaceMemory = this.surfaceCache.size * this.canvasWidth * this.canvasHeight * 4;
    const pictureMemory = this.pictureCache.size * 1024; // 每个Picture约1KB
    return surfaceMemory + pictureMemory;
  }

  /**
   * 清理旧缓存
   */
  clearOldCache() {
    // 清理一半的Surface缓存
    const surfaceKeys = Array.from(this.surfaceCache.keys());
    const keysToRemove = surfaceKeys.slice(0, Math.floor(surfaceKeys.length / 2));

    keysToRemove.forEach(key => {
      const surface = this.surfaceCache.get(key);
      if (surface) {
        surface.dispose();
      }
      this.surfaceCache.delete(key);
    });

    // 清理一半的Picture缓存
    const pictureKeys = Array.from(this.pictureCache.keys());
    const pictureKeysToRemove = pictureKeys.slice(0, Math.floor(pictureKeys.length / 2));

    pictureKeysToRemove.forEach(key => {
      const picture = this.pictureCache.get(key);
      if (picture) {
        picture.dispose();
      }
      this.pictureCache.delete(key);
    });
  }

  /**
   * 清理所有缓存
   */
  clearAllCache() {
    // 清理Surface缓存
    this.surfaceCache.forEach(surface => {
      if (surface) {
        surface.dispose();
      }
    });
    this.surfaceCache.clear();

    // 清理Picture缓存
    this.pictureCache.forEach(picture => {
      if (picture) {
        picture.dispose();
      }
    });
    this.pictureCache.clear();

    // 清理分层缓存
    this.layerCache.forEach(picture => {
      if (picture) {
        picture.dispose();
      }
    });
    this.layerCache.clear();

    // 清理路径缓存
    this.strokeCache.clear();
  }

  /**
   * 清除路径缓存
   */
  clearCache() {
    this.strokeCache.clear();
  }
}

/**
 * 渲染页面背景
 */
export const renderPageBackground = (style, canvasWidth, canvasHeight) => {
  const styleConfig = noteStyles.find(s => s.id === style) || noteStyles[0];

  const background = (
    <Rect
      key="background"
      x={0}
      y={0}
      width={canvasWidth}
      height={canvasHeight}
      color={styleConfig.backgroundColor}
    />
  );

  const pattern = renderBackgroundPattern(styleConfig, canvasWidth, canvasHeight);

  return [background, ...(pattern || [])].filter(Boolean);
};

/**
 * 渲染背景图案
 */
export const renderBackgroundPattern = (styleConfig, canvasWidth, canvasHeight) => {
  console.log('DrawingEngine: 渲染背景图案', styleConfig);

  if (!styleConfig.pattern) {
    console.log('DrawingEngine: 没有图案配置');
    return [];
  }

  switch (styleConfig.pattern) {
    case 'lines':
      console.log('DrawingEngine: 渲染横线图案');
      return renderLinesPattern(styleConfig, canvasWidth, canvasHeight);
    case 'grid':
      return renderGridPattern(styleConfig, canvasWidth, canvasHeight);
    case 'dots':
      return renderDotsPattern(styleConfig, canvasWidth, canvasHeight);
    case 'cornell':
      return renderCornellPattern(styleConfig, canvasWidth, canvasHeight);
    default:
      return [];
  }
};

/**
 * 渲染横线图案
 */
export const renderLinesPattern = (styleConfig, canvasWidth, canvasHeight) => {
  const lines = [];
  const spacing = 30;
  const color = '#E0E0E0';

  for (let y = spacing; y < canvasHeight; y += spacing) {
    lines.push(
      <Line
        key={`line-${y}`}
        p1={{ x: 0, y }}
        p2={{ x: canvasWidth, y }}
        color={color}
        strokeWidth={1}
      />
    );
  }

  return lines;
};

/**
 * 渲染网格图案
 */
export const renderGridPattern = (styleConfig, canvasWidth, canvasHeight) => {
  const lines = [];
  const gridSize = 20;
  const color = '#E0E0E0';

  // 垂直线
  for (let x = gridSize; x < canvasWidth; x += gridSize) {
    lines.push(
      <Line
        key={`v-line-${x}`}
        p1={{ x, y: 0 }}
        p2={{ x, y: canvasHeight }}
        color={color}
        strokeWidth={1}
      />
    );
  }

  // 水平线
  for (let y = gridSize; y < canvasHeight; y += gridSize) {
    lines.push(
      <Line
        key={`h-line-${y}`}
        p1={{ x: 0, y }}
        p2={{ x: canvasWidth, y }}
        color={color}
        strokeWidth={1}
      />
    );
  }

  return lines;
};

/**
 * 渲染点阵图案
 */
export const renderDotsPattern = (styleConfig, canvasWidth, canvasHeight) => {
  const dots = [];
  const dotSpacing = 20;
  const dotSize = 1;
  const color = '#C0C0C0';

  for (let x = dotSpacing; x < canvasWidth; x += dotSpacing) {
    for (let y = dotSpacing; y < canvasHeight; y += dotSpacing) {
      dots.push(
        <Circle
          key={`dot-${x}-${y}`}
          cx={x}
          cy={y}
          r={dotSize}
          color={color}
        />
      );
    }
  }

  return dots;
};

/**
 * 渲染康奈尔笔记图案
 */
export const renderCornellPattern = (styleConfig, canvasWidth, canvasHeight) => {
  const elements = [];
  const color = '#E0E0E0';
  const lineSpacing = 30;

  // 左侧边栏分割线 (约占页面宽度的1/4)
  const sidebarWidth = canvasWidth * 0.25;
  elements.push(
    <Line
      key="sidebar-divider"
      p1={{ x: sidebarWidth, y: 0 }}
      p2={{ x: sidebarWidth, y: canvasHeight }}
      color={color}
      strokeWidth={1}
    />
  );

  // 底部总结区域分割线 (约占页面高度的1/5)
  const summaryHeight = canvasHeight * 0.8;
  elements.push(
    <Line
      key="summary-divider"
      p1={{ x: 0, y: summaryHeight }}
      p2={{ x: canvasWidth, y: summaryHeight }}
      color={color}
      strokeWidth={1}
    />
  );

  // 主要笔记区域的横线 (右侧区域)
  for (let y = lineSpacing; y < summaryHeight; y += lineSpacing) {
    elements.push(
      <Line
        key={`main-line-${y}`}
        p1={{ x: sidebarWidth, y }}
        p2={{ x: canvasWidth, y }}
        color={color}
        strokeWidth={0.5}
      />
    );
  }

  return elements;
};

/**
 * ✅ 优化的渲染笔画 - 支持离屏渲染
 */
export const renderStroke = (stroke, drawingEngine) => {
  if (!stroke || !stroke.points || stroke.points.length < 2) {return null;}

  const toolConfig = drawingEngine.getToolConfig(stroke.tool);

  // ✅ 优先使用离屏渲染的Picture
  const picture = drawingEngine.createStrokePicture(stroke);
  if (picture) {
    return (
      <Picture
        key={stroke.id}
        picture={picture}
      />
    );
  }

  // 降级到传统路径渲染
  let path = drawingEngine.getCachedStrokePath(stroke.id);
  if (!path) {
    // 创建新路径并缓存
    path = drawingEngine.createStrokePath(stroke.points, stroke.tool, toolConfig.smoothing);
    if (path) {
      drawingEngine.cacheStrokePath(stroke.id, path);
    }
  }

  if (!path) {return null;}

  return (
    <Path
      key={stroke.id}
      path={path}
      color={stroke.color}
      style="stroke"
      strokeWidth={stroke.width}
      strokeCap={toolConfig.strokeCap}
      strokeJoin={toolConfig.strokeJoin}
      opacity={stroke.opacity}
      blendMode={toolConfig.blendMode}
    />
  );
};

/**
 * ✅ 渲染分层笔画 - 使用离屏渲染优化
 */
export const renderLayerStrokes = (strokes, drawingEngine) => {
  if (!strokes || strokes.length === 0) {return null;}

  // 使用分层Picture渲染
  const layerPicture = drawingEngine.createLayerPicture(strokes);
  if (layerPicture) {
    return (
      <Picture
        key={`layer_${strokes.map(s => s.id).join('_')}`}
        picture={layerPicture}
      />
    );
  }

  // 降级到单个笔画渲染
  return strokes.map(stroke => renderStroke(stroke, drawingEngine));
};

export default DrawingEngine;
