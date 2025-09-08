/**
 * 手写系统配置文件
 * 统一管理手写相关的设置和常量
 */

// 手写工具配置 - 与AllInOneToolbar保持一致
export const HANDWRITING_TOOLS = [
  {
    id: 'pen',
    name: '钢笔',
    icon: 'edit',
    defaultWidth: 2,
    minWidth: 1,
    maxWidth: 10,
    supportsPressure: true,
    supportsTilt: true,
    description: '精确书写，适合文字和细节',
    engineTool: 'pen' // 映射到手写引擎的工具类型
  },
  {
    id: 'pencil',
    name: '铅笔',
    icon: 'create',
    defaultWidth: 1,
    minWidth: 0.5,
    maxWidth: 8,
    supportsPressure: true,
    supportsTilt: true,
    description: '自然书写，支持压感变化',
    engineTool: 'pencil'
  },
  {
    id: 'brush',
    name: '画笔',
    icon: 'brush',
    defaultWidth: 4,
    minWidth: 2,
    maxWidth: 16,
    supportsPressure: true,
    supportsTilt: false,
    description: '艺术绘制，支持压感变化',
    engineTool: 'marker'
  },
  {
    id: 'highlighter',
    name: '荧光笔',
    icon: 'highlight',
    defaultWidth: 8,
    minWidth: 4,
    maxWidth: 20,
    supportsPressure: false,
    supportsTilt: false,
    description: '半透明标记，适合重点标注',
    engineTool: 'marker',
    opacity: 0.5,
    colorTransform: true // 需要颜色转换
  },
  {
    id: 'eraser',
    name: '橡皮擦',
    icon: 'clear',
    defaultWidth: 10,
    minWidth: 5,
    maxWidth: 30,
    supportsPressure: false,
    supportsTilt: false,
    description: '擦除笔迹，支持部分擦除',
    engineTool: 'eraser'
  }
];

// 预设颜色配置 - 与AllInOneToolbar保持一致
export const HANDWRITING_COLORS = [
  { color: '#000000', name: '黑色', category: 'basic' },
  { color: '#FF0000', name: '红色', category: 'primary' },
  { color: '#0000FF', name: '蓝色', category: 'primary' },
  { color: '#008000', name: '绿色', category: 'primary' },
  { color: '#FFA500', name: '橙色', category: 'secondary' },
  { color: '#800080', name: '紫色', category: 'secondary' },
  { color: '#FFC0CB', name: '粉色', category: 'light' },
  { color: '#FFFF00', name: '黄色', category: 'primary' },
  { color: '#00FFFF', name: '青色', category: 'secondary' },
  { color: '#A52A2A', name: '棕色', category: 'dark' },
  { color: '#4B0082', name: '靛蓝', category: 'dark' },
  { color: '#006400', name: '深绿', category: 'dark' },
  { color: '#8B4513', name: '棕褐色', category: 'dark' },
  { color: '#4682B4', name: '钢蓝', category: 'secondary' },
  { color: '#D2691E', name: '巧克力色', category: 'secondary' },
  { color: '#9ACD32', name: '黄绿色', category: 'light' },
  { color: '#CD5C5C', name: '印度红', category: 'secondary' },
  { color: '#708090', name: '石板灰', category: 'basic' }
];

// 笔迹粗细配置 - 与AllInOneToolbar保持一致
export const HANDWRITING_STROKE_WIDTHS = [
  { width: 1, name: '极细', description: '精细线条' },
  { width: 2, name: '细', description: '细线条' },
  { width: 3, name: '正常', description: '标准粗细' },
  { width: 5, name: '粗', description: '粗线条' },
  { width: 8, name: '很粗', description: '很粗线条' },
  { width: 12, name: '超粗', description: '超粗线条' },
  { width: 16, name: '特粗', description: '特粗线条' },
  { width: 20, name: '最粗', description: '最粗线条' }
];

// 手写笔检测配置
export const STYLUS_DETECTION_CONFIG = {
  // 压感检测阈值
  pressureThreshold: 0.1,
  
  // 接触面积检测阈值（像素）
  radiusThreshold: 10,
  
  // 支持的手写笔类型
  supportedStylusTypes: [
    'stylus',
    'pencil',
    'apple_pencil',
    's_pen',
    'surface_pen',
    'usi_pen'
  ],
  
  // 倾斜角度范围（弧度）
  tiltRange: {
    min: 0,
    max: Math.PI / 2
  },
  
  // 方位角范围（弧度）
  azimuthRange: {
    min: 0,
    max: Math.PI * 2
  }
};

// 性能优化配置
export const PERFORMANCE_CONFIG = {
  // 点简化配置
  pointOptimization: {
    enabled: true,
    tolerance: 1.0, // 简化容差
    angleThreshold: 0.1, // 角度变化阈值
    distanceThreshold: 1.0 // 距离阈值
  },
  
  // 渲染配置
  rendering: {
    maxPointsPerStroke: 1000, // 每个笔迹最大点数
    smoothingEnabled: true, // 启用平滑
    smoothingFactor: 0.25, // 平滑因子
    antiAliasing: true // 抗锯齿
  },
  
  // 内存管理配置
  memory: {
    maxStrokesInMemory: 500, // 内存中最大笔迹数
    autoCleanupEnabled: true, // 自动清理
    cleanupInterval: 60000, // 清理间隔（毫秒）
    maxMemoryUsage: 50 * 1024 * 1024 // 最大内存使用（字节）
  }
};

// 保存配置
export const PERSISTENCE_CONFIG = {
  // 自动保存配置
  autoSave: {
    enabled: true,
    interval: 1000, // 自动保存间隔（毫秒）
    maxRetries: 3, // 最大重试次数
    retryDelay: 500 // 重试延迟（毫秒）
  },
  
  // 文件配置
  file: {
    extension: '.json',
    encoding: 'utf8',
    compression: false, // 是否压缩
    backup: true // 是否创建备份
  },
  
  // 清理配置
  cleanup: {
    enabled: true,
    maxAge: 30 * 24 * 60 * 60 * 1000, // 最大保留时间（30天）
    maxFiles: 1000 // 最大文件数
  }
};

// 手势配置
export const GESTURE_CONFIG = {
  // 手势识别配置
  recognition: {
    minDistance: 0, // 最小移动距离
    maxPointers: 1, // 最大触点数
    enableSimultaneousHandlers: false // 启用同时手势处理
  },
  
  // 防误触配置
  palmRejection: {
    enabled: true,
    radiusThreshold: 15, // 手掌接触面积阈值
    pressureThreshold: 0.05, // 手掌压力阈值
    timeThreshold: 100 // 时间阈值（毫秒）
  },
  
  // 手指拒绝配置
  fingerRejection: {
    enabled: true, // 默认启用
    strictMode: false, // 严格模式
    allowFingerWhenNoStylus: true // 无手写笔时允许手指
  }
};

// UI配置
export const UI_CONFIG = {
  // 工具栏配置
  toolbar: {
    position: 'bottom', // 位置：top, bottom, left, right
    compact: false, // 紧凑模式
    autoHide: false, // 自动隐藏
    hideDelay: 3000, // 隐藏延迟（毫秒）
    animationDuration: 200 // 动画持续时间（毫秒）
  },
  
  // 颜色选择器配置
  colorPicker: {
    columns: 4, // 列数
    showNames: false, // 显示颜色名称
    allowCustom: true, // 允许自定义颜色
    recentColors: true // 显示最近使用的颜色
  },
  
  // 粗细选择器配置
  widthPicker: {
    showPreview: true, // 显示预览
    showValues: true, // 显示数值
    allowCustom: true // 允许自定义粗细
  }
};

// 屏幕特定配置
export const SCREEN_CONFIGS = {
  // PDF查看器配置
  pdfViewer: {
    fingerRejection: true, // 启用手指拒绝
    autoSaveInterval: 2000, // 自动保存间隔
    layerOpacity: 0.9, // 手写层透明度
    zIndex: 10 // 层级
  },
  
  // 笔记编辑器配置
  noteEditor: {
    fingerRejection: false, // 允许手指书写
    autoSaveInterval: 1000,
    layerOpacity: 1.0,
    zIndex: 10,
    mixedMode: true // 混合模式（文字+手写）
  },
  
  // 画布配置
  canvas: {
    fingerRejection: false, // 允许手指绘制
    autoSaveInterval: 3000,
    layerOpacity: 1.0,
    zIndex: 5,
    infiniteCanvas: true, // 无限画布
    gridEnabled: false // 网格
  },
  
  // 知识图谱配置
  knowledgeGraph: {
    fingerRejection: true,
    autoSaveInterval: 1500,
    layerOpacity: 0.8,
    zIndex: 15,
    handwritingRecognition: true // 手写识别
  },
  
  // 思维导图配置
  mindMap: {
    fingerRejection: true,
    autoSaveInterval: 1500,
    layerOpacity: 0.9,
    zIndex: 12,
    nodeEditing: true // 节点编辑
  }
};

// 设备适配配置
export const DEVICE_CONFIG = {
  // iOS配置
  ios: {
    applePencilSupport: true,
    forceTouch: true,
    hapticFeedback: true
  },
  
  // Android配置
  android: {
    sPenSupport: true,
    pressureSensitive: true,
    tiltSupport: true
  },
  
  // 通用配置
  common: {
    retina: true, // 高分辨率支持
    darkMode: true, // 深色模式支持
    accessibility: true // 无障碍支持
  }
};

// 导出默认配置
export const DEFAULT_HANDWRITING_CONFIG = {
  tool: 'pen',
  color: '#000000',
  width: 2,
  opacity: 1,
  enablePressure: true,
  enableTilt: true,
  fingerRejection: true,
  autoSave: true,
  smoothing: true
};

// 配置验证函数
export const validateConfig = (config) => {
  const errors = [];
  
  // 验证工具
  if (config.tool && !HANDWRITING_TOOLS.find(t => t.id === config.tool)) {
    errors.push(`无效的工具: ${config.tool}`);
  }
  
  // 验证颜色
  if (config.color && !/^#[0-9A-Fa-f]{6}$/.test(config.color)) {
    errors.push(`无效的颜色格式: ${config.color}`);
  }
  
  // 验证粗细
  if (config.width && (config.width < 0.1 || config.width > 50)) {
    errors.push(`无效的笔迹粗细: ${config.width}`);
  }
  
  // 验证透明度
  if (config.opacity && (config.opacity < 0 || config.opacity > 1)) {
    errors.push(`无效的透明度: ${config.opacity}`);
  }
  
  return errors;
};

// 工具映射 - AllInOneToolbar工具到手写引擎工具的映射
export const TOOL_MAPPING = {
  'pen': 'pen',
  'pencil': 'pencil',
  'brush': 'marker',
  'highlighter': 'marker',
  'eraser': 'eraser'
};

// 荧光笔颜色映射（半透明）
export const HIGHLIGHTER_COLORS = {
  '#000000': '#00000040',
  '#FF0000': '#FF000040',
  '#0000FF': '#0000FF40',
  '#008000': '#00800040',
  '#FFA500': '#FFA50040',
  '#800080': '#80008040',
  '#FFC0CB': '#FFC0CB40',
  '#FFFF00': '#FFFF0040',
  '#00FFFF': '#00FFFF40',
  '#A52A2A': '#A52A2A40',
  '#4B0082': '#4B008240',
  '#006400': '#00640040',
  '#8B4513': '#8B451340',
  '#4682B4': '#4682B440',
  '#D2691E': '#D2691E40',
  '#9ACD32': '#9ACD3240',
  '#CD5C5C': '#CD5C5C40',
  '#708090': '#70809040'
};

// 获取工具配置
export const getToolConfig = (toolId) => {
  try {
    const tool = HANDWRITING_TOOLS.find(tool => tool.id === toolId);
    if (!tool) {
      console.warn(`未找到工具配置: ${toolId}，使用默认工具`);
      return HANDWRITING_TOOLS[0];
    }
    return tool;
  } catch (error) {
    console.error('获取工具配置失败:', error);
    return HANDWRITING_TOOLS[0];
  }
};

// 获取屏幕配置
export const getScreenConfig = (screenName) => {
  try {
    const config = SCREEN_CONFIGS[screenName];
    if (!config) {
      console.warn(`未找到屏幕配置: ${screenName}，使用默认配置`);
      return SCREEN_CONFIGS.noteEditor;
    }
    return config;
  } catch (error) {
    console.error('获取屏幕配置失败:', error);
    return SCREEN_CONFIGS.noteEditor;
  }
};

// 映射AllInOneToolbar工具到手写引擎工具
export const mapToolToEngine = (toolConfig) => {
  try {
    // 详细的调试信息
    console.log('mapToolToEngine 输入:', {
      toolConfig,
      type: typeof toolConfig,
      isObject: typeof toolConfig === 'object',
      hasType: toolConfig && toolConfig.type,
      stringified: JSON.stringify(toolConfig)
    });

    if (!toolConfig) {
      console.warn('工具配置为空，使用默认工具');
      return 'pen';
    }

    // 处理不同的输入格式
    let toolType;
    if (typeof toolConfig === 'string') {
      toolType = toolConfig;
    } else if (toolConfig && typeof toolConfig === 'object') {
      if (toolConfig.type) {
        toolType = toolConfig.type;
      } else {
        console.warn(`工具对象缺少type属性:`, toolConfig);
        console.warn(`对象的所有属性:`, Object.keys(toolConfig));
        return 'pen';
      }
    } else {
      console.warn(`无效的工具配置格式: ${typeof toolConfig}，使用默认工具`);
      return 'pen';
    }

    // 验证工具类型
    if (!toolType || typeof toolType !== 'string') {
      console.warn(`工具类型无效: ${toolType} (类型: ${typeof toolType})，使用默认工具`);
      return 'pen';
    }

    const mappedTool = TOOL_MAPPING[toolType];

    if (!mappedTool) {
      console.warn(`未找到工具映射: ${toolType}，使用默认工具`);
      console.log('可用的工具映射:', Object.keys(TOOL_MAPPING));
      return 'pen';
    }

    console.log(`工具映射成功: ${toolType} → ${mappedTool}`);
    return mappedTool;
  } catch (error) {
    console.error('工具映射失败:', error);
    console.error('错误的工具配置:', toolConfig);
    return 'pen';
  }
};

// 处理荧光笔颜色
export const processHighlighterColor = (color) => {
  try {
    return HIGHLIGHTER_COLORS[color] || (color + '40');
  } catch (error) {
    console.error('处理荧光笔颜色失败:', error);
    return color;
  }
};

// 计算实际笔迹粗细
export const calculateActualStrokeWidth = (toolConfig, width) => {
  try {
    const toolType = typeof toolConfig === 'string' ? toolConfig : toolConfig?.type;

    switch (toolType) {
      case 'pen':
        return width;
      case 'pencil':
        return Math.max(width * 0.8, 1);
      case 'brush':
        return width * 1.5;
      case 'highlighter':
        return width * 2;
      case 'eraser':
        return width * 2;
      default:
        return width;
    }
  } catch (error) {
    console.error('计算笔迹粗细失败:', error);
    return width || 2;
  }
};

// 获取工具透明度
export const getToolOpacity = (toolConfig) => {
  try {
    const toolType = typeof toolConfig === 'string' ? toolConfig : toolConfig?.type;
    return toolType === 'highlighter' ? 0.5 : 1.0;
  } catch (error) {
    console.error('获取工具透明度失败:', error);
    return 1.0;
  }
};

// 合并配置
export const mergeConfigs = (defaultConfig, userConfig) => {
  try {
    return {
      ...defaultConfig,
      ...userConfig
    };
  } catch (error) {
    console.error('合并配置失败:', error);
    return defaultConfig || {};
  }
};
