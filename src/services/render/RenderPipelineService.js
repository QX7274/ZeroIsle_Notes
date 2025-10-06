/**
 * ✅ 渲染管线管理服务
 * 提供多线程渲染、GPU加速、帧率自适应等功能
 */

import { Platform } from 'react-native';
import { Skia } from '@shopify/react-native-skia';

/**
 * 渲染配置
 */
const RENDER_CONFIG = {
  // 帧率配置
  TARGET_FPS: 60,
  MIN_FPS: 30,
  MAX_FPS: 120,
  
  // 质量配置
  HIGH_QUALITY: {
    scale: 2.0,
    antialias: true,
    smoothing: true
  },
  MEDIUM_QUALITY: {
    scale: 1.5,
    antialias: true,
    smoothing: false
  },
  LOW_QUALITY: {
    scale: 1.0,
    antialias: false,
    smoothing: false
  },
  
  // 性能配置
  MAX_RENDER_TIME: 16, // 16ms (60fps)
  ADAPTIVE_THRESHOLD: 0.8, // 性能阈值
  GPU_ACCELERATION: true,
  
  // 多线程配置
  WORKER_THREADS: 2,
  RENDER_QUEUE_SIZE: 10
};

/**
 * 渲染质量枚举
 */
export const RENDER_QUALITY = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low'
};

/**
 * 渲染状态枚举
 */
export const RENDER_STATE = {
  IDLE: 'idle',
  RENDERING: 'rendering',
  QUEUED: 'queued',
  ERROR: 'error'
};

/**
 * 渲染任务类
 */
export class RenderTask {
  constructor(id, type, data, priority = 'normal') {
    this.id = id;
    this.type = type;
    this.data = data;
    this.priority = priority;
    this.timestamp = Date.now();
    this.state = RENDER_STATE.QUEUED;
    this.result = null;
    this.error = null;
  }
}

/**
 * 性能监控器
 */
export class PerformanceMonitor {
  constructor() {
    this.frameTimes = [];
    this.renderTimes = [];
    this.gpuUsage = 0;
    this.memoryUsage = 0;
    this.currentFPS = 60;
    this.quality = RENDER_QUALITY.HIGH;
  }
  
  /**
   * 记录帧时间
   */
  recordFrameTime(frameTime) {
    this.frameTimes.push(frameTime);
    
    // 保持最近100帧的记录
    if (this.frameTimes.length > 100) {
      this.frameTimes.shift();
    }
    
    // 计算当前FPS
    this.currentFPS = this.calculateFPS();
  }
  
  /**
   * 记录渲染时间
   */
  recordRenderTime(renderTime) {
    this.renderTimes.push(renderTime);
    
    // 保持最近50次渲染的记录
    if (this.renderTimes.length > 50) {
      this.renderTimes.shift();
    }
  }
  
  /**
   * 计算FPS
   */
  calculateFPS() {
    if (this.frameTimes.length < 2) {
      return 60;
    }
    
    const avgFrameTime = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    return Math.round(1000 / avgFrameTime);
  }
  
  /**
   * 获取平均渲染时间
   */
  getAverageRenderTime() {
    if (this.renderTimes.length === 0) {
      return 0;
    }
    
    return this.renderTimes.reduce((a, b) => a + b, 0) / this.renderTimes.length;
  }
  
  /**
   * 检查是否需要降低质量
   */
  shouldReduceQuality() {
    const avgRenderTime = this.getAverageRenderTime();
    const fps = this.currentFPS;
    
    return avgRenderTime > RENDER_CONFIG.MAX_RENDER_TIME || fps < RENDER_CONFIG.MIN_FPS;
  }
  
  /**
   * 检查是否可以提升质量
   */
  shouldIncreaseQuality() {
    const avgRenderTime = this.getAverageRenderTime();
    const fps = this.currentFPS;
    
    return avgRenderTime < RENDER_CONFIG.MAX_RENDER_TIME * RENDER_CONFIG.ADAPTIVE_THRESHOLD && 
           fps > RENDER_CONFIG.TARGET_FPS;
  }
  
  /**
   * 获取推荐质量
   */
  getRecommendedQuality() {
    if (this.shouldReduceQuality()) {
      if (this.quality === RENDER_QUALITY.HIGH) {
        return RENDER_QUALITY.MEDIUM;
      } else if (this.quality === RENDER_QUALITY.MEDIUM) {
        return RENDER_QUALITY.LOW;
      }
    } else if (this.shouldIncreaseQuality()) {
      if (this.quality === RENDER_QUALITY.LOW) {
        return RENDER_QUALITY.MEDIUM;
      } else if (this.quality === RENDER_QUALITY.MEDIUM) {
        return RENDER_QUALITY.HIGH;
      }
    }
    
    return this.quality;
  }
  
  /**
   * 获取性能统计
   */
  getPerformanceStats() {
    return {
      fps: this.currentFPS,
      avgRenderTime: this.getAverageRenderTime(),
      quality: this.quality,
      frameCount: this.frameTimes.length,
      renderCount: this.renderTimes.length,
      gpuUsage: this.gpuUsage,
      memoryUsage: this.memoryUsage
    };
  }
}

/**
 * GPU加速渲染器
 */
export class GPUAcceleratedRenderer {
  constructor() {
    this.enabled = RENDER_CONFIG.GPU_ACCELERATION;
    this.surfaces = new Map();
    this.textures = new Map();
  }
  
  /**
   * 创建GPU加速Surface
   */
  createGPUSurface(width, height, quality = RENDER_QUALITY.HIGH) {
    if (!this.enabled) {
      return null;
    }
    
    try {
      const config = this.getQualityConfig(quality);
      const surface = Skia.Surface.MakeOffscreen(width * config.scale, height * config.scale);
      
      if (surface) {
        const surfaceId = `gpu_${Date.now()}_${Math.random()}`;
        this.surfaces.set(surfaceId, {
          surface,
          width,
          height,
          quality,
          timestamp: Date.now()
        });
        
        return { id: surfaceId, surface };
      }
    } catch (error) {
      console.error('创建GPU Surface失败:', error);
    }
    
    return null;
  }
  
  /**
   * 获取质量配置
   */
  getQualityConfig(quality) {
    switch (quality) {
      case RENDER_QUALITY.HIGH:
        return RENDER_CONFIG.HIGH_QUALITY;
      case RENDER_QUALITY.MEDIUM:
        return RENDER_CONFIG.MEDIUM_QUALITY;
      case RENDER_QUALITY.LOW:
        return RENDER_CONFIG.LOW_QUALITY;
      default:
        return RENDER_CONFIG.MEDIUM_QUALITY;
    }
  }
  
  /**
   * 渲染到GPU Surface
   */
  renderToGPUSurface(surfaceId, renderFunction) {
    const surfaceData = this.surfaces.get(surfaceId);
    if (!surfaceData) {
      return null;
    }
    
    try {
      const canvas = surfaceData.surface.getCanvas();
      const result = renderFunction(canvas, surfaceData);
      
      surfaceData.surface.flush();
      return result;
    } catch (error) {
      console.error('GPU渲染失败:', error);
      return null;
    }
  }
  
  /**
   * 清理GPU资源
   */
  cleanupGPUResources() {
    this.surfaces.forEach((surfaceData, id) => {
      if (surfaceData.surface) {
        surfaceData.surface.dispose();
      }
    });
    this.surfaces.clear();
    
    this.textures.forEach((texture, id) => {
      if (texture.dispose) {
        texture.dispose();
      }
    });
    this.textures.clear();
  }
}

/**
 * 多线程渲染器
 */
export class MultiThreadRenderer {
  constructor() {
    this.workerThreads = [];
    this.renderQueue = [];
    this.activeTasks = new Map();
    this.maxWorkers = RENDER_CONFIG.WORKER_THREADS;
  }
  
  /**
   * 添加渲染任务
   */
  addRenderTask(task) {
    this.renderQueue.push(task);
    this.processQueue();
  }
  
  /**
   * 处理渲染队列
   */
  processQueue() {
    while (this.renderQueue.length > 0 && this.activeTasks.size < this.maxWorkers) {
      const task = this.renderQueue.shift();
      this.executeRenderTask(task);
    }
  }
  
  /**
   * 执行渲染任务
   */
  async executeRenderTask(task) {
    task.state = RENDER_STATE.RENDERING;
    this.activeTasks.set(task.id, task);
    
    try {
      const startTime = performance.now();
      
      // 模拟多线程渲染
      const result = await this.renderInWorker(task);
      
      const endTime = performance.now();
      const renderTime = endTime - startTime;
      
      task.result = result;
      task.state = RENDER_STATE.IDLE;
      
      // 记录渲染时间
      this.recordRenderTime(renderTime);
      
    } catch (error) {
      task.error = error;
      task.state = RENDER_STATE.ERROR;
      console.error('渲染任务失败:', error);
    } finally {
      this.activeTasks.delete(task.id);
      this.processQueue();
    }
  }
  
  /**
   * 在Worker中渲染
   */
  async renderInWorker(task) {
    // 模拟异步渲染
    return new Promise((resolve) => {
      setTimeout(() => {
        // 这里应该调用实际的渲染逻辑
        resolve({ taskId: task.id, result: 'rendered' });
      }, Math.random() * 10); // 模拟渲染时间
    });
  }
  
  /**
   * 记录渲染时间
   */
  recordRenderTime(renderTime) {
    // 这里应该调用性能监控器
    console.log('渲染时间:', renderTime + 'ms');
  }
  
  /**
   * 获取队列状态
   */
  getQueueStatus() {
    return {
      queueLength: this.renderQueue.length,
      activeTasks: this.activeTasks.size,
      maxWorkers: this.maxWorkers
    };
  }
  
  /**
   * 清理渲染器
   */
  cleanup() {
    this.renderQueue = [];
    this.activeTasks.clear();
  }
}

/**
 * 渲染管线管理服务
 */
export class RenderPipelineService {
  constructor() {
    this.performanceMonitor = new PerformanceMonitor();
    this.gpuRenderer = new GPUAcceleratedRenderer();
    this.multiThreadRenderer = new MultiThreadRenderer();
    this.isEnabled = true;
    this.currentQuality = RENDER_QUALITY.HIGH;
    this.callbacks = new Map();
  }
  
  /**
   * 启动渲染管线
   */
  start() {
    console.log('🚀 [RenderPipeline] 启动渲染管线');
    
    // 初始化渲染管线
    this.initialize();
    
    // 调用回调
    this.callCallbacks('stateChange', RENDER_STATE.RENDERING);
  }
  
  /**
   * 停止渲染管线
   */
  stop() {
    console.log('🛑 [RenderPipeline] 停止渲染管线');
    
    // 清理资源
    this.destroy();
    
    // 调用回调
    this.callCallbacks('stateChange', RENDER_STATE.IDLE);
  }
  
  /**
   * 获取自适应质量
   */
  getAdaptiveQuality() {
    return this.performanceMonitor.getRecommendedQuality();
  }
  
  /**
   * 是否应该使用GPU加速
   */
  shouldUseGPUAcceleration() {
    return this.gpuRenderer.enabled && this.isEnabled;
  }
  
  /**
   * 初始化渲染管线
   */
  initialize() {
    console.log('🚀 [RenderPipeline] 初始化渲染管线');
    
    // 启动性能监控
    this.startPerformanceMonitoring();
    
    // 启动自适应质量调整
    this.startAdaptiveQuality();
  }
  
  /**
   * 启动性能监控
   */
  startPerformanceMonitoring() {
    setInterval(() => {
      this.updatePerformanceStats();
    }, 1000); // 每秒更新一次
  }
  
  /**
   * 启动自适应质量调整
   */
  startAdaptiveQuality() {
    setInterval(() => {
      this.adjustQuality();
    }, 2000); // 每2秒检查一次
  }
  
  /**
   * 更新性能统计
   */
  updatePerformanceStats() {
    const stats = this.performanceMonitor.getPerformanceStats();
    
    // 调用回调
    this.callCallbacks('performanceUpdate', stats);
  }
  
  /**
   * 调整渲染质量
   */
  adjustQuality() {
    const recommendedQuality = this.performanceMonitor.getRecommendedQuality();
    
    if (recommendedQuality !== this.currentQuality) {
      this.setRenderQuality(recommendedQuality);
      console.log(`🎨 [RenderPipeline] 质量调整: ${this.currentQuality} -> ${recommendedQuality}`);
    }
  }
  
  /**
   * 设置渲染质量
   */
  setRenderQuality(quality) {
    this.currentQuality = quality;
    
    // 调用回调
    this.callCallbacks('qualityChange', quality);
  }
  
  /**
   * 创建渲染任务
   */
  createRenderTask(type, data, priority = 'normal') {
    const taskId = `render_${Date.now()}_${Math.random()}`;
    const task = new RenderTask(taskId, type, data, priority);
    
    this.multiThreadRenderer.addRenderTask(task);
    
    return task;
  }
  
  /**
   * 渲染笔画
   */
  renderStroke(stroke, quality = null) {
    const renderQuality = quality || this.currentQuality;
    
    return this.createRenderTask('stroke', {
      stroke,
      quality: renderQuality
    }, 'high');
  }
  
  /**
   * 渲染页面
   */
  renderPage(pageData, quality = null) {
    const renderQuality = quality || this.currentQuality;
    
    return this.createRenderTask('page', {
      pageData,
      quality: renderQuality
    }, 'normal');
  }
  
  /**
   * 批量渲染
   */
  batchRender(tasks) {
    return this.createRenderTask('batch', {
      tasks
    }, 'low');
  }
  
  /**
   * 注册回调
   */
  registerCallback(event, callback) {
    if (!this.callbacks.has(event)) {
      this.callbacks.set(event, []);
    }
    this.callbacks.get(event).push(callback);
  }
  
  /**
   * 取消注册回调
   */
  unregisterCallback(event, callback) {
    if (this.callbacks.has(event)) {
      const callbacks = this.callbacks.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }
  
  /**
   * 调用回调
   */
  callCallbacks(event, data) {
    if (this.callbacks.has(event)) {
      this.callbacks.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`渲染管线回调错误 (${event}):`, error);
        }
      });
    }
  }
  
  /**
   * 获取渲染状态
   */
  getRenderStatus() {
    return {
      enabled: this.isEnabled,
      quality: this.currentQuality,
      performance: this.performanceMonitor.getPerformanceStats(),
      queue: this.multiThreadRenderer.getQueueStatus()
    };
  }
  
  /**
   * 启用/禁用服务
   */
  setEnabled(enabled) {
    this.isEnabled = enabled;
  }
  
  /**
   * 销毁服务
   */
  destroy() {
    this.gpuRenderer.cleanupGPUResources();
    this.multiThreadRenderer.cleanup();
    this.callbacks.clear();
  }
}

// 创建全局渲染管线服务实例
export const renderPipelineService = new RenderPipelineService();

export default RenderPipelineService;
