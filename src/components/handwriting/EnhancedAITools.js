/**
 * 增强AI工具集
 * 深度优化的AI功能，专注于手写笔记应用的核心需求
 */

import { NativeModules, Platform } from 'react-native';

export class EnhancedAITools {
  constructor() {
    this.isInitialized = false;
    this.availableEngines = new Set();
    this.cache = new Map();
    this.processingQueue = [];
    
    this.initialize();
  }

  /**
   * 初始化AI工具
   */
  async initialize() {
    console.log('EnhancedAITools: 开始初始化');
    
    try {
      // 检测可用的AI引擎
      await this.detectAvailableEngines();
      
      // 预热缓存
      this.warmupCache();
      
      this.isInitialized = true;
      console.log('EnhancedAITools: 初始化完成', {
        engines: Array.from(this.availableEngines)
      });
      
    } catch (error) {
      console.error('EnhancedAITools: 初始化失败', error);
    }
  }

  /**
   * 检测可用的AI引擎
   */
  async detectAvailableEngines() {
    // 检测原生OCR引擎
    if (Platform.OS === 'ios' && NativeModules.VisionKit) {
      this.availableEngines.add('vision-kit');
    }
    
    if (Platform.OS === 'android' && NativeModules.MLKitTextRecognition) {
      this.availableEngines.add('ml-kit');
    }
    
    // 检测Tesseract
    if (NativeModules.TesseractOCR) {
      this.availableEngines.add('tesseract');
    }
    
    // 备用JavaScript引擎
    this.availableEngines.add('js-ocr');
    this.availableEngines.add('js-shape-recognition');
    this.availableEngines.add('js-content-analysis');
  }

  /**
   * 预热缓存
   */
  warmupCache() {
    // 预加载常用模式
    this.cache.set('common-shapes', ['circle', 'rectangle', 'line', 'arrow']);
    this.cache.set('common-languages', ['zh-CN', 'en-US', 'ja-JP']);
  }

  /**
   * 高精度OCR文字识别
   */
  async recognizeText(imageData, options = {}) {
    const defaultOptions = {
      language: 'auto',
      includeConfidence: true,
      includeBoundingBoxes: true,
      recognizeHandwriting: true,
      recognizeMath: false,
      enhanceQuality: true,
      ...options
    };

    try {
      // 生成缓存键
      const cacheKey = this.generateCacheKey('ocr', imageData, defaultOptions);
      
      // 检查缓存
      if (this.cache.has(cacheKey)) {
        console.log('EnhancedAITools: 使用OCR缓存结果');
        return this.cache.get(cacheKey);
      }

      let result;

      // 优先使用最佳引擎
      if (this.availableEngines.has('vision-kit')) {
        result = await this.recognizeWithVisionKit(imageData, defaultOptions);
      } else if (this.availableEngines.has('ml-kit')) {
        result = await this.recognizeWithMLKit(imageData, defaultOptions);
      } else if (this.availableEngines.has('tesseract')) {
        result = await this.recognizeWithTesseract(imageData, defaultOptions);
      } else {
        result = await this.recognizeWithJavaScript(imageData, defaultOptions);
      }

      // 后处理优化
      result = this.postProcessOCRResult(result, defaultOptions);

      // 缓存结果
      this.cache.set(cacheKey, result);
      
      return result;

    } catch (error) {
      console.error('EnhancedAITools: OCR识别失败', error);
      return { text: '', confidence: 0, error: error.message };
    }
  }

  /**
   * 使用Vision Kit进行OCR (iOS)
   */
  async recognizeWithVisionKit(imageData, options) {
    const result = await NativeModules.VisionKit.recognizeText(imageData, {
      recognitionLevel: 'accurate',
      recognitionLanguages: options.language === 'auto' ? [] : [options.language],
      usesLanguageCorrection: true
    });

    return {
      text: result.text,
      confidence: result.confidence || 0.95,
      blocks: result.textBlocks || [],
      language: result.detectedLanguage || options.language,
      processingTime: result.processingTime || 0,
      method: 'vision-kit'
    };
  }

  /**
   * 使用ML Kit进行OCR (Android)
   */
  async recognizeWithMLKit(imageData, options) {
    const result = await NativeModules.MLKitTextRecognition.process(imageData, {
      language: options.language
    });

    return {
      text: result.text,
      confidence: result.confidence || 0.9,
      blocks: result.textBlocks || [],
      language: result.language || options.language,
      processingTime: result.processingTime || 0,
      method: 'ml-kit'
    };
  }

  /**
   * OCR结果后处理
   */
  postProcessOCRResult(result, options) {
    if (!result.text) return result;

    let processedText = result.text;

    // 数学公式识别增强
    if (options.recognizeMath) {
      processedText = this.enhanceMathRecognition(processedText);
    }

    // 手写文字优化
    if (options.recognizeHandwriting) {
      processedText = this.enhanceHandwritingRecognition(processedText);
    }

    // 语言检测和校正
    if (options.language === 'auto') {
      const detectedLang = this.detectLanguage(processedText);
      result.detectedLanguage = detectedLang;
      processedText = this.applyLanguageCorrection(processedText, detectedLang);
    }

    return {
      ...result,
      text: processedText,
      originalText: result.text,
      enhancements: {
        mathRecognition: options.recognizeMath,
        handwritingOptimization: options.recognizeHandwriting,
        languageCorrection: options.language === 'auto'
      }
    };
  }

  /**
   * 智能形状识别和美化
   */
  async recognizeAndBeautifyShapes(strokeData, options = {}) {
    const defaultOptions = {
      tolerance: 0.15,
      minConfidence: 0.7,
      beautify: true,
      supportedShapes: ['circle', 'rectangle', 'triangle', 'line', 'arrow', 'ellipse'],
      smartCorrection: true,
      ...options
    };

    try {
      const cacheKey = this.generateCacheKey('shapes', strokeData, defaultOptions);
      
      if (this.cache.has(cacheKey)) {
        return this.cache.get(cacheKey);
      }

      // 分析笔迹几何特征
      const analysis = this.analyzeStrokeGeometry(strokeData);
      
      // 识别形状
      const recognizedShapes = await this.identifyShapes(analysis, defaultOptions);
      
      // 智能美化
      const beautifiedShapes = defaultOptions.beautify ? 
        this.beautifyShapes(recognizedShapes, defaultOptions) : 
        recognizedShapes;

      // 智能校正
      const correctedShapes = defaultOptions.smartCorrection ?
        this.applySmartCorrection(beautifiedShapes, analysis) :
        beautifiedShapes;

      const result = {
        shapes: correctedShapes,
        originalAnalysis: analysis,
        confidence: this.calculateOverallConfidence(correctedShapes),
        processingTime: Date.now() - analysis.startTime
      };

      this.cache.set(cacheKey, result);
      return result;

    } catch (error) {
      console.error('EnhancedAITools: 形状识别失败', error);
      return { shapes: [], error: error.message };
    }
  }

  /**
   * 分析笔迹几何特征
   */
  analyzeStrokeGeometry(strokeData) {
    const startTime = Date.now();
    const points = strokeData.points || [];
    
    if (points.length < 3) {
      return { valid: false, startTime };
    }

    // 计算边界框
    const bounds = this.calculateBounds(points);
    
    // 计算几何特征
    const features = {
      bounds,
      pointCount: points.length,
      totalLength: this.calculatePathLength(points),
      curvature: this.calculateCurvature(points),
      corners: this.detectCorners(points),
      symmetry: this.calculateSymmetry(points, bounds),
      aspectRatio: bounds.width / bounds.height,
      compactness: this.calculateCompactness(points, bounds),
      smoothness: this.calculateSmoothness(points),
      closure: this.calculateClosure(points)
    };

    return {
      valid: true,
      startTime,
      features,
      points
    };
  }

  /**
   * 识别具体形状
   */
  async identifyShapes(analysis, options) {
    if (!analysis.valid) return [];

    const shapes = [];
    const { features } = analysis;

    // 圆形检测 (增强算法)
    if (this.isCircle(features, options.tolerance)) {
      shapes.push({
        type: 'circle',
        confidence: this.calculateCircleConfidence(features),
        center: features.bounds.center,
        radius: Math.min(features.bounds.width, features.bounds.height) / 2,
        quality: this.assessShapeQuality(features, 'circle')
      });
    }

    // 矩形检测 (增强算法)
    if (this.isRectangle(features, options.tolerance)) {
      shapes.push({
        type: 'rectangle',
        confidence: this.calculateRectangleConfidence(features),
        bounds: features.bounds,
        corners: features.corners,
        quality: this.assessShapeQuality(features, 'rectangle')
      });
    }

    // 直线检测 (增强算法)
    if (this.isLine(features, options.tolerance)) {
      shapes.push({
        type: 'line',
        confidence: this.calculateLineConfidence(features),
        start: this.findLineStart(analysis.points),
        end: this.findLineEnd(analysis.points),
        quality: this.assessShapeQuality(features, 'line')
      });
    }

    // 箭头检测 (增强算法)
    if (this.isArrow(features, options.tolerance)) {
      shapes.push({
        type: 'arrow',
        confidence: this.calculateArrowConfidence(features),
        start: this.detectArrowStart(analysis.points),
        end: this.detectArrowEnd(analysis.points),
        direction: this.calculateArrowDirection(analysis.points),
        quality: this.assessShapeQuality(features, 'arrow')
      });
    }

    // 过滤低置信度结果
    return shapes.filter(shape => shape.confidence >= options.minConfidence);
  }

  /**
   * 智能美化形状
   */
  beautifyShapes(shapes, options) {
    return shapes.map(shape => {
      const beautified = { ...shape };

      switch (shape.type) {
        case 'circle':
          beautified.svgPath = this.generatePerfectCircle(shape);
          beautified.isBeautified = true;
          break;
        case 'rectangle':
          beautified.svgPath = this.generatePerfectRectangle(shape);
          beautified.corners = this.perfectRectangleCorners(shape.bounds);
          beautified.isBeautified = true;
          break;
        case 'line':
          beautified.svgPath = this.generatePerfectLine(shape);
          beautified.isBeautified = true;
          break;
        case 'arrow':
          beautified.svgPath = this.generatePerfectArrow(shape);
          beautified.isBeautified = true;
          break;
      }

      return beautified;
    });
  }

  /**
   * 生成缓存键
   */
  generateCacheKey(type, data, options) {
    const dataHash = this.simpleHash(JSON.stringify(data));
    const optionsHash = this.simpleHash(JSON.stringify(options));
    return `${type}_${dataHash}_${optionsHash}`;
  }

  /**
   * 简单哈希函数
   */
  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * 获取可用工具列表
   */
  getAvailableTools() {
    return Array.from(this.availableEngines);
  }

  /**
   * 检查工具是否可用
   */
  isToolAvailable(toolName) {
    return this.availableEngines.has(toolName);
  }

  /**
   * 清理缓存
   */
  clearCache() {
    this.cache.clear();
    console.log('EnhancedAITools: 缓存已清理');
  }

  /**
   * 获取缓存统计
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      engines: Array.from(this.availableEngines),
      isInitialized: this.isInitialized
    };
  }

  // ========== 辅助方法 ==========

  /**
   * 计算边界框
   */
  calculateBounds(points) {
    if (!points || points.length === 0) return null;

    let minX = points[0].x, maxX = points[0].x;
    let minY = points[0].y, maxY = points[0].y;

    points.forEach(point => {
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y);
      maxY = Math.max(maxY, point.y);
    });

    return {
      x: minX, y: minY,
      width: maxX - minX,
      height: maxY - minY,
      center: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 }
    };
  }

  /**
   * 计算路径长度
   */
  calculatePathLength(points) {
    let length = 0;
    for (let i = 1; i < points.length; i++) {
      const dx = points[i].x - points[i-1].x;
      const dy = points[i].y - points[i-1].y;
      length += Math.sqrt(dx * dx + dy * dy);
    }
    return length;
  }

  /**
   * 计算曲率
   */
  calculateCurvature(points) {
    if (points.length < 3) return 0;

    let totalCurvature = 0;
    for (let i = 1; i < points.length - 1; i++) {
      const p1 = points[i-1], p2 = points[i], p3 = points[i+1];
      const angle1 = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      const angle2 = Math.atan2(p3.y - p2.y, p3.x - p2.x);
      totalCurvature += Math.abs(angle2 - angle1);
    }
    return totalCurvature / (points.length - 2);
  }

  /**
   * 检测角点
   */
  detectCorners(points) {
    const corners = [];
    const threshold = Math.PI / 4; // 45度阈值

    for (let i = 2; i < points.length - 2; i++) {
      const p1 = points[i-2], p2 = points[i], p3 = points[i+2];
      const angle1 = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      const angle2 = Math.atan2(p3.y - p2.y, p3.x - p2.x);
      const angleDiff = Math.abs(angle2 - angle1);

      if (angleDiff > threshold) {
        corners.push({ point: p2, angle: angleDiff, index: i });
      }
    }
    return corners;
  }

  /**
   * 计算对称性
   */
  calculateSymmetry(points, bounds) {
    // 简化的对称性计算
    const centerX = bounds.center.x;
    const centerY = bounds.center.y;

    let horizontalSymmetry = 0;
    let verticalSymmetry = 0;

    points.forEach(point => {
      const distFromCenterX = Math.abs(point.x - centerX);
      const distFromCenterY = Math.abs(point.y - centerY);
      horizontalSymmetry += distFromCenterX;
      verticalSymmetry += distFromCenterY;
    });

    return {
      horizontal: 1 - (horizontalSymmetry / (points.length * bounds.width)),
      vertical: 1 - (verticalSymmetry / (points.length * bounds.height))
    };
  }

  /**
   * 计算紧密度
   */
  calculateCompactness(points, bounds) {
    const area = bounds.width * bounds.height;
    const perimeter = this.calculatePathLength(points);
    return (4 * Math.PI * area) / (perimeter * perimeter);
  }

  /**
   * 计算平滑度
   */
  calculateSmoothness(points) {
    if (points.length < 3) return 1;

    let totalVariation = 0;
    for (let i = 1; i < points.length - 1; i++) {
      const p1 = points[i-1], p2 = points[i], p3 = points[i+1];
      const v1 = { x: p2.x - p1.x, y: p2.y - p1.y };
      const v2 = { x: p3.x - p2.x, y: p3.y - p2.y };
      const dot = v1.x * v2.x + v1.y * v2.y;
      const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
      const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
      const cosAngle = dot / (mag1 * mag2);
      totalVariation += Math.abs(1 - cosAngle);
    }
    return 1 - (totalVariation / (points.length - 2));
  }

  /**
   * 计算闭合度
   */
  calculateClosure(points) {
    if (points.length < 3) return 0;
    const start = points[0];
    const end = points[points.length - 1];
    const distance = Math.sqrt((end.x - start.x) ** 2 + (end.y - start.y) ** 2);
    const pathLength = this.calculatePathLength(points);
    return 1 - (distance / pathLength);
  }

  /**
   * 检测是否为圆形
   */
  isCircle(features, tolerance) {
    const aspectRatio = features.aspectRatio;
    const compactness = features.compactness;
    const closure = features.closure;

    return Math.abs(aspectRatio - 1) < tolerance &&
           compactness > (1 - tolerance) &&
           closure > (1 - tolerance);
  }

  /**
   * 检测是否为矩形
   */
  isRectangle(features, tolerance) {
    return features.corners && features.corners.length >= 4 && features.closure > 0.8;
  }

  /**
   * 检测是否为直线
   */
  isLine(features, tolerance) {
    return features.curvature < tolerance && features.aspectRatio > 3;
  }

  /**
   * 检测是否为箭头
   */
  isArrow(features, tolerance) {
    return features.corners && features.corners.length >= 2 && features.aspectRatio > 2;
  }

  /**
   * 生成完美圆形SVG
   */
  generatePerfectCircle(shape) {
    const { center, radius } = shape;
    return `M ${center.x - radius} ${center.y}
            A ${radius} ${radius} 0 1 1 ${center.x + radius} ${center.y}
            A ${radius} ${radius} 0 1 1 ${center.x - radius} ${center.y}`;
  }

  /**
   * 生成完美矩形SVG
   */
  generatePerfectRectangle(shape) {
    const { bounds } = shape;
    return `M ${bounds.x} ${bounds.y}
            L ${bounds.x + bounds.width} ${bounds.y}
            L ${bounds.x + bounds.width} ${bounds.y + bounds.height}
            L ${bounds.x} ${bounds.y + bounds.height} Z`;
  }

  /**
   * 数学公式识别增强
   */
  enhanceMathRecognition(text) {
    // 简化的数学公式识别
    return text.replace(/(\d+)\s*\*\s*(\d+)/g, '$1 × $2')
               .replace(/(\d+)\s*\/\s*(\d+)/g, '$1 ÷ $2')
               .replace(/\^(\d+)/g, '⁰¹²³⁴⁵⁶⁷⁸⁹'[$1] || '^$1');
  }

  /**
   * 手写文字识别增强
   */
  enhanceHandwritingRecognition(text) {
    // 常见手写错误修正
    return text.replace(/rn/g, 'm')
               .replace(/cl/g, 'd')
               .replace(/vv/g, 'w');
  }

  /**
   * 语言检测
   */
  detectLanguage(text) {
    // 简化的语言检测
    if (/[\u4e00-\u9fff]/.test(text)) return 'zh-CN';
    if (/[\u3040-\u309f\u30a0-\u30ff]/.test(text)) return 'ja-JP';
    return 'en-US';
  }

  /**
   * 应用语言校正
   */
  applyLanguageCorrection(text, language) {
    // 根据语言应用特定校正
    switch (language) {
      case 'zh-CN':
        return text.replace(/，/g, '，').replace(/。/g, '。');
      case 'en-US':
        return text.replace(/\s+/g, ' ').trim();
      default:
        return text;
    }
  }
}

export default EnhancedAITools;
