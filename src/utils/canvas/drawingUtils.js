/**
 * 画布绘图辅助工具函数
 *
 * 包含：
 * - 路径相交检测
 * - 淡出动画
 * - 选择框检测
 * - 笔画位移计算
 */
import realmService from '../../services/database/realmService';


/**
 * 检测点是否在矩形内
 * @param {Object} point - 点坐标 {x, y}
 * @param {Object} rect - 矩形 {x, y, width, height}
 * @returns {boolean}
 */
export function isPointInRect(point, rect) {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

/**
 * 检测笔画是否在选择框内
 * @param {Object} stroke - 笔画对象，包含points数组
 * @param {Object} box - 选择框 {x, y, width, height}
 * @param {number} threshold - 阈值，默认0.5表示50%的点在框内即算选中
 * @returns {boolean}
 */
export function isStrokeInBox(stroke, box, threshold = 0.5) {
  if (!stroke || !stroke.points || stroke.points.length === 0) {
    return false;
  }

  let pointsInBox = 0;
  const totalPoints = stroke.points.length;

  for (const point of stroke.points) {
    if (isPointInRect(point, box)) {
      pointsInBox++;
    }
  }

  // 如果超过阈值比例的点在框内，则认为笔画被选中
  return pointsInBox / totalPoints >= threshold;
}

/**
 * 计算两点之间的距离
 * @param {Object} p1 - 点1 {x, y}
 * @param {Object} p2 - 点2 {x, y}
 * @returns {number}
 */
export function distance(p1, p2) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * 检测点是否在路径附近（用于橡皮擦碰撞检测）
 * @param {Object} point - 点坐标 {x, y}
 * @param {Array} path - 路径点数组
 * @param {number} threshold - 碰撞半径
 * @returns {boolean}
 */
export function isPointNearPath(point, path, threshold) {
  if (!path || path.length === 0) {
    return false;
  }

  for (const pathPoint of path) {
    if (distance(point, pathPoint) <= threshold) {
      return true;
    }
  }

  return false;
}

/**
 * 检测两条路径是否相交（用于橡皮擦）
 * @param {Array} path1 - 路径1的点数组
 * @param {Array} path2 - 路径2的点数组
 * @param {number} threshold - 碰撞半径
 * @returns {boolean}
 */
export function isPathIntersecting(path1, path2, threshold) {
  if (!path1 || !path2 || path1.length === 0 || path2.length === 0) {
    return false;
  }

  // 简化算法：检查path1的每个点是否接近path2
  for (const point of path1) {
    if (isPointNearPath(point, path2, threshold)) {
      return true;
    }
  }

  return false;
}

/**
 * 检测橡皮擦路径与笔画是否相交
 * @param {Object} eraserStroke - 橡皮擦笔画，包含points和size
 * @param {Object} targetStroke - 目标笔画，包含points
 * @returns {boolean}
 */
export function isEraserIntersecting(eraserStroke, targetStroke) {
  const threshold = eraserStroke.size || 16;
  return isPathIntersecting(
    eraserStroke.points,
    targetStroke.points,
    threshold / 2
  );
}

/**
 * 移动笔画（更新所有点的坐标）
 * @param {Object} stroke - 笔画对象
 * @param {number} deltaX - X轴位移
 * @param {number} deltaY - Y轴位移
 * @returns {Object} 新的笔画对象
 */
export function moveStroke(stroke, deltaX, deltaY) {
  return {
    ...stroke,
    points: stroke.points.map(point => ({
      ...point,
      x: point.x + deltaX,
      y: point.y + deltaY,
    })),
  };
}

/**
 * 移动多个笔画
 * @param {Array} strokes - 笔画数组
 * @param {Array} strokeIds - 要移动的笔画ID数组
 * @param {number} deltaX - X轴位移
 * @param {number} deltaY - Y轴位移
 * @returns {Array} 更新后的笔画数组
 */
export function moveSelectedStrokes(strokes, strokeIds, deltaX, deltaY) {
  const idSet = new Set(strokeIds);

  return strokes.map(stroke => {
    if (idSet.has(stroke.id)) {
      return moveStroke(stroke, deltaX, deltaY);
    }
    return stroke;
  });
}

/**
 * 创建淡出动画控制器
 * @param {Function} updateOpacity - 更新透明度的回调 (strokeId, opacity) => void
 * @param {Function} removeStroke - 删除笔画的回调 (strokeId) => void
 * @param {number} duration - 持续时间（毫秒）
 * @param {number} steps - 动画步数，默认60
 * @returns {Function} 启动动画的函数 (strokeId) => timerId
 */
export function createFadeOutController(updateOpacity, removeStroke, duration = 3000, steps = 60) {
  const timers = new Map();

  return {
    /**
     * 启动淡出动画
     * @param {string} strokeId - 笔画ID
     * @returns {number} 定时器ID
     */
    start: (strokeId) => {
      // 如果已经有定时器在运行，先清除
      if (timers.has(strokeId)) {
        clearInterval(timers.get(strokeId));
      }

      const interval = duration / steps;
      let currentStep = 0;

      const timerId = setInterval(() => {
        currentStep++;
        const opacity = 1 - currentStep / steps;

        if (currentStep >= steps) {
          clearInterval(timerId);
          timers.delete(strokeId);
          removeStroke(strokeId);
        } else {
          updateOpacity(strokeId, opacity);
        }
      }, interval);

      timers.set(strokeId, timerId);
      return timerId;
    },

    /**
     * 取消某个笔画的淡出动画
     * @param {string} strokeId - 笔画ID
     */
    cancel: (strokeId) => {
      if (timers.has(strokeId)) {
        clearInterval(timers.get(strokeId));
        timers.delete(strokeId);
      }
    },

    /**
     * 清除所有淡出动画
     */
    cancelAll: () => {
      timers.forEach(timerId => clearInterval(timerId));
      timers.clear();
    },
  };
}

/**
 * 规范化选择框（确保width和height为正）
 * @param {Object} box - 原始选择框 {x, y, width, height}
 * @returns {Object} 规范化后的选择框
 */
export function normalizeBox(box) {
  const { x, y, width, height } = box;

  return {
    x: width >= 0 ? x : x + width,
    y: height >= 0 ? y : y + height,
    width: Math.abs(width),
    height: Math.abs(height),
  };
}

/**
 * 从起点和终点创建选择框
 * @param {Object} start - 起点 {x, y}
 * @param {Object} end - 终点 {x, y}
 * @returns {Object} 选择框 {x, y, width, height}
 */
export function createBoxFromPoints(start, end) {
  return normalizeBox({
    x: start.x,
    y: start.y,
    width: end.x - start.x,
    height: end.y - start.y,
  });
}

/**
 * 生成唯一ID
 * @returns {string}
 */
export function generateStrokeId() {
  return `stroke_${realmService.createObjectId()}`;
}

/**
 * 检测点是否在笔画的边界框内
 * @param {Object} point - 点 {x, y}
 * @param {Object} stroke - 笔画
 * @param {number} padding - 边界扩展，默认10
 * @returns {boolean}
 */
export function isPointInStrokeBounds(point, stroke, padding = 10) {
  if (!stroke || !stroke.points || stroke.points.length === 0) {
    return false;
  }

  const xs = stroke.points.map(p => p.x);
  const ys = stroke.points.map(p => p.y);

  const minX = Math.min(...xs) - padding;
  const maxX = Math.max(...xs) + padding;
  const minY = Math.min(...ys) - padding;
  const maxY = Math.max(...ys) + padding;

  return (
    point.x >= minX &&
    point.x <= maxX &&
    point.y >= minY &&
    point.y <= maxY
  );
}

/**
 * 过滤掉激光笔笔画（保存时使用）
 * @param {Array} strokes - 笔画数组
 * @returns {Array} 过滤后的笔画数组
 */
export function filterLaserStrokes(strokes) {
  return strokes.filter(stroke => stroke.tool !== 'laser');
}

/**
 * 应用荧光笔配置到Paint/Context
 * @param {Object} ctx - Canvas上下文或Paint对象
 * @param {Object} config - 工具配置
 */
export function applyHighlighterConfig(ctx, config) {
  if (config.type === 'highlighter') {
    if (ctx.globalAlpha !== undefined) {
      // Canvas 2D context
      ctx.globalAlpha = config.opacity || 0.4;
      ctx.globalCompositeOperation = config.blendMode || 'multiply';
    } else if (ctx.setAlpha) {
      // Paint对象（可能需要适配不同的API）
      ctx.setAlpha(Math.round((config.opacity || 0.4) * 255));
    }
  }
}

/**
 * 重置绘图上下文配置
 * @param {Object} ctx - Canvas上下文
 */
export function resetDrawingConfig(ctx) {
  if (ctx.globalAlpha !== undefined) {
    ctx.globalAlpha = 1.0;
    ctx.globalCompositeOperation = 'source-over';
  }
}




