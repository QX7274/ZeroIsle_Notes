/**
 * 企业级手写引擎
 * 实现低延迟、高性能的手写体验
 */

import { Platform } from 'react-native';

class HandwritingEngine {
  constructor() {
    this.isInitialized = false;
    this.currentStroke = null;
    this.strokes = [];
    this.canvas = null;
    this.context = null;
    
    // 性能优化参数
    this.maxPointsPerStroke = 1000;
    this.smoothingFactor = 0.3;
    this.pressureSensitivity = 1.0;
    
    // 手写笔检测
    this.isPenActive = false;
    this.lastInputType = 'finger';
    
    // 预测性绘制
    this.predictionEnabled = true;
    this.predictionPoints = [];
    
    // 事件监听器
    this.listeners = new Map();
  }

  /**
   * 初始化手写引擎
   */
  initialize(canvas, options = {}) {
    try {
      this.canvas = canvas;
      this.context = canvas.getContext('2d');
      
      // 设置画布属性
      this.setupCanvas(options);
      
      // 初始化事件监听
      this.setupEventListeners();
      
      this.isInitialized = true;
      console.log('HandwritingEngine: 初始化完成');
      
      return true;
    } catch (error) {
      console.error('HandwritingEngine: 初始化失败:', error);
      return false;
    }
  }

  /**
   * 设置画布属性
   */
  setupCanvas(options) {
    const {
      backgroundColor = '#ffffff',
      strokeColor = '#000000',
      strokeWidth = 2,
      lineCap = 'round',
      lineJoin = 'round'
    } = options;

    this.context.fillStyle = backgroundColor;
    this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    this.context.strokeStyle = strokeColor;
    this.context.lineWidth = strokeWidth;
    this.context.lineCap = lineCap;
    this.context.lineJoin = lineJoin;
    
    // 启用硬件加速
    this.context.imageSmoothingEnabled = true;
    this.context.imageSmoothingQuality = 'high';
  }

  /**
   * 设置事件监听器
   */
  setupEventListeners() {
    // 触摸开始
    this.canvas.addEventListener('touchstart', this.handleTouchStart.bind(this));
    this.canvas.addEventListener('pointerdown', this.handlePointerDown.bind(this));
    
    // 触摸移动
    this.canvas.addEventListener('touchmove', this.handleTouchMove.bind(this));
    this.canvas.addEventListener('pointermove', this.handlePointerMove.bind(this));
    
    // 触摸结束
    this.canvas.addEventListener('touchend', this.handleTouchEnd.bind(this));
    this.canvas.addEventListener('pointerup', this.handlePointerUp.bind(this));
  }

  /**
   * 检测输入类型（手指 vs 手写笔）
   */
  detectInputType(event) {
    // 检查压感
    if (event.pressure && event.pressure > 0.1) {
      this.lastInputType = 'pen';
      this.isPenActive = true;
      return 'pen';
    }
    
    // 检查触控面积
    if (event.radiusX && event.radiusY) {
      const area = Math.PI * event.radiusX * event.radiusY;
      if (area < 50) { // 小触控面积通常是笔
        this.lastInputType = 'pen';
        this.isPenActive = true;
        return 'pen';
      }
    }
    
    // 检查倾斜角度
    if (event.tiltX !== undefined || event.tiltY !== undefined) {
      this.lastInputType = 'pen';
      this.isPenActive = true;
      return 'pen';
    }
    
    // 检查指针类型
    if (event.pointerType === 'pen') {
      this.lastInputType = 'pen';
      this.isPenActive = true;
      return 'pen';
    }
    
    this.lastInputType = 'finger';
    this.isPenActive = false;
    return 'finger';
  }

  /**
   * 处理触摸开始
   */
  handleTouchStart(event) {
    event.preventDefault();
    const touch = event.touches[0];
    this.startStroke(touch.clientX, touch.clientY, event);
  }

  /**
   * 处理指针按下
   */
  handlePointerDown(event) {
    event.preventDefault();
    this.startStroke(event.clientX, event.clientY, event);
  }

  /**
   * 开始新的笔画
   */
  startStroke(x, y, event) {
    const inputType = this.detectInputType(event);
    
    // 如果是手指且手写笔激活，忽略手指输入
    if (inputType === 'finger' && this.isPenActive) {
      return;
    }
    
    const point = this.createPoint(x, y, event);
    
    this.currentStroke = {
      id: Date.now(),
      points: [point],
      inputType,
      startTime: performance.now(),
      color: this.context.strokeStyle,
      width: this.getStrokeWidth(event),
      completed: false
    };
    
    // 开始绘制路径
    this.context.beginPath();
    this.context.moveTo(point.x, point.y);
    
    this.notifyListeners('strokeStart', this.currentStroke);
  }

  /**
   * 创建点对象
   */
  createPoint(x, y, event) {
    return {
      x: x - this.canvas.offsetLeft,
      y: y - this.canvas.offsetTop,
      pressure: event.pressure || 0.5,
      timestamp: performance.now(),
      tiltX: event.tiltX || 0,
      tiltY: event.tiltY || 0,
      radiusX: event.radiusX || 1,
      radiusY: event.radiusY || 1
    };
  }

  /**
   * 获取笔画宽度（基于压感）
   */
  getStrokeWidth(event) {
    const basePressure = event.pressure || 0.5;
    const baseWidth = this.context.lineWidth;
    
    if (this.lastInputType === 'pen') {
      // 手写笔支持压感变化
      return baseWidth * (0.5 + basePressure * this.pressureSensitivity);
    } else {
      // 手指使用固定宽度
      return baseWidth;
    }
  }

  /**
   * 处理触摸移动
   */
  handleTouchMove(event) {
    event.preventDefault();
    if (!this.currentStroke) return;
    
    const touch = event.touches[0];
    this.continueStroke(touch.clientX, touch.clientY, event);
  }

  /**
   * 处理指针移动
   */
  handlePointerMove(event) {
    event.preventDefault();
    if (!this.currentStroke) return;
    
    this.continueStroke(event.clientX, event.clientY, event);
  }

  /**
   * 继续当前笔画
   */
  continueStroke(x, y, event) {
    if (!this.currentStroke) return;
    
    const point = this.createPoint(x, y, event);
    this.currentStroke.points.push(point);
    
    // 限制点数量，避免内存溢出
    if (this.currentStroke.points.length > this.maxPointsPerStroke) {
      this.currentStroke.points.shift();
    }
    
    // 绘制到当前点
    this.drawToPoint(point);
    
    // 预测性绘制
    if (this.predictionEnabled) {
      this.predictNextPoints(point);
    }
    
    this.notifyListeners('strokeContinue', { stroke: this.currentStroke, point });
  }

  /**
   * 绘制到指定点
   */
  drawToPoint(point) {
    // 动态调整线宽
    const width = this.getStrokeWidth({ pressure: point.pressure });
    this.context.lineWidth = width;
    
    this.context.lineTo(point.x, point.y);
    this.context.stroke();
  }

  /**
   * 预测下一个点（减少延迟感）
   */
  predictNextPoints(currentPoint) {
    const points = this.currentStroke.points;
    if (points.length < 3) return;
    
    // 简单的线性预测
    const p1 = points[points.length - 3];
    const p2 = points[points.length - 2];
    const p3 = currentPoint;
    
    const vx = (p3.x - p1.x) / 2;
    const vy = (p3.y - p1.y) / 2;
    
    const predictedPoint = {
      x: p3.x + vx * 0.3,
      y: p3.y + vy * 0.3,
      pressure: p3.pressure,
      predicted: true
    };
    
    // 临时绘制预测点
    this.context.save();
    this.context.globalAlpha = 0.3;
    this.context.lineTo(predictedPoint.x, predictedPoint.y);
    this.context.stroke();
    this.context.restore();
  }

  /**
   * 处理触摸结束
   */
  handleTouchEnd(event) {
    event.preventDefault();
    this.endStroke();
  }

  /**
   * 处理指针抬起
   */
  handlePointerUp(event) {
    event.preventDefault();
    this.endStroke();
  }

  /**
   * 结束当前笔画
   */
  endStroke() {
    if (!this.currentStroke) return;
    
    this.currentStroke.completed = true;
    this.currentStroke.endTime = performance.now();
    this.currentStroke.duration = this.currentStroke.endTime - this.currentStroke.startTime;
    
    // 平滑处理
    this.smoothStroke(this.currentStroke);
    
    // 保存笔画
    this.strokes.push(this.currentStroke);
    
    this.notifyListeners('strokeEnd', this.currentStroke);
    
    this.currentStroke = null;
  }

  /**
   * 平滑笔画
   */
  smoothStroke(stroke) {
    if (stroke.points.length < 3) return;
    
    const smoothedPoints = [];
    smoothedPoints.push(stroke.points[0]);
    
    for (let i = 1; i < stroke.points.length - 1; i++) {
      const p0 = stroke.points[i - 1];
      const p1 = stroke.points[i];
      const p2 = stroke.points[i + 1];
      
      const smoothedPoint = {
        x: p0.x * this.smoothingFactor + p1.x * (1 - 2 * this.smoothingFactor) + p2.x * this.smoothingFactor,
        y: p0.y * this.smoothingFactor + p1.y * (1 - 2 * this.smoothingFactor) + p2.y * this.smoothingFactor,
        pressure: p1.pressure,
        timestamp: p1.timestamp
      };
      
      smoothedPoints.push(smoothedPoint);
    }
    
    smoothedPoints.push(stroke.points[stroke.points.length - 1]);
    stroke.points = smoothedPoints;
  }

  /**
   * 添加事件监听器
   */
  addEventListener(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  /**
   * 通知监听器
   */
  notifyListeners(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('HandwritingEngine: 监听器回调错误:', error);
        }
      });
    }
  }

  /**
   * 清除画布
   */
  clear() {
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.strokes = [];
    this.currentStroke = null;
    this.notifyListeners('clear');
  }

  /**
   * 销毁引擎
   */
  destroy() {
    this.listeners.clear();
    this.strokes = [];
    this.currentStroke = null;
    this.isInitialized = false;
  }
}

export default HandwritingEngine;
