/**
 * 硬件级手写笔检测系统
 * 基于电磁感应、压感、蓝牙协议等硬件特征的企业级检测算法
 */

import { Platform, NativeModules } from 'react-native';

class HardwarePenDetection {
  constructor() {
    this.isInitialized = false;
    this.activePens = new Map(); // 存储已配对的手写笔
    this.detectionHistory = []; // 检测历史，用于学习用户习惯
    this.calibrationData = null; // 校准数据
    
    // 检测参数
    this.config = {
      // 压感检测阈值
      pressureThreshold: {
        min: 0.05,  // 最小压感值
        max: 0.95,  // 最大压感值
        variation: 0.1  // 压感变化阈值
      },
      
      // 触控面积阈值
      areaThreshold: {
        penMax: 50,     // 手写笔最大触控面积 (px²)
        fingerMin: 100  // 手指最小触控面积 (px²)
      },
      
      // 速度和精度阈值
      motionThreshold: {
        maxPenVelocity: 800,    // 手写笔最大速度
        maxAcceleration: 200,   // 最大加速度变化
        smoothnessFactor: 0.8   // 平滑度因子
      },
      
      // 时间窗口
      timeWindow: {
        continuity: 200,    // 连续性检测窗口 (ms)
        antiTouch: 300,     // 防误触时间窗口 (ms)
        learning: 5000      // 学习窗口 (ms)
      }
    };
  }

  /**
   * 初始化检测系统
   */
  async initialize() {
    try {
      // 检测设备支持的手写笔类型
      await this.detectSupportedPens();
      
      // 加载校准数据
      await this.loadCalibrationData();
      
      // 初始化硬件监听
      this.setupHardwareListeners();
      
      this.isInitialized = true;
      console.log('HardwarePenDetection: 初始化完成');
      
      return true;
    } catch (error) {
      console.error('HardwarePenDetection: 初始化失败:', error);
      return false;
    }
  }

  /**
   * 检测设备支持的手写笔类型
   */
  async detectSupportedPens() {
    const supportedPens = [];
    
    if (Platform.OS === 'ios') {
      // 检测 Apple Pencil 支持
      if (this.supportsApplePencil()) {
        supportedPens.push({
          type: 'apple_pencil',
          generation: this.getApplePencilGeneration(),
          features: ['pressure', 'tilt', 'azimuth', 'bluetooth']
        });
      }
    } else if (Platform.OS === 'android') {
      // 检测 Android 手写笔支持
      const androidPens = await this.detectAndroidPens();
      supportedPens.push(...androidPens);
    }
    
    this.supportedPens = supportedPens;
    console.log('支持的手写笔:', supportedPens);
  }

  /**
   * 检测 Apple Pencil 支持
   */
  supportsApplePencil() {
    // 通过设备型号判断是否支持 Apple Pencil
    const deviceModel = this.getDeviceModel();
    const supportedModels = [
      'iPad Pro', 'iPad Air', 'iPad mini', 'iPad (6th generation)',
      'iPad (7th generation)', 'iPad (8th generation)', 'iPad (9th generation)'
    ];
    
    return supportedModels.some(model => deviceModel.includes(model));
  }

  /**
   * 获取 Apple Pencil 代数
   */
  getApplePencilGeneration() {
    const deviceModel = this.getDeviceModel();
    
    // Apple Pencil 2 支持的设备
    const pencil2Models = [
      'iPad Pro 11-inch', 'iPad Pro 12.9-inch (3rd generation)',
      'iPad Air (4th generation)', 'iPad mini (6th generation)'
    ];
    
    if (pencil2Models.some(model => deviceModel.includes(model))) {
      return 2;
    }
    
    return 1;
  }

  /**
   * 检测 Android 手写笔
   */
  async detectAndroidPens() {
    const pens = [];
    
    try {
      // 检测 S Pen (Samsung)
      if (this.supportsSPen()) {
        pens.push({
          type: 's_pen',
          features: ['pressure', 'tilt', 'button', 'air_command']
        });
      }
      
      // 检测 Surface Pen (Microsoft)
      if (this.supportsSurfacePen()) {
        pens.push({
          type: 'surface_pen',
          features: ['pressure', 'tilt', 'eraser', 'bluetooth']
        });
      }
      
      // 检测通用 USI 笔
      if (this.supportsUSI()) {
        pens.push({
          type: 'usi_pen',
          features: ['pressure', 'tilt']
        });
      }
      
    } catch (error) {
      console.error('检测 Android 手写笔失败:', error);
    }
    
    return pens;
  }

  /**
   * 企业级手写笔检测算法
   * 基于多维硬件特征的综合判断
   */
  detectInputType(event) {
    if (!this.isInitialized) {
      return this.fallbackDetection(event);
    }

    const currentTime = Date.now();
    let penScore = 0;
    let confidence = 0;
    const features = this.extractFeatures(event);

    // === 硬件级特征检测 ===

    // 1. 蓝牙协议检测 (最高优先级)
    if (this.detectBluetoothPen(event)) {
      penScore += 10;
      confidence += 0.5;
      console.log('检测到蓝牙手写笔协议');
    }

    // 2. 电磁感应检测
    if (this.detectElectromagneticSignal(event)) {
      penScore += 8;
      confidence += 0.4;
      console.log('检测到电磁感应信号');
    }

    // 3. 压感特征检测
    const pressureScore = this.analyzePressure(features.pressure);
    penScore += pressureScore.score;
    confidence += pressureScore.confidence;

    // 4. 触控面积分析
    const areaScore = this.analyzeTouchArea(features.area);
    penScore += areaScore.score;
    confidence += areaScore.confidence;

    // 5. 倾斜角度检测
    const tiltScore = this.analyzeTilt(features.tilt);
    penScore += tiltScore.score;
    confidence += tiltScore.confidence;

    // 6. 运动特征分析
    const motionScore = this.analyzeMotion(features.motion);
    penScore += motionScore.score;
    confidence += motionScore.confidence;

    // 7. 指针类型检测
    if (event.pointerType === 'pen') {
      penScore += 6;
      confidence += 0.3;
    }

    // === 上下文和学习算法 ===

    // 8. 历史行为分析
    const historyScore = this.analyzeHistory(features);
    penScore += historyScore.score;
    confidence += historyScore.confidence;

    // 9. 连续性检测
    const continuityScore = this.analyzeContinuity(currentTime);
    penScore += continuityScore.score;
    confidence += continuityScore.confidence;

    // === 动态阈值计算 ===
    const dynamicThreshold = this.calculateDynamicThreshold(confidence, features);
    const detectedType = penScore >= dynamicThreshold ? 'pen' : 'finger';

    // 更新检测历史
    this.updateDetectionHistory({
      timestamp: currentTime,
      features,
      score: penScore,
      confidence,
      result: detectedType
    });

    // 自适应学习
    this.adaptiveLearn(features, detectedType);

    if (__DEV__) {
      console.log(`硬件级检测: ${detectedType} (得分: ${penScore.toFixed(1)}, 置信度: ${confidence.toFixed(2)}, 阈值: ${dynamicThreshold.toFixed(1)})`);
      console.log('特征:', features);
    }

    return detectedType;
  }

  /**
   * 提取输入特征
   */
  extractFeatures(event) {
    return {
      pressure: event.pressure || event.force || 0.5,
      area: this.calculateTouchArea(event),
      tilt: {
        x: event.tiltX || 0,
        y: event.tiltY || 0,
        magnitude: Math.sqrt((event.tiltX || 0) ** 2 + (event.tiltY || 0) ** 2)
      },
      motion: {
        velocity: Math.sqrt((event.velocityX || 0) ** 2 + (event.velocityY || 0) ** 2),
        acceleration: this.calculateAcceleration(event)
      },
      position: {
        x: event.x || event.clientX || 0,
        y: event.y || event.clientY || 0
      },
      timestamp: Date.now()
    };
  }

  /**
   * 检测蓝牙手写笔
   */
  detectBluetoothPen(event) {
    // 检查是否有已配对的蓝牙手写笔
    if (this.activePens.size > 0) {
      // 检查事件是否来自已知的手写笔
      const penId = this.getPenIdFromEvent(event);
      return this.activePens.has(penId);
    }
    
    return false;
  }

  /**
   * 检测电磁感应信号
   */
  detectElectromagneticSignal(event) {
    // 检查是否有电磁感应特征
    // 这通常通过设备特定的 API 或事件属性来检测
    return event.inputSource === 'electromagnetic' || 
           event.penType === 'electromagnetic' ||
           (event.pressure > 0 && event.tiltX !== undefined);
  }

  /**
   * 分析压感特征
   */
  analyzePressure(pressure) {
    let score = 0;
    let confidence = 0;

    if (pressure > this.config.pressureThreshold.min && 
        pressure < this.config.pressureThreshold.max) {
      
      // 压感值在合理范围内
      const pressureVariation = Math.abs(pressure - 0.5);
      score += 4 + (pressureVariation * 3);
      confidence += 0.35;

      // 检查压感变化的细腻程度
      if (this.detectionHistory.length > 0) {
        const lastPressure = this.detectionHistory[this.detectionHistory.length - 1]?.features?.pressure || 0.5;
        const pressureChange = Math.abs(pressure - lastPressure);
        
        if (pressureChange > 0.01 && pressureChange < 0.3) {
          // 细腻的压感变化，很可能是手写笔
          score += 2;
          confidence += 0.15;
        }
      }
    }

    return { score, confidence };
  }

  /**
   * 分析触控面积
   */
  analyzeTouchArea(area) {
    let score = 0;
    let confidence = 0;

    if (area < this.config.areaThreshold.penMax) {
      // 小触控面积，很可能是笔
      score += 4;
      confidence += 0.3;
      
      if (area < 20) {
        // 非常小的触控面积，几乎确定是笔
        score += 2;
        confidence += 0.2;
      }
    } else if (area > this.config.areaThreshold.fingerMin) {
      // 大触控面积，很可能是手指
      score -= 3;
    }

    return { score, confidence };
  }

  /**
   * 分析倾斜角度
   */
  analyzeTilt(tilt) {
    let score = 0;
    let confidence = 0;

    if (tilt.magnitude > 0) {
      // 有倾斜角度，手写笔独有特征
      score += 5;
      confidence += 0.25;
      
      // 倾斜角度在合理范围内
      if (tilt.magnitude > 5 && tilt.magnitude < 80) {
        score += 2;
        confidence += 0.15;
      }
    }

    return { score, confidence };
  }

  /**
   * 分析运动特征
   */
  analyzeMotion(motion) {
    let score = 0;
    let confidence = 0;

    // 手写笔通常移动更精确，速度相对稳定
    if (motion.velocity < this.config.motionThreshold.maxPenVelocity) {
      score += 1;
      confidence += 0.1;
    }

    // 加速度变化平滑
    if (motion.acceleration < this.config.motionThreshold.maxAcceleration) {
      score += 1;
      confidence += 0.1;
    }

    return { score, confidence };
  }

  /**
   * 分析历史行为
   */
  analyzeHistory(currentFeatures) {
    let score = 0;
    let confidence = 0;

    if (this.detectionHistory.length === 0) {
      return { score, confidence };
    }

    // 分析最近的检测结果
    const recentHistory = this.detectionHistory.slice(-5);
    const penCount = recentHistory.filter(h => h.result === 'pen').length;
    const fingerCount = recentHistory.filter(h => h.result === 'finger').length;

    if (penCount > fingerCount) {
      // 最近更多地检测为笔
      score += 2;
      confidence += 0.1;
    }

    // 特征一致性检查
    const featureConsistency = this.calculateFeatureConsistency(currentFeatures, recentHistory);
    score += featureConsistency * 2;
    confidence += featureConsistency * 0.1;

    return { score, confidence };
  }

  /**
   * 分析连续性
   */
  analyzeContinuity(currentTime) {
    let score = 0;
    let confidence = 0;

    if (this.detectionHistory.length > 0) {
      const lastDetection = this.detectionHistory[this.detectionHistory.length - 1];
      const timeDelta = currentTime - lastDetection.timestamp;

      if (timeDelta < this.config.timeWindow.continuity && lastDetection.result === 'pen') {
        // 连续的笔输入
        score += 3;
        confidence += 0.15;
      }
    }

    return { score, confidence };
  }

  /**
   * 计算动态阈值
   */
  calculateDynamicThreshold(confidence, features) {
    let baseThreshold = 5.0;

    // 根据置信度调整
    baseThreshold -= confidence * 2;

    // 根据设备类型调整
    if (Platform.OS === 'ios' && this.supportsApplePencil()) {
      baseThreshold -= 1; // iPad 对手写笔支持更好
    }

    // 根据特征强度调整
    if (features.pressure > 0.1 && features.tilt.magnitude > 0) {
      baseThreshold -= 1; // 有明显的笔特征
    }

    return Math.max(2.0, baseThreshold);
  }

  /**
   * 更新检测历史
   */
  updateDetectionHistory(detection) {
    this.detectionHistory.push(detection);
    
    // 保持历史记录在合理范围内
    if (this.detectionHistory.length > 100) {
      this.detectionHistory = this.detectionHistory.slice(-50);
    }
  }

  /**
   * 自适应学习
   */
  adaptiveLearn(features, result) {
    // 基于用户的使用模式调整检测参数
    // 这里可以实现机器学习算法来优化检测精度
    
    // 简单的参数调整示例
    if (result === 'pen' && features.pressure < 0.1) {
      // 如果检测为笔但压感很低，可能需要调整压感阈值
      this.config.pressureThreshold.min = Math.min(
        this.config.pressureThreshold.min, 
        features.pressure * 0.8
      );
    }
  }

  /**
   * 计算触控面积
   */
  calculateTouchArea(event) {
    const radiusX = event.radiusX || event.touchMajor || 5;
    const radiusY = event.radiusY || event.touchMinor || 5;
    return Math.PI * radiusX * radiusY;
  }

  /**
   * 计算加速度
   */
  calculateAcceleration(event) {
    if (this.detectionHistory.length === 0) return 0;
    
    const lastEvent = this.detectionHistory[this.detectionHistory.length - 1];
    const currentVelocity = Math.sqrt((event.velocityX || 0) ** 2 + (event.velocityY || 0) ** 2);
    const lastVelocity = lastEvent.features?.motion?.velocity || 0;
    
    return Math.abs(currentVelocity - lastVelocity);
  }

  /**
   * 获取设备型号
   */
  getDeviceModel() {
    // 这里需要使用原生模块获取设备信息
    // 简化实现
    return Platform.OS === 'ios' ? 'iPad Pro' : 'Android Device';
  }

  /**
   * 回退检测算法
   */
  fallbackDetection(event) {
    // 当硬件检测不可用时的简单算法
    const pressure = event.pressure || 0.5;
    const area = this.calculateTouchArea(event);
    
    if (pressure > 0.1 && area < 50) {
      return 'pen';
    }
    
    return 'finger';
  }

  /**
   * 设置硬件监听器
   */
  setupHardwareListeners() {
    // 监听蓝牙设备连接/断开
    // 监听手写笔配对状态
    // 这里需要原生模块支持
  }

  /**
   * 加载校准数据
   */
  async loadCalibrationData() {
    // 从本地存储加载用户的校准数据
    // 包括个人使用习惯、设备特定参数等
  }

  /**
   * 检测各种 Android 手写笔支持
   */
  supportsSPen() {
    // 检测三星 S Pen 支持
    return false; // 简化实现
  }

  supportsSurfacePen() {
    // 检测微软 Surface Pen 支持
    return false; // 简化实现
  }

  supportsUSI() {
    // 检测 USI (Universal Stylus Initiative) 支持
    return false; // 简化实现
  }

  getPenIdFromEvent(event) {
    // 从事件中提取手写笔 ID
    return event.pointerId || 'unknown';
  }

  calculateFeatureConsistency(currentFeatures, history) {
    // 计算特征一致性
    return 0.5; // 简化实现
  }
}

export default new HardwarePenDetection();
