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
  PanResponder,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import ColorPicker from './ColorPicker'; // 企业级颜色选择器组件
import MaterialIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import Svg, { Path, Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import Slider from '@react-native-community/slider';
import { Text } from './Typography';
import { useTheme } from '../../context/ThemeContext';
import { noteAIService } from '../../services/notes/noteAIService';
import { chatHistoryService as aiHistoryService } from '../../services/ai/chatHistoryService';
import { bookmarkService } from '../../services/notes/bookmarkService';
import { launchImageLibrary } from 'react-native-image-picker';
import screenUtils from '../../native/screenUtilsBridge';
import Clipboard from '@react-native-clipboard/clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 集成增强组件
import PenSelector from '../toolbar/PenSelector';
import ShapeToolSelector, { ShapeTypes, generateShapePath } from '../toolbar/ShapeToolSelector';
import { PenTypes, handwritingService } from '../../services/handwritingService';

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

// 功能快捷键（需要Ctrl/Cmd）
const FUNCTION_SHORTCUTS = Object.freeze({
  'Z': 'undo',           // Ctrl+Z
  'Y': 'redo',           // Ctrl+Y
  'Shift+Z': 'redo',     // Ctrl+Shift+Z
  'A': 'selectAll',
  'D': 'duplicate',
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
}) => {
  const { colors } = useTheme();

  // 获取响应式配置
  const toolbarConfig = useMemo(() => getToolbarConfig(), []);

  // 动态生成样式
  const styles = useMemo(() => createStyles(toolbarConfig), [toolbarConfig]);
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
      recognitionEnabled: overrides.recognitionEnabled ?? currentToolConfig?.recognitionEnabled ?? true,
      recognitionDebounceMs: overrides.recognitionDebounceMs ?? currentToolConfig?.recognitionDebounceMs ?? 180,
      palmRejectionEnabled: overrides.palmRejectionEnabled ?? currentToolConfig?.palmRejectionEnabled ?? true,
      fingerMode: overrides.fingerMode || currentToolConfig?.fingerMode || 'gesture_only',
      ...overrides,
    };
  }, [
    activeColor,
    activeShape,
    activeStrokeWidth,
    activeTool,
    currentToolConfig,
    selectedPenType,
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
      'recognitionEnabled', 'recognitionDebounceMs',
      'palmRejectionEnabled', 'fingerMode', 'mode', 'blendMode',
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

  // 加载AI历史记录
  useEffect(() => {
    loadAIHistory();
  }, []);

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
      Alert.alert('加载失败', '无法加载AI历史记录，请稍后重试。');
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
  const handleToolSelect = (tool) => {
    setActiveTool(tool);
    triggerHapticFeedback('light');
    if (tool !== DRAWING_TOOLS.SHAPE) {
      setShowShapePicker(false);
    }
  };

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

  // 处理AI工具选择 (现在调用流式处理)
  const handleAIToolSelect = (tool) => {
    if (isAIProcessing) {
      return;
    }
    handleStreamingAIToolSelect(tool);
  };

  const handleOpenAIHistory = () => {
    if (isAIProcessing || isAIHistoryLoading || isAIHistoryApplying) {
      return;
    }
    setShowAIHistoryModal(true);
    loadAIHistory();
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
                // 动态定位：工具栏正下方居中显示，增加更多间距
                top: toolbarConfig.height + 70,
                left: '50%',
                marginLeft: -140, // 280宽度的一半
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
  ), [showAIToolModal, colors, handleAIToolSelect, isAIProcessing]);

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

      {/* 主工具栏 */}
      <View style={[styles.container, { backgroundColor: colors.card }]}>

        {/* 绘图工具 */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.toolbarSection} contentContainerStyle={styles.toolbarContentContainer}>
          {/* 书签按钮 */}
          {toolConfigForMode.bookmarks && (
            <>
              <View style={styles.toolGroup}>
                <TouchableOpacity
                  style={[styles.toolButton, isBookmarkActionLocked && styles.disabledToolButton]}
                  activeOpacity={TOOL_BUTTON_ACTIVE_OPACITY}
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
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toolButton, isBookmarkActionLocked && styles.disabledToolButton]}
                  activeOpacity={TOOL_BUTTON_ACTIVE_OPACITY}
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
                </TouchableOpacity>
              </View>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
            </>
          )}

          {toolConfigForMode.editing && (
            <>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />

              {/* 预设工具组 - 企业级功能 */}
              <View style={styles.toolGroup}>
                <TouchableOpacity
                  style={[
                    styles.toolButton,
                    showPresetSelector && { backgroundColor: colors.primary + '20' },
                    isPageDocActionLocked && styles.disabledToolButton,
                  ]}
                  activeOpacity={TOOL_BUTTON_ACTIVE_OPACITY}
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
                </TouchableOpacity>
              </View>

              <View style={[styles.divider, { backgroundColor: colors.border }]} />

              {/* 编辑工具组 */}
              <View style={styles.toolGroup}>
                <TouchableOpacity
                  style={[
                    styles.toolButton,
                    !canUndo && styles.disabledToolButton,
                  ]}
                  activeOpacity={TOOL_BUTTON_ACTIVE_OPACITY}
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
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.toolButton,
                    !canRedo && styles.disabledToolButton,
                  ]}
                  activeOpacity={TOOL_BUTTON_ACTIVE_OPACITY}
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
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.toolButton,
                    isPageDocActionLocked && styles.disabledToolButton,
                  ]}
                  activeOpacity={TOOL_BUTTON_ACTIVE_OPACITY}
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
                </TouchableOpacity>
              </View>
            </>
          )}

          {toolConfigForMode.drawing && (
            <>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />

              {/* 绘图工具组 */}
              <View style={styles.toolGroup}>
                <TouchableOpacity
                  style={[
                    styles.toolButton,
                    isDrawingToolsLocked && styles.disabledToolButton,
                    activeTool === DRAWING_TOOLS.PEN && styles.activeToolButton,
                    activeTool === DRAWING_TOOLS.PEN && { backgroundColor: colors.primary + '30' },
                  ]}
                  activeOpacity={TOOL_BUTTON_ACTIVE_OPACITY}
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
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.toolButton,
                    isDrawingToolsLocked && styles.disabledToolButton,
                    activeTool === DRAWING_TOOLS.PENCIL && styles.activeToolButton,
                    activeTool === DRAWING_TOOLS.PENCIL && { backgroundColor: colors.primary + '30' },
                  ]}
                  activeOpacity={TOOL_BUTTON_ACTIVE_OPACITY}
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
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.toolButton,
                    isDrawingToolsLocked && styles.disabledToolButton,
                    activeTool === DRAWING_TOOLS.BRUSH && styles.activeToolButton,
                    activeTool === DRAWING_TOOLS.BRUSH && { backgroundColor: colors.primary + '30' },
                  ]}
                  activeOpacity={TOOL_BUTTON_ACTIVE_OPACITY}
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
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.toolButton,
                    isDrawingToolsLocked && styles.disabledToolButton,
                    activeTool === DRAWING_TOOLS.HIGHLIGHTER && styles.activeToolButton,
                    activeTool === DRAWING_TOOLS.HIGHLIGHTER && { backgroundColor: colors.primary + '30' },
                  ]}
                  activeOpacity={TOOL_BUTTON_ACTIVE_OPACITY}
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
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.toolButton,
                    isDrawingToolsLocked && styles.disabledToolButton,
                    activeTool === DRAWING_TOOLS.LASER && styles.activeToolButton,
                    activeTool === DRAWING_TOOLS.LASER && { backgroundColor: colors.primary + '30' },
                  ]}
                  activeOpacity={TOOL_BUTTON_ACTIVE_OPACITY}
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
                </TouchableOpacity>
              </View>

              <View style={[styles.divider, { backgroundColor: colors.border }]} />

              {/* 橡皮擦和套索工具组 */}
              <View style={styles.toolGroup}>
                <TouchableOpacity
                  style={[
                    styles.toolButton,
                    isDrawingToolsLocked && styles.disabledToolButton,
                    activeTool === DRAWING_TOOLS.ERASER && styles.activeToolButton,
                    activeTool === DRAWING_TOOLS.ERASER && { backgroundColor: colors.primary + '30' },
                  ]}
                  activeOpacity={TOOL_BUTTON_ACTIVE_OPACITY}
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
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.toolButton,
                    isDrawingToolsLocked && styles.disabledToolButton,
                    activeTool === DRAWING_TOOLS.LASSO && styles.activeToolButton,
                    activeTool === DRAWING_TOOLS.LASSO && { backgroundColor: colors.primary + '30' },
                  ]}
                  activeOpacity={TOOL_BUTTON_ACTIVE_OPACITY}
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
                </TouchableOpacity>
              </View>
            </>
          )}

          {toolConfigForMode.styling && (
            <>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />

              {/* 样式工具组 */}
              <View style={styles.toolGroup}>
                <TouchableOpacity
                  style={[styles.toolButton, isDrawingToolsLocked && styles.disabledToolButton]}
                  activeOpacity={TOOL_BUTTON_ACTIVE_OPACITY}
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
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.toolButton, isDrawingToolsLocked && styles.disabledToolButton]}
                  activeOpacity={TOOL_BUTTON_ACTIVE_OPACITY}
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
                </TouchableOpacity>

                {/* 增强笔触选择器入口 */}
                <TouchableOpacity
                  style={[styles.toolButton, isDrawingToolsLocked && styles.disabledToolButton]}
                  activeOpacity={TOOL_BUTTON_ACTIVE_OPACITY}
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
                </TouchableOpacity>
              </View>

              <View style={[styles.divider, { backgroundColor: colors.border }]} />

              {/* 形状和辅助工具组 */}
              <View style={styles.toolGroup}>
                {/* 增强形状选择器入口 */}
                <TouchableOpacity
                  style={[
                    styles.toolButton,
                    isTextAndShapeLocked && styles.disabledToolButton,
                    activeTool === DRAWING_TOOLS.SHAPE && styles.activeToolButton,
                    activeTool === DRAWING_TOOLS.SHAPE && { backgroundColor: colors.primary + '30' },
                  ]}
                  activeOpacity={TOOL_BUTTON_ACTIVE_OPACITY}
                  onPress={() => {
                    if (isTextAndShapeLocked) {
                      return;
                    }
                    setShowEnhancedShapeSelector(true);
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
                </TouchableOpacity>

                {/* 标尺切换 */}
                <TouchableOpacity
                  style={[
                    styles.toolButton,
                    showRuler && { backgroundColor: colors.primary + '20' },
                    isDrawingToolsLocked && styles.disabledToolButton,
                  ]}
                  activeOpacity={TOOL_BUTTON_ACTIVE_OPACITY}
                  onPress={() => {
                    if (isDrawingToolsLocked) {
                      return;
                    }
                    setShowRuler(!showRuler);
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
                </TouchableOpacity>

                {/* 网格切换 */}
                <TouchableOpacity
                  style={[
                    styles.toolButton,
                    showGrid && { backgroundColor: colors.primary + '20' },
                    isDrawingToolsLocked && styles.disabledToolButton,
                  ]}
                  activeOpacity={TOOL_BUTTON_ACTIVE_OPACITY}
                  onPress={() => {
                    if (isDrawingToolsLocked) {
                      return;
                    }
                    setShowGrid(!showGrid);
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
                </TouchableOpacity>
              </View>
            </>
          )}

          {toolConfigForMode.ai && (
            <>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />

              {/* AI工具组 */}
              <View style={styles.toolGroup}>
                <TouchableOpacity
                  style={[
                    styles.toolButton,
                    isAIProcessing && styles.disabledToolButton,
                  ]}
                  activeOpacity={TOOL_BUTTON_ACTIVE_OPACITY}
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
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.toolButton,
                    (isAIProcessing || isAIHistoryLoading || isAIHistoryApplying) && styles.disabledToolButton,
                  ]}
                  activeOpacity={TOOL_BUTTON_ACTIVE_OPACITY}
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
                </TouchableOpacity>
              </View>
            </>
          )}

          {(toolConfigForMode.shapes || toolConfigForMode.text || toolConfigForMode.image) && (
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
          )}

          {/* 形状、文本、图片工具组 */}
          <View style={styles.toolGroup}>
            {toolConfigForMode.shapes && (
              <TouchableOpacity
                style={[
                  styles.toolButton,
                  isTextAndShapeLocked && styles.disabledToolButton,
                  activeTool === DRAWING_TOOLS.SHAPE && styles.activeToolButton,
                  activeTool === DRAWING_TOOLS.SHAPE && { backgroundColor: colors.primary + '30' },
                ]}
                activeOpacity={TOOL_BUTTON_ACTIVE_OPACITY}
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
              </TouchableOpacity>
            )}

            {toolConfigForMode.text && (
              <TouchableOpacity
                style={[
                  styles.toolButton,
                  isTextAndShapeLocked && styles.disabledToolButton,
                  activeTool === DRAWING_TOOLS.TEXT && styles.activeToolButton,
                  activeTool === DRAWING_TOOLS.TEXT && { backgroundColor: colors.primary + '30' },
                ]}
                activeOpacity={TOOL_BUTTON_ACTIVE_OPACITY}
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
              </TouchableOpacity>
            )}

            {toolConfigForMode.image && (
              <TouchableOpacity
                style={[
                  styles.toolButton,
                  isImageActionLocked && styles.disabledToolButton,
                ]}
                activeOpacity={TOOL_BUTTON_ACTIVE_OPACITY}
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
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>

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
const createStyles = (config) => StyleSheet.create({
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
    maxHeight: config.height + 4,
    position: 'relative',
  },
  toolbarSection: {
    flexDirection: 'row',
  },
  toolbarContentContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
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
}); // end of createStyles

export default AllInOneToolbar;
