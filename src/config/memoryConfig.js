/**
 * 内存配置
 * 统一管理应用的内存相关配置
 */

/**
 * 内存配置常量
 */
export const MEMORY_CONFIG = {
  // 基础内存限制
  MAX_MEMORY_GB: 8, // 最大8GB内存
  WARNING_THRESHOLD_MB: 200, // 200MB警告阈值
  CRITICAL_THRESHOLD_MB: 400, // 400MB严重警告阈值
  EMERGENCY_THRESHOLD_MB: 600, // 600MB紧急阈值
  
  // 文件类型内存配置
  FILE_TYPE_MEMORY: {
    // 文档类型
    pdf: { multiplier: 3, maxMB: 4096 },
    doc: { multiplier: 4, maxMB: 8192 },
    docx: { multiplier: 4, maxMB: 8192 },
    ppt: { multiplier: 4, maxMB: 8192 },
    pptx: { multiplier: 4, maxMB: 8192 },
    xls: { multiplier: 3, maxMB: 4096 },
    xlsx: { multiplier: 3, maxMB: 4096 },
    
    // 图片类型
    jpg: { multiplier: 2, maxMB: 2048 },
    jpeg: { multiplier: 2, maxMB: 2048 },
    png: { multiplier: 2, maxMB: 2048 },
    gif: { multiplier: 2, maxMB: 2048 },
    bmp: { multiplier: 2, maxMB: 2048 },
    webp: { multiplier: 2, maxMB: 2048 },
    
    // 视频类型
    mp4: { multiplier: 1.5, maxMB: 4096 },
    avi: { multiplier: 1.5, maxMB: 4096 },
    mov: { multiplier: 1.5, maxMB: 4096 },
    mkv: { multiplier: 1.5, maxMB: 4096 },
    
    // 音频类型
    mp3: { multiplier: 1.5, maxMB: 1024 },
    wav: { multiplier: 1.5, maxMB: 1024 },
    m4a: { multiplier: 1.5, maxMB: 1024 },
    ogg: { multiplier: 1.5, maxMB: 1024 },
    
    // 文本类型
    txt: { multiplier: 2, maxMB: 512 },
    md: { multiplier: 2, maxMB: 512 },
    json: { multiplier: 2, maxMB: 512 },
    xml: { multiplier: 2, maxMB: 512 },
    
    // 代码类型
    js: { multiplier: 1.5, maxMB: 256 },
    ts: { multiplier: 1.5, maxMB: 256 },
    py: { multiplier: 1.5, maxMB: 256 },
    java: { multiplier: 1.5, maxMB: 256 },
    cpp: { multiplier: 1.5, maxMB: 256 },
    c: { multiplier: 1.5, maxMB: 256 },
  },
  
  // 内存监控配置
  MONITOR: {
    INTERVAL: 5000, // 5秒监控间隔
    WARNING_RATIO: 0.6, // 60%使用率警告
    CRITICAL_RATIO: 0.8, // 80%使用率严重警告
    EMERGENCY_RATIO: 0.9, // 90%使用率紧急清理
    AUTO_CLEANUP_ENABLED: true,
    CLEANUP_DELAY: 2000, // 2秒清理延迟
  },
  
  // 内存优化配置
  OPTIMIZATION: {
    ENABLED: true,
    THRESHOLD_RATIO: 0.7, // 70%时开始优化
    COMPRESSION_LEVEL: 0.6, // 压缩级别
    MIN_COMPRESSION_SIZE: 512, // 最小压缩大小
    MAX_CACHE_SIZE: 500, // 最大缓存项目数
    MAX_CACHE_AGE: 600000, // 10分钟缓存最大年龄
  },
  
  // Android特定配置
  ANDROID: {
    LARGE_HEAP: true,
    HARDWARE_ACCELERATED: true,
    JVM_ARGS: '-Xmx8192m -XX:MaxMetaspaceSize=2048m -XX:+HeapDumpOnOutOfMemoryError -Dfile.encoding=UTF-8 -XX:+UseG1GC -XX:MaxGCPauseMillis=200',
  },
  
  // iOS特定配置
  IOS: {
    MEMORY_WARNING_THRESHOLD: 0.8, // 80%内存使用率警告
    AUTO_CLEANUP_ON_MEMORY_WARNING: true,
  },
};

/**
 * 获取文件类型的内存配置
 */
export function getFileTypeMemoryConfig(fileExtension) {
  const ext = fileExtension.toLowerCase();
  return MEMORY_CONFIG.FILE_TYPE_MEMORY[ext] || {
    multiplier: 1.5,
    maxMB: 1024
  };
}

/**
 * 计算文件所需内存
 */
export function calculateFileMemory(fileSizeMB, fileExtension) {
  const config = getFileTypeMemoryConfig(fileExtension);
  const requiredMemoryMB = Math.min(fileSizeMB * config.multiplier, config.maxMB);
  
  return {
    requiredMemoryMB,
    config,
    isWithinLimit: requiredMemoryMB <= MEMORY_CONFIG.MAX_MEMORY_GB * 1024
  };
}

/**
 * 检查内存是否充足
 */
export function hasEnoughMemory(requiredMemoryMB) {
  return requiredMemoryMB <= MEMORY_CONFIG.MAX_MEMORY_GB * 1024;
}

/**
 * 获取内存状态
 */
export function getMemoryStatus(currentUsageMB) {
  if (currentUsageMB >= MEMORY_CONFIG.EMERGENCY_THRESHOLD_MB) {
    return 'emergency';
  } else if (currentUsageMB >= MEMORY_CONFIG.CRITICAL_THRESHOLD_MB) {
    return 'critical';
  } else if (currentUsageMB >= MEMORY_CONFIG.WARNING_THRESHOLD_MB) {
    return 'warning';
  } else {
    return 'normal';
  }
}

/**
 * 获取内存配置摘要
 */
export function getMemoryConfigSummary() {
  return {
    maxMemoryGB: MEMORY_CONFIG.MAX_MEMORY_GB,
    warningThresholdMB: MEMORY_CONFIG.WARNING_THRESHOLD_MB,
    criticalThresholdMB: MEMORY_CONFIG.CRITICAL_THRESHOLD_MB,
    emergencyThresholdMB: MEMORY_CONFIG.EMERGENCY_THRESHOLD_MB,
    monitorInterval: MEMORY_CONFIG.MONITOR.INTERVAL,
    optimizationEnabled: MEMORY_CONFIG.OPTIMIZATION.ENABLED,
    autoCleanupEnabled: MEMORY_CONFIG.MONITOR.AUTO_CLEANUP_ENABLED,
  };
}

export default MEMORY_CONFIG;

