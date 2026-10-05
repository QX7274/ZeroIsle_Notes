import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  Platform,
  Vibration,
  TextInput,
  KeyboardAvoidingView,
  Dimensions,
  useWindowDimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import ColorPicker from './ColorPicker'; // 企业级颜色选择器组件
import MaterialIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import Slider from '@react-native-community/slider';
import { Text } from './Typography';
import { useTheme } from '../../context/ThemeContext';
import { noteAIService } from '../../services/notes/noteAIService';
import { chatHistoryService as aiHistoryService } from '../../services/ai/chatHistoryService';
import { bookmarkService } from '../../services/notes/bookmarkService';
import { launchImageLibrary } from 'react-native-image-picker';
import Clipboard from '@react-native-clipboard/clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 集成增强组件
import PenSelector from '../toolbar/PenSelector';
import HandFeelPanel from '../toolbar/HandFeelPanel';
import ShapeToolSelector, { ShapeTypes } from '../toolbar/ShapeToolSelector';
import { PenTypes, handwritingService } from '../../services/handwritingService';
// 偏好持久化纯逻辑层（清洗 / 加载竞态 / 最近颜色规整）。上提到顶部而不是在组件体内 require：
// 组件体内的 require 会让 react-hooks 把局部变量当成依赖项，逼出不必要的 eslint-disable。
import {
  createPreferencesLoader,
  deriveTouchedFields,
  pickRecentColors,
  toSwatchList,
} from './AllInOneToolbarPrefs';
// WS-B：工具栏纯布局逻辑（断点 / 宽度估算 / popover 夹取），无 React 依赖、可独立单测
import {
  resolveToolbarLayout,
  estimateToolbarWidth,
  resolvePopoverPosition,
  TOOLBAR_BREAKPOINTS,
} from './AllInOneToolbarLayout';

// 常用预设颜色
const PRESET_COLORS = [
  '#000000', // 黑色
  '#FF0000', // 红色
  '#FFA500', // 橙色
  '#FFFF00', // 黄色
  '#00FF00', // 绿色
  '#00FFFF', // 青色
  '#0000FF', // 蓝色
  '#9B59B6', // 紫色
  '#8B4513', // 棕色
];

// 获取屏幕尺寸
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// 响应式尺寸计算
const getResponsiveSize = (size) => {
  const standardScreenWidth = 375; // iPhone 8/X 宽度作为标准
  const scale = Math.min(SCREEN_WIDTH / standardScreenWidth, 1.2); // 限制最大缩放
  return Math.round(size * scale);
};

// 根据屏幕尺寸确定工具栏配置
const getToolbarConfig = () => {
  const isSmallScreen = SCREEN_WIDTH < 360;
  const isMediumScreen = SCREEN_WIDTH < 480;
  const isLargeScreen = SCREEN_WIDTH >= 768;

  return {
    buttonSize: isSmallScreen ? 32 : isMediumScreen ? 36 : 40,
    fontSize: isSmallScreen ? 8 : isMediumScreen ? 9 : 10,
    iconSize: isSmallScreen ? 16 : isMediumScreen ? 18 : 20,
    padding: isSmallScreen ? 4 : isMediumScreen ? 6 : 8,
    height: isSmallScreen ? 36 : isMediumScreen ? 40 : 44,
    spacing: isSmallScreen ? 1 : 2,
  };
};

// 笔触粗细范围配置
const STROKE_WIDTH_RANGE = { min: 1, max: 50, step: 1 };

// 笔触粗细快捷选项
const STROKE_WIDTH_PRESETS = [
  { value: 2, label: '细' },
  { value: 5, label: '中' },
  { value: 10, label: '粗' },
  { value: 20, label: '特粗' },
];

// 绘图工具类型
const DRAWING_TOOLS = Object.freeze({
  PEN: 'pen',
  PENCIL: 'pencil',
  BRUSH: 'brush',
  HIGHLIGHTER: 'highlighter',
  LASER: 'laser',
  ERASER: 'eraser',
  SHAPE: 'shape',
  TEXT: 'text',
  LASSO: 'lasso',  // 套索选择工具（包含选择和移动功能）
  UNDO: 'undo',
  REDO: 'redo',
  CLEAR: 'clear',
});

// 激光笔配置
const LASER_CONFIG = {
  fadeOutDuration: 3000, // 3秒消失
  animationSteps: 60, // 动画帧数
};

// 荧光笔配置
const HIGHLIGHTER_CONFIG = {
  opacity: 0.4, // 半透明
  blendMode: 'multiply', // 混合模式
};

const PEN_PROFILE_TO_TYPE = Object.freeze({
  fountain: PenTypes.FOUNTAIN,
  pencil: PenTypes.PENCIL,
  brush: PenTypes.BRUSH,
  marker: PenTypes.MARKER,
});

const resolvePenTypeFromConfig = (toolConfig) => {
  if (!toolConfig) {
    return PenTypes.FOUNTAIN;
  }

  if (toolConfig.penProfile && PEN_PROFILE_TO_TYPE[toolConfig.penProfile]) {
    return PEN_PROFILE_TO_TYPE[toolConfig.penProfile];
  }

  if (toolConfig.tool === DRAWING_TOOLS.PENCIL) {
    return PenTypes.PENCIL;
  }

  if (toolConfig.tool === DRAWING_TOOLS.BRUSH) {
    return PenTypes.BRUSH;
  }

  if (toolConfig.tool === DRAWING_TOOLS.HIGHLIGHTER) {
    return PenTypes.MARKER;
  }

  return PenTypes.FOUNTAIN;
};

// 形状类型
const SHAPES = Object.freeze({
  LINE: 'line',
  RECTANGLE: 'rectangle',
  CIRCLE: 'circle',
  TRIANGLE: 'triangle',
  DIAMOND: 'diamond', // 菱形
  PARALLELOGRAM: 'parallelogram', // 平行四边形
  ELLIPSE: 'ellipse', // 椭圆
  ARROW: 'arrow',
  ARC: 'arc', // 弧形
  STAR: 'star',
  POLYGON: 'polygon',
  CURVE: 'curve',
});

// AI工具类型
const AI_TOOLS = [
  { id: 'translate', label: '翻译', icon: 'translate', description: '翻译选中的文本' },
  { id: 'code_recognition', label: '代码识别', icon: 'code-braces', description: '识别并格式化代码' },
  { id: 'math_formula', label: '数学公式', icon: 'function-variant', description: '识别数学公式并转换为LaTeX' },
  { id: 'handwriting', label: '手写识别', icon: 'draw', description: '识别手写内容并转换为文本' },
  { id: 'summarize', label: '摘要', icon: 'text-box', description: '生成文本摘要' },
  { id: 'extract_keywords', label: '提取关键词', icon: 'key', description: '从文本中提取关键词' },
  { id: 'explain', label: '解释', icon: 'help', description: '解释选中的内容' },
  { id: 'rewrite', label: '改写', icon: 'pencil', description: '改写选中的文本' },
  { id: 'grammar', label: '语法检查', icon: 'spellcheck', description: '检查文本的语法和拼写' },
  { id: 'simplify', label: '简化', icon: 'text-short', description: '简化复杂的文本' },
];

// ============ 企业级功能配置 ============

// 快捷键映射
const KEYBOARD_SHORTCUTS = Object.freeze({
  // 工具快捷键
  'P': DRAWING_TOOLS.PEN,
  'N': DRAWING_TOOLS.PENCIL,
  'B': DRAWING_TOOLS.BRUSH,
  'H': DRAWING_TOOLS.HIGHLIGHTER,
  'L': DRAWING_TOOLS.LASER,
  'E': DRAWING_TOOLS.ERASER,
  'S': DRAWING_TOOLS.LASSO,
  'U': DRAWING_TOOLS.SHAPE,
  'T': DRAWING_TOOLS.TEXT,
});

// 工具预设 - 快速切换场景
const TOOL_PRESETS = Object.freeze({
  writing: {
    id: 'writing',
    name: '书写模式',
    icon: 'pencil',
    tool: DRAWING_TOOLS.PEN,
    color: 'THEME_TEXT', // 动态跟随主题
    strokeWidth: 2,
    opacity: 1,
  },
  annotation: {
    id: 'annotation',
    name: '标注模式',
    icon: 'highlighter',
    tool: DRAWING_TOOLS.HIGHLIGHTER,
    color: '#FFFF00',
    strokeWidth: 12,
    opacity: 0.4,
  },
  drawing: {
    id: 'drawing',
    name: '绘画模式',
    icon: 'brush',
    tool: DRAWING_TOOLS.BRUSH,
    color: '#333333',
    strokeWidth: 5,
    opacity: 0.9,
  },
  sketch: {
    id: 'sketch',
    name: '草图模式',
    icon: 'pencil-outline',
    tool: DRAWING_TOOLS.PENCIL,
    color: '#808080',
    strokeWidth: 1,
    opacity: 0.8,
  },
  technical: {
    id: 'technical',
    name: '制图模式',
    icon: 'ruler-square',
    tool: DRAWING_TOOLS.SHAPE,
    color: '#0000FF',
    strokeWidth: 2,
    opacity: 1,
    showGrid: true,
    showRuler: true,
  },
  presentation: {
    id: 'presentation',
    name: '演示模式',
    icon: 'laser-pointer',
    tool: DRAWING_TOOLS.LASER,
    color: '#FF0000',
    strokeWidth: 4,
    opacity: 1,
  },
});

// 持久化存储键
const STORAGE_KEYS = Object.freeze({
  TOOLBAR_PREFERENCES: '@zeroislenotes:toolbar_preferences',
  RECENT_COLORS: '@zeroislenotes:recent_colors',
  CURRENT_PRESET: '@zeroislenotes:current_preset',
});

// Eraser sizes removed - now using unified stroke width


// Modern SVG Icons
const PenIcon = ({ color = '#000', size = 20 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path
      d="M20.71 7.04c.39-.39.39-1.04 0-1.41l-2.34-2.34c-.37-.39-1.02-.39-1.41 0l-1.84 1.83 3.75 3.75M3 17.25V21h3.75L17.81 9.93l-3.75-3.75L3 17.25z"
      fill={color}
    />
  </Svg>
);

const PencilIcon = ({ color = '#000', size = 20 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path
      d="M20.71 7.04c.39-.39.39-1.04 0-1.41l-2.34-2.34c-.37-.39-1.02-.39-1.41 0l-1.84 1.83 3.75 3.75M3 17.25V21h3.75L17.81 9.93l-3.75-3.75L3 17.25z"
      fill={color}
      opacity={0.7}
    />
  </Svg>
);

const BrushIcon = ({ color = '#000', size = 20 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path
      d="M7 14c-1.66 0-3 1.34-3 3 0 1.31-1.16 2-2 2 .92 1.22 2.49 2 4 2 2.21 0 4-1.79 4-4 0-1.66-1.34-3-3-3zm13.71-9.37l-1.34-1.34a.996.996 0 00-1.41 0L9 12.25 11.75 15l8.96-8.96c.39-.39.39-1.02 0-1.41z"
      fill={color}
    />
  </Svg>
);

const HighlighterIcon = ({ color = '#000', size = 20 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path
      d="M17.75 7L14 3.25l-10 10V17h3.75l10-10zm2.96-2.96a.996.996 0 000-1.41L18.37.29a.996.996 0 00-1.41 0L15 2.25 18.75 6l1.96-1.96z"
      fill={color}
      opacity={0.6}
    />
    <Path
      d="M0 20h24v4H0z"
      fill={color}
      opacity={0.3}
    />
  </Svg>
);

const LaserIcon = ({ color = '#000', size = 20 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    {/* 中心光点 */}
    <Path
      d="M12 12 m-3 0 a 3 3 0 1 0 6 0 a 3 3 0 1 0 -6 0"
      fill={color}
    />
    {/* 内层光晕 */}
    <Path
      d="M12 12 m-5 0 a 5 5 0 1 0 10 0 a 5 5 0 1 0 -10 0"
      fill={color}
      opacity={0.3}
    />
    {/* 外层光晕 */}
    <Path
      d="M12 12 m-7 0 a 7 7 0 1 0 14 0 a 7 7 0 1 0 -14 0"
      fill={color}
      opacity={0.15}
    />
    {/* 四条射线表示激光特性 */}
    <Path
      d="M12 2 L12 6 M12 18 L12 22 M2 12 L6 12 M18 12 L22 12"
      stroke={color}
      strokeWidth="1.5"
      strokeLinecap="round"
      opacity={0.5}
    />
  </Svg>
);

const EraserIcon = ({ color = '#000', size = 20 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path
      d="M16.24 3.56l4.95 4.94c.78.79.78 2.05 0 2.84L12 20.53a4.008 4.008 0 01-5.66 0L2.81 17c-.78-.79-.78-2.05 0-2.84l10.6-10.6c.79-.78 2.05-.78 2.83 0M4.22 15.58l3.54 3.53c.78.79 2.04.79 2.83 0l3.53-3.53-6.36-6.36-3.54 3.53c-.78.79-.78 2.05 0 2.83z"
      fill={color}
    />
  </Svg>
);


// 套索图标 - 纯虚线自由形状
const LassoIcon = ({ color = '#000', size = 20 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    {/* 自由形状的纯虚线轮廓 - 更流畅的曲线 */}
    <Path
      d="M5 8 Q3 12 5 16 Q7 19 10 20 Q14 21 17 19 Q20 17 21 13 Q22 9 20 6 Q18 3 14 3 Q10 3 7 5 Q5 6 5 8 Z"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeDasharray="4,3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

const RulerIcon = ({ color = '#000', size = 20 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path
      d="M21 6H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zM7 14H5v-4h2v4zm4 0H9v-4h2v4zm0-6h-1V6H8v2H7V6H5v2H4V6H3v10h1v-2h1v2h2v-2h1v2h2v-2h1v2h2v-2h1v2h2v-2h1v2h2v-2h1v2h1V6h-1v2h-1V6h-2v2h-1V6h-2v2zm4 6h-2v-4h2v4zm4 0h-2v-4h2v4z"
      fill={color}
    />
  </Svg>
);

const GridIcon = ({ color = '#000', size = 20 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path
      d="M3 3v8h8V3H3zm6 6H5V5h4v4zm-6 4v8h8v-8H3zm6 6H5v-4h4v4zm4-16v8h8V3h-8zm6 6h-4V5h4v4zm-6 4v8h8v-8h-8zm6 6h-4v-4h4v4z"
      fill={color}
    />
  </Svg>
);

// 书签图标
const BookmarkIcon = ({ color = '#000', size = 20 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path
      d="M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2z"
      fill={color}
    />
  </Svg>
);

// 添加书签图标
const AddBookmarkIcon = ({ color = '#000', size = 20 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path
      d="M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2zm-1 9h-3v3h-2v-3H8v-2h3V7h2v3h3v2z"
      fill={color}
    />
  </Svg>
);

// 撤销图标
const UndoIcon = ({ color = '#000', size = 20 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path
      d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"
      fill={color}
    />
  </Svg>
);

// 重做图标
const RedoIcon = ({ color = '#000', size = 20 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path
      d="M18.4 10.6C16.55 8.99 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22L3.9 16a8.002 8.002 0 0 1 7.6-5.5c1.95 0 3.73.72 5.12 1.88L13 15h9V6l-3.6 4.6z"
      fill={color}
    />
  </Svg>
);

// 清除图标 - 优化的扫帚样式
const ClearIcon = ({ color = '#000', size = 20 }) => {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {/* 扫帚把手 - 加粗 */}
      <Path
        d="M18 2 L10 10"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* 扫帚刷头主体 - 更饱满 */}
      <Path
        d="M10 10 L4 16 L2 18 L4 20 L6 22 L8 20 L14 14 Z"
        fill={color}
      />
      {/* 刷毛纹理线条 - 简化 */}
      <Path
        d="M6 16 L4 18 M8 14 L6 16 M10 12 L8 14 M12 16 L10 18"
        stroke="#FFF"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity={0.3}
      />
      {/* 飞扬的灰尘颗粒 - 增强视觉效果 */}
      <Path
        d="M15 11 Q17 10 19 11"
        stroke={color}
        strokeWidth="2"
        strokeDasharray="1,2"
        fill="none"
        opacity={0.4}
        strokeLinecap="round"
      />
      <Path
        d="M17 9 Q19 8 21 9"
        stroke={color}
        strokeWidth="1.5"
        strokeDasharray="1,2"
        fill="none"
        opacity={0.3}
        strokeLinecap="round"
      />
    </Svg>
  );
};

// AI工具图标 - AI文字样式带光环
const AIIcon = ({ color = '#000', size = 20 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    {/* 外圈光环 */}
    <Path
      d="M12 2 C6.48 2 2 6.48 2 12 C2 17.52 6.48 22 12 22 C17.52 22 22 17.52 22 12 C22 6.48 17.52 2 12 2 Z"
      stroke={color}
      strokeWidth="1.5"
      fill="none"
      opacity={0.3}
    />
    {/* A字母 - 重新设计 */}
    <Path
      d="M7 16 L9 7 L11 16"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <Path
      d="M7.8 13 L10.2 13"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      fill="none"
    />
    {/* I字母 */}
    <Path
      d="M14 7 L14 16 M13 7 L15 7 M13 16 L15 16"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      fill="none"
    />
    {/* 顶部星光点缀 */}
    <Path
      d="M12 3 L12.3 4 L13.3 4.2 L12.5 4.8 L12.7 5.8 L12 5.3 L11.3 5.8 L11.5 4.8 L10.7 4.2 L11.7 4 Z"
      fill={color}
      opacity={0.6}
    />
    {/* 右侧闪光 */}
    <Path
      d="M18.5 8 L19 9.5 L20.5 10 L19 10.5 L18.5 12 L18 10.5 L16.5 10 L18 9.5 Z"
      fill={color}
      opacity={0.4}
    />
  </Svg>
);

// 历史图标
const HistoryIcon = ({ color = '#000', size = 20 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path
      d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"
      fill={color}
    />
  </Svg>
);

// 形状图标 - 平行四边形
const ShapeIcon = ({ color = '#000', size = 20 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path
      d="M6 6 L18 6 L22 18 L10 18 Z"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinejoin="round"
    />
  </Svg>
);

// 文本图标
const TextIcon = ({ color = '#000', size = 20 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path
      d="M5 4v3h5.5v12h3V7H19V4H5z"
      fill={color}
    />
  </Svg>
);

// 笔触粗细图标 - 显示三条不同粗细的线
const StrokeWidthIcon = ({ color = '#000', size = 20, strokeWidth = 2 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    {/* 细线 */}
    <Path
      d="M4 6 L20 6"
      stroke={color}
      strokeWidth="1"
      strokeLinecap="round"
    />
    {/* 中等线 */}
    <Path
      d="M4 12 L20 12"
      stroke={color}
      strokeWidth="3"
      strokeLinecap="round"
    />
    {/* 粗线 */}
    <Path
      d="M4 18 L20 18"
      stroke={color}
      strokeWidth="5"
      strokeLinecap="round"
    />
  </Svg>
);

// 图片图标
const ImageIcon = ({ color = '#000', size = 20 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path
      d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"
      fill={color}
    />
  </Svg>
);

// 取色器图标（胶头滴管样式）
const EyedropperIcon = ({ color = '#000', size = 20 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path
      d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"
      fill={color}
    />
  </Svg>
);

// Tool visibility configuration based on mode
const TOOL_CONFIG = {
  canvas: {
    drawing: true,
    editing: true,
    styling: true,
    ai: true,
    shapes: true,
    text: true,
    image: true,
    bookmarks: false, // Bookmarks are handled per-page, not on infinite canvas
  },
  paged: {
    drawing: true,
    editing: true,
    styling: true,
    ai: true,
    shapes: true,
    text: true,
    image: true,
    bookmarks: true, // 分页笔记按页存书签，工具栏需要暴露书签组
  },
  pdf: {
    drawing: true,
    editing: true,
    styling: true,
    ai: true,
    shapes: true,
    text: true,
    image: true,
    bookmarks: true,
  },
  markdown: {
    drawing: false, // No drawing on markdown editor
    editing: true, // Undo/redo for text
    styling: false,
    ai: true, // AI can process text
    shapes: false,
    text: true, // Text formatting tools could be here
    image: true,
    bookmarks: true,
  },
  'file-viewer': { // Default for file viewer, very limited
    drawing: false,
    editing: false,
    styling: false,
    ai: false,
    shapes: false,
    text: false,
    image: false,
    bookmarks: false,
  },
};

const AllInOneToolbar = ({
  // 模式设置
  mode = 'canvas', // 'canvas', 'pdf', 'markdown', 'file-viewer'

  // 绘图工具相关props
  onToolChange,
  onColorChange,
  onStrokeWidthChange,
  onToolConfigChange,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  onClear,
  initialTool = DRAWING_TOOLS.PEN,
  initialColor = '#000000',
  initialStrokeWidth = 2,
  currentToolConfig,

  // AI工具相关props
  onAIToolSelect,
  selectedText,
  onAIProcessResult,
  onImageUpload,
  // 本地OCR/手写识别回调（由容器实现）
  onRequestRegionOCR,
  onRequestStrokeRecognition,

  // 书签相关
  onBookmarkAdd,
  onBookmarkList,
  onBookmarkNavigate, // 导航到书签
  currentNoteId,      // 当前笔记ID
  currentPage = 1,    // 当前页码

  // 文本工具相关
  onTextAdd,          // 添加文本回调

  // 套索工具相关props
  onLassoSelect,      // 套索选择回调
  onLassoComplete,    // 套索完成回调

  // WS-B：安全区注入点。放在这里而不是从 theme 里读，
  // 是因为调用方（ViewerLayout / 各笔记页）才持有 SafeAreaInsets 的权威来源。
  defaultInsetsForToolbar,

  // WS-C：原生上报的套索选中笔迹 id。分页/无限画布屏幕已通过 toolbarProps 透传进来。
  selectedStrokeIds = [],

  // WS-C：选中笔迹的后续操作通道（删除/复制/移动）。
  // 目前四个屏幕都还没有实现该回调，因此工具栏会**自动降级**为只读提示，
  // 而不是给用户一个点了没反应的按钮。父级一旦传了它，操作条即自动启用。
  onSelectedStrokesAction,
}) => {
  const { colors } = useTheme();
  const handleStreamingAIToolSelectRef = useRef(null);

  // 屏幕宽度必须**响应式**获取。
  // 模块顶层的 `Dimensions.get('window')` 只在首次求值时取一次快照：
  // 旋转、分屏、以及 iPad 从「iPhone 兼容模式」切到平板模式等场景都不会更新，
  // 会让断点判定与换行策略一直用旧值（真机实测：iPad 报告 w=1032 却仍按 390 的布局走）。
  // useWindowDimensions 是 RN 官方推荐做法，尺寸变化会自动触发重渲染。
  const windowDimensions = useWindowDimensions();
  const screenWidth = Math.round(
    (windowDimensions && windowDimensions.width > 0)
      ? windowDimensions.width
      : SCREEN_WIDTH
  );
  const screenHeight = Math.round(
    (windowDimensions && windowDimensions.height > 0)
      ? windowDimensions.height
      : SCREEN_HEIGHT
  );

  // ==================== 工作流代码插入区（互不越界，勿删标记） ====================
  // 说明：本轮工具栏优化由三条工作流并行完成，它们只允许在各自标记内追加代码，
  // 主渲染 JSX 由 Lead 统一集成，避免多方同时改同一段 JSX 造成冲突。

  // ==== WS-A:BEGIN（手感与手势：pan 工具、手感面板状态、补偿 effect） ====
  //
  // 本区域只提供「常量 + 处理函数 + 补偿 effect」，JSX 由 Lead 统一集成。
  // 之所以全用「普通函数声明」而不是 useCallback：插入区位于所有 useState 之前，
  // 一旦在依赖数组里引用后面声明的值（notifyToolPayloadChange 等）就会在渲染期
  // 触发 TDZ ReferenceError；普通函数每次渲染重建，天然拿到最新状态且无依赖数组。

  // 平移/手掌工具 id。与 bridge 的 TOOL_TO_INTERACTION_MODE.pan 保持同一个字符串，
  // 否则手势模式会落回 mixed，用户点「手掌」后依然在画线。
  const PAN_TOOL_ID = 'pan';

  // 手感面板自持开关状态，工具栏只用 ref 命令式开合：
  // 这样 AllInOneToolbar 顶层不必新增 useState（拖动滑块的实时更新不会牵动整条工具栏重渲染）。
  // 本轮只允许改插入区、不能动文件顶部的 import，故用 require 取面板组件
  // （Metro/Babel 下与顶部 import 等价，模块只求值一次；Lead 集成时可上提到顶部 import）。
  // HandFeelPanel 已在文件顶部 import（避免组件体内 require 造成的依赖噪声）。
  const handFeelPanelRef = useRef(null);

  // 标尺/网格/形状的覆盖层快照，用于比对"是否真的变了"。
  const overlaySnapshotRef = useRef(null);

  // 补偿 effect：修复 showRuler/showGrid/activeShape 被重置的真实缺陷。
  // 现有那个工具变化 effect 的依赖数组里没有这三项，于是
  //  - 预设切换（applyPreset 只 setShowGrid/setShowRuler、完全不 notify）在同一次更新里
  //    若其它依赖值没变，原生就永远收不到这次覆盖层变化；
  //  - 先开网格再点其它也会因为 payload 被后续 notify 覆盖回去而丢状态。
  // 这里额外盯住这三项：任意一项变化就重新下发一次完整载荷，
  // 不修改原 effect（属共享区域）。
  // 刻意不写依赖数组：deps 里引用 notifyToolPayloadChange 会在渲染期 TDZ 崩溃（见上方说明），
  // 而函数体本身足够轻（一次浅比较），notifyToolPayloadChange 内部还有 isSameToolConfig 去重。
  useEffect(() => {
    const snapshot = { showRuler, showGrid, activeShape };
    const previous = overlaySnapshotRef.current;
    const overlayChanged = previous
      ? (
        previous.showRuler !== snapshot.showRuler ||
        previous.showGrid !== snapshot.showGrid ||
        previous.activeShape !== snapshot.activeShape
      )
      : false;

    overlaySnapshotRef.current = snapshot;

    // 首次挂载不做补偿：挂载时已有主 effect 下发初始配置，重复下发只会多打一次桥。
    if (!overlayChanged) {
      return;
    }

    notifyToolPayloadChange({
      showRuler: snapshot.showRuler,
      showGrid: snapshot.showGrid,
    });
  });

  // 打开手感面板：面板自己管可见性，工具栏只发命令。
  function openHandFeelPanel() {
    if (handFeelPanelRef.current && typeof handFeelPanelRef.current.open === 'function') {
      handFeelPanelRef.current.open();
    }
    triggerHapticFeedback('light');
  }

  // 手掌/平移工具：切换 activeTool 并立刻下发 tool=pan。
  // interactionMode 不在前端写死，交给 bridge 依据 TOOL_TO_INTERACTION_MODE 推导成 gesture，
  // 避免"前端一套映射、bridge 一套映射"两边漂移。
  function handlePanToolPress() {
    setActiveTool(PAN_TOOL_ID);
    triggerHapticFeedback('light');
    notifyToolPayloadChange({ type: PAN_TOOL_ID, tool: PAN_TOOL_ID });
  }

  // 手感面板实时下发。面板已经做过 60ms 节流，这里只负责同步工具栏本地状态。
  function handleHandFeelChange(payload) {
    if (!payload || typeof payload !== 'object') {
      return;
    }

    // 必须回写工具栏的粗细/不透明度状态：否则面板调完粗细后，
    // 下一次工具切换会用旧的 activeStrokeWidth 把原生刚设好的值静默写回去。
    if (typeof payload.strokeWidth === 'number') {
      setActiveStrokeWidth(payload.strokeWidth);
    }
    if (typeof payload.opacity === 'number') {
      setStrokeOpacity(payload.opacity);
    }

    if (onToolConfigChange) {
      onToolConfigChange(payload);
    }
  }

  // Lead 集成用片段（放在绘制工具组内）：
  //   <TouchableOpacity
  //     style={[styles.toolButton, isDrawingToolsLocked && styles.disabledToolButton,
  //       activeTool === PAN_TOOL_ID && { backgroundColor: colors.primary + '30' }]}
  //     activeOpacity={TOOL_BUTTON_ACTIVE_OPACITY}
  //     onPress={handlePanToolPress}
  //     disabled={isDrawingToolsLocked}
  //     accessibilityLabel="手掌/平移工具"
  //     accessibilityHint="单指拖动画面，不留下墨迹"
  //     accessibilityRole="button"
  //     accessibilityState={{ selected: activeTool === PAN_TOOL_ID, disabled: isDrawingToolsLocked, busy: false }}
  //   >
  //     <MaterialIcon name="pan" color={...} size={toolbarConfig.iconSize} />
  //   </TouchableOpacity>
  //
  //   <TouchableOpacity ... onPress={openHandFeelPanel} accessibilityLabel="手感" ...>
  //     <MaterialIcon name="tune-variant" color={colors.text} size={toolbarConfig.iconSize} />
  //   </TouchableOpacity>
  //
  //   面板挂载（与 PenSelector 同级）：
  //   <HandFeelPanel
  //     ref={handFeelPanelRef}
  //     toolConfig={currentToolConfig}
  //     onChange={handleHandFeelChange}
  //   />

  // ==== WS-A:END ====

  // ==== WS-C:BEGIN（未接通收口：偏好加载、最近颜色、选中态降级） ====
  //
  // 与 WS-A 同样的约束：本区域位于所有 useState 之前，effect 的依赖数组里
  // 一旦引用下方声明的 activeColor / setActiveColor 等，会在渲染期 TDZ 崩溃。
  // 因此这里所有 effect 都不写依赖数组（函数体轻、内部自行去重），
  // 需要读最新值的地方一律用「函数式 setState」或 ref。

  // 本轮新增的纯逻辑层（偏好清洗/加载竞态/最近颜色规整）。
  // 顶部 import 区是三条工作流共享的区域，为遵守「只改自己标记区」的纪律，
  // 这里用 require 取（Metro/Babel 下与顶部 import 等价，模块只求值一次）；
  // Lead 集成时可上提到文件顶部 import。
  // createPreferencesLoader / deriveTouchedFields / pickRecentColors / toSwatchList
  // 已在文件顶部 import（原因同上）。

  // 偏好加载器：整个组件生命周期只建一次。
  // 修复缺陷 1 —— 原先 loadPreferences / savePreferences 之间没有任何「加载完成」标志，
  // 挂载 1 秒后的防抖保存会把刚从 AsyncStorage 读回的颜色与粗细重新写成默认值。
  const preferencesLoaderRef = useRef(null);
  if (!preferencesLoaderRef.current) {
    preferencesLoaderRef.current = createPreferencesLoader({
      // 测试与真机都走注入式 storage：单测里注入假实现，绝不真的读写磁盘。
      storage: AsyncStorage,
      // 这里的默认值必须与下方 useState 初值一致，否则「用户是否动过」会误判。
      readDefaultPrefs: () => ({
        lastColor: initialColor,
        lastStrokeWidth: initialStrokeWidth,
        lastTool: initialTool,
        showRuler: false,
        showGrid: false,
      }),
    });
  }

  // 首次偏好加载是否已经结束。加载结束前一切「用默认值落盘」的行为都必须被拦住。
  const [preferencesHydrated, setPreferencesHydrated] = useState(false);
  // 最近颜色镜像：缺陷 2 是「只写不读」——addRecentColor 会写 AsyncStorage，
  // 但组件从未渲染 recentColors。这里把加载结果放进 state 供 renderRecentColors 消费。
  const [recentPalette, setRecentPalette] = useState([]);

  const hydrationWriteDoneRef = useRef(false);

  // 挂载时加载一次偏好（loader 内部保证并发/重复调用只真正读一次磁盘）。
  useEffect(() => {
    let cancelled = false;
    const loader = preferencesLoaderRef.current;

    loader.load().then((result) => {
      if (cancelled) {
        return;
      }

      // 逐字段回填，并做「用户是否已经动过」判定：
      // 若在异步读盘期间用户已经改过该字段（当前值 != 默认值），保留用户值；
      // 否则采用磁盘值。这正是任务要求的 isUserTouched 语义
      // （判定逻辑抽在 AllInOneToolbarPrefs.deriveTouchedFields，有独立单测覆盖）。
      setActiveColor((current) => (
        deriveTouchedFields({ lastColor: current }, { lastColor: initialColor }).length > 0
          ? current
          : result.preferences.lastColor
      ));
      setActiveStrokeWidth((current) => (
        deriveTouchedFields({ lastStrokeWidth: current }, { lastStrokeWidth: initialStrokeWidth }).length > 0
          ? current
          : result.preferences.lastStrokeWidth
      ));
      setActiveTool((current) => (
        deriveTouchedFields({ lastTool: current }, { lastTool: initialTool }).length > 0
          ? current
          : result.preferences.lastTool
      ));
      setShowRuler((current) => (
        deriveTouchedFields({ showRuler: current }, { showRuler: false }).length > 0
          ? current
          : result.preferences.showRuler
      ));
      setShowGrid((current) => (
        deriveTouchedFields({ showGrid: current }, { showGrid: false }).length > 0
          ? current
          : result.preferences.showGrid
      ));

      setRecentPalette(result.recentColors);
      if (result.currentPreset) {
        setCurrentPreset(result.currentPreset);
      }
      setPreferencesHydrated(true);
    }).catch(() => {
      // loader 已经吞掉读取异常并把 loaded 置位；这里只需避免 UI 卡在「未加载」态。
      if (!cancelled) {
        setPreferencesHydrated(true);
      }
    });

    return () => {
      cancelled = true;
    };
    // 刻意只挂载时跑一次：initialColor / initialStrokeWidth / initialTool 是
    // 父级在挂载那一刻给的初值，写进依赖数组会在父级回传新值时把用户当前
    // 正在用的颜色/工具再次覆盖（比缺依赖更危险）。deriveTouchedFields 是纯函数，
    // 稳定不变，无需进入依赖数组。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 加载完成后的防御性补写（缺陷 1 的第二道闸）。
  // 若磁盘读取慢于外层 1 秒防抖，外层会先用「挂载时的默认值」落盘一次。
  // 这里在读盘结束、状态已回填之后补写一次，保证磁盘的最终值是用户偏好。
  // 只写一次：依赖数组不写是 TDZ 约束，因此用 ref 自己去重。
  useEffect(() => {
    if (!preferencesHydrated || hydrationWriteDoneRef.current) {
      return;
    }
    hydrationWriteDoneRef.current = true;

    if (!preferencesLoaderRef.current.canPersist()) {
      return;
    }

    const payload = {
      lastColor: activeColor,
      lastStrokeWidth: activeStrokeWidth,
      lastTool: activeTool,
      showRuler,
      showGrid,
    };

    AsyncStorage
      .setItem(STORAGE_KEYS.TOOLBAR_PREFERENCES, JSON.stringify(payload))
      .catch(() => {});
  });

  // 缺陷 2 的另一半：addRecentColor 只更新组件内的 recentColors，
  // 工具栏上的最近颜色条必须跟着变，否则用户本会话新选的颜色要等重启才出现。
  // 用 key 比对而不是依赖数组：依赖数组引用 recentColors 会在渲染期 TDZ 崩溃。
  const recentMirrorKeyRef = useRef('');
  // 依赖数组里写 recentColors 会不会 TDZ？
  // 不会：模块顶层 import 的 require 与函数声明都不提升 useState 的返回值，
  // 但依赖数组是在「渲染已经走到 setRecentPalette 这一行之后」才被求值的
  // （useEffect 调用本身在 recentColors 的 useState 之后执行），
  // 所以这里可以安全地写 recentColors；下面的注释保留来由以免后人误删。
  // 之所以仍然用 key 去重：recentColors 的数组身份每次都变，只有内容变了才需要镜像，
  // 否则每次渲染都会 setRecentPalette（同值 setState 虽会 bail out，但会多一次调度）。
  useEffect(() => {
    const source = Array.isArray(recentColors) ? recentColors : [];
    const key = source.join('|');
    if (!key || key === recentMirrorKeyRef.current) {
      return;
    }

    recentMirrorKeyRef.current = key;
    setRecentPalette(pickRecentColors(source, 10));
    // 只依赖 recentColors：pickRecentColors 现在是模块顶层 import 的纯函数，
    // 它不是响应式值，放进依赖数组会被 react-hooks 判为无效依赖（已实测报 error）。
  }, [recentColors]);

  /**
   * 最近颜色条。
   *
   * 为什么放在工具栏上「再渲染一份」：ColorPicker 内部虽然也有最近颜色，
   * 但它必须点开颜色面板才可见，等于「最近颜色」在工具栏上手不可及。
   * 这里渲染的是持久化在 STORAGE_KEYS.RECENT_COLORS 里的同一份数据。
   *
   * Lead 接线位置：主 return 的根 <View> 内，与 renderPresetSelector() 同级。
   */
  const renderRecentColors = () => {
    const swatches = toSwatchList(pickRecentColors(recentPalette, 6));
    if (swatches.length === 0) {
      return null;
    }

    return (
      <View
        testID="toolbar.recentColors"
        accessibilityRole="toolbar"
        accessibilityLabel="最近使用的颜色"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 8,
          paddingVertical: 2,
        }}
      >
        <Text style={{ color: colors.textSecondary, fontSize: 10, marginRight: 6 }}>最近</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {swatches.map(({ color, key }) => (
            <TouchableOpacity
              key={key}
              testID={`toolbar.recentColor.${color.replace('#', '')}`}
              style={{
                width: 20,
                height: 20,
                borderRadius: 10,
                marginRight: 6,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: color,
              }}
              onPress={() => {
                setActiveColor(color);
                notifyToolPayloadChange({ color });
                triggerHapticFeedback('light');
              }}
              accessibilityRole="button"
              accessibilityLabel={`最近颜色 ${color}`}
              accessibilityHint="把该颜色设为当前画笔颜色"
              accessibilityState={{ disabled: false, busy: false }}
            />
          ))}
        </ScrollView>
      </View>
    );
  };

  /**
   * 套索选中笔迹的操作条。
   *
   * 核实结论（不是猜测）：
   *  - 原生确实会上报选中结果（SkiaPagedCanvasScreenNative 的 onStrokesSelected ->
   *    selectedStrokeIds，并且已经通过 toolbarProps 传进本组件），
   *    但工具栏侧此前没有任何消费方，选中态在 UI 上完全不可见；
   *  - onLassoSelect / onLassoComplete 是「工具栏 -> 原生」方向的下发通道，
   *    由 useNativeToolbarBridge 实现并已在父级接线，工具栏内部本就不需要调用它们；
   *  - 本组件没有任何安全的「删除/复制选中笔迹」命令通道：onToolConfigChange 只承载
   *    绘图工具配置，bridge 也没有暴露 deleteSelectedStrokes 之类的派发器。
   *
   * 因此按任务要求选择 (b) 诚实降级 + 预留回调，而不是伪造 IPC 命令：
   *  - 父级传入 onSelectedStrokesAction 时才启用按钮（拥有真实通道的容器才用得上）；
   *  - 未传入时按钮 disabled 且 hint 写明「当前版本暂不支持」，不给虚假高亮。
   *
   * Lead 接线位置：主 return 的根 <View> 内，与 renderPresetSelector() 同级，调用
   *   {renderSelectedStrokesBar(selectedStrokeIds, onSelectedStrokesAction)}
   * 并且需要在组件 props 解构里新增
   *   selectedStrokeIds = [],
   *   onSelectedStrokesAction,
   */
  const renderSelectedStrokesBar = (strokeIds, strokesActionHandler) => {
    const ids = Array.isArray(strokeIds) ? strokeIds : [];
    if (ids.length === 0) {
      // 没有选中内容时整条不浮出，避免留下一条永远不可用的工具条。
      return null;
    }

    const actionEnabled = typeof strokesActionHandler === 'function';
    const actions = [
      { id: 'delete', label: '删除选中笔迹', icon: 'delete-outline' },
      { id: 'duplicate', label: '复制选中笔迹', icon: 'content-copy' },
      { id: 'done', label: '完成选择', icon: 'check' },
    ];

    return (
      <View
        testID="toolbar.selectedStrokesBar"
        accessibilityRole="toolbar"
        accessibilityLabel={`已选中 ${ids.length} 条笔迹`}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 8,
          paddingVertical: 2,
        }}
      >
        <Text style={{ color: colors.text, fontSize: 11, marginRight: 8 }}>
          {`已选中 ${ids.length} 条`}
        </Text>
        {actions.map((action) => (
          <TouchableOpacity
            key={action.id}
            testID={`toolbar.selectedStrokesAction.${action.id}`}
            style={[
              styles.toolButton,
              !actionEnabled && styles.disabledToolButton,
            ]}
            disabled={!actionEnabled}
            onPress={actionEnabled
              ? () => {
                strokesActionHandler(action.id, ids);
                triggerHapticFeedback('light');
              }
              : undefined}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            accessibilityHint={
              actionEnabled
                ? undefined
                : '当前版本暂不支持，需要由画布容器提供命令通道'
            }
            accessibilityState={{ disabled: !actionEnabled, busy: false }}
          >
            <MaterialIcon
              name={action.icon}
              size={toolbarConfig.iconSize}
              color={actionEnabled ? colors.text : colors.textDisabled}
            />
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  // ==== WS-C:END ====

  // ==================== 工作流代码插入区结束 ====================


  // 获取响应式配置。
  // WS-B 集成修正：原先这里是 getToolbarConfig()（只看 SCREEN_WIDTH 的几个阈值），
  // 而 WS-B 交付的 resolveToolbarLayout 只能算出配置却没人用 —— 等于没接通。
  // 现在这里真实采用响应式布局结果：断点分档 + 安全区 + 44dp 触达 + 分组间距。
  const wsbBaseToolbarConfig = getToolbarConfig();
  const wsbScreenWidth = (typeof screenWidth === 'number' && screenWidth > 0)
    ? screenWidth
    : wsbBaseToolbarConfig.buttonSize * 10;
  const wsbLayout = resolveToolbarLayout(wsbScreenWidth, {
    insets: defaultInsetsForToolbar,
  });

  // toolbarConfig 是主 return 与 createStyles 唯一消费的配置对象，
  // 因此把响应式结果叠在这里，才算真正接通（31 处 toolbarConfig.* 引用同时生效）。
  const toolbarConfig = useMemo(() => ({
    ...wsbBaseToolbarConfig,
    tier: wsbLayout.tier,
    buttonSize: wsbLayout.buttonSize,
    iconSize: wsbLayout.iconSize,
    hitSlop: wsbLayout.hitSlop,
    // 注意字段映射：纯逻辑层的 horizontalPadding 对应旧配置的 padding，
    // groupGap 对应 spacing；createStyles 读的是旧字段名，所以在这里对齐。
    padding: wsbLayout.horizontalPadding,
    spacing: wsbLayout.groupGap,
    showLabels: wsbLayout.showLabels,
  }), [wsbBaseToolbarConfig, wsbLayout]);

  // 工具栏是否需要在窄屏上横滑：用布局纯函数估算「全部工具组一行是否放得下」。
  const toolbarNeedsScroll = useMemo(() => {
    // 必须传「每组各自的按钮数」而不是组数：一个绘图组就有 6 个按钮，
    // 只按组数估算会严重低估，导致溢出提示永不出现（集成期用真机实测发现）。
    const buttonsPerGroup = [
      2, // bookmarks：添加书签 / 书签列表
      1, // preset：场景预设
      3, // history：撤销 / 重做 / 清除
      6, // drawing：画笔/铅笔/刷子/荧光笔/激光笔 + 手掌平移
      2, // erase：橡皮擦 / 套索
      5, // style：颜色 / 粗细 / 笔触类型 / 手感 + 间距
      4, // assist：更多形状 / 标尺 / 网格 / 防误触 / 手指书写（含隐藏项）
      2, // ai：AI 工具 / AI 历史
      3, // page：形状 / 文本 / 图片
    ];
    const estimated = estimateToolbarWidth(toolbarConfig, buttonsPerGroup);
    return estimated > screenWidth;
    // screenWidth 必须进依赖：旋转/分屏/平板模式切换后要重新判定是否溢出。
  }, [toolbarConfig, screenWidth]);

  // 平板/宽屏改用「多行换行」而不是横滑：真机实测发现单行横滑时平板上
  // 颜色/粗细/手感永远在屏幕外，用户根本发现不了这些功能。
  // 判据是「设备够宽（平板）且内容真的放不下」，不能写死 1200pt 断点：
  // iPad Pro 13" 竖屏逻辑宽只有 1024pt（< 1200），按 wide 断点判定会落进 regular 而仍然横滑。
  // 下限沿用项目既有的平板口径 768pt（getToolbarConfig 的 isLargeScreen）。
  const TABLET_MIN_WIDTH = 768;
  const shouldWrapToolbar = screenWidth >= TABLET_MIN_WIDTH && toolbarNeedsScroll;

  // 动态生成样式。必须把 shouldWrapToolbar 传进去决定 maxHeight：
  // 单行模式下容器高度是定值（buttonSize 级别），换行时会裁掉第二行起的内容。
  // 注意不能用 `{ maxHeight: undefined }` 覆盖——RN 的 StyleSheet.flatten 不会用
  // undefined 覆盖已有值（真机实测：判据已是 wrap=true，界面却仍只有一行）。
  const styles = useMemo(
    () => createStyles(toolbarConfig, shouldWrapToolbar),
    [toolbarConfig, shouldWrapToolbar],
  );

  // 只有「确实溢出但又不换行」时才提示右侧还有内容。
  // 曾经写成 `SCREEN_WIDTH < TOOLBAR_BREAKPOINTS.wide`，结果平板上（最需要提示）反而消失；
  // 现在平板走换行分支，提示只服务于窄屏横滑场景，语义清晰。
  const shouldHintOverflow = toolbarNeedsScroll && !shouldWrapToolbar;
  const [activeTool, setActiveTool] = useState(initialTool);
  const [activeColor, setActiveColor] = useState(initialColor);
  const [activeStrokeWidth, setActiveStrokeWidth] = useState(initialStrokeWidth);
  const [activeShape, setActiveShape] = useState(SHAPES.LINE);

  // HSV颜色选择器状态
  // 颜色选择器状态
  // 移除：由ColorPicker组件内部管理
  // const [showCustomColorPicker, setShowCustomColorPicker] = useState(false); -> 使用 showColorPicker 代替

  // 触觉反馈支持（始终启用）
  const hapticFeedbackEnabled = true;

  // 触觉反馈函数
  const triggerHapticFeedback = useCallback((type = 'light') => {
    if (!hapticFeedbackEnabled) {return;}

    if (Platform.OS === 'ios') {
      switch (type) {
        case 'light':
          Vibration.vibrate(10);
          break;
        case 'medium':
          Vibration.vibrate(20);
          break;
        case 'heavy':
          Vibration.vibrate(50);
          break;
        case 'success':
          Vibration.vibrate([0, 10, 50, 10]);
          break;
        case 'error':
          Vibration.vibrate([0, 50, 100, 50]);
          break;
        default:
          Vibration.vibrate(10);
      }
    } else if (Platform.OS === 'android') {
      switch (type) {
        case 'light':
          Vibration.vibrate(25);
          break;
        case 'medium':
          Vibration.vibrate(50);
          break;
        case 'heavy':
          Vibration.vibrate(100);
          break;
        case 'success':
          Vibration.vibrate([0, 25, 50, 25]);
          break;
        case 'error':
          Vibration.vibrate([0, 100, 200, 100]);
          break;
        default:
          Vibration.vibrate(25);
      }
    }
  }, [hapticFeedbackEnabled]);

  // AI工具相关状态
  const [showAIToolModal, setShowAIToolModal] = useState(false);
  const [showAIHistoryModal, setShowAIHistoryModal] = useState(false);
  const [selectedAITool, setSelectedAITool] = useState(null);
  const [isAIProcessing, setIsAIProcessing] = useState(false);
  const [isImagePicking, setIsImagePicking] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isAIHistoryLoading, setIsAIHistoryLoading] = useState(false);
  const [isAIHistoryApplying, setIsAIHistoryApplying] = useState(false);
  const [aiHistory, setAIHistory] = useState([]);
  const [isStreamingModalVisible, setIsStreamingModalVisible] = useState(false);
  const [streamingText, setStreamingText] = useState('');

  // 无

  // 选择器状态
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showStrokeWidthPopover, setShowStrokeWidthPopover] = useState(false);
  const [showShapePicker, setShowShapePicker] = useState(false);

  // 文本工具状态
  const [showTextInputModal, setShowTextInputModal] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [textFontSize, setTextFontSize] = useState(16);
  const [textStyle, setTextStyle] = useState({ bold: false, italic: false, underline: false });
  const [textAlignment, setTextAlignment] = useState('left');
  const [isTextSubmitting, setIsTextSubmitting] = useState(false);

  // 书签相关状态
  const [showBookmarkModal, setShowBookmarkModal] = useState(false);
  const [bookmarks, setBookmarks] = useState([]);
  const [bookmarkTitle, setBookmarkTitle] = useState('');
  const [showAddBookmarkDialog, setShowAddBookmarkDialog] = useState(false);
  const [isBookmarksLoading, setIsBookmarksLoading] = useState(false);
  const [isBookmarkSubmitting, setIsBookmarkSubmitting] = useState(false);
  const [deletingBookmarkId, setDeletingBookmarkId] = useState(null);

  // 增强笔触选择器状态
  const [showPenSelector, setShowPenSelector] = useState(false);
  const [selectedPenType, setSelectedPenType] = useState(PenTypes.FOUNTAIN);
  const [strokeOpacity, setStrokeOpacity] = useState(1);
  // 手写输入体验：防误触（掌托）与手指模式（本轮接通到原生）
  const [palmRejectionEnabled, setPalmRejectionEnabled] = useState(true);
  const [fingerMode, setFingerMode] = useState('gesture_only');

  // 增强形状选择器状态
  const [showEnhancedShapeSelector, setShowEnhancedShapeSelector] = useState(false);
  const [selectedEnhancedShape, setSelectedEnhancedShape] = useState(ShapeTypes.RECTANGLE);
  const [shapeFillEnabled, setShapeFillEnabled] = useState(false);

  // 标尺和网格状态
  const [showRuler, setShowRuler] = useState(false);
  const [showGrid, setShowGrid] = useState(false);

  // ============ 企业级功能状态 ============

  // 当前预设
  const [currentPreset, setCurrentPreset] = useState(null);
  const [showPresetSelector, setShowPresetSelector] = useState(false);

  // 最近使用的颜色
  const [recentColors, setRecentColors] = useState([]);

  // 前一个工具（用于快速切换回）
  const [previousTool, setPreviousTool] = useState(null);

  // 加载持久化配置
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const savedPrefs = await AsyncStorage.getItem(STORAGE_KEYS.TOOLBAR_PREFERENCES);
        if (savedPrefs) {
          const prefs = JSON.parse(savedPrefs);
          if (prefs.lastColor) {setActiveColor(prefs.lastColor);}
          if (prefs.lastStrokeWidth) {setActiveStrokeWidth(prefs.lastStrokeWidth);}
          if (prefs.lastTool) {setActiveTool(prefs.lastTool);}
          if (prefs.showRuler !== undefined) {setShowRuler(prefs.showRuler);}
          if (prefs.showGrid !== undefined) {setShowGrid(prefs.showGrid);}
        }

        const savedColors = await AsyncStorage.getItem(STORAGE_KEYS.RECENT_COLORS);
        if (savedColors) {
          setRecentColors(JSON.parse(savedColors));
        }

        const savedPreset = await AsyncStorage.getItem(STORAGE_KEYS.CURRENT_PRESET);
        if (savedPreset) {
          setCurrentPreset(savedPreset);
        }
      } catch (error) {
        console.log('加载工具栏配置失败:', error);
      }
    };

    loadPreferences();
  }, []);

  useEffect(() => {
    setActiveTool(initialTool);
  }, [initialTool]);

  useEffect(() => {
    setActiveColor(initialColor);
  }, [initialColor]);

  useEffect(() => {
    setActiveStrokeWidth(initialStrokeWidth);
  }, [initialStrokeWidth]);

  useEffect(() => {
    if (!currentToolConfig) {
      return;
    }

    setSelectedPenType(resolvePenTypeFromConfig(currentToolConfig));
    if (typeof currentToolConfig.opacity === 'number') {
      setStrokeOpacity(currentToolConfig.opacity);
    }
    if (typeof currentToolConfig.palmRejectionEnabled === 'boolean') {
      setPalmRejectionEnabled(currentToolConfig.palmRejectionEnabled);
    }
    if (typeof currentToolConfig.fingerMode === 'string' && currentToolConfig.fingerMode) {
      setFingerMode(currentToolConfig.fingerMode);
    }
  }, [currentToolConfig]);

  const buildCurrentToolPayload = useCallback((overrides = {}) => {
    const nextTool = overrides.type || overrides.tool || activeTool;
    const nextColor = overrides.color || activeColor;
    const nextStrokeWidth = overrides.size || overrides.strokeWidth || activeStrokeWidth;
    const nextOpacity = overrides.opacity ?? (
      nextTool === DRAWING_TOOLS.HIGHLIGHTER
        ? HIGHLIGHTER_CONFIG.opacity
        : strokeOpacity
    );
    const nextPen = overrides.penProfile
      ? (PEN_PROFILE_TO_TYPE[overrides.penProfile] || selectedPenType)
      : selectedPenType;

    return {
      tool: nextTool,
      type: nextTool,
      color: nextColor,
      size: nextStrokeWidth,
      strokeWidth: nextStrokeWidth,
      opacity: nextOpacity,
      penProfile: overrides.penProfile || nextPen?.id || currentToolConfig?.penProfile || 'fountain',
      pressureSensitivity: overrides.pressureSensitivity ?? (nextPen?.pressureSensitivity ?? currentToolConfig?.pressureSensitivity),
      velocitySensitivity: overrides.velocitySensitivity ?? (nextPen?.velocitySensitivity ?? currentToolConfig?.velocitySensitivity),
      taperIn: overrides.taperIn ?? (nextPen?.taper?.start ?? currentToolConfig?.taperIn),
      taperOut: overrides.taperOut ?? (nextPen?.taper?.end ?? currentToolConfig?.taperOut),
      smoothing: overrides.smoothing ?? (nextPen?.smoothing ?? currentToolConfig?.smoothing),
      shape: overrides.shape || (nextTool === DRAWING_TOOLS.SHAPE ? activeShape : 'freehand'),
      // 形状填充：随配置下发到原生（原生按它决定实心还是描边）。
      // 注意它必须同时出现在 isSameToolConfig 的比较键里，否则拨开关不会触发下发。
      fill: overrides.fill ?? shapeFillEnabled,
      recognitionEnabled: overrides.recognitionEnabled ?? currentToolConfig?.recognitionEnabled ?? true,
      recognitionDebounceMs: overrides.recognitionDebounceMs ?? currentToolConfig?.recognitionDebounceMs ?? 180,
      palmRejectionEnabled: overrides.palmRejectionEnabled ?? palmRejectionEnabled,
      fingerMode: overrides.fingerMode || fingerMode,
      // 标尺/网格此前只改本地 state、从不下发原生（RISK-NAV-002 同源死接线）。
      // 现在作为覆盖层配置随 toolConfig 一并送到原生画布。
      showRuler: overrides.showRuler ?? showRuler,
      showGrid: overrides.showGrid ?? showGrid,
      ...overrides,
    };
  }, [
    activeColor,
    activeShape,
    activeStrokeWidth,
    activeTool,
    currentToolConfig,
    fingerMode,
    palmRejectionEnabled,
    selectedPenType,
    // fill 进了载荷，就必须进依赖：否则用户拨动「填充」后 useCallback 仍返回旧闭包，
    // 下发出去的仍是旧的 fill 值（与「不下发」是同一类症状）。
    shapeFillEnabled,
    showGrid,
    showRuler,
    strokeOpacity,
  ]);

  const isSameToolConfig = useCallback((nextConfig, prevConfig) => {
    if (!prevConfig) {
      return false;
    }

    const keysToCompare = [
      'tool', 'type', 'color', 'size', 'strokeWidth', 'opacity',
      'penProfile', 'pressureSensitivity', 'velocitySensitivity',
      'taperIn', 'taperOut', 'smoothing', 'shape',
      // fill 必须参与比较：否则用户拨动「填充」开关时会被判定为「配置没变」而整条不下发，
      // 表现就是开关能拨、形状永远是空心（真机复现过这类「本地 state 变了但原生没收到」）。
      'fill',
      'recognitionEnabled', 'recognitionDebounceMs',
      'palmRejectionEnabled', 'fingerMode', 'showRuler', 'showGrid',
      'mode', 'blendMode',
      'fadeOutDuration', 'animationSteps',
    ];

    return keysToCompare.every((key) => nextConfig?.[key] === prevConfig?.[key]);
  }, []);

  const notifyToolPayloadChange = useCallback((overrides = {}) => {
    const payload = buildCurrentToolPayload(overrides);

    // 防止与父组件双向同步时出现无意义的循环更新
    if (isSameToolConfig(payload, currentToolConfig)) {
      return;
    }

    if (onToolConfigChange) {
      onToolConfigChange(payload);
      return;
    }

    onToolChange?.(payload);
  }, [buildCurrentToolPayload, currentToolConfig, isSameToolConfig, onToolChange, onToolConfigChange]);

  // 保存配置
  const savePreferences = useCallback(async () => {
    try {
      const prefs = {
        lastColor: activeColor,
        lastStrokeWidth: activeStrokeWidth,
        lastTool: activeTool,
        showRuler,
        showGrid,
      };
      await AsyncStorage.setItem(STORAGE_KEYS.TOOLBAR_PREFERENCES, JSON.stringify(prefs));
    } catch (error) {
      console.log('保存工具栏配置失败:', error);
    }
  }, [activeColor, activeStrokeWidth, activeTool, showRuler, showGrid]);

  // 工具/颜色变化时保存
  useEffect(() => {
    const timer = setTimeout(() => {
      savePreferences();
    }, 1000); // 防抖1秒
    return () => clearTimeout(timer);
  }, [savePreferences]);

  // 添加最近使用颜色
  const addRecentColor = useCallback(async (color) => {
    setRecentColors(prev => {
      const filtered = prev.filter(c => c !== color);
      const updated = [color, ...filtered].slice(0, 10); // 最多保存10个
      AsyncStorage.setItem(STORAGE_KEYS.RECENT_COLORS, JSON.stringify(updated));
      return updated;
    });
  }, []);

  // 应用预设
  const applyPreset = useCallback((presetId) => {
    const preset = TOOL_PRESETS[presetId];
    if (!preset) {return;}

    // 保存当前工具
    setPreviousTool(activeTool);

    // 处理动态主题颜色
    const effectiveColor = preset.color === 'THEME_TEXT' ? colors.text : preset.color;

    // 应用预设配置
    setActiveTool(preset.tool);
    setActiveColor(effectiveColor);
    setActiveStrokeWidth(preset.strokeWidth);
    setStrokeOpacity(preset.opacity);

    if (preset.showGrid !== undefined) {setShowGrid(preset.showGrid);}
    if (preset.showRuler !== undefined) {setShowRuler(preset.showRuler);}

    setCurrentPreset(presetId);

    // 保存当前预设
    AsyncStorage.setItem(STORAGE_KEYS.CURRENT_PRESET, presetId);

    triggerHapticFeedback('success');
  }, [activeTool, triggerHapticFeedback, colors.text]);

  // 切换到前一个工具
  const switchToPreviousTool = useCallback(() => {
    if (previousTool) {
      const temp = activeTool;
      setActiveTool(previousTool);
      setPreviousTool(temp);
      triggerHapticFeedback('light');
    }
  }, [previousTool, activeTool, triggerHapticFeedback]);

  const isImageActionLocked = isImagePicking || isAIProcessing || isClearing;
  const TOOL_BUTTON_ACTIVE_OPACITY = 0.72;

  // 处理图片上传
  const handleImageUpload = async () => {
    if (isImageActionLocked) {
      return;
    }

    setIsImagePicking(true);

    const options = {
      mediaType: 'photo',
      includeBase64: false,
      maxHeight: 2000,
      maxWidth: 2000,
      quality: 0.8,
    };

    try {
      const response = await launchImageLibrary(options);
      console.log('图片选择响应:', response);

      if (response?.didCancel) {
        return;
      }

      if (response?.errorCode || response?.errorMessage) {
        const errorText = response?.errorMessage || response?.errorCode || '未知错误';
        console.error('图片选择错误:', errorText);
        Alert.alert('错误', '选择图片失败: ' + errorText);
        return;
      }

      const asset = response?.assets?.[0];
      if (!asset?.uri) {
        Alert.alert('错误', '未获取到有效图片，请重试。');
        return;
      }

      await Promise.resolve(onImageUpload?.({
        uri: asset.uri,
        width: asset.width,
        height: asset.height,
        fileName: asset.fileName,
        fileSize: asset.fileSize,
        type: asset.type,
      }));

      triggerHapticFeedback('success');
    } catch (error) {
      console.error('图片上传处理失败:', error);
      Alert.alert('错误', error?.message || '处理图片时发生错误，请稍后重试。');
    } finally {
      setIsImagePicking(false);
    }
  };

  // 当工具改变时通知父组件
  useEffect(() => {
    if (activeTool === DRAWING_TOOLS.SHAPE) {
      notifyToolPayloadChange({ type: activeTool, shape: activeShape });
    } else if (activeTool === DRAWING_TOOLS.ERASER) {
      notifyToolPayloadChange({ type: activeTool, mode: 'erase' });
    } else if (activeTool === DRAWING_TOOLS.HIGHLIGHTER) {
      notifyToolPayloadChange({
        type: activeTool,
        opacity: HIGHLIGHTER_CONFIG.opacity,
        blendMode: HIGHLIGHTER_CONFIG.blendMode,
        penProfile: 'marker',
      });
    } else if (activeTool === DRAWING_TOOLS.LASER) {
      notifyToolPayloadChange({
        type: activeTool,
        fadeOutDuration: LASER_CONFIG.fadeOutDuration,
        animationSteps: LASER_CONFIG.animationSteps,
      });
    } else if (activeTool === DRAWING_TOOLS.LASSO) {
      notifyToolPayloadChange({
        type: activeTool,
        mode: 'select',
        allowMove: true,
        allowCopy: true,
        allowDelete: true,
      });
    } else {
      notifyToolPayloadChange();
    }
  }, [
    activeColor,
    activeShape,
    activeStrokeWidth,
    activeTool,
    notifyToolPayloadChange,
    fingerMode,
    palmRejectionEnabled,
    selectedPenType,
    strokeOpacity,
  ]);

  // 当颜色改变时通知父组件
  useEffect(() => {
    if (onColorChange && activeTool !== DRAWING_TOOLS.ERASER) {
      onColorChange(activeColor);
    }
  }, [activeColor, activeTool, onColorChange]);

  // 当笔触粗细改变时通知父组件
  useEffect(() => {
    if (onStrokeWidthChange) {
      onStrokeWidthChange(activeStrokeWidth);
    }
  }, [activeStrokeWidth, onStrokeWidthChange]);

  // 加载AI历史记录
  const loadAIHistory = async () => {
    if (isAIHistoryLoading) {
      return;
    }

    setIsAIHistoryLoading(true);
    try {
      const historyItems = await aiHistoryService.getHistory({ limit: 10 });
      setAIHistory(historyItems);
    } catch (error) {
      console.error('加载AI历史记录失败:', error);
      setAIHistory([]);
    } finally {
      setIsAIHistoryLoading(false);
    }
  };

  const isBookmarkActionLocked = isBookmarksLoading || isBookmarkSubmitting || !!deletingBookmarkId;

  // 加载书签列表
  const loadBookmarks = async () => {
    if (isBookmarksLoading) {
      return;
    }

    setIsBookmarksLoading(true);
    try {
      if (currentNoteId) {
        const noteBookmarks = await bookmarkService.getBookmarks(currentNoteId);
        setBookmarks(noteBookmarks);
      } else {
        const allBookmarks = await bookmarkService.getAllBookmarks();
        setBookmarks(allBookmarks);
      }
    } catch (error) {
      console.error('加载书签失败:', error);
      Alert.alert('加载失败', error?.message || '无法加载书签，请稍后重试。');
    } finally {
      setIsBookmarksLoading(false);
    }
  };

  const handleOpenBookmarkModal = async () => {
    if (isBookmarkActionLocked) {
      return;
    }

    setShowBookmarkModal(true);
    await loadBookmarks();
    triggerHapticFeedback('light');
  };

  const handleCloseBookmarkModal = () => {
    if (isBookmarkActionLocked) {
      return;
    }
    setShowBookmarkModal(false);
  };

  const handleOpenAddBookmarkDialog = () => {
    if (isBookmarkActionLocked) {
      return;
    }

    setShowAddBookmarkDialog(true);
    triggerHapticFeedback('light');
  };

  const handleCloseAddBookmarkDialog = () => {
    if (isBookmarkSubmitting) {
      return;
    }
    setShowAddBookmarkDialog(false);
    setBookmarkTitle('');
  };

  // 处理添加书签
  const handleAddBookmark = async () => {
    if (isBookmarkSubmitting) {
      return;
    }

    setIsBookmarkSubmitting(true);
    try {
      if (!currentNoteId) {
        Alert.alert('提示', '无法添加书签：未指定笔记');
        return;
      }

      const defaultTitle = bookmarkTitle.trim() || `书签 - 第${currentPage}页`;

      const newBookmark = await bookmarkService.addBookmark(
        currentNoteId,
        currentPage,
        null,
        defaultTitle,
        activeColor
      );

      onBookmarkAdd?.(newBookmark);

      await loadBookmarks();

      setBookmarkTitle('');
      setShowAddBookmarkDialog(false);

      Alert.alert('成功', '书签添加成功');
      triggerHapticFeedback('success');
    } catch (error) {
      console.error('添加书签失败:', error);
      Alert.alert('错误', error?.message || '添加书签失败，请稍后重试。');
    } finally {
      setIsBookmarkSubmitting(false);
    }
  };

  // 处理删除书签
  const handleDeleteBookmark = async (bookmarkId) => {
    if (deletingBookmarkId || isBookmarkSubmitting) {
      return;
    }

    Alert.alert(
      '确认删除',
      '确定要删除这个书签吗？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            setDeletingBookmarkId(bookmarkId);
            try {
              const success = await bookmarkService.deleteBookmark(bookmarkId);
              if (success) {
                await loadBookmarks();
                triggerHapticFeedback('success');
              } else {
                Alert.alert('错误', '删除书签失败');
              }
            } catch (error) {
              console.error('删除书签失败:', error);
              Alert.alert('错误', error?.message || '删除书签失败，请稍后重试。');
            } finally {
              setDeletingBookmarkId(null);
            }
          },
        },
      ]
    );
  };

  // 处理导航到书签
  const handleNavigateToBookmark = (bookmark) => {
    if (isBookmarkActionLocked || deletingBookmarkId) {
      return;
    }

    if (onBookmarkNavigate) {
      onBookmarkNavigate(bookmark);
      setShowBookmarkModal(false);
    }
  };

  const isTextAndShapeLocked = isAIProcessing || isClearing;

  // 处理文本工具选择
  const handleTextToolSelect = () => {
    if (isTextAndShapeLocked) {
      return;
    }

    setActiveTool(DRAWING_TOOLS.TEXT);
    setShowTextInputModal(true);
    triggerHapticFeedback('light');
  };

  const handleCloseTextInputModal = () => {
    if (isTextSubmitting) {
      return;
    }
    setShowTextInputModal(false);
  };

  const handleOpenTextColorPicker = () => {
    if (isTextSubmitting) {
      return;
    }
    setShowTextInputModal(false);
    setShowColorPicker(true);
    triggerHapticFeedback('light');
  };

  // 处理文本提交
  const handleTextSubmit = async () => {
    if (isTextSubmitting) {
      return;
    }

    if (!textInput.trim()) {
      Alert.alert('提示', '请输入文本内容');
      return;
    }

    setIsTextSubmitting(true);
    try {
      await Promise.resolve(onTextAdd?.({
        text: textInput,
        fontSize: textFontSize,
        color: activeColor,
        style: textStyle,
        alignment: textAlignment,
      }));

      // 重置文本输入
      setShowTextInputModal(false);
      setTextInput('');
      setTextFontSize(16);
      setTextStyle({ bold: false, italic: false, underline: false });
      setTextAlignment('left');

      triggerHapticFeedback('success');
    } catch (error) {
      console.error('添加文本失败:', error);
      Alert.alert('错误', error?.message || '添加文本失败，请稍后重试。');
    } finally {
      setIsTextSubmitting(false);
    }
  };

  // 处理绘图工具选择
  const handleToolSelect = useCallback((tool) => {
    setActiveTool(tool);
    triggerHapticFeedback('light');
    if (tool !== DRAWING_TOOLS.SHAPE) {
      setShowShapePicker(false);
    }
  }, [triggerHapticFeedback]);

  const isDrawingToolsLocked = isAIProcessing || isClearing;
  const isPageDocActionLocked = isClearing || isAIProcessing || isImagePicking || isAIHistoryLoading || isAIHistoryApplying;

  const handleDrawingToolPress = (tool) => {
    if (isDrawingToolsLocked) {
      return;
    }
    handleToolSelect(tool);
  };

  const handleUndoPress = () => {
    if (!canUndo) {
      return;
    }
    onUndo?.();
    triggerHapticFeedback('light');
  };

  const handleRedoPress = () => {
    if (!canRedo) {
      return;
    }
    onRedo?.();
    triggerHapticFeedback('light');
  };

  // 处理形状选择
  const handleShapeSelect = (shape) => {
    if (isTextAndShapeLocked) {
      return;
    }
    setActiveShape(shape);
    setShowShapePicker(false);
    triggerHapticFeedback('light');
  };

  const executeClearAction = async (clearType) => {
    try {
      await Promise.resolve(onClear?.(clearType));
      triggerHapticFeedback('success');
    } catch (error) {
      console.error('清除操作失败:', error);
      Alert.alert('错误', error?.message || '清除失败，请稍后重试。');
    } finally {
      setIsClearing(false);
    }
  };

  const showClearConfirm = (clearType, title, message) => {
    Alert.alert(
      title,
      message,
      [
        {
          text: '取消',
          style: 'cancel',
          onPress: () => setIsClearing(false),
        },
        {
          text: '确定',
          style: 'destructive',
          onPress: () => executeClearAction(clearType),
        },
      ],
      {
        cancelable: true,
        onDismiss: () => setIsClearing(false),
      }
    );
  };

  const handleClearPress = () => {
    if (isPageDocActionLocked) {
      return;
    }

    setIsClearing(true);
    Alert.alert(
      '清除',
      '选择清除范围：',
      [
        {
          text: '取消',
          style: 'cancel',
          onPress: () => setIsClearing(false),
        },
        {
          text: '选中内容',
          onPress: () => executeClearAction('selected'),
        },
        {
          text: '当前视图',
          onPress: () => executeClearAction('current_view'),
        },
        {
          text: '当前页面',
          onPress: () => showClearConfirm('current_page', '确认', '确定要清除当前页面吗？此操作无法撤销。'),
        },
        {
          text: '整个文档',
          style: 'destructive',
          onPress: () => showClearConfirm('entire_document', '确认', '确定要清除整个文档吗？此操作无法撤销。'),
        },
      ],
      {
        cancelable: true,
        onDismiss: () => setIsClearing(false),
      }
    );
  };

  // 处理流式AI工具选择
  const handleStreamingAIToolSelect = async (tool) => {
    setSelectedAITool(tool);
    setShowAIToolModal(false);
    let inputText = selectedText && String(selectedText).trim() ? String(selectedText).trim() : '';

    try {
      // 如果没有选中文本，则尝试OCR或手写识别
      if (!inputText) {
        if (typeof onRequestRegionOCR === 'function') {
          const regionText = await onRequestRegionOCR();
          if (regionText && String(regionText).trim()) {inputText = String(regionText).trim();}
        }
        if (!inputText && typeof onRequestStrokeRecognition === 'function') {
          const strokeText = await onRequestStrokeRecognition();
          if (strokeText && String(strokeText).trim()) {inputText = String(strokeText).trim();}
        }
      }

      if (!inputText) {
        Alert.alert('提示', '请先选中文本，或通过拖拽/手写输入内容。');
        return;
      }

      setIsAIProcessing(true);
      setIsStreamingModalVisible(true);
      setStreamingText('');

      const streamController = noteAIService.processTextStream(inputText, tool.id, {});

      streamController
        .onMessage((chunk, fullText) => {
          setStreamingText(fullText);
        })
        .onComplete(async (fullText) => {
          setIsAIProcessing(false);
          await aiHistoryService.addHistory({
            tool: tool.id,
            input: inputText,
            output: fullText,
            timestamp: new Date(),
          });
          loadAIHistory();
          // The modal will be closed by the user
        })
        .onError((error) => {
          setIsAIProcessing(false);
          setIsStreamingModalVisible(false);
          Alert.alert('AI处理失败', error.message || '发生未知错误');
        })
        .start();

    } catch (error) {
      setIsAIProcessing(false);
      Alert.alert('错误', error.message || '处理AI请求时出错');
    }
  };

  handleStreamingAIToolSelectRef.current = handleStreamingAIToolSelect;

  // 处理AI工具选择 (现在调用流式处理)
  const handleAIToolSelect = useCallback((tool) => {
    if (isAIProcessing) {
      return;
    }
    handleStreamingAIToolSelectRef.current?.(tool);
  }, [isAIProcessing]);

  const handleOpenAIHistory = () => {
    if (isAIProcessing || isAIHistoryLoading || isAIHistoryApplying) {
      return;
    }
    setShowAIHistoryModal(true);
    if (aiHistory.length === 0) {
      loadAIHistory();
    }
  };

  const handleCloseAIHistory = () => {
    if (isAIHistoryLoading || isAIHistoryApplying) {
      return;
    }
    setShowAIHistoryModal(false);
  };

  const handleCloseStreamingAIResultModal = () => {
    if (isAIProcessing) {
      return;
    }
    setIsStreamingModalVisible(false);
  };

  const handleUseAIHistoryResult = async (item) => {
    if (isAIHistoryApplying) {
      return;
    }

    setIsAIHistoryApplying(true);
    try {
      await Promise.resolve(onAIProcessResult?.(item.output, item.tool));
      setShowAIHistoryModal(false);
      triggerHapticFeedback('success');
    } catch (error) {
      console.error('应用AI历史结果失败:', error);
      Alert.alert('错误', error?.message || '应用历史结果失败，请稍后重试。');
    } finally {
      setIsAIHistoryApplying(false);
    }
  };

  // 无

  // 使用AI处理文本
  const processWithAI = async (toolId, text) => {
    try {
      let result;

      // 根据工具类型调用不同的API
      switch (toolId) {
        case 'translate':
          result = await noteAIService.translateText(text);
          break;
        case 'code_recognition':
          result = await noteAIService.recognizeCode(text);
          break;
        case 'math_formula':
          result = await noteAIService.recognizeMathFormula(text);
          break;
        case 'summarize':
          result = await noteAIService.summarizeText(text);
          break;
        case 'extract_keywords':
          result = await noteAIService.extractKeywords(text);
          break;
        case 'explain':
          result = await noteAIService.explainText(text);
          break;
        case 'rewrite':
          result = await noteAIService.rewriteText(text);
          break;
        case 'grammar':
        case 'simplify':
        default:
          // 对于其他工具，使用通用处理API
          result = await noteAIService.processText(text, toolId);
          break;
      }

      return result;
    } catch (error) {
      console.error('AI处理请求失败:', error);
      throw error;
    }
  };

  // 2D颜色选择器 - 色板交互处理
  // 渲染颜色选择器 - 使用企业级组件
  const renderColorPicker = () => (
    <ColorPicker
      visible={showColorPicker}
      onClose={() => setShowColorPicker(false)}
      onColorChange={(color) => {
        setActiveColor(color);
        addRecentColor(color);
        onColorChange?.(color);
      }}
      initialColor={activeColor}
      showEyedropper={true}
    />
  );


  // 渲染笔触粗细弹出式面板 - 改进版设计
  const renderStrokeWidthPopover = () => {
    if (!showStrokeWidthPopover) {return null;}

    // popover 定位只算一次：锚点取「工具栏正下方居中」（宽度 0、y 为工具栏底边），
    // 由布局纯函数做左右/上下夹取，保证任何屏幕宽度下都完整可见。
    const strokeWidthPopoverPosition = resolvePopoverPosition(
      { x: screenWidth / 2, y: toolbarConfig.height, width: 0, height: 0 },
      { width: 280, height: 190 },
      { width: screenWidth, height: screenHeight },
      { margin: 8 },
    );

    return (
      <Modal
        visible={showStrokeWidthPopover}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          if (isDrawingToolsLocked) {
            return;
          }
          setShowStrokeWidthPopover(false);
        }}
      >
        <Pressable
          style={styles.popoverOverlay}
          onPress={() => {
            if (isDrawingToolsLocked) {
              return;
            }
            setShowStrokeWidthPopover(false);
          }}
        >
          {/* 弹出面板 - 完全阻止事件穿透 */}
          <Pressable
            style={[
              styles.strokeWidthPopover,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                // 动态定位：交给布局纯函数做左右/上下夹取。
                // 原先写死 top=height+70 / left='50%' / marginLeft=-140：
                // 小屏与分屏下 popover 会有一半漂到屏幕外，用户看不到滑块。
                ...strokeWidthPopoverPosition,
                marginLeft: 0,
              },
            ]}
            onPress={(e) => {
              e.stopPropagation();
            }}
          >
            {/* 标题行：左侧标题，右侧数值 */}
            <View style={styles.strokeWidthHeaderRow}>
              <Text style={[styles.strokeWidthTitle, { color: colors.text }]}>笔刷粗细</Text>
              <Text style={[styles.strokeWidthValue, { color: colors.textSecondary }]}>
                {(activeStrokeWidth / 10).toFixed(1)}mm
              </Text>
            </View>

            {/* 滑块区域 - 匹配图片设计 */}
            <View style={styles.strokeWidthSliderSection}>
              {/* 渐变厚度轨道 - 从细到粗的渐变 */}
              <View style={styles.strokeWidthGradientTrack}>
                <Svg width="100%" height="30" viewBox="0 0 280 30">
                  <Defs>
                    <LinearGradient id="strokeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <Stop offset="0%" stopColor={colors.text} stopOpacity="0.3" />
                      <Stop offset="100%" stopColor={colors.text} stopOpacity="0.8" />
                    </LinearGradient>
                  </Defs>
                  {/* 从细到粗的锥形形状 */}
                  <Path
                    d="M 10 15 L 270 5 L 270 25 Z"
                    fill="url(#strokeGradient)"
                  />
                </Svg>
                <TouchableOpacity
                  style={styles.strokeWidthTrackClickable}
                  onPress={(event) => {
                    const { locationX } = event.nativeEvent;
                    const trackWidth = 280;
                    const ratio = Math.max(0, Math.min(1, locationX / trackWidth));
                    const width = ratio * (STROKE_WIDTH_RANGE.max - STROKE_WIDTH_RANGE.min) + STROKE_WIDTH_RANGE.min;
                    setActiveStrokeWidth(Math.round(width));
                    if (onStrokeWidthChange) {
                      onStrokeWidthChange(Math.round(width));
                    }
                    triggerHapticFeedback('light');
                  }}
                  activeOpacity={1}
                />
                {/* 当前位置指示器小球 */}
                <View
                  style={[
                    styles.strokeWidthIndicator,
                    {
                      // 轨道从x=10到x=270，可用宽度260px，小球宽度16px需要居中偏移-8px
                      left: 10 + ((activeStrokeWidth - STROKE_WIDTH_RANGE.min) / (STROKE_WIDTH_RANGE.max - STROKE_WIDTH_RANGE.min)) * 260 - 8,
                      backgroundColor: colors.primary,
                      borderColor: '#fff',
                    },
                  ]}
                />
              </View>

              {/* 滑块 */}
              <Slider
                style={styles.strokeWidthSliderCompact}
                minimumValue={STROKE_WIDTH_RANGE.min}
                maximumValue={STROKE_WIDTH_RANGE.max}
                step={STROKE_WIDTH_RANGE.step}
                value={activeStrokeWidth}
                onValueChange={(value) => {
                  setActiveStrokeWidth(value);
                  if (onStrokeWidthChange) {
                    onStrokeWidthChange(value);
                  }
                  triggerHapticFeedback('light');
                }}
                onSlidingComplete={() => {
                  // 移除自动关闭，只通过点击外部关闭
                }}
                minimumTrackTintColor="transparent"
                maximumTrackTintColor="transparent"
                thumbTintColor="#FFFFFF"
                thumbStyle={{
                  width: 20,
                  height: 20,
                  borderRadius: 10,
                  borderWidth: 2,
                  borderColor: colors.text,
                }}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    );
  };

  // 渲染预设选择器
  const renderPresetSelector = () => {
    if (!showPresetSelector) {return null;}

    return (
      <Modal
        visible={showPresetSelector}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          if (isPageDocActionLocked) {
            return;
          }
          setShowPresetSelector(false);
        }}
      >
        <Pressable
          style={styles.popoverOverlay}
          onPress={() => {
            if (isPageDocActionLocked) {
              return;
            }
            setShowPresetSelector(false);
          }}
        >
          <View style={[styles.presetSelectorPanel, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.presetSelectorTitle, { color: colors.text }]}>场景预设</Text>
            <View style={styles.presetGrid}>
              {Object.values(TOOL_PRESETS).map((preset) => (
                <TouchableOpacity
                  key={preset.id}
                  style={[
                    styles.presetItem,
                    currentPreset === preset.id && { backgroundColor: colors.primary + '20', borderColor: colors.primary },
                    isPageDocActionLocked && styles.disabledToolButton,
                  ]}
                  onPress={() => {
                    if (isPageDocActionLocked) {
                      return;
                    }
                    applyPreset(preset.id);
                    setShowPresetSelector(false);
                    triggerHapticFeedback('light');
                  }}
                  disabled={isPageDocActionLocked}
                  accessibilityRole="button"
                  accessibilityLabel={`应用${preset.name}预设`}
                  accessibilityHint="一键应用该场景工具和样式配置"
                  accessibilityState={{ disabled: isPageDocActionLocked, busy: isPageDocActionLocked, selected: currentPreset === preset.id }}
                >
                  <MaterialIcon
                    name={preset.icon}
                    size={24}
                    color={preset.color === 'THEME_TEXT' ? colors.text : preset.color}
                  />
                  <Text style={[
                    styles.presetName,
                    { color: currentPreset === preset.id ? colors.primary : colors.text },
                  ]}>
                    {preset.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Pressable>
      </Modal>
    );
  };

  // 键盘快捷键监听
  useEffect(() => {
    // 监听键盘事件 (Web/Desktop)
    if (Platform.OS === 'web' || Platform.OS === 'windows' || Platform.OS === 'macos') {
      const handleKeyDown = (e) => {
        const key = e.key.toUpperCase();
        // 工具快捷键
        if (KEYBOARD_SHORTCUTS[key]) {
          handleToolSelect(KEYBOARD_SHORTCUTS[key]);
        }
        // 功能快捷键
        if (e.ctrlKey || e.metaKey) {
          if (key === 'Z') {
            if (e.shiftKey) {
              if (canRedo) {
                onRedo?.();
              }
            } else if (canUndo) {
              onUndo?.();
            }
          } else if (key === 'Y' && canRedo) {
            onRedo?.();
          }
        }
      };

      if (Platform.OS === 'web') {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
      }
    }
  }, [handleToolSelect, onUndo, onRedo, canUndo, canRedo]);

  // ==== WS-B:BEGIN（布局优化：断点、popover 夹取、按压反馈包装、分组 testID） ====
  //
  // 说明（为什么这样写）：
  // 1. 这里遵循「先接入纯逻辑、不动机主 return 的 JSX」的纪律。
  //    本区只做定义 + 覆盖后的 toolbarConfig 计算，主 JSX 由 Lead 在集成步骤消费；
  //    这样既避免与其它 workstream 抢同一段 JSX 造成冲突，也让改动可被单独回退。
  // 2. resolveToolbarLayout 是纯函数（见 ./AllInOneToolbarLayout），
  //    非法屏幕宽度会回落 compact 且不抛错，所以旋转/分屏的中间帧也安全。
  // 3. getToolbarConfig() 保留为回落路径：ScreenLayout 未提供宽度时用它原有的结果。

  // 说明（集成修正）：wsbBaseToolbarConfig / wsbLayout / toolbarConfig 的计算已移到
  // 下方 toolbarConfig 定义处（那里才是主 return 与 createStyles 的消费点）。
  // 本区只保留「按压反馈包装」与「分组 testID」两个局部定义。
  //
  // 可复用按压反馈包装：统一按下时的背景/透明度变化，并补齐 44dp 触达区域。
  // 为什么抽成组件：工具栏里有几十处 Pressable，逐处写 hitSlop 易漏且不一致。
  const ToolbarPressable = ({
    children,
    style,
    onPress,
    onLongPress,
    disabled = false,
    accessibilityLabel,
    testID,
    hitSlop,
    pressedOpacity = 0.6,
    pressedBackgroundColor,
    ...rest
  }) => {
    // 这里不用 useMemo：resolvedHitSlop 只是一个字面量对象的拼装，
    // 而且 wsbLayout 属于外层作用域，把它写进依赖数组反而会被 lint 判为无效依赖。
    let resolvedHitSlop = hitSlop;
    if (typeof hitSlop === 'number') {
      resolvedHitSlop = { top: hitSlop, bottom: hitSlop, left: hitSlop, right: hitSlop };
    } else if (!hitSlop || typeof hitSlop !== 'object') {
      // 未显式传入时，采用当前断点算出的触达扩展量，保证 >= 44dp 的可点区域。
      resolvedHitSlop = {
        top: wsbLayout.hitSlop,
        bottom: wsbLayout.hitSlop,
        left: wsbLayout.hitSlop,
        right: wsbLayout.hitSlop,
      };
    }

    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled }}
        testID={testID}
        disabled={disabled}
        hitSlop={resolvedHitSlop}
        onPress={onPress}
        onLongPress={onLongPress}
        style={({ pressed }) => [
          style,
          pressed && !disabled && { opacity: pressedOpacity },
          pressed && !disabled && pressedBackgroundColor
            ? { backgroundColor: pressedBackgroundColor }
            : null,
        ]}
        {...rest}
      >
        {children}
      </Pressable>
    );
  };

  ToolbarPressable.displayName = 'ToolbarPressable';

  // 分组 testID 生成器：让 UI 测试能稳定定位「第 N 组」而不依赖样式。
  const getToolbarGroupTestID = (groupKey) => `all-in-one-toolbar-group-${String(groupKey || 'unknown')}`;

  // 接线现状（核实于当前文件，避免注释与代码互相打架）：
  //  - getToolbarGroupTestID：已在主 return 的 9 个 toolGroup 上真实消费（含容器 testID）。
  //  - 响应式 toolbarConfig：已由 resolveToolbarLayout 产出并被 createStyles / 主 return 消费。
  //  - ToolbarPressable：目前**尚未接线**。主 return 里改的是标尺/网格/防误触/手指书写
  //    四处原生 Pressable（各自内联 hitSlop + pressed 透明度），并未改用本包装。
  //    保留定义是为了 Lead 后续统一替换时可直接复用（见完成说明的接线位置）。
  //    这是「已交付但未挂载」的状态，之前那句「都已在主 return 里真实消费」与事实不符。

  // ==== WS-B:END ====

  // 渲染形状选择器
  const renderShapePicker = () => (
    <View
      style={[styles.shapePickerContainer, {
        backgroundColor: colors.card,
        borderColor: colors.border,
        display: showShapePicker ? 'flex' : 'none',
      }, isTextAndShapeLocked && { opacity: 0.6 }]}
      pointerEvents={isTextAndShapeLocked ? 'none' : 'auto'}
      accessibilityState={{ disabled: isTextAndShapeLocked, busy: isTextAndShapeLocked }}
    >
      <TouchableOpacity
        style={[
          styles.shapeItem,
          activeShape === SHAPES.LINE && styles.activeShapeItem,
        ]}
        onPress={() => handleShapeSelect(SHAPES.LINE)}
        disabled={isTextAndShapeLocked}
        accessibilityRole="button"
        accessibilityLabel="选择线条形状"
        accessibilityState={{ selected: activeShape === SHAPES.LINE, disabled: isTextAndShapeLocked, busy: isTextAndShapeLocked }}
      >
        <View style={[styles.shapeIcon, { width: 24, height: 2, backgroundColor: activeShape === SHAPES.LINE ? colors.primary : colors.text }]} />
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.shapeItem,
          activeShape === SHAPES.RECTANGLE && styles.activeShapeItem,
        ]}
        onPress={() => handleShapeSelect(SHAPES.RECTANGLE)}
        disabled={isTextAndShapeLocked}
        accessibilityRole="button"
        accessibilityLabel="选择矩形形状"
        accessibilityState={{ selected: activeShape === SHAPES.RECTANGLE, disabled: isTextAndShapeLocked, busy: isTextAndShapeLocked }}
      >
        <View style={[styles.shapeIcon, { width: 24, height: 24, borderWidth: 2, borderColor: activeShape === SHAPES.RECTANGLE ? colors.primary : colors.text }]} />
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.shapeItem,
          activeShape === SHAPES.CIRCLE && styles.activeShapeItem,
        ]}
        onPress={() => handleShapeSelect(SHAPES.CIRCLE)}
        disabled={isTextAndShapeLocked}
        accessibilityRole="button"
        accessibilityLabel="选择圆形形状"
        accessibilityState={{ selected: activeShape === SHAPES.CIRCLE, disabled: isTextAndShapeLocked, busy: isTextAndShapeLocked }}
      >
        <View style={[styles.shapeIcon, { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: activeShape === SHAPES.CIRCLE ? colors.primary : colors.text }]} />
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.shapeItem,
          activeShape === SHAPES.TRIANGLE && styles.activeShapeItem,
        ]}
        onPress={() => handleShapeSelect(SHAPES.TRIANGLE)}
        disabled={isTextAndShapeLocked}
        accessibilityRole="button"
        accessibilityLabel="选择三角形形状"
        accessibilityState={{ selected: activeShape === SHAPES.TRIANGLE, disabled: isTextAndShapeLocked, busy: isTextAndShapeLocked }}
      >
        <Svg width="24" height="24" viewBox="0 0 24 24">
          <Path
            d="M12 2 L22 20 L2 20 Z"
            fill="none"
            stroke={activeShape === SHAPES.TRIANGLE ? colors.primary : colors.text}
            strokeWidth="2"
          />
        </Svg>
      </TouchableOpacity>

      {/* 菱形 */}
      <TouchableOpacity
        style={[
          styles.shapeItem,
          activeShape === SHAPES.DIAMOND && styles.activeShapeItem,
        ]}
        onPress={() => handleShapeSelect(SHAPES.DIAMOND)}
        disabled={isTextAndShapeLocked}
        accessibilityRole="button"
        accessibilityLabel="选择菱形形状"
        accessibilityState={{ selected: activeShape === SHAPES.DIAMOND, disabled: isTextAndShapeLocked, busy: isTextAndShapeLocked }}
      >
        <Svg width="24" height="24" viewBox="0 0 24 24">
          <Path
            d="M12 2 L22 12 L12 22 L2 12 Z"
            fill="none"
            stroke={activeShape === SHAPES.DIAMOND ? colors.primary : colors.text}
            strokeWidth="2"
          />
        </Svg>
      </TouchableOpacity>

      {/* 平行四边形 */}
      <TouchableOpacity
        style={[
          styles.shapeItem,
          activeShape === SHAPES.PARALLELOGRAM && styles.activeShapeItem,
        ]}
        onPress={() => handleShapeSelect(SHAPES.PARALLELOGRAM)}
        disabled={isTextAndShapeLocked}
        accessibilityRole="button"
        accessibilityLabel="选择平行四边形形状"
        accessibilityState={{ selected: activeShape === SHAPES.PARALLELOGRAM, disabled: isTextAndShapeLocked, busy: isTextAndShapeLocked }}
      >
        <Svg width="24" height="24" viewBox="0 0 24 24">
          <Path
            d="M6 6 L18 6 L22 18 L10 18 Z"
            fill="none"
            stroke={activeShape === SHAPES.PARALLELOGRAM ? colors.primary : colors.text}
            strokeWidth="2"
          />
        </Svg>
      </TouchableOpacity>

      {/* 椭圆 */}
      <TouchableOpacity
        style={[
          styles.shapeItem,
          activeShape === SHAPES.ELLIPSE && styles.activeShapeItem,
        ]}
        onPress={() => handleShapeSelect(SHAPES.ELLIPSE)}
        disabled={isTextAndShapeLocked}
        accessibilityRole="button"
        accessibilityLabel="选择椭圆形状"
        accessibilityState={{ selected: activeShape === SHAPES.ELLIPSE, disabled: isTextAndShapeLocked, busy: isTextAndShapeLocked }}
      >
        <Svg width="24" height="24" viewBox="0 0 24 24">
          <Path
            d="M12 4 C18 4 22 7 22 12 C22 17 18 20 12 20 C6 20 2 17 2 12 C2 7 6 4 12 4 Z"
            fill="none"
            stroke={activeShape === SHAPES.ELLIPSE ? colors.primary : colors.text}
            strokeWidth="2"
          />
        </Svg>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.shapeItem,
          activeShape === SHAPES.ARROW && styles.activeShapeItem,
        ]}
        onPress={() => handleShapeSelect(SHAPES.ARROW)}
        disabled={isTextAndShapeLocked}
        accessibilityRole="button"
        accessibilityLabel="选择箭头形状"
        accessibilityState={{ selected: activeShape === SHAPES.ARROW, disabled: isTextAndShapeLocked, busy: isTextAndShapeLocked }}
      >
        <Svg width="24" height="24" viewBox="0 0 24 24">
          <Path
            d="M2 12 L20 12 M15 7 L20 12 L15 17"
            fill="none"
            stroke={activeShape === SHAPES.ARROW ? colors.primary : colors.text}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.shapeItem,
          activeShape === SHAPES.STAR && styles.activeShapeItem,
        ]}
        onPress={() => handleShapeSelect(SHAPES.STAR)}
        disabled={isTextAndShapeLocked}
        accessibilityRole="button"
        accessibilityLabel="选择星形形状"
        accessibilityState={{ selected: activeShape === SHAPES.STAR, disabled: isTextAndShapeLocked, busy: isTextAndShapeLocked }}
      >
        <View style={[styles.shapeIcon, { width: 24, height: 24, position: 'relative' }]}>
          <View style={{ position: 'absolute', top: 0, left: 10, width: 4, height: 12, backgroundColor: activeShape === SHAPES.STAR ? colors.primary : colors.text, transform: [{ rotate: '35deg' }] }} />
          <View style={{ position: 'absolute', top: 0, left: 10, width: 4, height: 12, backgroundColor: activeShape === SHAPES.STAR ? colors.primary : colors.text, transform: [{ rotate: '-35deg' }] }} />
          <View style={{ position: 'absolute', top: 5, left: 0, width: 4, height: 12, backgroundColor: activeShape === SHAPES.STAR ? colors.primary : colors.text, transform: [{ rotate: '90deg' }] }} />
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.shapeItem,
          activeShape === SHAPES.POLYGON && styles.activeShapeItem,
        ]}
        onPress={() => handleShapeSelect(SHAPES.POLYGON)}
        disabled={isTextAndShapeLocked}
        accessibilityRole="button"
        accessibilityLabel="选择多边形形状"
        accessibilityState={{ selected: activeShape === SHAPES.POLYGON, disabled: isTextAndShapeLocked, busy: isTextAndShapeLocked }}
      >
        <View style={[styles.shapeIcon, { width: 24, height: 24, position: 'relative' }]}>
          <View style={{ position: 'absolute', top: 0, left: 10, width: 4, height: 12, backgroundColor: activeShape === SHAPES.POLYGON ? colors.primary : colors.text }} />
          <View style={{ position: 'absolute', top: 4, left: 2, width: 4, height: 16, backgroundColor: activeShape === SHAPES.POLYGON ? colors.primary : colors.text, transform: [{ rotate: '60deg' }] }} />
          <View style={{ position: 'absolute', top: 4, left: 18, width: 4, height: 16, backgroundColor: activeShape === SHAPES.POLYGON ? colors.primary : colors.text, transform: [{ rotate: '-60deg' }] }} />
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.shapeItem,
          activeShape === SHAPES.CURVE && styles.activeShapeItem,
        ]}
        onPress={() => handleShapeSelect(SHAPES.CURVE)}
        disabled={isTextAndShapeLocked}
        accessibilityRole="button"
        accessibilityLabel="选择曲线形状"
        accessibilityState={{ selected: activeShape === SHAPES.CURVE, disabled: isTextAndShapeLocked, busy: isTextAndShapeLocked }}
      >
        <View style={[styles.shapeIcon, { width: 24, height: 24 }]}>
          <Svg width="24" height="24" viewBox="0 0 24 24">
            <Path d="M4,12 Q10,4 20,12" stroke={activeShape === SHAPES.CURVE ? colors.primary : colors.text} strokeWidth="2" fill="none" />
          </Svg>
        </View>
      </TouchableOpacity>

      {/* 弧形 */}
      <TouchableOpacity
        style={[
          styles.shapeItem,
          activeShape === SHAPES.ARC && styles.activeShapeItem,
        ]}
        onPress={() => handleShapeSelect(SHAPES.ARC)}
        disabled={isTextAndShapeLocked}
        accessibilityRole="button"
        accessibilityLabel="选择弧线形状"
        accessibilityState={{ selected: activeShape === SHAPES.ARC, disabled: isTextAndShapeLocked, busy: isTextAndShapeLocked }}
      >
        <Svg width="24" height="24" viewBox="0 0 24 24">
          <Path
            d="M4 12 A8 8 0 0 1 20 12"
            fill="none"
            stroke={activeShape === SHAPES.ARC ? colors.primary : colors.text}
            strokeWidth="2"
          />
        </Svg>
      </TouchableOpacity>
    </View>
  );

  // 渲染AI工具选择器 - 使用React.memo优化
  const renderAIToolModal = useCallback(() => (
    <Modal
      visible={showAIToolModal}
      transparent={true}
      animationType="slide"
      onRequestClose={() => {
        if (isAIProcessing) {
          return;
        }
        setShowAIToolModal(false);
      }}
    >
      <TouchableOpacity
        style={[styles.modalContainer, { backgroundColor: 'rgba(0,0,0,0.5)' }]}
        activeOpacity={1}
        onPress={() => {
          if (isAIProcessing) {
            return;
          }
          setShowAIToolModal(false);
        }}
      >
        <TouchableOpacity
          style={[styles.modalContent, { backgroundColor: colors.card }]}
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.modalHeader}>
            <Text variant="heading" level="h6">AI工具</Text>
            <TouchableOpacity
              onPress={() => {
                if (isAIProcessing) {
                  return;
                }
                setShowAIToolModal(false);
              }}
              disabled={isAIProcessing}
              accessibilityRole="button"
              accessibilityLabel="关闭AI工具弹窗"
              accessibilityHint="关闭AI工具选择面板"
              accessibilityState={{ disabled: isAIProcessing, busy: isAIProcessing }}
            >
              <Icon name="close" size={24} color={isAIProcessing ? colors.textDisabled : colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.toolGrid}>
            {AI_TOOLS.map(tool => (
              <TouchableOpacity
                key={tool.id}
                style={[
                  styles.gridToolButton,
                  { backgroundColor: colors.background, borderColor: colors.border },
                  isAIProcessing && styles.disabledToolButton,
                ]}
                onPress={() => handleAIToolSelect(tool)}
                disabled={isAIProcessing}
                accessibilityRole="button"
                accessibilityLabel={`${tool.label}工具`}
                accessibilityHint={tool.description}
                accessibilityState={{ disabled: isAIProcessing, busy: isAIProcessing }}
              >
                <MaterialIcon name={tool.icon} size={24} color={isAIProcessing ? colors.textDisabled : colors.primary} />
                <Text
                  variant="body"
                  size="medium"
                  color="text"
                  style={styles.gridToolText}
                >
                  {tool.label}
                </Text>
                <Text
                  variant="caption"
                  color="textSecondary"
                  style={styles.gridToolDescription}
                >
                  {tool.description}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  ), [colors, handleAIToolSelect, isAIProcessing, showAIToolModal, styles]);

  // 渲染AI历史记录模态框
  const renderAIHistoryModal = () => (
    <Modal
      visible={showAIHistoryModal}
      transparent={true}
      animationType="slide"
      onRequestClose={handleCloseAIHistory}
    >
      <TouchableOpacity
        style={[styles.modalContainer, { backgroundColor: 'rgba(0,0,0,0.5)' }]}
        activeOpacity={1}
        onPress={handleCloseAIHistory}
      >
        <TouchableOpacity
          style={[styles.modalContent, { backgroundColor: colors.card }]}
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.modalHeader}>
            <Text variant="heading" level="h6">AI历史记录</Text>
            <TouchableOpacity
              onPress={handleCloseAIHistory}
              disabled={isAIHistoryLoading || isAIHistoryApplying}
              accessibilityRole="button"
              accessibilityLabel="关闭AI历史弹窗"
              accessibilityHint="关闭AI历史记录面板"
              accessibilityState={{
                disabled: isAIHistoryLoading || isAIHistoryApplying,
                busy: isAIHistoryLoading || isAIHistoryApplying,
              }}
            >
              <Icon
                name="close"
                size={24}
                color={(isAIHistoryLoading || isAIHistoryApplying) ? colors.textDisabled : colors.text}
              />
            </TouchableOpacity>
          </View>

          {isAIHistoryLoading ? (
            <View style={styles.emptyHistory}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text variant="body" color="textSecondary" style={styles.emptyHistoryText}>
                正在加载历史记录...
              </Text>
            </View>
          ) : aiHistory.length === 0 ? (
            <View style={styles.emptyHistory}>
              <Icon name="time-outline" size={48} color={colors.textSecondary} />
              <Text variant="body" color="textSecondary" style={styles.emptyHistoryText}>
                暂无历史记录
              </Text>
            </View>
          ) : (
            <FlatList
              data={aiHistory}
              keyExtractor={(item, index) => `history-${index}`}
              removeClippedSubviews={Platform.OS === 'android'}
              initialNumToRender={8}
              maxToRenderPerBatch={8}
              windowSize={7}
              renderItem={({ item }) => (
                <View style={[styles.historyItem, { borderBottomColor: colors.border }]}>
                  <View style={styles.historyItemHeader}>
                    <Text variant="subtitle" color="text">
                      {AI_TOOLS.find(t => t.id === item.tool)?.label || item.tool}
                    </Text>
                    <Text variant="caption" color="textSecondary">
                      {new Date(item.timestamp).toLocaleString()}
                    </Text>
                  </View>
                  <Text variant="body" color="textSecondary" numberOfLines={2}>
                    输入: {item.input}
                  </Text>
                  <Text variant="body" color="primary" numberOfLines={2}>
                    输出: {item.output}
                  </Text>
                  <TouchableOpacity
                    style={[styles.historyItemButton, isAIHistoryApplying && styles.disabledToolButton]}
                    onPress={() => handleUseAIHistoryResult(item)}
                    disabled={isAIHistoryApplying}
                    accessibilityRole="button"
                    accessibilityLabel="使用AI历史结果"
                    accessibilityHint="将该历史结果应用到当前页面"
                    accessibilityState={{ disabled: isAIHistoryApplying, busy: isAIHistoryApplying }}
                  >
                    {isAIHistoryApplying ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <Text variant="button" color="primary">使用此结果</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            />
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );

  // 渲染AI处理加载指示器
  const renderAIProcessingIndicator = () => (
    isAIProcessing && (
      <View style={[styles.processingOverlay, { backgroundColor: 'rgba(0,0,0,0.3)' }]}>
        <View style={[styles.processingContainer, { backgroundColor: colors.card }]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.processingText, { color: colors.text }]}>
            正在处理...
          </Text>
        </View>
      </View>
    )
  );

  // 渲染书签列表模态框
  const renderBookmarkModal = () => (
    <Modal
      visible={showBookmarkModal}
      transparent={true}
      animationType="slide"
      onRequestClose={handleCloseBookmarkModal}
    >
      <TouchableOpacity
        style={[styles.modalContainer, { backgroundColor: 'rgba(0,0,0,0.5)' }]}
        activeOpacity={1}
        onPress={handleCloseBookmarkModal}
      >
        <TouchableOpacity
          style={[styles.modalContent, { backgroundColor: colors.card }]}
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.modalHeader}>
            <Text variant="heading" level="h6">书签列表</Text>
            <TouchableOpacity
              onPress={handleCloseBookmarkModal}
              disabled={isBookmarkActionLocked}
              accessibilityRole="button"
              accessibilityLabel="关闭书签列表"
              accessibilityHint="关闭书签管理面板"
              accessibilityState={{ disabled: isBookmarkActionLocked, busy: isBookmarkActionLocked }}
            >
              <Icon name="close" size={24} color={isBookmarkActionLocked ? colors.textDisabled : colors.text} />
            </TouchableOpacity>
          </View>

          {isBookmarksLoading ? (
            <View style={styles.emptyHistory}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text variant="body" color="textSecondary" style={styles.emptyHistoryText}>
                正在加载书签...
              </Text>
            </View>
          ) : bookmarks.length === 0 ? (
            <View style={styles.emptyHistory}>
              <Icon name="bookmark-outline" size={48} color={colors.textSecondary} />
              <Text variant="body" color="textSecondary" style={styles.emptyHistoryText}>
                暂无书签
              </Text>
            </View>
          ) : (
            <FlatList
              data={bookmarks}
              keyExtractor={(item) => item.id}
              removeClippedSubviews={Platform.OS === 'android'}
              initialNumToRender={8}
              maxToRenderPerBatch={8}
              windowSize={7}
              renderItem={({ item }) => (
                <View style={[styles.bookmarkItem, { borderBottomColor: colors.border }]}>
                  <TouchableOpacity
                    style={styles.bookmarkContent}
                    onPress={() => handleNavigateToBookmark(item)}
                    disabled={isBookmarkActionLocked || deletingBookmarkId === item.id}
                    accessibilityRole="button"
                    accessibilityLabel={`跳转到书签 ${item.title}`}
                    accessibilityHint={`前往第 ${item.pageNumber} 页`}
                    accessibilityState={{
                      disabled: isBookmarkActionLocked || deletingBookmarkId === item.id,
                      busy: deletingBookmarkId === item.id,
                    }}
                  >
                    <View style={[styles.bookmarkColorIndicator, { backgroundColor: item.color }]} />
                    <View style={styles.bookmarkInfo}>
                      <Text variant="subtitle" color="text">{item.title}</Text>
                      <Text variant="caption" color="textSecondary">
                        第 {item.pageNumber} 页 • {new Date(item.timestamp).toLocaleString()}
                      </Text>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.bookmarkDeleteButton, deletingBookmarkId === item.id && styles.disabledToolButton]}
                    onPress={() => handleDeleteBookmark(item.id)}
                    disabled={isBookmarkActionLocked || deletingBookmarkId === item.id}
                    accessibilityRole="button"
                    accessibilityLabel={`删除书签 ${item.title}`}
                    accessibilityHint="删除当前书签"
                    accessibilityState={{
                      disabled: isBookmarkActionLocked || deletingBookmarkId === item.id,
                      busy: deletingBookmarkId === item.id,
                    }}
                  >
                    {deletingBookmarkId === item.id ? (
                      <ActivityIndicator size="small" color={colors.error} />
                    ) : (
                      <Icon name="trash-outline" size={20} color={colors.error} />
                    )}
                  </TouchableOpacity>
                </View>
              )}
            />
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );

  // 渲染添加书签对话框
  const renderAddBookmarkDialog = () => (
    <Modal
      visible={showAddBookmarkDialog}
      transparent={true}
      animationType="fade"
      onRequestClose={handleCloseAddBookmarkDialog}
    >
      <Pressable
        style={styles.modalOverlay}
        onPress={handleCloseAddBookmarkDialog}
      >
        <View
          style={[styles.dialogContainer, { backgroundColor: colors.card }]}
          onStartShouldSetResponder={() => true}
          onResponderRelease={(e) => e.stopPropagation()}
        >
          <Text style={[styles.dialogTitle, { color: colors.text }]}>添加书签</Text>

          <TextInput
            style={[styles.dialogInput, { color: colors.text, borderColor: colors.border }]}
            placeholder={`书签 - 第${currentPage}页`}
            placeholderTextColor={colors.textSecondary}
            value={bookmarkTitle}
            onChangeText={setBookmarkTitle}
            editable={!isBookmarkSubmitting}
            autoFocus
          />

          <View style={styles.dialogButtons}>
            <TouchableOpacity
              style={[styles.dialogButton, { backgroundColor: colors.background }, isBookmarkSubmitting && styles.disabledToolButton]}
              onPress={handleCloseAddBookmarkDialog}
              disabled={isBookmarkSubmitting}
              accessibilityRole="button"
              accessibilityLabel="取消添加书签"
              accessibilityHint="关闭添加书签弹窗"
              accessibilityState={{ disabled: isBookmarkSubmitting, busy: isBookmarkSubmitting }}
            >
              <Text style={{ color: colors.text }}>取消</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.dialogButton, { backgroundColor: colors.primary }, isBookmarkSubmitting && styles.disabledToolButton]}
              onPress={handleAddBookmark}
              disabled={isBookmarkSubmitting}
              accessibilityRole="button"
              accessibilityLabel="确认添加书签"
              accessibilityHint="保存当前页面书签"
              accessibilityState={{ disabled: isBookmarkSubmitting, busy: isBookmarkSubmitting }}
            >
              {isBookmarkSubmitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={{ color: '#fff' }}>确定</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Pressable>
    </Modal>
  );

  // 渲染流式AI结果模态框
  const renderStreamingAIResultModal = () => (
    <Modal
      visible={isStreamingModalVisible}
      transparent={true}
      animationType="fade"
      onRequestClose={handleCloseStreamingAIResultModal}
    >
      <View style={styles.modalContainer}>
        <View style={[styles.modalContent, { maxHeight: '70%' }]}>
          <View style={styles.modalHeader}>
            <Text variant="heading" level="h6">{selectedAITool?.label || 'AI处理中'}</Text>
            <TouchableOpacity
              onPress={handleCloseStreamingAIResultModal}
              disabled={isAIProcessing}
              accessibilityRole="button"
              accessibilityLabel="关闭AI结果弹窗"
              accessibilityHint="关闭AI流式结果面板"
              accessibilityState={{ disabled: isAIProcessing, busy: isAIProcessing }}
            >
              <Icon name="close" size={24} color={isAIProcessing ? colors.textDisabled : colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView style={{ flex: 1, paddingVertical: 10 }}>
            <Text style={{ color: colors.text }}>{streamingText}</Text>
            {isAIProcessing && <ActivityIndicator style={{ marginTop: 10 }} color={colors.primary} />}
          </ScrollView>
          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[styles.modalButton, isAIProcessing && styles.disabledToolButton]}
              onPress={() => {
                Clipboard.setString(streamingText);
                Alert.alert('已复制', '结果已复制到剪贴板');
              }}
              disabled={isAIProcessing}
              accessibilityRole="button"
              accessibilityLabel="复制AI结果"
              accessibilityHint="复制当前AI处理结果到剪贴板"
              accessibilityState={{ disabled: isAIProcessing, busy: isAIProcessing }}
            >
              <Text style={{ color: isAIProcessing ? colors.textDisabled : colors.primary }}>复制</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: colors.primary }, isAIProcessing && styles.disabledToolButton]}
              onPress={handleCloseStreamingAIResultModal}
              disabled={isAIProcessing}
              accessibilityRole="button"
              accessibilityLabel="关闭AI结果弹窗"
              accessibilityHint="关闭当前AI结果视图"
              accessibilityState={{ disabled: isAIProcessing, busy: isAIProcessing }}
            >
              <Text style={{ color: '#FFF' }}>关闭</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );


  // 渲染文本输入模态框
  const renderTextInputModal = () => (
    <Modal
      visible={showTextInputModal}
      transparent={true}
      animationType="slide"
      onRequestClose={handleCloseTextInputModal}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <TouchableOpacity
          style={[styles.modalContainer, { backgroundColor: 'rgba(0,0,0,0.5)' }]}
          activeOpacity={1}
          onPress={handleCloseTextInputModal}
        >
          <TouchableOpacity
            style={[styles.textModalContent, { backgroundColor: colors.card }]}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
          <View style={styles.modalHeader}>
            <Text variant="heading" level="h6">添加文本</Text>
            <TouchableOpacity
              onPress={handleCloseTextInputModal}
              disabled={isTextSubmitting}
              accessibilityRole="button"
              accessibilityLabel="关闭文本输入"
              accessibilityHint="关闭文本输入弹窗"
              accessibilityState={{ disabled: isTextSubmitting, busy: isTextSubmitting }}
            >
              <Icon name="close" size={24} color={isTextSubmitting ? colors.textDisabled : colors.text} />
            </TouchableOpacity>
          </View>

          {/* 文本输入框 */}
          <TextInput
            style={[styles.textInput, {
              color: colors.text,
              borderColor: colors.border,
              fontWeight: textStyle.bold ? 'bold' : 'normal',
              fontStyle: textStyle.italic ? 'italic' : 'normal',
              textDecorationLine: textStyle.underline ? 'underline' : 'none',
              textAlign: textAlignment,
            }]}
            placeholder="输入文本内容..."
            placeholderTextColor={colors.textSecondary}
            value={textInput}
            onChangeText={setTextInput}
            editable={!isTextSubmitting}
            multiline
            numberOfLines={4}
            autoFocus
          />

          {/* 字体大小选择 */}
          <View style={styles.textToolSection}>
            <Text style={[styles.textToolLabel, { color: colors.text }]}>字体大小: {textFontSize}px</Text>
            <Slider
              style={styles.textSlider}
              minimumValue={12}
              maximumValue={48}
              step={2}
              value={textFontSize}
              onValueChange={setTextFontSize}
              minimumTrackTintColor={colors.primary}
              maximumTrackTintColor={colors.border}
              thumbTintColor={colors.primary}
              disabled={isTextSubmitting}
            />
          </View>

          {/* 字体样式选择 */}
          <View style={styles.textToolSection}>
            <Text style={[styles.textToolLabel, { color: colors.text }]}>字体样式</Text>
            <View style={styles.textStyleButtons}>
              <TouchableOpacity
                style={[
                  styles.textStyleButton,
                  { borderColor: colors.border },
                  textStyle.bold && { backgroundColor: colors.primary + '20' },
                  isTextSubmitting && styles.disabledToolButton,
                ]}
                onPress={() => setTextStyle({ ...textStyle, bold: !textStyle.bold })}
                disabled={isTextSubmitting}
                accessibilityRole="button"
                accessibilityLabel="切换粗体"
                accessibilityHint="将文本样式切换为粗体"
                accessibilityState={{ disabled: isTextSubmitting, busy: isTextSubmitting, selected: textStyle.bold }}
              >
                <Text style={[styles.textStyleButtonText, { color: colors.text, fontWeight: 'bold' }]}>B</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.textStyleButton,
                  { borderColor: colors.border },
                  textStyle.italic && { backgroundColor: colors.primary + '20' },
                  isTextSubmitting && styles.disabledToolButton,
                ]}
                onPress={() => setTextStyle({ ...textStyle, italic: !textStyle.italic })}
                disabled={isTextSubmitting}
                accessibilityRole="button"
                accessibilityLabel="切换斜体"
                accessibilityHint="将文本样式切换为斜体"
                accessibilityState={{ disabled: isTextSubmitting, busy: isTextSubmitting, selected: textStyle.italic }}
              >
                <Text style={[styles.textStyleButtonText, { color: colors.text, fontStyle: 'italic' }]}>I</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.textStyleButton,
                  { borderColor: colors.border },
                  textStyle.underline && { backgroundColor: colors.primary + '20' },
                  isTextSubmitting && styles.disabledToolButton,
                ]}
                onPress={() => setTextStyle({ ...textStyle, underline: !textStyle.underline })}
                disabled={isTextSubmitting}
                accessibilityRole="button"
                accessibilityLabel="切换下划线"
                accessibilityHint="将文本样式切换为下划线"
                accessibilityState={{ disabled: isTextSubmitting, busy: isTextSubmitting, selected: textStyle.underline }}
              >
                <Text style={[styles.textStyleButtonText, { color: colors.text, textDecorationLine: 'underline' }]}>U</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* 文本对齐选择 */}
          <View style={styles.textToolSection}>
            <Text style={[styles.textToolLabel, { color: colors.text }]}>对齐方式</Text>
            <View style={styles.textStyleButtons}>
              <TouchableOpacity
                style={[
                  styles.textStyleButton,
                  { borderColor: colors.border },
                  textAlignment === 'left' && { backgroundColor: colors.primary + '20' },
                  isTextSubmitting && styles.disabledToolButton,
                ]}
                onPress={() => setTextAlignment('left')}
                disabled={isTextSubmitting}
                accessibilityRole="button"
                accessibilityLabel="左对齐"
                accessibilityHint="将文本对齐方式设置为左对齐"
                accessibilityState={{ disabled: isTextSubmitting, busy: isTextSubmitting, selected: textAlignment === 'left' }}
              >
                <Text style={[styles.textAlignmentButtonText, { color: colors.text }]}>左</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.textStyleButton,
                  { borderColor: colors.border },
                  textAlignment === 'center' && { backgroundColor: colors.primary + '20' },
                  isTextSubmitting && styles.disabledToolButton,
                ]}
                onPress={() => setTextAlignment('center')}
                disabled={isTextSubmitting}
                accessibilityRole="button"
                accessibilityLabel="居中对齐"
                accessibilityHint="将文本对齐方式设置为居中"
                accessibilityState={{ disabled: isTextSubmitting, busy: isTextSubmitting, selected: textAlignment === 'center' }}
              >
                <Text style={[styles.textAlignmentButtonText, { color: colors.text }]}>中</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.textStyleButton,
                  { borderColor: colors.border },
                  textAlignment === 'right' && { backgroundColor: colors.primary + '20' },
                  isTextSubmitting && styles.disabledToolButton,
                ]}
                onPress={() => setTextAlignment('right')}
                disabled={isTextSubmitting}
                accessibilityRole="button"
                accessibilityLabel="右对齐"
                accessibilityHint="将文本对齐方式设置为右对齐"
                accessibilityState={{ disabled: isTextSubmitting, busy: isTextSubmitting, selected: textAlignment === 'right' }}
              >
                <Text style={[styles.textAlignmentButtonText, { color: colors.text }]}>右</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* 颜色选择 */}
          <View style={styles.textToolSection}>
            <Text style={[styles.textToolLabel, { color: colors.text }]}>文本颜色</Text>
            <TouchableOpacity
              style={[styles.colorSelectButton, { borderColor: colors.border }, isTextSubmitting && styles.disabledToolButton]}
              onPress={handleOpenTextColorPicker}
              disabled={isTextSubmitting}
              accessibilityRole="button"
              accessibilityLabel="选择文本颜色"
              accessibilityHint="打开颜色选择器以设置文本颜色"
              accessibilityState={{ disabled: isTextSubmitting, busy: isTextSubmitting }}
            >
              <View style={[styles.colorPreviewSmall, { backgroundColor: activeColor }]} />
              <Text style={{ color: colors.text, marginLeft: 8 }}>{activeColor}</Text>
            </TouchableOpacity>
          </View>

          {/* 确认按钮 */}
          <TouchableOpacity
            style={[
              styles.textSubmitButton,
              { backgroundColor: colors.primary },
              (isTextSubmitting || !textInput.trim()) && styles.disabledToolButton,
            ]}
            onPress={handleTextSubmit}
            disabled={isTextSubmitting || !textInput.trim()}
            accessibilityRole="button"
            accessibilityLabel="提交文本"
            accessibilityHint="将输入的文本添加到页面"
            accessibilityState={{ disabled: isTextSubmitting || !textInput.trim(), busy: isTextSubmitting }}
          >
            {isTextSubmitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.textSubmitButtonText}>添加文本</Text>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  );

  // 主工具栏渲染
  const toolConfigForMode = TOOL_CONFIG[mode] || TOOL_CONFIG['file-viewer'];

  return (
    <View>
      {renderStreamingAIResultModal()}
      {renderPresetSelector()}

      {/* 最近颜色条：把 ColorPicker 内部那份「最近使用」搬到工具栏上直接可见 */}
      {renderRecentColors()}

      {/* 套索选中笔迹的操作条：没有选中内容时不渲染 */}
      {renderSelectedStrokesBar(selectedStrokeIds, onSelectedStrokesAction)}

      {/* 主工具栏。
          换行时放开容器高度上限：单行模式的 maxHeight 是定值（buttonSize 级别），
          一旦换成多行就会被裁掉第二行起的内容（真机实测：iPad 上换行后只见一行）。
          判据必须与 shouldWrapToolbar 一致，不能用 tier（iPad 是 regular 但确实要换行）。 */}
      <View
        style={[styles.container, { backgroundColor: colors.card }]}
        testID="toolbar.allInOne"
      >

        {/* 绘图工具。
            两种排布策略，按可用宽度切换：
            ① 平板/宽屏（shouldWrapToolbar）：**多行换行**，9 组工具一次全部可见。
               这是本轮最关键的一处布局修正——真机实测发现单行横滑时，
               颜色/粗细/手感这些常用工具永远在屏幕外，用户以为功能不存在；
               平板本来就有纵向空间，换行比横滑更符合「按得到」的目标。
            ② 窄屏：保持单行横滑，并显示右侧溢出提示。
            注意横滑时内容容器必须左对齐（不能用 justifyContent:'center' + flexGrow:1），
            否则内容被居中、左端被推出视口且滚动不到。 */}
        {/* 关键：横向 ScrollView 的 style 里带着 flexDirection:'row'（styles.toolbarSection），
            它会与内容容器的 flexWrap:'wrap' 互相干扰 —— 结果是「wrap 判据为 true、界面却仍是一行
            且超出部分被裁掉」（真机实测）。
            因此换行分支必须**同时**关掉 horizontal 并去掉 row 方向，
            只让内容容器负责 row + wrap。 */}
        <ScrollView
          horizontal={!shouldWrapToolbar}
          showsHorizontalScrollIndicator={false}
          style={shouldWrapToolbar ? styles.toolbarSectionWrapped : styles.toolbarSection}
          contentContainerStyle={[
            styles.toolbarContentContainer,
            shouldWrapToolbar
              ? styles.toolbarContentContainerWrapped
              : (toolbarNeedsScroll
                ? styles.toolbarContentContainerScrollable
                : styles.toolbarContentContainerCentered),
          ]}
        >
          {/* 书签按钮 */}
          {toolConfigForMode.bookmarks && (
            <>
              <View style={styles.toolGroup} testID={getToolbarGroupTestID('bookmarks')}>
                <ToolbarPressable
                  style={[styles.toolButton, isBookmarkActionLocked && styles.disabledToolButton]}
                  onPress={handleOpenAddBookmarkDialog}
                  disabled={isBookmarkActionLocked}
                  accessibilityLabel="添加书签"
                  accessibilityHint="在当前页面添加书签"
                  accessibilityRole="button"
                  accessibilityState={{ disabled: isBookmarkActionLocked, busy: isBookmarkActionLocked }}
                >
                  <AddBookmarkIcon
                    color={isBookmarkActionLocked ? colors.textDisabled : colors.text}
                    size={toolbarConfig.iconSize}
                  />
                </ToolbarPressable>
                <ToolbarPressable
                  style={[styles.toolButton, isBookmarkActionLocked && styles.disabledToolButton]}
                  onPress={handleOpenBookmarkModal}
                  disabled={isBookmarkActionLocked}
                  accessibilityLabel="书签列表"
                  accessibilityHint="查看和管理书签"
                  accessibilityRole="button"
                  accessibilityState={{ disabled: isBookmarkActionLocked, busy: isBookmarkActionLocked }}
                >
                  <BookmarkIcon
                    color={isBookmarkActionLocked ? colors.textDisabled : colors.text}
                    size={toolbarConfig.iconSize}
                  />
                </ToolbarPressable>
              </View>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
            </>
          )}

          {toolConfigForMode.editing && (
            <>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />

              {/* 预设工具组 - 企业级功能 */}
              <View style={styles.toolGroup} testID={getToolbarGroupTestID('preset')}>
                <ToolbarPressable
                  style={[
                    styles.toolButton,
                    showPresetSelector && { backgroundColor: colors.primary + '20' },
                    isPageDocActionLocked && styles.disabledToolButton,
                  ]}
                  onPress={() => {
                    if (isPageDocActionLocked) {
                      return;
                    }
                    setShowPresetSelector(true);
                    triggerHapticFeedback('light');
                  }}
                  disabled={isPageDocActionLocked}
                  accessibilityLabel="场景预设"
                  accessibilityHint="快速切换工具和样式预设"
                  accessibilityRole="button"
                  accessibilityState={{ disabled: isPageDocActionLocked, busy: isPageDocActionLocked, selected: showPresetSelector }}
                >
                  <MaterialIcon
                    name={currentPreset ? TOOL_PRESETS[currentPreset].icon : 'view-grid-plus'}
                    color={currentPreset ? colors.primary : colors.text}
                    size={toolbarConfig.iconSize}
                  />
                </ToolbarPressable>
              </View>

              <View style={[styles.divider, { backgroundColor: colors.border }]} />

              {/* 编辑工具组 */}
              <View style={styles.toolGroup} testID={getToolbarGroupTestID('history')}>
                <ToolbarPressable
                  style={[
                    styles.toolButton,
                    !canUndo && styles.disabledToolButton,
                  ]}
                  onPress={handleUndoPress}
                  disabled={!canUndo}
                  accessibilityLabel="撤销"
                  accessibilityHint="撤销上一步操作"
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !canUndo, busy: false }}
                >
                  <UndoIcon
                    color={!canUndo ? colors.textDisabled : colors.text}
                    size={toolbarConfig.iconSize}
                  />
                </ToolbarPressable>

                <ToolbarPressable
                  style={[
                    styles.toolButton,
                    !canRedo && styles.disabledToolButton,
                  ]}
                  onPress={handleRedoPress}
                  disabled={!canRedo}
                  accessibilityLabel="重做"
                  accessibilityHint="重做撤销的操作"
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !canRedo, busy: false }}
                >
                  <RedoIcon
                    color={!canRedo ? colors.textDisabled : colors.text}
                    size={toolbarConfig.iconSize}
                  />
                </ToolbarPressable>

                <ToolbarPressable
                  style={[
                    styles.toolButton,
                    isPageDocActionLocked && styles.disabledToolButton,
                  ]}
                  onPress={handleClearPress}
                  disabled={isPageDocActionLocked}
                  accessibilityLabel="清除"
                  accessibilityHint="清除画布内容"
                  accessibilityRole="button"
                  accessibilityState={{ disabled: isPageDocActionLocked, busy: isPageDocActionLocked }}
                >
                  <ClearIcon
                    color={isPageDocActionLocked ? colors.textDisabled : colors.text}
                    size={toolbarConfig.iconSize}
                  />
                </ToolbarPressable>
              </View>
            </>
          )}

          {toolConfigForMode.drawing && (
            <>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />

              {/* 绘图工具组 */}
              <View style={styles.toolGroup} testID={getToolbarGroupTestID('drawing')}>
                <ToolbarPressable
                  style={[
                    styles.toolButton,
                    isDrawingToolsLocked && styles.disabledToolButton,
                    activeTool === DRAWING_TOOLS.PEN && styles.activeToolButton,
                    activeTool === DRAWING_TOOLS.PEN && { backgroundColor: colors.primary + '30' },
                  ]}
                  onPress={() => handleDrawingToolPress(DRAWING_TOOLS.PEN)}
                  disabled={isDrawingToolsLocked}
                  accessibilityLabel="画笔工具"
                  accessibilityHint="选择画笔进行绘图"
                  accessibilityRole="button"
                  accessibilityState={{ selected: activeTool === DRAWING_TOOLS.PEN, disabled: isDrawingToolsLocked, busy: false }}
                >
                  <PenIcon
                    color={isDrawingToolsLocked ? colors.textDisabled : (activeTool === DRAWING_TOOLS.PEN ? colors.primary : colors.text)}
                    size={toolbarConfig.iconSize}
                  />
                </ToolbarPressable>

                <ToolbarPressable
                  style={[
                    styles.toolButton,
                    isDrawingToolsLocked && styles.disabledToolButton,
                    activeTool === DRAWING_TOOLS.PENCIL && styles.activeToolButton,
                    activeTool === DRAWING_TOOLS.PENCIL && { backgroundColor: colors.primary + '30' },
                  ]}
                  onPress={() => handleDrawingToolPress(DRAWING_TOOLS.PENCIL)}
                  disabled={isDrawingToolsLocked}
                  accessibilityLabel="铅笔工具"
                  accessibilityHint="选择铅笔进行绘图"
                  accessibilityRole="button"
                  accessibilityState={{ selected: activeTool === DRAWING_TOOLS.PENCIL, disabled: isDrawingToolsLocked, busy: false }}
                >
                  <PencilIcon
                    color={isDrawingToolsLocked ? colors.textDisabled : (activeTool === DRAWING_TOOLS.PENCIL ? colors.primary : colors.text)}
                    size={toolbarConfig.iconSize}
                  />
                </ToolbarPressable>

                <ToolbarPressable
                  style={[
                    styles.toolButton,
                    isDrawingToolsLocked && styles.disabledToolButton,
                    activeTool === DRAWING_TOOLS.BRUSH && styles.activeToolButton,
                    activeTool === DRAWING_TOOLS.BRUSH && { backgroundColor: colors.primary + '30' },
                  ]}
                  onPress={() => handleDrawingToolPress(DRAWING_TOOLS.BRUSH)}
                  disabled={isDrawingToolsLocked}
                  accessibilityLabel="刷子工具"
                  accessibilityHint="选择刷子进行绘图"
                  accessibilityRole="button"
                  accessibilityState={{ selected: activeTool === DRAWING_TOOLS.BRUSH, disabled: isDrawingToolsLocked, busy: false }}
                >
                  <BrushIcon
                    color={isDrawingToolsLocked ? colors.textDisabled : (activeTool === DRAWING_TOOLS.BRUSH ? colors.primary : colors.text)}
                    size={toolbarConfig.iconSize}
                  />
                </ToolbarPressable>

                <ToolbarPressable
                  style={[
                    styles.toolButton,
                    isDrawingToolsLocked && styles.disabledToolButton,
                    activeTool === DRAWING_TOOLS.HIGHLIGHTER && styles.activeToolButton,
                    activeTool === DRAWING_TOOLS.HIGHLIGHTER && { backgroundColor: colors.primary + '30' },
                  ]}
                  onPress={() => handleDrawingToolPress(DRAWING_TOOLS.HIGHLIGHTER)}
                  disabled={isDrawingToolsLocked}
                  accessibilityLabel="荧光笔工具"
                  accessibilityHint="选择荧光笔进行高亮标记"
                  accessibilityRole="button"
                  accessibilityState={{ selected: activeTool === DRAWING_TOOLS.HIGHLIGHTER, disabled: isDrawingToolsLocked, busy: false }}
                >
                  <HighlighterIcon
                    color={isDrawingToolsLocked ? colors.textDisabled : (activeTool === DRAWING_TOOLS.HIGHLIGHTER ? colors.primary : colors.text)}
                    size={toolbarConfig.iconSize}
                  />
                </ToolbarPressable>

                <ToolbarPressable
                  style={[
                    styles.toolButton,
                    isDrawingToolsLocked && styles.disabledToolButton,
                    activeTool === DRAWING_TOOLS.LASER && styles.activeToolButton,
                    activeTool === DRAWING_TOOLS.LASER && { backgroundColor: colors.primary + '30' },
                  ]}
                  onPress={() => handleDrawingToolPress(DRAWING_TOOLS.LASER)}
                  disabled={isDrawingToolsLocked}
                  accessibilityLabel="激光笔工具"
                  accessibilityHint="选择激光笔进行临时标记"
                  accessibilityRole="button"
                  accessibilityState={{ selected: activeTool === DRAWING_TOOLS.LASER, disabled: isDrawingToolsLocked, busy: false }}
                >
                  <LaserIcon
                    color={isDrawingToolsLocked ? colors.textDisabled : (activeTool === DRAWING_TOOLS.LASER ? colors.primary : colors.text)}
                    size={toolbarConfig.iconSize}
                  />
                </ToolbarPressable>

                {/* 手掌/平移：单指拖动画面而不留墨迹。
                    与画笔同组是因为它属于「用哪只手写」的选择，而不是编辑动作；
                    它下发的是 pan 工具，交给 bridge 推导出 gesture 交互模式。 */}
                <ToolbarPressable
                  style={[
                    styles.toolButton,
                    isDrawingToolsLocked && styles.disabledToolButton,
                    activeTool === PAN_TOOL_ID && styles.activeToolButton,
                    activeTool === PAN_TOOL_ID && { backgroundColor: colors.primary + '30' },
                  ]}
                  onPress={handlePanToolPress}
                  disabled={isDrawingToolsLocked}
                  accessibilityLabel="手掌/平移工具"
                  accessibilityHint="单指拖动画面，不留下墨迹"
                  accessibilityRole="button"
                  accessibilityState={{ selected: activeTool === PAN_TOOL_ID, disabled: isDrawingToolsLocked, busy: false }}
                >
                  <MaterialIcon
                    name="pan"
                    color={isDrawingToolsLocked ? colors.textDisabled : (activeTool === PAN_TOOL_ID ? colors.primary : colors.text)}
                    size={toolbarConfig.iconSize}
                  />
                </ToolbarPressable>
              </View>

              <View style={[styles.divider, { backgroundColor: colors.border }]} />

              {/* 橡皮擦和套索工具组 */}
              <View style={styles.toolGroup} testID={getToolbarGroupTestID('erase')}>
                <ToolbarPressable
                  style={[
                    styles.toolButton,
                    isDrawingToolsLocked && styles.disabledToolButton,
                    activeTool === DRAWING_TOOLS.ERASER && styles.activeToolButton,
                    activeTool === DRAWING_TOOLS.ERASER && { backgroundColor: colors.primary + '30' },
                  ]}
                  onPress={() => handleDrawingToolPress(DRAWING_TOOLS.ERASER)}
                  disabled={isDrawingToolsLocked}
                  accessibilityLabel="橡皮擦工具"
                  accessibilityHint="选择橡皮擦删除内容"
                  accessibilityRole="button"
                  accessibilityState={{ selected: activeTool === DRAWING_TOOLS.ERASER, disabled: isDrawingToolsLocked, busy: false }}
                >
                  <EraserIcon
                    color={isDrawingToolsLocked ? colors.textDisabled : (activeTool === DRAWING_TOOLS.ERASER ? colors.primary : colors.text)}
                    size={toolbarConfig.iconSize}
                  />
                </ToolbarPressable>

                <ToolbarPressable
                  style={[
                    styles.toolButton,
                    isDrawingToolsLocked && styles.disabledToolButton,
                    activeTool === DRAWING_TOOLS.LASSO && styles.activeToolButton,
                    activeTool === DRAWING_TOOLS.LASSO && { backgroundColor: colors.primary + '30' },
                  ]}
                  onPress={() => handleDrawingToolPress(DRAWING_TOOLS.LASSO)}
                  disabled={isDrawingToolsLocked}
                  accessibilityLabel="套索工具"
                  accessibilityHint="自由绘制选区，选择和移动内容"
                  accessibilityRole="button"
                  accessibilityState={{ selected: activeTool === DRAWING_TOOLS.LASSO, disabled: isDrawingToolsLocked, busy: false }}
                >
                  <LassoIcon
                    color={isDrawingToolsLocked ? colors.textDisabled : (activeTool === DRAWING_TOOLS.LASSO ? colors.primary : colors.text)}
                    size={toolbarConfig.iconSize}
                  />
                </ToolbarPressable>
              </View>
            </>
          )}

          {toolConfigForMode.styling && (
            <>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />

              {/* 样式工具组 */}
              <View style={styles.toolGroup} testID={getToolbarGroupTestID('style')}>
                <ToolbarPressable
                  style={[styles.toolButton, isDrawingToolsLocked && styles.disabledToolButton]}
                  onPress={() => {
                    if (isDrawingToolsLocked) {
                      return;
                    }
                    setShowColorPicker(true);
                    triggerHapticFeedback('light');
                  }}
                  disabled={isDrawingToolsLocked}
                  accessibilityLabel="颜色选择"
                  accessibilityHint="打开颜色选择器"
                  accessibilityRole="button"
                  accessibilityState={{ disabled: isDrawingToolsLocked, busy: isDrawingToolsLocked }}
                >
                  <View
                    style={[
                      styles.colorIndicator,
                      { backgroundColor: activeColor, width: 24, height: 24, borderRadius: 12 },
                    ]}
                  />
                </ToolbarPressable>

                <ToolbarPressable
                  style={[styles.toolButton, isDrawingToolsLocked && styles.disabledToolButton]}
                  onPress={() => {
                    if (isDrawingToolsLocked) {
                      return;
                    }
                    setShowStrokeWidthPopover(!showStrokeWidthPopover);
                    triggerHapticFeedback('light');
                  }}
                  disabled={isDrawingToolsLocked}
                  accessibilityLabel="笔触粗细"
                  accessibilityHint="调整画笔粗细"
                  accessibilityRole="button"
                  accessibilityState={{ disabled: isDrawingToolsLocked, busy: isDrawingToolsLocked }}
                >
                  <StrokeWidthIcon
                    color={colors.text}
                    size={toolbarConfig.iconSize}
                    strokeWidth={Math.min(activeStrokeWidth / 5, 4)}
                  />
                </ToolbarPressable>

                {/* 增强笔触选择器入口 */}
                <ToolbarPressable
                  style={[styles.toolButton, isDrawingToolsLocked && styles.disabledToolButton]}
                  onPress={() => {
                    if (isDrawingToolsLocked) {
                      return;
                    }
                    setShowPenSelector(true);
                    triggerHapticFeedback('light');
                  }}
                  disabled={isDrawingToolsLocked}
                  accessibilityLabel="笔触类型"
                  accessibilityHint="选择不同笔触类型"
                  accessibilityRole="button"
                  accessibilityState={{ disabled: isDrawingToolsLocked, busy: isDrawingToolsLocked }}
                >
                  <MaterialIcon
                    name="fountain-pen-tip"
                    color={colors.text}
                    size={toolbarConfig.iconSize}
                  />
                </ToolbarPressable>

                {/* 手感：压感/速度/平滑/起收笔/不透明度/粗细 + 实时笔迹预览。
                    这些字段原本只能靠切换笔型间接触发，用户无法微调；
                    面板自行持有开关状态，工具栏顶层因此不必新增 state。 */}
                <ToolbarPressable
                  style={[
                    styles.toolButton,
                    isDrawingToolsLocked && styles.disabledToolButton,
                  ]}
                  onPress={openHandFeelPanel}
                  disabled={isDrawingToolsLocked}
                  accessibilityLabel="手感"
                  accessibilityHint="调节压感、平滑、起收笔等手感参数"
                  accessibilityRole="button"
                  accessibilityState={{ disabled: isDrawingToolsLocked, busy: false }}
                >
                  <MaterialIcon
                    name="tune-variant"
                    color={isDrawingToolsLocked ? colors.textDisabled : colors.text}
                    size={toolbarConfig.iconSize}
                  />
                </ToolbarPressable>
              </View>

              <View style={[styles.divider, { backgroundColor: colors.border }]} />

              {/* 形状和辅助工具组 */}
              <View style={styles.toolGroup} testID={getToolbarGroupTestID('assist')}>
                {/* 增强形状选择器入口 */}
                <ToolbarPressable
                  style={[
                    styles.toolButton,
                    isTextAndShapeLocked && styles.disabledToolButton,
                    activeTool === DRAWING_TOOLS.SHAPE && styles.activeToolButton,
                    activeTool === DRAWING_TOOLS.SHAPE && { backgroundColor: colors.primary + '30' },
                  ]}
                  onPress={() => {
                    if (isTextAndShapeLocked) {
                      return;
                    }
                    setShowEnhancedShapeSelector(true);
                    triggerHapticFeedback('light');
                  }}
                  disabled={isTextAndShapeLocked}
                  // 工具栏上「形状」有两个入口：这里打开完整形状库弹窗，末尾那个打开内联快捷条。
                  // 两者刻意用不同标签：既让读屏用户能区分，也避免 UI 测试同时命中两个同名节点
                  // （修复前两个入口都叫「形状工具」，属于真实的可达性缺陷）。
                  accessibilityLabel="更多形状"
                  accessibilityHint="打开完整形状库选择形状"
                  accessibilityRole="button"
                  accessibilityState={{
                    selected: activeTool === DRAWING_TOOLS.SHAPE,
                    disabled: isTextAndShapeLocked,
                    busy: false,
                  }}
                >
                  <ShapeIcon
                    color={isTextAndShapeLocked ? colors.textDisabled : (activeTool === DRAWING_TOOLS.SHAPE ? colors.primary : colors.text)}
                    size={toolbarConfig.iconSize}
                  />
                </ToolbarPressable>

                {/* 标尺切换。
                    改用 Pressable 而不是 TouchableOpacity：touchable 只在内容盒内响应，
                    而按断点算出的按钮本身就偏小；Pressable 的 hitSlop 能把有效触达补到 44dp，
                    并给出按压反馈（快速连点时用户能确认点到了）。 */}
                <Pressable
                  style={({ pressed }) => [
                    styles.toolButton,
                    showRuler && { backgroundColor: colors.primary + '20' },
                    isDrawingToolsLocked && styles.disabledToolButton,
                    pressed && !isDrawingToolsLocked && { opacity: TOOL_BUTTON_ACTIVE_OPACITY },
                  ]}
                  hitSlop={toolbarConfig.hitSlop || 8}
                  onPress={() => {
                    if (isDrawingToolsLocked) {
                      return;
                    }
                    const next = !showRuler;
                    setShowRuler(next);
                    // 下发到原生：让标尺真正渲染，而不是只高亮按钮
                    notifyToolPayloadChange({ showRuler: next });
                    triggerHapticFeedback('light');
                  }}
                  disabled={isDrawingToolsLocked}
                  accessibilityLabel="标尺"
                  accessibilityHint="显示或隐藏标尺"
                  accessibilityRole="button"
                  accessibilityState={{ disabled: isDrawingToolsLocked, busy: isDrawingToolsLocked, selected: showRuler }}
                >
                  <RulerIcon
                    color={showRuler ? colors.primary : colors.text}
                    size={toolbarConfig.iconSize}
                  />
                </Pressable>

                {/* 网格切换（与标尺同样改为 Pressable + hitSlop） */}
                <Pressable
                  style={({ pressed }) => [
                    styles.toolButton,
                    showGrid && { backgroundColor: colors.primary + '20' },
                    isDrawingToolsLocked && styles.disabledToolButton,
                    pressed && !isDrawingToolsLocked && { opacity: TOOL_BUTTON_ACTIVE_OPACITY },
                  ]}
                  hitSlop={toolbarConfig.hitSlop || 8}
                  onPress={() => {
                    if (isDrawingToolsLocked) {
                      return;
                    }
                    const next = !showGrid;
                    setShowGrid(next);
                    // 下发到原生：让网格真正渲染，而不是只高亮按钮
                    notifyToolPayloadChange({ showGrid: next });
                    triggerHapticFeedback('light');
                  }}
                  disabled={isDrawingToolsLocked}
                  accessibilityLabel="网格"
                  accessibilityHint="显示或隐藏网格"
                  accessibilityRole="button"
                  accessibilityState={{ disabled: isDrawingToolsLocked, busy: isDrawingToolsLocked, selected: showGrid }}
                >
                  <GridIcon
                    color={showGrid ? colors.primary : colors.text}
                    size={toolbarConfig.iconSize}
                  />
                </Pressable>

                {/* 防误触（掌托）开关：开启后只有手写笔能书写，手指留给滚动 */}
                <Pressable
                  style={({ pressed }) => [
                    styles.toolButton,
                    palmRejectionEnabled && { backgroundColor: colors.primary + '20' },
                    isDrawingToolsLocked && styles.disabledToolButton,
                    pressed && !isDrawingToolsLocked && { opacity: TOOL_BUTTON_ACTIVE_OPACITY },
                  ]}
                  hitSlop={toolbarConfig.hitSlop || 8}
                  onPress={() => {
                    if (isDrawingToolsLocked) {
                      return;
                    }
                    const next = !palmRejectionEnabled;
                    setPalmRejectionEnabled(next);
                    notifyToolPayloadChange({ palmRejectionEnabled: next });
                    triggerHapticFeedback('light');
                  }}
                  disabled={isDrawingToolsLocked}
                  accessibilityLabel="防误触"
                  accessibilityHint="开启后手掌与手指不会留下墨迹"
                  accessibilityRole="button"
                  accessibilityState={{ disabled: isDrawingToolsLocked, busy: isDrawingToolsLocked, selected: palmRejectionEnabled }}
                >
                  <MaterialIcon
                    name={palmRejectionEnabled ? 'hand-back-right-off' : 'hand-back-right'}
                    color={palmRejectionEnabled ? colors.primary : colors.text}
                    size={toolbarConfig.iconSize}
                  />
                </Pressable>

                {/* 手指书写模式：防误触关闭后，选择手指是书写还是手势 */}
                <Pressable
                  style={({ pressed }) => [
                    styles.toolButton,
                    !palmRejectionEnabled && fingerMode === 'draw' && { backgroundColor: colors.primary + '20' },
                    isDrawingToolsLocked && styles.disabledToolButton,
                    pressed && !(isDrawingToolsLocked || palmRejectionEnabled) && { opacity: TOOL_BUTTON_ACTIVE_OPACITY },
                  ]}
                  hitSlop={toolbarConfig.hitSlop || 8}
                  onPress={() => {
                    if (isDrawingToolsLocked) {
                      return;
                    }
                    const next = fingerMode === 'draw' ? 'gesture_only' : 'draw';
                    setFingerMode(next);
                    notifyToolPayloadChange({ fingerMode: next });
                    triggerHapticFeedback('light');
                  }}
                  disabled={isDrawingToolsLocked || palmRejectionEnabled}
                  accessibilityLabel="手指书写"
                  accessibilityHint="允许用手指书写（需先关闭防误触）"
                  accessibilityRole="button"
                  accessibilityState={{ disabled: isDrawingToolsLocked || palmRejectionEnabled, busy: false, selected: !palmRejectionEnabled && fingerMode === 'draw' }}
                >
                  <MaterialIcon
                    name="gesture-tap"
                    color={(isDrawingToolsLocked || palmRejectionEnabled) ? colors.textDisabled : (fingerMode === 'draw' ? colors.primary : colors.text)}
                    size={toolbarConfig.iconSize}
                  />
                </Pressable>
              </View>
            </>
          )}

          {toolConfigForMode.ai && (
            <>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />

              {/* AI工具组 */}
              <View style={styles.toolGroup} testID={getToolbarGroupTestID('ai')}>
                <ToolbarPressable
                  style={[
                    styles.toolButton,
                    isAIProcessing && styles.disabledToolButton,
                  ]}
                  onPress={() => {
                    if (isAIProcessing) {
                      return;
                    }
                    setShowAIToolModal(true);
                    triggerHapticFeedback('light');
                  }}
                  disabled={isAIProcessing}
                  accessibilityLabel="AI工具"
                  accessibilityHint="打开AI工具选择面板"
                  accessibilityRole="button"
                  accessibilityState={{ disabled: isAIProcessing, busy: isAIProcessing }}
                >
                  <AIIcon
                    color={isAIProcessing ? colors.textDisabled : colors.text}
                    size={toolbarConfig.iconSize}
                  />
                </ToolbarPressable>

                <ToolbarPressable
                  style={[
                    styles.toolButton,
                    (isAIProcessing || isAIHistoryLoading || isAIHistoryApplying) && styles.disabledToolButton,
                  ]}
                  onPress={handleOpenAIHistory}
                  disabled={isAIProcessing || isAIHistoryLoading || isAIHistoryApplying}
                  accessibilityLabel="AI历史"
                  accessibilityHint="查看AI工具使用历史"
                  accessibilityRole="button"
                  accessibilityState={{
                    disabled: isAIProcessing || isAIHistoryLoading || isAIHistoryApplying,
                    busy: isAIHistoryLoading || isAIHistoryApplying,
                  }}
                >
                  <HistoryIcon
                    color={(isAIProcessing || isAIHistoryLoading || isAIHistoryApplying) ? colors.textDisabled : colors.text}
                    size={toolbarConfig.iconSize}
                  />
                </ToolbarPressable>
              </View>
            </>
          )}

          {(toolConfigForMode.shapes || toolConfigForMode.text || toolConfigForMode.image) && (
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
          )}

          {/* 形状、文本、图片工具组 */}
          <View style={styles.toolGroup} testID={getToolbarGroupTestID('page')}>
            {toolConfigForMode.shapes && (
              <ToolbarPressable
                style={[
                  styles.toolButton,
                  isTextAndShapeLocked && styles.disabledToolButton,
                  activeTool === DRAWING_TOOLS.SHAPE && styles.activeToolButton,
                  activeTool === DRAWING_TOOLS.SHAPE && { backgroundColor: colors.primary + '30' },
                ]}
                onPress={() => {
                  if (isTextAndShapeLocked) {
                    return;
                  }
                  handleToolSelect(DRAWING_TOOLS.SHAPE);
                  setShowShapePicker(!showShapePicker);
                  triggerHapticFeedback('light');
                }}
                disabled={isTextAndShapeLocked}
                accessibilityLabel="形状工具"
                accessibilityHint="选择形状进行绘制"
                accessibilityRole="button"
                accessibilityState={{
                  selected: activeTool === DRAWING_TOOLS.SHAPE,
                  disabled: isTextAndShapeLocked,
                  busy: false,
                }}
              >
                <ShapeIcon
                  color={isTextAndShapeLocked ? colors.textDisabled : (activeTool === DRAWING_TOOLS.SHAPE ? colors.primary : colors.text)}
                  size={toolbarConfig.iconSize}
                />
              </ToolbarPressable>
            )}

            {toolConfigForMode.text && (
              <ToolbarPressable
                style={[
                  styles.toolButton,
                  isTextAndShapeLocked && styles.disabledToolButton,
                  activeTool === DRAWING_TOOLS.TEXT && styles.activeToolButton,
                  activeTool === DRAWING_TOOLS.TEXT && { backgroundColor: colors.primary + '30' },
                ]}
                onPress={handleTextToolSelect}
                disabled={isTextAndShapeLocked}
                accessibilityLabel="文本工具"
                accessibilityHint="添加文本内容"
                accessibilityRole="button"
                accessibilityState={{
                  selected: activeTool === DRAWING_TOOLS.TEXT,
                  disabled: isTextAndShapeLocked,
                  busy: false,
                }}
              >
                <TextIcon
                  color={isTextAndShapeLocked ? colors.textDisabled : (activeTool === DRAWING_TOOLS.TEXT ? colors.primary : colors.text)}
                  size={toolbarConfig.iconSize}
                />
              </ToolbarPressable>
            )}

            {toolConfigForMode.image && (
              <ToolbarPressable
                style={[
                  styles.toolButton,
                  isImageActionLocked && styles.disabledToolButton,
                ]}
                onPress={handleImageUpload}
                disabled={isImageActionLocked}
                accessibilityLabel="图片工具"
                accessibilityHint="添加图片到画布"
                accessibilityRole="button"
                accessibilityState={{ disabled: isImageActionLocked, busy: isImagePicking }}
              >
                <ImageIcon
                  color={isImageActionLocked ? colors.textDisabled : colors.text}
                  size={toolbarConfig.iconSize}
                />
              </ToolbarPressable>
            )}
          </View>
        </ScrollView>

        {/* 溢出提示：窄屏放不下全部工具组时，明确告诉用户右侧还有内容可滑。
            没有这个提示时，用户会以为「颜色/粗细」这些常用工具根本不存在。 */}
        {shouldHintOverflow && (
          <View
            testID="toolbar.overflowHint"
            pointerEvents="none"
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              bottom: 0,
              width: 18,
              justifyContent: 'center',
              alignItems: 'center',
              backgroundColor: colors.card,
            }}
          >
            <MaterialIcon name="chevron-right" size={16} color={colors.textSecondary || colors.text} />
          </View>
        )}

        {/* 形状选择器 */}
        {showShapePicker && renderShapePicker()}

        {/* 颜色选择器 */}
        {showColorPicker && renderColorPicker()}

        {/* 笔触粗细弹出面板 */}
        {showStrokeWidthPopover && renderStrokeWidthPopover()}

        {/* AI工具模态框 */}
        {showAIToolModal && renderAIToolModal()}

        {/* AI历史记录模态框 */}
        {showAIHistoryModal && renderAIHistoryModal()}

        {/* AI处理加载指示器 */}
        {isAIProcessing && renderAIProcessingIndicator()}

        {/* 书签列表模态框 */}
        {showBookmarkModal && renderBookmarkModal()}

        {/* 添加书签对话框 */}
        {showAddBookmarkDialog && renderAddBookmarkDialog()}

        {/* 文本输入模态框 */}
        {showTextInputModal && renderTextInputModal()}

        {/* 手感参数面板：与笔触选择器同级，未传 visible 时面板自持开关状态 */}
        <HandFeelPanel
          ref={handFeelPanelRef}
          toolConfig={currentToolConfig}
          onChange={handleHandFeelChange}
        />

        {/* 增强笔触选择器 */}
        <PenSelector
          visible={showPenSelector}
          onClose={() => setShowPenSelector(false)}
          selectedPen={selectedPenType}
          onSelectPen={(pen) => {
            setSelectedPenType(pen);
            handwritingService.setPenType(pen.id);
            // 更新粗细范围
            if (pen.minWidth && pen.maxWidth) {
              const midWidth = (pen.minWidth + pen.maxWidth) / 2;
              setActiveStrokeWidth(midWidth);
              onStrokeWidthChange?.(midWidth);
            }
          }}
          strokeWidth={activeStrokeWidth}
          onStrokeWidthChange={(width) => {
            setActiveStrokeWidth(width);
            onStrokeWidthChange?.(width);
          }}
          opacity={strokeOpacity}
          onOpacityChange={(opacity) => {
            setStrokeOpacity(opacity);
          }}
          color={activeColor}
        />

        {/* 增强形状选择器 */}
        <ShapeToolSelector
          visible={showEnhancedShapeSelector}
          onClose={() => setShowEnhancedShapeSelector(false)}
          selectedShape={selectedEnhancedShape}
          onSelectShape={(shape) => {
            setSelectedEnhancedShape(shape);
            setActiveShape(shape.id);
            onToolChange?.({ type: DRAWING_TOOLS.SHAPE, shape: shape.id, fill: shapeFillEnabled });
          }}
          strokeWidth={activeStrokeWidth}
          onStrokeWidthChange={(width) => {
            setActiveStrokeWidth(width);
            onStrokeWidthChange?.(width);
          }}
          fillEnabled={shapeFillEnabled}
          onFillToggle={() => setShapeFillEnabled(!shapeFillEnabled)}
          color={activeColor}
        />
      </View>

    </View>
  );
};

// 样式定义函数（动态生成）
const createStyles = (config, wrapped = false) => {
  return StyleSheet.create({
  container: {
    paddingVertical: 0,
    paddingHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
    borderRadius: 0,
    marginHorizontal: 0,
    marginVertical: 0,
    minHeight: config.height,
    // 单行时的高度上限（紧凑）。换行（平板）时必须放开，否则第二行起会被裁掉。
    // 注意用 undefined 在内联 style 里覆盖是无效的——RN 的 StyleSheet.flatten
    // 不会用 undefined 覆盖已有值（真机实测：wrap 判据已为 true，界面却仍只有一行），
    // 所以必须在这里按 wrapped 直接决定。
    maxHeight: wrapped ? undefined : config.height + 4,
    position: 'relative',
  },
  toolbarSection: {
    flexDirection: 'row',
  },
  // 换行模式：不能带 row 方向，否则会压住内容容器的 flexWrap。
  toolbarSectionWrapped: {
    flexDirection: 'column',
    flexGrow: 0,
  },
  toolbarContentContainer: {
    alignItems: 'center',
  },
  // 内容放得下：居中，视觉更稳。
  toolbarContentContainerCentered: {
    justifyContent: 'center',
    flexGrow: 1,
  },
  // 内容溢出：必须左对齐且不 flexGrow，否则居中会把左端推出视口、滚动也够不着。
  toolbarContentContainerScrollable: {
    justifyContent: 'flex-start',
    flexGrow: 0,
    paddingHorizontal: 2,
  },
  // 平板/宽屏：换行成多行，全部工具一次可见，不再需要横滑。
  toolbarContentContainerWrapped: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  toolGroup: {
    flexDirection: 'row',
    marginHorizontal: config.spacing,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toolButton: {
    paddingHorizontal: config.padding,
    paddingVertical: config.padding - 2,
    borderRadius: 10,
    margin: config.spacing,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: config.buttonSize,
    minWidth: config.buttonSize,
  },
  activeToolButton: {
    // 移除所有阴影和elevation效果，避免Android白色背景问题
  },
  disabledToolButton: {
    opacity: 0.42,
  },
  toolLabel: {
    fontSize: config.fontSize,
    marginTop: 0,
    textAlign: 'center',
    fontWeight: '600',
  },
  divider: {
    width: 1,
    height: config.buttonSize,
    marginHorizontal: config.spacing,
  },
  colorIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#fff',
    marginBottom: 4,
  },
  shapePickerContainer: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    padding: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderRadius: 8,
    borderWidth: 1,
    zIndex: 10,
  },
  shapeItem: {
    padding: 8,
    margin: 2,
    borderRadius: 8,
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeShapeItem: {
    backgroundColor: '#2563eb20',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  toolGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  gridToolButton: {
    width: '31%',
    margin: 4,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  gridToolText: {
    marginTop: 8,
    fontWeight: '500',
  },
  gridToolDescription: {
    marginTop: 4,
    fontSize: 12,
    textAlign: 'center',
  },
  historyItem: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
  },
  historyItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  historyItemButton: {
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#2563eb12',
    alignSelf: 'flex-start',
  },
  emptyHistory: {
    padding: 32,
    alignItems: 'center',
  },
  emptyHistoryText: {
    marginTop: 16,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorPickerContainer: {
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
    borderRadius: 12,
    padding: 16,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 12,
  },
  colorItem: {
    width: 32,
    height: 32,
    borderRadius: 16,
    margin: 3,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  activeColorItem: {
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  // 2D颜色板样式
  colorBoard: {
    borderRadius: 12,
    overflow: 'hidden',
    alignSelf: 'center',
    marginVertical: 16,
    borderWidth: 2,
    borderColor: '#ddd',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  colorBoardBase: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  colorBoardOverlay: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  colorBoardCursor: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 3,
    elevation: 5,
  },
  colorPickerActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  colorPickerButtonsRight: {
    flexDirection: 'row',
    gap: 8,
  },
  // 取色器按钮样式（圆形，只有图标）
  colorPickerEyedropperButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // 确定/取消按钮样式（圆形图标按钮）
  colorPickerActionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorPickerConfirmButton: {
    borderWidth: 0,
  },
  colorPickerActionButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  // 色相条可点击区域
  hueSliderClickable: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
  },
  hueSliderContainer: {
    marginTop: 12,
    marginBottom: 16,
  },
  hueSliderWrapper: {
    position: 'relative',
    height: 40,
    marginTop: 8,
  },
  hueSliderBackground: {
    position: 'absolute',
    width: '100%',
    height: 40,
  },
  hueSlider: {
    position: 'absolute',
    width: '100%',
    height: 40,
  },
  strokeWidthPreview: {
    // Dynamic styles applied inline
  },
  // 弹出式面板通用样式 - 定位在工具栏下方
  popoverOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    zIndex: 999,
  },
  strokeWidthPopover: {
    position: 'absolute',
    width: 280,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000,
  },
  // 标题行：标题在左，数值在右
  strokeWidthHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  strokeWidthTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  strokeWidthValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  // 滑块区域 - 匹配图片设计
  strokeWidthSliderSection: {
    flexDirection: 'column',
    alignItems: 'center',
    marginBottom: 16,
  },
  // 渐变厚度轨道 - 真正从细到粗的渐变
  strokeWidthGradientTrack: {
    width: '100%',
    height: 30,
    marginBottom: 8,
    justifyContent: 'center',
    position: 'relative',
  },
  // 笔触轨道可点击区域
  strokeWidthTrackClickable: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
  },
  // 当前位置指示器小球
  strokeWidthIndicator: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    top: 7,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  // 滑块本身 - 匹配图片中的白色圆形手柄
  strokeWidthSliderCompact: {
    width: '100%',
    height: 20,
    marginHorizontal: 0,
  },
  popoverPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginBottom: 8,
  },
  popoverPreviewCircle: {
    marginRight: 12,
  },
  popoverValueText: {
    fontSize: 16,
    fontWeight: '600',
  },
  popoverSliderContainer: {
    marginBottom: 12,
  },
  popoverSlider: {
    width: '100%',
    height: 40,
  },
  popoverQuickButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  popoverQuickButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',

  },
  popoverQuickButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },

  processingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingContainer: {
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  processingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: 'bold',
  },
  // 书签相关样式
  bookmarkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
  },
  bookmarkContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  bookmarkColorIndicator: {
    width: 4,
    height: 40,
    borderRadius: 2,
    marginRight: 12,
  },
  bookmarkInfo: {
    flex: 1,
  },
  bookmarkDeleteButton: {
    padding: 8,
  },
  // 对话框样式
  dialogContainer: {
    width: '80%',
    borderRadius: 16,
    padding: 20,
    alignSelf: 'center',
  },
  dialogTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  dialogInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
  },
  dialogButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  dialogButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    minWidth: 80,
    alignItems: 'center',
  },
  // 文本输入模态框样式
  textModalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    maxHeight: '80%',
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  textToolSection: {
    marginBottom: 16,
  },
  textToolLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  textSlider: {
    width: '100%',
    height: 40,
  },
  textStyleButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  textStyleButton: {
    width: 44,
    height: 44,
    borderWidth: 1,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textStyleButtonText: {
    fontSize: 18,
    fontWeight: '600',
  },
  textAlignmentButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  colorSelectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
  },
  colorPreviewSmall: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#fff',
  },
  textSubmitButton: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  textSubmitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  });
}; // end of createStyles

export default AllInOneToolbar;
