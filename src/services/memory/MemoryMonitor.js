/**
 * 内存监控服务
 * 实时监控内存使用情况，自动清理和优化内存
 */

import { Platform, AppState } from 'react-native';
import { Alert } from 'react-native';

/**
 * 内存监控配置
 */
const MONITOR_CONFIG = {
  // 监控间隔
  MONITOR_INTERVAL: 5000, // 5秒监控一次

  // 内存阈值
  WARNING_THRESHOLD: 0.6, // 60%内存使用率警告
  CRITICAL_THRESHOLD: 0.8, // 80%内存使用率严重警告
  EMERGENCY_THRESHOLD: 0.9, // 90%内存使用率紧急清理

  // 自动清理配置
  AUTO_CLEANUP_ENABLED: true,
  CLEANUP_DELAY: 2000, // 2秒延迟清理

  // 内存优化配置
  OPTIMIZATION_ENABLED: true,
  OPTIMIZATION_THRESHOLD: 0.7, // 70%时开始优化
};

/**
 * 内存状态枚举
 */
export const MEMORY_STATUS = {
  NORMAL: 'normal',
  WARNING: 'warning',
  CRITICAL: 'critical',
  EMERGENCY: 'emergency',
};

/**
 * 内存监控器类
 */
class MemoryMonitor {
  constructor() {
    this.isMonitoring = false;
    this.monitorInterval = null;
    this.currentStatus = MEMORY_STATUS.NORMAL;
    this.lastCleanupTime = 0;
    this.cleanupCallbacks = [];
    this.optimizationCallbacks = [];

    // 内存使用历史
    this.memoryHistory = [];
    this.maxHistorySize = 100;

    // 性能统计
    this.stats = {
      totalCleanups: 0,
      totalOptimizations: 0,
      averageMemoryUsage: 0,
      peakMemoryUsage: 0,
    };
  }

  /**
   * 开始监控
   */
  startMonitoring() {
    if (this.isMonitoring) {
      console.log('MemoryMonitor: 监控已在运行中');
      return;
    }

    console.log('MemoryMonitor: 开始内存监控');
    this.isMonitoring = true;

    // 立即执行一次检查
    this.checkMemoryStatus();

    // 设置定期监控
    this.monitorInterval = setInterval(() => {
      this.checkMemoryStatus();
    }, MONITOR_CONFIG.MONITOR_INTERVAL);

    // 监听应用状态变化
    this.setupAppStateListener();
  }

  /**
   * 停止监控
   */
  stopMonitoring() {
    if (!this.isMonitoring) {
      return;
    }

    console.log('MemoryMonitor: 停止内存监控');
    this.isMonitoring = false;

    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
  }

  /**
   * 检查内存状态
   */
  async checkMemoryStatus() {
    try {
      const memoryInfo = await this.getMemoryInfo();
      const usageRatio = memoryInfo.used / memoryInfo.total;

      // 更新内存历史
      this.updateMemoryHistory(memoryInfo);

      // 更新统计信息
      this.updateStats(memoryInfo);

      // 确定内存状态
      const newStatus = this.determineMemoryStatus(usageRatio);

      if (newStatus !== this.currentStatus) {
        console.log(`MemoryMonitor: 内存状态变化 ${this.currentStatus} -> ${newStatus}`);
        this.currentStatus = newStatus;
        this.handleMemoryStatusChange(newStatus, memoryInfo);
      }

      // 根据状态执行相应操作
      await this.handleMemoryStatus(newStatus, memoryInfo);

    } catch (error) {
      console.error('MemoryMonitor: 内存状态检查失败:', error);
    }
  }

  /**
   * 获取内存信息
   */
  async getMemoryInfo() {
    try {
      // 在React Native中，我们使用一些启发式方法来估算内存使用
      const memoryInfo = {
        used: 0,
        total: 0,
        available: 0,
        timestamp: Date.now(),
      };

      // 尝试获取实际内存信息（如果可用）
      if (Platform.OS === 'android') {
        // Android平台的内存信息获取
        try {
          const { NativeModules } = require('react-native');
          if (NativeModules.RNMemoryInfo) {
            const info = await NativeModules.RNMemoryInfo.getMemoryInfo();
            memoryInfo.used = info.usedMemory || 0;
            memoryInfo.total = info.totalMemory || 0;
            memoryInfo.available = info.availableMemory || 0;
          }
        } catch (e) {
          console.warn('MemoryMonitor: 无法获取原生内存信息，使用估算值');
        }
      }

      // 如果没有获取到实际内存信息，使用估算值
      if (memoryInfo.total === 0) {
        // 根据平台估算总内存
        const estimatedTotal = Platform.OS === 'ios' ? 4 * 1024 * 1024 * 1024 : 6 * 1024 * 1024 * 1024; // iOS 4GB, Android 6GB
        memoryInfo.total = estimatedTotal;

        // 基于已分配的内存估算使用量
        const allocatedMemory = this.getEstimatedAllocatedMemory();
        memoryInfo.used = allocatedMemory;
        memoryInfo.available = estimatedTotal - allocatedMemory;
      }

      return memoryInfo;
    } catch (error) {
      console.error('MemoryMonitor: 获取内存信息失败:', error);
      return {
        used: 0,
        total: 4 * 1024 * 1024 * 1024, // 默认4GB
        available: 4 * 1024 * 1024 * 1024,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * 估算已分配的内存
   */
  getEstimatedAllocatedMemory() {
    // 这里可以集成实际的内存分配器来获取真实的内存使用情况
    // 目前返回一个估算值
    return 512 * 1024 * 1024; // 估算512MB
  }

  /**
   * 更新内存历史
   */
  updateMemoryHistory(memoryInfo) {
    this.memoryHistory.push({
      ...memoryInfo,
      usageRatio: memoryInfo.used / memoryInfo.total,
    });

    // 限制历史记录大小
    if (this.memoryHistory.length > this.maxHistorySize) {
      this.memoryHistory.shift();
    }
  }

  /**
   * 更新统计信息
   */
  updateStats(memoryInfo) {
    const usageRatio = memoryInfo.used / memoryInfo.total;

    // 更新平均使用率
    if (this.memoryHistory.length > 0) {
      const totalUsage = this.memoryHistory.reduce((sum, record) => sum + record.usageRatio, 0);
      this.stats.averageMemoryUsage = totalUsage / this.memoryHistory.length;
    }

    // 更新峰值使用率
    if (usageRatio > this.stats.peakMemoryUsage) {
      this.stats.peakMemoryUsage = usageRatio;
    }
  }

  /**
   * 确定内存状态
   */
  determineMemoryStatus(usageRatio) {
    if (usageRatio >= MONITOR_CONFIG.EMERGENCY_THRESHOLD) {
      return MEMORY_STATUS.EMERGENCY;
    } else if (usageRatio >= MONITOR_CONFIG.CRITICAL_THRESHOLD) {
      return MEMORY_STATUS.CRITICAL;
    } else if (usageRatio >= MONITOR_CONFIG.WARNING_THRESHOLD) {
      return MEMORY_STATUS.WARNING;
    } else {
      return MEMORY_STATUS.NORMAL;
    }
  }

  /**
   * 处理内存状态变化
   */
  handleMemoryStatusChange(newStatus, memoryInfo) {
    const usagePercent = Math.round((memoryInfo.used / memoryInfo.total) * 100);

    switch (newStatus) {
      case MEMORY_STATUS.WARNING:
        console.warn(`MemoryMonitor: 内存使用率警告: ${usagePercent}%`);
        break;

      case MEMORY_STATUS.CRITICAL:
        console.error(`MemoryMonitor: 内存使用率严重: ${usagePercent}%`);
        break;

      case MEMORY_STATUS.EMERGENCY:
        console.error(`MemoryMonitor: 内存使用率紧急: ${usagePercent}%`);
        break;
    }
  }

  /**
   * 处理内存状态
   */
  async handleMemoryStatus(status, memoryInfo) {
    switch (status) {
      case MEMORY_STATUS.WARNING:
        if (MONITOR_CONFIG.OPTIMIZATION_ENABLED) {
          await this.performOptimization();
        }
        break;

      case MEMORY_STATUS.CRITICAL:
        await this.performCleanup();
        break;

      case MEMORY_STATUS.EMERGENCY:
        await this.performEmergencyCleanup();
        break;
    }
  }

  /**
   * 执行内存优化
   */
  async performOptimization() {
    if (Date.now() - this.lastCleanupTime < MONITOR_CONFIG.CLEANUP_DELAY) {
      return; // 避免频繁优化
    }

    console.log('MemoryMonitor: 执行内存优化');

    try {
      // 执行优化回调
      for (const callback of this.optimizationCallbacks) {
        try {
          await callback();
        } catch (error) {
          console.error('MemoryMonitor: 优化回调执行失败:', error);
        }
      }

      this.stats.totalOptimizations++;
      this.lastCleanupTime = Date.now();

      console.log('MemoryMonitor: 内存优化完成');
    } catch (error) {
      console.error('MemoryMonitor: 内存优化失败:', error);
    }
  }

  /**
   * 执行内存清理
   */
  async performCleanup() {
    if (Date.now() - this.lastCleanupTime < MONITOR_CONFIG.CLEANUP_DELAY) {
      return; // 避免频繁清理
    }

    console.log('MemoryMonitor: 执行内存清理');

    try {
      // 执行清理回调
      for (const callback of this.cleanupCallbacks) {
        try {
          await callback();
        } catch (error) {
          console.error('MemoryMonitor: 清理回调执行失败:', error);
        }
      }

      this.stats.totalCleanups++;
      this.lastCleanupTime = Date.now();

      console.log('MemoryMonitor: 内存清理完成');
    } catch (error) {
      console.error('MemoryMonitor: 内存清理失败:', error);
    }
  }

  /**
   * 执行紧急清理
   */
  async performEmergencyCleanup() {
    console.log('MemoryMonitor: 执行紧急内存清理');

    try {
      // 立即执行所有清理回调
      const cleanupPromises = this.cleanupCallbacks.map(callback =>
        callback().catch(error =>
          console.error('MemoryMonitor: 紧急清理回调失败:', error)
        )
      );

      await Promise.all(cleanupPromises);

      this.stats.totalCleanups++;
      this.lastCleanupTime = Date.now();

      // 显示警告
      Alert.alert(
        '内存不足',
        '应用内存使用率过高，已执行紧急清理。建议关闭其他应用或重启应用。',
        [{ text: '确定' }]
      );

      console.log('MemoryMonitor: 紧急内存清理完成');
    } catch (error) {
      console.error('MemoryMonitor: 紧急内存清理失败:', error);
    }
  }

  /**
   * 设置应用状态监听
   */
  setupAppStateListener() {
    AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'background') {
        // 应用进入后台时执行清理
        this.performCleanup();
      } else if (nextAppState === 'active') {
        // 应用回到前台时检查内存状态
        this.checkMemoryStatus();
      }
    });
  }

  /**
   * 添加清理回调
   */
  addCleanupCallback(callback) {
    this.cleanupCallbacks.push(callback);
  }

  /**
   * 添加优化回调
   */
  addOptimizationCallback(callback) {
    this.optimizationCallbacks.push(callback);
  }

  /**
   * 获取当前状态
   */
  getCurrentStatus() {
    return {
      status: this.currentStatus,
      isMonitoring: this.isMonitoring,
      stats: this.stats,
      memoryHistory: this.memoryHistory.slice(-10), // 最近10条记录
    };
  }

  /**
   * 获取内存统计
   */
  getMemoryStats() {
    return {
      ...this.stats,
      currentStatus: this.currentStatus,
      historySize: this.memoryHistory.length,
      lastCleanupTime: this.lastCleanupTime,
    };
  }

  /**
   * 重置统计
   */
  resetStats() {
    this.stats = {
      totalCleanups: 0,
      totalOptimizations: 0,
      averageMemoryUsage: 0,
      peakMemoryUsage: 0,
    };
    this.memoryHistory = [];
    console.log('MemoryMonitor: 统计信息已重置');
  }
}

export default new MemoryMonitor();


