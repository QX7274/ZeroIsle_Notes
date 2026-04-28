/**
 * 性能优化配置
 * 用于优化应用性能的全局配置
 */

// 知识图谱可视化性能配置
export const GRAPH_PERFORMANCE_CONFIG = {
  // 最大可渲染节点数（超过则警告或分批渲染）
  MAX_VISIBLE_NODES: 200,

  // 最大可渲染边数
  MAX_VISIBLE_EDGES: 500,

  // 力导向布局迭代次数
  FORCE_ITERATIONS: 100,

  // 节点更新防抖延迟（ms）
  NODE_UPDATE_DEBOUNCE: 100,

  // 是否启用节点虚拟化
  ENABLE_NODE_VIRTUALIZATION: true,

  // 视口外节点的渲染距离（倍数）
  VIEWPORT_BUFFER_MULTIPLIER: 1.5,

  // 是否使用简化渲染（远距离节点）
  ENABLE_LOD: true,

  // LOD切换距离阈值
  LOD_THRESHOLD: 0.5, // 缩放级别小于此值时使用简化渲染
};

// 分类功能性能配置
export const CATEGORY_PERFORMANCE_CONFIG = {
  // 分类列表虚拟化阈值
  VIRTUALIZATION_THRESHOLD: 50,

  // 树形视图默认展开层级
  DEFAULT_EXPAND_LEVEL: 2,

  // 搜索防抖延迟（ms）
  SEARCH_DEBOUNCE: 300,

  // 批量操作最大数量
  BATCH_OPERATION_LIMIT: 100,
};

// API请求性能配置
export const API_PERFORMANCE_CONFIG = {
  // 请求超时时间（ms）
  REQUEST_TIMEOUT: 30000,

  // 重试次数
  MAX_RETRIES: 3,

  // 重试延迟（ms）
  RETRY_DELAY: 1000,

  // 缓存时间（ms）
  CACHE_DURATION: 5 * 60 * 1000, // 5分钟

  // 批量请求延迟（ms）
  BATCH_DELAY: 100,
};

// 渲染性能配置
export const RENDER_PERFORMANCE_CONFIG = {
  // FlatList初始渲染数量
  INITIAL_NUM_TO_RENDER: 10,

  // FlatList最大渲染数量
  MAX_TO_RENDER_PER_BATCH: 5,

  // 窗口大小
  WINDOW_SIZE: 10,

  // 是否启用记忆化
  ENABLE_MEMOIZATION: true,

  // 图片懒加载
  ENABLE_LAZY_IMAGES: true,
};

// 内存管理配置
export const MEMORY_CONFIG = {
  // 图片缓存大小（MB）
  IMAGE_CACHE_SIZE: 100,

  // 数据缓存大小（条目数）
  DATA_CACHE_SIZE: 1000,

  // 自动清理间隔（ms）
  AUTO_CLEANUP_INTERVAL: 10 * 60 * 1000, // 10分钟

  // 内存警告阈值（MB）
  MEMORY_WARNING_THRESHOLD: 200,
};

// 动画性能配置
export const ANIMATION_CONFIG = {
  // 是否启用动画
  ENABLE_ANIMATIONS: true,

  // 默认动画时长（ms）
  DEFAULT_DURATION: 300,

  // 是否使用原生驱动
  USE_NATIVE_DRIVER: true,

  // 缩减动画（低性能设备）
  REDUCED_MOTION: false,
};

// 导出所有配置
export default {
  GRAPH_PERFORMANCE_CONFIG,
  CATEGORY_PERFORMANCE_CONFIG,
  API_PERFORMANCE_CONFIG,
  RENDER_PERFORMANCE_CONFIG,
  MEMORY_CONFIG,
  ANIMATION_CONFIG,
};
