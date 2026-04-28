/**
 * 原生模块可用性探测
 *
 * 用途：检查原生模块是否已正确链接并可用
 * 降级：若原生模块不可用，Wrapper 自动回退到 RN 旧版实现
 */

const { NativeModules, Platform, UIManager } = require('react-native');

const hasViewManager = (name) => {
  try {
    return typeof UIManager?.getViewManagerConfig === 'function'
      ? !!UIManager.getViewManagerConfig(name)
      : false;
  } catch (error) {
    return false;
  }
};

/**
 * 检查 PDF 原生视图是否可用
 */
export function isNativePDFAvailable() {
  try {
    // 检查原生模块是否存在
    const moduleExists = !!NativeModules.NativePDFModule || hasViewManager('NativePDFView');
    console.log('[NativeAvailability] PDF 原生模块检测:', {
      moduleExists,
      availableModules: Object.keys(NativeModules).filter(name => name.includes('Native')),
    });
    return moduleExists;
  } catch (error) {
    console.warn('[NativeAvailability] PDF 原生模块检测失败:', error);
    return false;
  }
}

/**
 * 检查分页笔记原生视图是否可用
 */
export function isNativePagedAvailable() {
  try {
    const moduleExists = !!NativeModules.NativePagedNoteModule || hasViewManager('NativePagedNoteView');
    console.log('[NativeAvailability] 分页笔记原生模块检测:', { moduleExists });
    return moduleExists;
  } catch (error) {
    console.warn('[NativeAvailability] 分页笔记原生模块检测失败:', error);
    return false;
  }
}

/**
 * 检查无限画布原生视图是否可用
 */
export function isNativeInfiniteAvailable() {
  try {
    const moduleExists = !!NativeModules.NativeInfiniteCanvasModule || hasViewManager('NativeInfiniteCanvasView');
    console.log('[NativeAvailability] 无限画布原生模块检测:', { moduleExists });
    return moduleExists;
  } catch (error) {
    console.warn('[NativeAvailability] 无限画布原生模块检测失败:', error);
    return false;
  }
}

/**
 * 批量检查所有原生模块可用性
 */
export function checkAllNativeModules() {
  const availability = {
    pdf: isNativePDFAvailable(),
    paged: isNativePagedAvailable(),
    infinite: isNativeInfiniteAvailable(),
    platform: Platform.OS,
    version: Platform.Version,
  };

  console.log('[NativeAvailability] 原生模块可用性:', availability);
  return availability;
}

/**
 * 获取原生模块能力信息（预留扩展）
 */
export function getNativeCapabilities() {
  const capabilities = {
    platform: Platform.OS,
    version: Platform.Version,
    modules: {
      pdf: {
        available: isNativePDFAvailable(),
        features: [], // 预留：注释支持、搜索、导出等
      },
      paged: {
        available: isNativePagedAvailable(),
        features: [], // 预留：样式、导出、压感等
      },
      infinite: {
        available: isNativeInfiniteAvailable(),
        features: [], // 预留：世界坐标范围、性能模式等
      },
    },
  };

  return capabilities;
}

module.exports = {
  isNativePDFAvailable,
  isNativePagedAvailable,
  isNativeInfiniteAvailable,
  checkAllNativeModules,
  getNativeCapabilities,
};
