/**
 * 高级笔迹数据类
 * 用于存储和管理手写笔迹的所有信息
 */

export class AdvancedStrokeData {
  constructor(style = {}) {
    this.id = this.generateUniqueId();
    this.points = [];
    this.style = {
      color: style.color || '#000000',
      width: style.width || 2,
      opacity: style.opacity || 1,
      tool: style.tool || 'pen'
    };
    this.bounds = {
      minX: Infinity,
      minY: Infinity,
      maxX: -Infinity,
      maxY: -Infinity
    };
    this.isComplete = false;
    this.timestamp = Date.now();
    this.transform = {
      scale: 1,
      translateX: 0,
      translateY: 0,
      rotation: 0,
      skewX: 0,
      skewY: 0
    };
    this.metadata = {};
  }

  /**
   * 生成唯一ID
   */
  generateUniqueId() {
    return `stroke_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 添加点到笔迹
   */
  addPoint(x, y, pressure = 1, tilt = 0, azimuth = 0, force = 0) {
    if (typeof x !== 'number' || typeof y !== 'number' || isNaN(x) || isNaN(y)) {
      console.warn('AdvancedStrokeData: 无效的点坐标', { x, y });
      return;
    }

    const point = {
      x,
      y,
      pressure,
      tilt,
      azimuth,
      force,
      timestamp: Date.now()
    };

    this.points.push(point);
    this.updateBounds(x, y);
  }

  /**
   * 更新边界框
   */
  updateBounds(x, y) {
    this.bounds.minX = Math.min(this.bounds.minX, x);
    this.bounds.minY = Math.min(this.bounds.minY, y);
    this.bounds.maxX = Math.max(this.bounds.maxX, x);
    this.bounds.maxY = Math.max(this.bounds.maxY, y);
  }

  /**
   * 完成笔迹
   */
  complete() {
    this.isComplete = true;
  }

  /**
   * 转换为SVG路径 - 使用平滑曲线
   */
  toSVGPath() {
    if (this.points.length === 0) return '';

    if (this.points.length === 1) {
      const point = this.points[0];
      return `M ${point.x} ${point.y} L ${point.x + 0.1} ${point.y + 0.1}`;
    }

    if (this.points.length === 2) {
      return `M ${this.points[0].x} ${this.points[0].y} L ${this.points[1].x} ${this.points[1].y}`;
    }

    // 使用平滑曲线
    let path = `M ${this.points[0].x} ${this.points[0].y}`;

    for (let i = 1; i < this.points.length - 1; i++) {
      const prev = this.points[i - 1];
      const curr = this.points[i];
      const next = this.points[i + 1];

      // 计算控制点
      const cp1x = prev.x + (curr.x - prev.x) * 0.5;
      const cp1y = prev.y + (curr.y - prev.y) * 0.5;
      const cp2x = curr.x + (next.x - curr.x) * 0.5;
      const cp2y = curr.y + (next.y - curr.y) * 0.5;

      // 使用二次贝塞尔曲线
      path += ` Q ${curr.x} ${curr.y} ${cp2x} ${cp2y}`;
    }

    // 添加最后一个点
    const lastPoint = this.points[this.points.length - 1];
    path += ` L ${lastPoint.x} ${lastPoint.y}`;

    return path;
  }

  /**
   * 序列化为JSON
   */
  toJSON() {
    return {
      id: this.id,
      points: this.points,
      style: this.style,
      bounds: this.bounds,
      isComplete: this.isComplete,
      timestamp: this.timestamp,
      transform: this.transform,
      metadata: this.metadata
    };
  }

  /**
   * 从JSON反序列化
   */
  static fromJSON(data) {
    const stroke = new AdvancedStrokeData(data.style);
    stroke.id = data.id || stroke.generateUniqueId();
    stroke.points = Array.isArray(data.points) ? data.points : [];
    stroke.bounds = data.bounds || {
      minX: Infinity,
      minY: Infinity,
      maxX: -Infinity,
      maxY: -Infinity
    };
    stroke.isComplete = Boolean(data.isComplete);
    stroke.timestamp = data.timestamp || Date.now();
    stroke.transform = data.transform || {
      scale: 1,
      translateX: 0,
      translateY: 0,
      rotation: 0,
      skewX: 0,
      skewY: 0
    };
    stroke.metadata = data.metadata || {};
    
    // 重新计算边界框
    if (stroke.points.length > 0) {
      stroke.bounds = {
        minX: Infinity,
        minY: Infinity,
        maxX: -Infinity,
        maxY: -Infinity
      };
      stroke.points.forEach(point => {
        stroke.updateBounds(point.x, point.y);
      });
    }
    
    return stroke;
  }

  /**
   * 获取笔迹长度
   */
  getLength() {
    if (this.points.length < 2) return 0;
    
    let length = 0;
    for (let i = 1; i < this.points.length; i++) {
      const prev = this.points[i - 1];
      const curr = this.points[i];
      const dx = curr.x - prev.x;
      const dy = curr.y - prev.y;
      length += Math.sqrt(dx * dx + dy * dy);
    }
    
    return length;
  }

  /**
   * 获取笔迹中心点
   */
  getCenter() {
    if (this.points.length === 0) return { x: 0, y: 0 };
    
    const sumX = this.points.reduce((sum, point) => sum + point.x, 0);
    const sumY = this.points.reduce((sum, point) => sum + point.y, 0);
    
    return {
      x: sumX / this.points.length,
      y: sumY / this.points.length
    };
  }

  /**
   * 克隆笔迹
   */
  clone() {
    return AdvancedStrokeData.fromJSON(this.toJSON());
  }

  /**
   * 应用变换
   */
  applyTransform(transform) {
    this.transform = { ...this.transform, ...transform };
    
    // 应用变换到所有点
    this.points = this.points.map(point => ({
      ...point,
      x: point.x * transform.scale + (transform.translateX || 0),
      y: point.y * transform.scale + (transform.translateY || 0)
    }));
    
    // 重新计算边界框
    this.bounds = {
      minX: Infinity,
      minY: Infinity,
      maxX: -Infinity,
      maxY: -Infinity
    };
    
    this.points.forEach(point => {
      this.updateBounds(point.x, point.y);
    });
  }

  /**
   * 简化笔迹点（减少点数以提高性能）
   */
  simplify(tolerance = 1.0) {
    if (this.points.length <= 2) return;
    
    const simplified = [this.points[0]];
    
    for (let i = 1; i < this.points.length - 1; i++) {
      const prev = this.points[i - 1];
      const curr = this.points[i];
      const next = this.points[i + 1];
      
      // 计算点到直线的距离
      const distance = this.pointToLineDistance(curr, prev, next);
      
      if (distance > tolerance) {
        simplified.push(curr);
      }
    }
    
    simplified.push(this.points[this.points.length - 1]);
    this.points = simplified;
  }

  /**
   * 计算点到直线的距离
   */
  pointToLineDistance(point, lineStart, lineEnd) {
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
  }
}
