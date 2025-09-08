/**
 * 缩放管理器
 * 用于管理手写内容的缩放和变换
 */
export class ScaleManager {
  constructor() {
    this.currentScale = 1;
    this.offsetX = 0;
    this.offsetY = 0;
    this.minScale = 0.1;
    this.maxScale = 10;
    this.scaleHistory = [];
  }

  /**
   * 设置缩放比例
   * @param {number} scale - 缩放比例
   */
  setScale(scale) {
    this.currentScale = Math.max(this.minScale, Math.min(this.maxScale, scale));
    this.scaleHistory.push({
      scale: this.currentScale,
      timestamp: Date.now()
    });
  }

  /**
   * 设置偏移量
   * @param {number} x - X轴偏移
   * @param {number} y - Y轴偏移
   */
  setOffset(x, y) {
    this.offsetX = x;
    this.offsetY = y;
  }

  /**
   * 获取当前变换状态
   * @returns {Object} 变换状态
   */
  getCurrentTransform() {
    return {
      scale: this.currentScale,
      offsetX: this.offsetX,
      offsetY: this.offsetY
    };
  }

  /**
   * 应用变换到坐标
   * @param {number} x - X坐标
   * @param {number} y - Y坐标
   * @returns {Object} 变换后的坐标
   */
  transformCoordinates(x, y) {
    return {
      x: (x - this.offsetX) / this.currentScale,
      y: (y - this.offsetY) / this.currentScale
    };
  }

  /**
   * 反向变换坐标
   * @param {number} x - X坐标
   * @param {number} y - Y坐标
   * @returns {Object} 反向变换后的坐标
   */
  inverseTransformCoordinates(x, y) {
    return {
      x: x * this.currentScale + this.offsetX,
      y: y * this.currentScale + this.offsetY
    };
  }

  /**
   * 重置变换
   */
  reset() {
    this.currentScale = 1;
    this.offsetX = 0;
    this.offsetY = 0;
    this.scaleHistory = [];
  }
}