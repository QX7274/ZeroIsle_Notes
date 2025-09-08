/**
 * 缩放一致性管理器
 * 用于确保手写内容在不同缩放级别下的一致性
 */
export class ScaleConsistencyManager {
  constructor() {
    this.scaleLevels = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
    this.currentScaleLevel = 1.0;
    this.consistencyRules = {
      minStrokeWidth: 0.5,
      maxStrokeWidth: 10,
      baseStrokeWidth: 2
    };
  }

  /**
   * 设置缩放级别
   * @param {number} scale - 缩放比例
   */
  setScaleLevel(scale) {
    // 找到最接近的缩放级别
    const closestLevel = this.scaleLevels.reduce((prev, curr) => 
      Math.abs(curr - scale) < Math.abs(prev - scale) ? curr : prev
    );
    
    this.currentScaleLevel = closestLevel;
  }

  /**
   * 根据缩放级别调整笔迹宽度
   * @param {number} baseWidth - 基础宽度
   * @returns {number} 调整后的宽度
   */
  adjustStrokeWidth(baseWidth) {
    const adjustedWidth = baseWidth * this.currentScaleLevel;
    
    return Math.max(
      this.consistencyRules.minStrokeWidth,
      Math.min(this.consistencyRules.maxStrokeWidth, adjustedWidth)
    );
  }

  /**
   * 获取当前缩放级别
   * @returns {number} 当前缩放级别
   */
  getCurrentScaleLevel() {
    return this.currentScaleLevel;
  }

  /**
   * 检查缩放一致性
   * @param {Array} strokes - 笔迹数组
   * @returns {Object} 一致性检查结果
   */
  checkConsistency(strokes) {
    const issues = [];
    
    strokes.forEach((stroke, index) => {
      if (stroke.style && stroke.style.width) {
        const expectedWidth = this.adjustStrokeWidth(this.consistencyRules.baseStrokeWidth);
        const actualWidth = stroke.style.width;
        
        if (Math.abs(actualWidth - expectedWidth) > 0.1) {
          issues.push({
            strokeIndex: index,
            expectedWidth,
            actualWidth,
            scaleLevel: this.currentScaleLevel
          });
        }
      }
    });
    
    return {
      isConsistent: issues.length === 0,
      issues,
      scaleLevel: this.currentScaleLevel
    };
  }

  /**
   * 修复缩放一致性问题
   * @param {Array} strokes - 笔迹数组
   * @returns {Array} 修复后的笔迹数组
   */
  fixConsistency(strokes) {
    return strokes.map(stroke => {
      if (stroke.style && stroke.style.width) {
        const adjustedWidth = this.adjustStrokeWidth(this.consistencyRules.baseStrokeWidth);
        return {
          ...stroke,
          style: {
            ...stroke.style,
            width: adjustedWidth
          }
        };
      }
      return stroke;
    });
  }

  /**
   * 重置管理器
   */
  reset() {
    this.currentScaleLevel = 1.0;
  }
}