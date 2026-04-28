/**
 * 笔画渲染工具
 * 提供笔画渲染、碰撞检测等绘图相关工具函数
 */

import { Skia } from '@shopify/react-native-skia';

/**
 * 绘图工具配置
 */
export const TOOL_CONFIGS = {
  pen: {
    name: '钢笔',
    opacity: 1.0,
    strokeCap: 'round',
    strokeJoin: 'round',
    smoothing: true,
    defaultWidth: 2,
  },
  pencil: {
    name: '铅笔',
    opacity: 0.8,
    strokeCap: 'round',
    strokeJoin: 'round',
    smoothing: true,
    defaultWidth: 1.5,
  },
  brush: {
    name: '画笔',
    opacity: 0.9,
    strokeCap: 'round',
    strokeJoin: 'round',
    smoothing: false,
    defaultWidth: 4,
  },
  highlighter: {
    name: '荧光笔',
    opacity: 0.3,
    strokeCap: 'butt',
    strokeJoin: 'miter',
    smoothing: false,
    defaultWidth: 12,
  },
  laser: {
    name: '激光笔',
    opacity: 1.0,
    strokeCap: 'round',
    strokeJoin: 'round',
    smoothing: true,
    defaultWidth: 3,
    fadeOutDuration: 3000, // 3秒后消失
  },
  eraser: {
    name: '橡皮擦',
    opacity: 1.0,
    strokeCap: 'round',
    strokeJoin: 'round',
    smoothing: false,
    defaultWidth: 16,
  },
  calligraphy: {
    name: '书法笔',
    opacity: 1.0,
    strokeCap: 'square',
    strokeJoin: 'miter',
    smoothing: true,
    defaultWidth: 6,
  },
};

/**
 * 创建Skia路径 - 使用高级平滑算法
 * @param {Array} points - 点数组 [{x, y, timestamp, pressure?, speed?}, ...]
 * @param {boolean} smoothing - 是否平滑处理
 * @param {string} smoothingType - 平滑类型: 'simple' | 'bezier' | 'catmull-rom'
 * @returns {SkiaPath} Skia路径对象
 */
export const createPath = (points, smoothing = true, smoothingType = 'catmull-rom') => {
  if (!points || points.length === 0) {return null;}

  const path = Skia.Path.Make();

  if (points.length === 1) {
    // 单点绘制为小圆点
    const { x, y } = points[0];
    const radius = points[0].width ? points[0].width / 2 : 1;
    path.addCircle(x, y, radius);
    return path;
  }

  if (!smoothing || points.length === 2) {
    // 直线连接，不平滑
    path.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      path.lineTo(points[i].x, points[i].y);
    }
    return path;
  }

  // 根据平滑类型选择算法
  switch (smoothingType) {
    case 'catmull-rom':
      return createCatmullRomPath(points, path);
    case 'bezier':
      return createBezierPath(points, path);
    case 'simple':
    default:
      return createSimpleSmoothPath(points, path);
  }
};

/**
 * 创建 Catmull-Rom 样条曲线路径（更光滑）
 */
function createCatmullRomPath(points, path) {
  const numPoints = points.length;

  if (numPoints < 2) {
    return path;
  }

  // 起点
  path.moveTo(points[0].x, points[0].y);

  if (numPoints === 2) {
    path.lineTo(points[1].x, points[1].y);
    return path;
  }

  const tension = 0.5; // Catmull-Rom 张力参数
  const segments = 8; // 每段插值点数

  for (let i = 0; i < numPoints - 1; i++) {
    const p0 = i > 0 ? points[i - 1] : points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = i < numPoints - 2 ? points[i + 2] : p2;

    // Catmull-Rom 插值
    for (let j = 1; j <= segments; j++) {
      const t = j / segments;
      const point = catmullRom(p0, p1, p2, p3, t, tension);
      path.lineTo(point.x, point.y);
    }
  }

  return path;
}

/**
 * Catmull-Rom 样条曲线插值函数
 */
function catmullRom(p0, p1, p2, p3, t, tension = 0.5) {
  const t2 = t * t;
  const t3 = t2 * t;

  // Catmull-Rom 系数矩阵
  const m1 = (p2.x - p0.x) * tension;
  const m2 = (p3.x - p1.x) * tension;
  const m1y = (p2.y - p0.y) * tension;
  const m2y = (p3.y - p1.y) * tension;

  const x = (2 * t3 - 3 * t2 + 1) * p1.x +
            (t3 - 2 * t2 + t) * m1 +
            (-2 * t3 + 3 * t2) * p2.x +
            (t3 - t2) * m2;

  const y = (2 * t3 - 3 * t2 + 1) * p1.y +
            (t3 - 2 * t2 + t) * m1y +
            (-2 * t3 + 3 * t2) * p2.y +
            (t3 - t2) * m2y;

  return { x, y };
}

/**
 * 创建二次贝塞尔曲线路径
 */
function createBezierPath(points, path) {
  path.moveTo(points[0].x, points[0].y);

  for (let i = 1; i < points.length - 1; i++) {
    const xMid = (points[i].x + points[i + 1].x) / 2;
    const yMid = (points[i].y + points[i + 1].y) / 2;
    path.quadTo(points[i].x, points[i].y, xMid, yMid);
  }

  // 连接到最后一点
  const lastPoint = points[points.length - 1];
  path.lineTo(lastPoint.x, lastPoint.y);

  return path;
}

/**
 * 创建简单平滑路径（三点平均）
 */
function createSimpleSmoothPath(points, path) {
  path.moveTo(points[0].x, points[0].y);

  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];

    // 三点平均平滑
    const smoothedX = (prev.x + curr.x + next.x) / 3;
    const smoothedY = (prev.y + curr.y + next.y) / 3;

    path.quadTo(curr.x, curr.y, smoothedX, smoothedY);
  }

  const lastPoint = points[points.length - 1];
  path.lineTo(lastPoint.x, lastPoint.y);

  return path;
}

/**
 * 检测两个笔画是否相交
 * @param {Array} eraserPoints - 橡皮擦路径点
 * @param {Array} strokePoints - 目标笔画点
 * @param {number} threshold - 碰撞阈值（橡皮擦半径）
 * @returns {boolean} 是否相交
 */
export const isStrokeIntersecting = (eraserPoints, strokePoints, threshold = 16) => {
  if (!eraserPoints || !strokePoints || eraserPoints.length === 0 || strokePoints.length === 0) {
    return false;
  }

  const thresholdSquared = threshold * threshold;

  // 检查橡皮擦路径上的每个点
  for (let i = 0; i < eraserPoints.length; i++) {
    const ep = eraserPoints[i];

    // 检查是否与笔画路径上的任何点接近
    for (let j = 0; j < strokePoints.length; j++) {
      const sp = strokePoints[j];
      const dx = ep.x - sp.x;
      const dy = ep.y - sp.y;
      const distSquared = dx * dx + dy * dy;

      if (distSquared <= thresholdSquared) {
        return true; // 相交
      }
    }
  }

  return false;
};

/**
 * 检测点是否在笔画边界框内
 * @param {Object} point - {x, y}
 * @param {Array} strokePoints - 笔画点数组
 * @param {number} padding - 边界框扩展值
 * @returns {boolean}
 */
export const isPointInStrokeBounds = (point, strokePoints, padding = 10) => {
  if (!strokePoints || strokePoints.length === 0) {return false;}

  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;

  strokePoints.forEach(p => {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  });

  minX -= padding;
  minY -= padding;
  maxX += padding;
  maxY += padding;

  return point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY;
};

/**
 * 检测矩形选择框内的笔画
 * @param {Object} rect - {x, y, width, height}
 * @param {Array} strokes - 笔画数组
 * @returns {Array} 选中的笔画ID数组
 */
export const getStrokesInRect = (rect, strokes) => {
  const selectedIds = [];

  strokes.forEach(stroke => {
    if (!stroke.points || stroke.points.length === 0) {return;}

    // 检查笔画的任意点是否在矩形内
    const hasPointInRect = stroke.points.some(p => {
      return (
        p.x >= rect.x &&
        p.x <= rect.x + rect.width &&
        p.y >= rect.y &&
        p.y <= rect.y + rect.height
      );
    });

    if (hasPointInRect) {
      selectedIds.push(stroke.id);
    }
  });

  return selectedIds;
};

/**
 * 移动笔画（更新所有点的坐标）
 * @param {Object} stroke - 笔画对象
 * @param {number} dx - X轴偏移
 * @param {number} dy - Y轴偏移
 * @returns {Object} 新的笔画对象
 */
export const moveStroke = (stroke, dx, dy) => {
  return {
    ...stroke,
    points: stroke.points.map(p => ({
      ...p,
      x: p.x + dx,
      y: p.y + dy,
    })),
  };
};

/**
 * 获取工具配置
 * @param {string|Object} tool - 工具类型或工具对象
 * @returns {Object} 工具配置
 */
export const getToolConfig = (tool) => {
  const toolType = typeof tool === 'object' ? tool.type : tool;
  const baseConfig = TOOL_CONFIGS[toolType] || TOOL_CONFIGS.pen;

  // 如果是对象，合并自定义配置
  if (typeof tool === 'object') {
    return {
      ...baseConfig,
      ...tool,
      type: toolType,
    };
  }

  return {
    ...baseConfig,
    type: toolType,
  };
};

/**
 * 计算笔画的边界框
 * @param {Array} points - 点数组
 * @returns {Object} {x, y, width, height}
 */
export const getStrokeBounds = (points) => {
  if (!points || points.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;

  points.forEach(p => {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  });

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
};

/**
 * 优化点插值 - 确保点与点之间有足够的密度
 * @param {Array} points - 原始点数组
 * @param {number} minDistance - 最小点间距（像素）
 * @param {number} maxDistance - 最大点间距（像素，超过此距离会插值）
 * @returns {Array} 优化后的点数组
 */
export const optimizePointInterpolation = (points, minDistance = 1, maxDistance = 10) => {
  if (!points || points.length < 2) {return points;}

  const optimized = [points[0]];

  for (let i = 1; i < points.length; i++) {
    const prev = optimized[optimized.length - 1];
    const curr = points[i];

    const dx = curr.x - prev.x;
    const dy = curr.y - prev.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > maxDistance) {
      // 距离过大，插入中间点
      const numSegments = Math.ceil(distance / maxDistance);
      const dt = 1 / numSegments;

      for (let j = 1; j < numSegments; j++) {
        const t = j * dt;
        const interpolated = {
          x: prev.x + dx * t,
          y: prev.y + dy * t,
          timestamp: prev.timestamp
            ? prev.timestamp + (curr.timestamp - prev.timestamp) * t
            : undefined,
          pressure: prev.pressure !== undefined && curr.pressure !== undefined
            ? prev.pressure + (curr.pressure - prev.pressure) * t
            : prev.pressure || curr.pressure || 1.0,
        };
        optimized.push(interpolated);
      }
    }
    // 距离合适或过小，都保留原有点
    optimized.push(curr);
  }

  return optimized;
};

/**
 * 简化笔画点（减少点数，优化性能）
 * @param {Array} points - 原始点数组
 * @param {number} tolerance - 容差值（越大简化越多）
 * @returns {Array} 简化后的点数组
 */
export const simplifyStroke = (points, tolerance = 2) => {
  if (!points || points.length <= 2) {return points;}

  // Douglas-Peucker 算法简化
  const simplify = (pts, tol) => {
    if (pts.length <= 2) {return pts;}

    let maxDist = 0;
    let maxIndex = 0;

    const first = pts[0];
    const last = pts[pts.length - 1];

    // 找到距离直线最远的点
    for (let i = 1; i < pts.length - 1; i++) {
      const dist = perpendicularDistance(pts[i], first, last);
      if (dist > maxDist) {
        maxDist = dist;
        maxIndex = i;
      }
    }

    // 如果最大距离大于容差，递归简化
    if (maxDist > tol) {
      const left = simplify(pts.slice(0, maxIndex + 1), tol);
      const right = simplify(pts.slice(maxIndex), tol);
      return [...left.slice(0, -1), ...right];
    } else {
      return [first, last];
    }
  };

  return simplify(points, tolerance);
};

/**
 * 计算点到直线的垂直距离
 */
const perpendicularDistance = (point, lineStart, lineEnd) => {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;

  if (dx === 0 && dy === 0) {
    return Math.sqrt(
      Math.pow(point.x - lineStart.x, 2) + Math.pow(point.y - lineStart.y, 2)
    );
  }

  const t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / (dx * dx + dy * dy);

  if (t < 0) {
    return Math.sqrt(
      Math.pow(point.x - lineStart.x, 2) + Math.pow(point.y - lineStart.y, 2)
    );
  } else if (t > 1) {
    return Math.sqrt(
      Math.pow(point.x - lineEnd.x, 2) + Math.pow(point.y - lineEnd.y, 2)
    );
  }

  const projX = lineStart.x + t * dx;
  const projY = lineStart.y + t * dy;

  return Math.sqrt(
    Math.pow(point.x - projX, 2) + Math.pow(point.y - projY, 2)
  );
};

