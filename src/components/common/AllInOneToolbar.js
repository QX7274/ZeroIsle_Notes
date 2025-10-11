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
  PanResponder,
  Dimensions
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import MaterialIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import Svg, { Path, Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import Slider from '@react-native-community/slider';
import { Text } from './Typography';
import { useTheme } from '../../context/ThemeContext';
import { noteAIService } from '../../services/notes/noteAIService';
import { chatHistoryService as aiHistoryService } from '../../services/ai/chatHistoryService';
import { bookmarkService } from '../../services/notes/bookmarkService';
import { launchImageLibrary } from 'react-native-image-picker';

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
  { value: 20, label: '特粗' }
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
  CLEAR: 'clear'
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
  CURVE: 'curve'
});

// AI工具类型
const AI_TOOLS = [
  { id: 'translate', label: '翻译', icon: 'translate', description: '翻译选中的文本' },
  { id: 'code_recognition', label: '代码识别', icon: 'code-braces', description: '识别并格式化代码' },
  { id: 'math_formula', label: '数学公式', icon: 'function-variant', description: '识别数学公式并转换为LaTeX' },
  { id: 'summarize', label: '摘要', icon: 'text-box', description: '生成文本摘要' },
  { id: 'extract_keywords', label: '提取关键词', icon: 'key', description: '从文本中提取关键词' },
  { id: 'explain', label: '解释', icon: 'help', description: '解释选中的内容' },
  { id: 'rewrite', label: '改写', icon: 'pencil', description: '改写选中的文本' },
  { id: 'grammar', label: '语法检查', icon: 'spellcheck', description: '检查文本的语法和拼写' },
  { id: 'simplify', label: '简化', icon: 'text-short', description: '简化复杂的文本' },
];

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

const AllInOneToolbar = ({
  // 绘图工具相关props
  onToolChange,
  onColorChange,
  onStrokeWidthChange,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  onClear,
  initialTool = DRAWING_TOOLS.PEN,
  initialColor = '#000000',
  initialStrokeWidth = 2,

  // AI工具相关props
  onAIToolSelect,
  selectedText,
  onAIProcessResult,
  onImageUpload,

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
  const [customColorHue, setCustomColorHue] = useState(0);
  const [customColorSaturation, setCustomColorSaturation] = useState(100);
  const [customColorValue, setCustomColorValue] = useState(100);
  const [showCustomColorPicker, setShowCustomColorPicker] = useState(false);
  const [tempColor, setTempColor] = useState(null); // 临时颜色，用于预览
  const [isPickingColor, setIsPickingColor] = useState(false); // 取色器模式

  // 触觉反馈支持（始终启用）
  const hapticFeedbackEnabled = true;

  // 触觉反馈函数
  const triggerHapticFeedback = useCallback((type = 'light') => {
    if (!hapticFeedbackEnabled) return;

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
  const [aiHistory, setAIHistory] = useState([]);

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

  // 书签相关状态
  const [showBookmarkModal, setShowBookmarkModal] = useState(false);
  const [bookmarks, setBookmarks] = useState([]);
  const [bookmarkTitle, setBookmarkTitle] = useState('');
  const [showAddBookmarkDialog, setShowAddBookmarkDialog] = useState(false);

  // 处理图片上传
  const handleImageUpload = () => {
    const options = {
      mediaType: 'photo',
      includeBase64: false,
      maxHeight: 2000,
      maxWidth: 2000,
      quality: 0.8,
    };

    launchImageLibrary(options, (response) => {
      console.log('图片选择响应:', response);

      if (response.didCancel) {
        console.log('用户取消了图片选择');
        return;
      }

      if (response.errorMessage) {
        console.error('图片选择错误:', response.errorMessage);
        Alert.alert('错误', '选择图片失败: ' + response.errorMessage);
        return;
      }

      if (response.assets && response.assets.length > 0) {
        const asset = response.assets[0];
        console.log('选择的图片:', asset);

        // 调用回调函数，传递图片信息
        if (onImageUpload) {
          onImageUpload({
            uri: asset.uri,
            width: asset.width,
            height: asset.height,
            fileName: asset.fileName,
            fileSize: asset.fileSize,
            type: asset.type
          });
        }
      }
    });
  };

  // 加载AI历史记录
  useEffect(() => {
    loadAIHistory();
  }, []);

  // HSV转RGB辅助函数
  const hsvToRgb = useCallback((h, s, v) => {
    s = s / 100;
    v = v / 100;
    const c = v * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = v - c;
    let r = 0, g = 0, b = 0;
    
    if (h >= 0 && h < 60) {
      r = c; g = x; b = 0;
    } else if (h >= 60 && h < 120) {
      r = x; g = c; b = 0;
    } else if (h >= 120 && h < 180) {
      r = 0; g = c; b = x;
    } else if (h >= 180 && h < 240) {
      r = 0; g = x; b = c;
    } else if (h >= 240 && h < 300) {
      r = x; g = 0; b = c;
    } else if (h >= 300 && h < 360) {
      r = c; g = 0; b = x;
    }
    
    r = Math.round((r + m) * 255);
    g = Math.round((g + m) * 255);
    b = Math.round((b + m) * 255);
    
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()}`;
  }, []);

  // RGB转HSV辅助函数
  const rgbToHsv = useCallback((hexColor) => {
    const r = parseInt(hexColor.slice(1, 3), 16) / 255;
    const g = parseInt(hexColor.slice(3, 5), 16) / 255;
    const b = parseInt(hexColor.slice(5, 7), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const diff = max - min;
    
    let h = 0;
    let s = max === 0 ? 0 : (diff / max) * 100;
    let v = max * 100;

    if (diff !== 0) {
      if (max === r) {
        h = 60 * (((g - b) / diff) % 6);
      } else if (max === g) {
        h = 60 * ((b - r) / diff + 2);
      } else {
        h = 60 * ((r - g) / diff + 4);
      }
    }

    if (h < 0) h += 360;

    return { h, s, v };
  }, []);

  // 当工具改变时通知父组件
  useEffect(() => {
    if (onToolChange) {
      if (activeTool === DRAWING_TOOLS.SHAPE) {
        onToolChange({ type: activeTool, shape: activeShape });
      } else if (activeTool === DRAWING_TOOLS.ERASER) {
        onToolChange({ type: activeTool, mode: 'erase' });
      } else if (activeTool === DRAWING_TOOLS.HIGHLIGHTER) {
        onToolChange({ 
          type: activeTool, 
          opacity: HIGHLIGHTER_CONFIG.opacity,
          blendMode: HIGHLIGHTER_CONFIG.blendMode
        });
      } else if (activeTool === DRAWING_TOOLS.LASER) {
        onToolChange({ 
          type: activeTool, 
          fadeOutDuration: LASER_CONFIG.fadeOutDuration,
          animationSteps: LASER_CONFIG.animationSteps
        });
      } else if (activeTool === DRAWING_TOOLS.LASSO) {
        onToolChange({ 
          type: activeTool, 
          mode: 'select',
          allowMove: true,  // 套索包含移动功能
          allowCopy: true,  // 套索包含复制功能
          allowDelete: true // 套索包含删除功能
        });
      } else {
        onToolChange({ type: activeTool });
      }
    }
  }, [activeTool, activeShape, onToolChange]);

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
    try {
      const historyItems = await aiHistoryService.getHistory({ limit: 10 });
      setAIHistory(historyItems);
    } catch (error) {
      console.error('加载AI历史记录失败:', error);
    }
  };

  // 加载书签列表
  const loadBookmarks = async () => {
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
    }
  };

  // 处理添加书签
  const handleAddBookmark = async () => {
    try {
      if (!currentNoteId) {
        Alert.alert('提示', '无法添加书签：未指定笔记');
        return;
      }

      // 生成默认标题
      const defaultTitle = bookmarkTitle.trim() || `书签 - 第${currentPage}页`;

      const newBookmark = await bookmarkService.addBookmark(
        currentNoteId,
        currentPage,
        null, // position 由父组件处理
        defaultTitle,
        activeColor
      );

      // 调用父组件回调
      if (onBookmarkAdd) {
        onBookmarkAdd(newBookmark);
      }

      // 刷新书签列表
      await loadBookmarks();

      // 重置输入
      setBookmarkTitle('');
      setShowAddBookmarkDialog(false);

      Alert.alert('成功', '书签添加成功');
      triggerHapticFeedback('success');
    } catch (error) {
      console.error('添加书签失败:', error);
      Alert.alert('错误', '添加书签失败: ' + error.message);
    }
  };

  // 处理删除书签
  const handleDeleteBookmark = async (bookmarkId) => {
    try {
      Alert.alert(
        '确认删除',
        '确定要删除这个书签吗？',
        [
          { text: '取消', style: 'cancel' },
          {
            text: '删除',
            style: 'destructive',
            onPress: async () => {
              const success = await bookmarkService.deleteBookmark(bookmarkId);
              if (success) {
                await loadBookmarks();
                triggerHapticFeedback('success');
              } else {
                Alert.alert('错误', '删除书签失败');
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('删除书签失败:', error);
      Alert.alert('错误', '删除书签失败: ' + error.message);
    }
  };

  // 处理导航到书签
  const handleNavigateToBookmark = (bookmark) => {
    if (onBookmarkNavigate) {
      onBookmarkNavigate(bookmark);
      setShowBookmarkModal(false);
    }
  };

  // 处理文本工具选择
  const handleTextToolSelect = () => {
    setActiveTool(DRAWING_TOOLS.TEXT);
    setShowTextInputModal(true);
    triggerHapticFeedback('light');
  };

  // 处理文本提交
  const handleTextSubmit = () => {
    if (!textInput.trim()) {
      Alert.alert('提示', '请输入文本内容');
      return;
    }

    if (onTextAdd) {
      onTextAdd({
        text: textInput,
        fontSize: textFontSize,
        color: activeColor,
        style: textStyle,
        alignment: textAlignment,
      });
    }

    // 重置文本输入
    setShowTextInputModal(false);
    setTextInput('');
    setTextFontSize(16);
    setTextStyle({ bold: false, italic: false, underline: false });
    setTextAlignment('left');

    triggerHapticFeedback('success');
  };

  // 处理绘图工具选择
  const handleToolSelect = (tool) => {
    setActiveTool(tool);
    triggerHapticFeedback('light');
    if (tool !== DRAWING_TOOLS.SHAPE) {
      setShowShapePicker(false);
    }
  };

  // 处理形状选择
  const handleShapeSelect = (shape) => {
    setActiveShape(shape);
    setShowShapePicker(false);
  };

  // 处理AI工具选择
  const handleAIToolSelect = async (tool) => {
    setSelectedAITool(tool);
    setShowAIToolModal(false);

    if (!selectedText) {
      Alert.alert('提示', '请先选择文本');
      return;
    }

    try {
      setIsAIProcessing(true);

      // 调用AI处理API
      const result = await processWithAI(tool.id, selectedText);

      // 处理结果
      if (result) {
        const outputText = result.result || result.translated_text || result.data;

        // 添加到历史记录
        await aiHistoryService.addHistory({
          tool: tool.id,
          input: selectedText,
          output: outputText,
          timestamp: new Date()
        });

        // 刷新历史记录
        loadAIHistory();

        // 调用结果处理函数
        if (onAIProcessResult) {
          onAIProcessResult(outputText, tool.id);
        }
      } else {
        throw new Error('AI处理失败，未返回结果');
      }
    } catch (error) {
      console.error(`AI处理失败 (${tool.id}):`, error);
      Alert.alert('处理失败', error.message || '无法处理选中的文本，请稍后重试');
    } finally {
      setIsAIProcessing(false);
    }
  };

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
  const handleColorBoardTouch = useCallback((event, boardSize = 280) => {
    const { locationX, locationY } = event.nativeEvent;
    const saturation = Math.max(0, Math.min(100, (locationX / boardSize) * 100));
    const value = Math.max(0, Math.min(100, 100 - (locationY / boardSize) * 100));
    setCustomColorSaturation(saturation);
    setCustomColorValue(value);
    triggerHapticFeedback('light');
  }, [triggerHapticFeedback]);

  // 处理取色器
  const handleEyedropperPress = () => {
    setIsPickingColor(true);
    Alert.alert(
      '取色器',
      '取色器功能需要屏幕截图权限。是否继续？',
      [
        { text: '取消', style: 'cancel', onPress: () => setIsPickingColor(false) },
        { 
          text: '继续',
          onPress: () => {
            // 简化版：直接允许用户输入颜色值
            Alert.prompt(
              '输入颜色',
              '请输入十六进制颜色值（例如：#FF0000）',
              [
                { text: '取消', style: 'cancel', onPress: () => setIsPickingColor(false) },
                {
                  text: '确定',
                  onPress: (colorValue) => {
                    if (colorValue && /^#[0-9A-Fa-f]{6}$/.test(colorValue)) {
                      const hsv = rgbToHsv(colorValue);
                      setCustomColorHue(hsv.h);
                      setCustomColorSaturation(hsv.s);
                      setCustomColorValue(hsv.v);
                      setTempColor(colorValue);
                    }
                    setIsPickingColor(false);
                  }
                }
              ]
            );
          }
        }
      ]
    );
  };

  // 处理确定按钮
  const handleColorConfirm = () => {
    const customColor = hsvToRgb(customColorHue, customColorSaturation, customColorValue);
    setActiveColor(customColor);
    onColorChange?.(customColor);
    triggerHapticFeedback('success');
    setShowColorPicker(false);
    setTempColor(null);
  };

  // 处理取消按钮
  const handleColorCancel = () => {
    setShowColorPicker(false);
    setTempColor(null);
    setIsPickingColor(false);
  };

  // 渲染颜色选择器 - 2D色板版本
  const renderColorPicker = () => {
    const customColor = tempColor || hsvToRgb(customColorHue, customColorSaturation, customColorValue);
    const boardSize = 260;
    const cursorX = (customColorSaturation / 100) * boardSize;
    const cursorY = (1 - customColorValue / 100) * boardSize;
    const hueColor = hsvToRgb(customColorHue, 100, 100);
    
    return (
      <Modal
        transparent={true}
        visible={showColorPicker}
        animationType="fade"
        onRequestClose={handleColorCancel}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={handleColorCancel}
        >
          <View
            style={[styles.colorPickerContainer, { backgroundColor: colors.card }]}
            onStartShouldSetResponder={() => true}
            onResponderRelease={(e) => e.stopPropagation()}
          >
            {/* 预设颜色 */}
            <View style={styles.colorGrid}>
              {PRESET_COLORS.map((color) => (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorItem,
                    { backgroundColor: color },
                    activeColor === color && styles.activeColorItem,
                  ]}
                  onPress={() => {
                    const hsv = rgbToHsv(color);
                    setCustomColorHue(hsv.h);
                    setCustomColorSaturation(hsv.s);
                    setCustomColorValue(hsv.v);
                    triggerHapticFeedback('light');
                  }}
                />
              ))}
            </View>

            {/* 色相滑块 - 可点击选择 */}
            <View style={styles.hueSliderContainer}>
              <View style={styles.hueSliderWrapper}>
                <Svg width="100%" height={40} style={styles.hueSliderBackground}>
                  <Defs>
                    <LinearGradient id="rainbow" x1="0%" y1="0%" x2="100%" y2="0%">
                      <Stop offset="0%" stopColor="#FF0000" />
                      <Stop offset="16.67%" stopColor="#FFFF00" />
                      <Stop offset="33.33%" stopColor="#00FF00" />
                      <Stop offset="50%" stopColor="#00FFFF" />
                      <Stop offset="66.67%" stopColor="#0000FF" />
                      <Stop offset="83.33%" stopColor="#FF00FF" />
                      <Stop offset="100%" stopColor="#FF0000" />
                    </LinearGradient>
                  </Defs>
                  <Rect width="100%" height={40} fill="url(#rainbow)" rx={6} />
                </Svg>
                <Slider
                  style={styles.hueSlider}
                  minimumValue={0}
                  maximumValue={360}
                  step={1}
                  value={customColorHue}
                  onValueChange={setCustomColorHue}
                  minimumTrackTintColor="transparent"
                  maximumTrackTintColor="transparent"
                  thumbTintColor={hueColor}
                />
                {/* 可点击的色相条 */}
                <TouchableOpacity
                  style={styles.hueSliderClickable}
                  onPress={(event) => {
                    const { locationX } = event.nativeEvent;
                    const hue = (locationX / 280) * 360; // 280是色相条宽度
                    setCustomColorHue(Math.max(0, Math.min(360, hue)));
                    triggerHapticFeedback('light');
                  }}
                  activeOpacity={1}
                />
              </View>
            </View>

            {/* 2D颜色板 - 饱和度和明度 */}
            <View 
              style={[styles.colorBoard, { width: boardSize, height: boardSize }]}
              onStartShouldSetResponder={() => true}
              onResponderGrant={(e) => handleColorBoardTouch(e, boardSize)}
              onResponderMove={(e) => handleColorBoardTouch(e, boardSize)}
            >
              {/* 基础色相背景 */}
              <View style={[styles.colorBoardBase, { backgroundColor: hueColor }]} />
              
              {/* 白色到透明的渐变（饱和度） */}
              <Svg width={boardSize} height={boardSize} style={styles.colorBoardOverlay}>
                <Defs>
                  <LinearGradient id="saturation" x1="0%" y1="0%" x2="100%" y2="0%">
                    <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
                    <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
                  </LinearGradient>
                </Defs>
                <Rect width={boardSize} height={boardSize} fill="url(#saturation)" />
              </Svg>

              {/* 透明到黑色的渐变（明度） */}
              <Svg width={boardSize} height={boardSize} style={styles.colorBoardOverlay}>
                <Defs>
                  <LinearGradient id="brightness" x1="0%" y1="0%" x2="0%" y2="100%">
                    <Stop offset="0%" stopColor="#000000" stopOpacity="0" />
                    <Stop offset="100%" stopColor="#000000" stopOpacity="1" />
                  </LinearGradient>
                </Defs>
                <Rect width={boardSize} height={boardSize} fill="url(#brightness)" />
              </Svg>

              {/* 光标指示器 */}
              <View 
                style={[
                  styles.colorBoardCursor, 
                  { 
                    left: cursorX - 10, 
                    top: cursorY - 10,
                    backgroundColor: customColor,
                    borderColor: customColorValue > 50 ? '#000' : '#FFF'
                  }
                ]} 
              />
            </View>

            {/* 操作按钮区域 */}
            <View style={styles.colorPickerActions}>
              {/* 取色器按钮 - 放在色相条后方 */}
              <TouchableOpacity
                style={[styles.colorPickerEyedropperButton, { borderColor: colors.border }]}
                onPress={handleEyedropperPress}
              >
                <EyedropperIcon color={colors.text} size={18} />
              </TouchableOpacity>

              <View style={styles.colorPickerButtonsRight}>
                <TouchableOpacity
                  style={[styles.colorPickerActionButton, { borderColor: colors.border }]}
                  onPress={handleColorCancel}
                >
                  <Icon name="close" size={20} color={colors.text} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.colorPickerActionButton, styles.colorPickerConfirmButton, { backgroundColor: colors.primary }]}
                  onPress={handleColorConfirm}
                >
                  <Icon name="checkmark" size={20} color="#FFF" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Pressable>
      </Modal>
    );
  };


  // 渲染笔触粗细弹出式面板 - 改进版设计
  const renderStrokeWidthPopover = () => {
    if (!showStrokeWidthPopover) return null;

    return (
      <Modal
        visible={showStrokeWidthPopover}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowStrokeWidthPopover(false)}
      >
        <Pressable
          style={styles.popoverOverlay}
          onPress={() => setShowStrokeWidthPopover(false)}
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
              }
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
                    }
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

  // 渲染形状选择器
  const renderShapePicker = () => (
    <View style={[styles.shapePickerContainer, {
      backgroundColor: colors.card,
      borderColor: colors.border,
      display: showShapePicker ? 'flex' : 'none'
    }]}>
      <TouchableOpacity
        style={[
          styles.shapeItem,
          activeShape === SHAPES.LINE && styles.activeShapeItem,
        ]}
        onPress={() => handleShapeSelect(SHAPES.LINE)}
      >
        <View style={[styles.shapeIcon, { width: 24, height: 2, backgroundColor: activeShape === SHAPES.LINE ? colors.primary : colors.text }]} />
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.shapeItem,
          activeShape === SHAPES.RECTANGLE && styles.activeShapeItem,
        ]}
        onPress={() => handleShapeSelect(SHAPES.RECTANGLE)}
      >
        <View style={[styles.shapeIcon, { width: 24, height: 24, borderWidth: 2, borderColor: activeShape === SHAPES.RECTANGLE ? colors.primary : colors.text }]} />
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.shapeItem,
          activeShape === SHAPES.CIRCLE && styles.activeShapeItem,
        ]}
        onPress={() => handleShapeSelect(SHAPES.CIRCLE)}
      >
        <View style={[styles.shapeIcon, { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: activeShape === SHAPES.CIRCLE ? colors.primary : colors.text }]} />
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.shapeItem,
          activeShape === SHAPES.TRIANGLE && styles.activeShapeItem,
        ]}
        onPress={() => handleShapeSelect(SHAPES.TRIANGLE)}
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
      onRequestClose={() => setShowAIToolModal(false)}
    >
      <TouchableOpacity
        style={[styles.modalContainer, { backgroundColor: 'rgba(0,0,0,0.5)' }]}
        activeOpacity={1}
        onPress={() => setShowAIToolModal(false)}
      >
        <TouchableOpacity
          style={[styles.modalContent, { backgroundColor: colors.card }]}
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.modalHeader}>
            <Text variant="heading" level="h6">AI工具</Text>
            <TouchableOpacity onPress={() => setShowAIToolModal(false)}>
              <Icon name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.toolGrid}>
            {AI_TOOLS.map(tool => (
              <TouchableOpacity
                key={tool.id}
                style={[
                  styles.gridToolButton,
                  { backgroundColor: colors.background, borderColor: colors.border }
                ]}
                onPress={() => handleAIToolSelect(tool)}
              >
                <MaterialIcon name={tool.icon} size={24} color={colors.primary} />
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
  ), [showAIToolModal, colors, handleAIToolSelect]);

  // 渲染AI历史记录模态框
  const renderAIHistoryModal = () => (
    <Modal
      visible={showAIHistoryModal}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowAIHistoryModal(false)}
    >
      <TouchableOpacity
        style={[styles.modalContainer, { backgroundColor: 'rgba(0,0,0,0.5)' }]}
        activeOpacity={1}
        onPress={() => setShowAIHistoryModal(false)}
      >
        <TouchableOpacity
          style={[styles.modalContent, { backgroundColor: colors.card }]}
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.modalHeader}>
            <Text variant="heading" level="h6">AI历史记录</Text>
            <TouchableOpacity onPress={() => setShowAIHistoryModal(false)}>
              <Icon name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {aiHistory.length === 0 ? (
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
                    style={styles.historyItemButton}
                    onPress={() => {
                      if (onAIProcessResult) {
                        onAIProcessResult(item.output, item.tool);
                      }
                      setShowAIHistoryModal(false);
                    }}
                  >
                    <Text variant="button" color="primary">使用此结果</Text>
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
      onRequestClose={() => setShowBookmarkModal(false)}
    >
      <TouchableOpacity
        style={[styles.modalContainer, { backgroundColor: 'rgba(0,0,0,0.5)' }]}
        activeOpacity={1}
        onPress={() => setShowBookmarkModal(false)}
      >
        <TouchableOpacity
          style={[styles.modalContent, { backgroundColor: colors.card }]}
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.modalHeader}>
            <Text variant="heading" level="h6">书签列表</Text>
            <TouchableOpacity onPress={() => setShowBookmarkModal(false)}>
              <Icon name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {bookmarks.length === 0 ? (
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
              renderItem={({ item }) => (
                <View style={[styles.bookmarkItem, { borderBottomColor: colors.border }]}>
                  <TouchableOpacity
                    style={styles.bookmarkContent}
                    onPress={() => handleNavigateToBookmark(item)}
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
                    style={styles.bookmarkDeleteButton}
                    onPress={() => handleDeleteBookmark(item.id)}
                  >
                    <Icon name="trash-outline" size={20} color={colors.error} />
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
      onRequestClose={() => setShowAddBookmarkDialog(false)}
    >
      <Pressable
        style={styles.modalOverlay}
        onPress={() => setShowAddBookmarkDialog(false)}
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
            autoFocus
          />

          <View style={styles.dialogButtons}>
            <TouchableOpacity
              style={[styles.dialogButton, { backgroundColor: colors.background }]}
              onPress={() => {
                setShowAddBookmarkDialog(false);
                setBookmarkTitle('');
              }}
            >
              <Text style={{ color: colors.text }}>取消</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.dialogButton, { backgroundColor: colors.primary }]}
              onPress={handleAddBookmark}
            >
              <Text style={{ color: '#fff' }}>确定</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Pressable>
    </Modal>
  );

  // 渲染文本输入模态框
  const renderTextInputModal = () => (
    <Modal
      visible={showTextInputModal}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowTextInputModal(false)}
    >
      <TouchableOpacity
        style={[styles.modalContainer, { backgroundColor: 'rgba(0,0,0,0.5)' }]}
        activeOpacity={1}
        onPress={() => setShowTextInputModal(false)}
      >
        <TouchableOpacity
          style={[styles.textModalContent, { backgroundColor: colors.card }]}
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.modalHeader}>
            <Text variant="heading" level="h6">添加文本</Text>
            <TouchableOpacity onPress={() => setShowTextInputModal(false)}>
              <Icon name="close" size={24} color={colors.text} />
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
                  textStyle.bold && { backgroundColor: colors.primary + '20' }
                ]}
                onPress={() => setTextStyle({ ...textStyle, bold: !textStyle.bold })}
              >
                <Text style={[styles.textStyleButtonText, { color: colors.text, fontWeight: 'bold' }]}>B</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.textStyleButton,
                  { borderColor: colors.border },
                  textStyle.italic && { backgroundColor: colors.primary + '20' }
                ]}
                onPress={() => setTextStyle({ ...textStyle, italic: !textStyle.italic })}
              >
                <Text style={[styles.textStyleButtonText, { color: colors.text, fontStyle: 'italic' }]}>I</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.textStyleButton,
                  { borderColor: colors.border },
                  textStyle.underline && { backgroundColor: colors.primary + '20' }
                ]}
                onPress={() => setTextStyle({ ...textStyle, underline: !textStyle.underline })}
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
                  textAlignment === 'left' && { backgroundColor: colors.primary + '20' }
                ]}
                onPress={() => setTextAlignment('left')}
              >
                <Text style={[styles.textAlignmentButtonText, { color: colors.text }]}>左</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.textStyleButton,
                  { borderColor: colors.border },
                  textAlignment === 'center' && { backgroundColor: colors.primary + '20' }
                ]}
                onPress={() => setTextAlignment('center')}
              >
                <Text style={[styles.textAlignmentButtonText, { color: colors.text }]}>中</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.textStyleButton,
                  { borderColor: colors.border },
                  textAlignment === 'right' && { backgroundColor: colors.primary + '20' }
                ]}
                onPress={() => setTextAlignment('right')}
              >
                <Text style={[styles.textAlignmentButtonText, { color: colors.text }]}>右</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* 颜色选择 */}
          <View style={styles.textToolSection}>
            <Text style={[styles.textToolLabel, { color: colors.text }]}>文本颜色</Text>
            <TouchableOpacity
              style={[styles.colorSelectButton, { borderColor: colors.border }]}
              onPress={() => {
                setShowTextInputModal(false);
                setShowColorPicker(true);
              }}
            >
              <View style={[styles.colorPreviewSmall, { backgroundColor: activeColor }]} />
              <Text style={{ color: colors.text, marginLeft: 8 }}>{activeColor}</Text>
            </TouchableOpacity>
          </View>

          {/* 确认按钮 */}
          <TouchableOpacity
            style={[styles.textSubmitButton, { backgroundColor: colors.primary }]}
            onPress={handleTextSubmit}
          >
            <Text style={styles.textSubmitButtonText}>添加文本</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );

  // 主工具栏渲染
  return (
    <View>
      {/* 主工具栏 */}
      <View style={[styles.container, { backgroundColor: colors.card }]}>

      {/* 绘图工具 */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.toolbarSection} contentContainerStyle={styles.toolbarContentContainer}>
        {/* 书签按钮 */}
        <View style={styles.toolGroup}>
          <TouchableOpacity 
            style={styles.toolButton} 
            onPress={() => {
              setShowAddBookmarkDialog(true);
              triggerHapticFeedback('light');
            }}
            accessibilityLabel="添加书签"
            accessibilityHint="在当前页面添加书签"
            accessibilityRole="button"
          >
            <AddBookmarkIcon 
              color={colors.text} 
              size={toolbarConfig.iconSize}
            />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.toolButton} 
            onPress={() => {
              loadBookmarks();
              setShowBookmarkModal(true);
              triggerHapticFeedback('light');
            }}
            accessibilityLabel="书签列表"
            accessibilityHint="查看和管理书签"
            accessibilityRole="button"
          >
            <BookmarkIcon 
              color={colors.text} 
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
              !canUndo && styles.disabledToolButton
            ]}
            onPress={() => {
              onUndo?.();
              triggerHapticFeedback('light');
            }}
            disabled={!canUndo}
            accessibilityLabel="撤销"
            accessibilityHint="撤销上一步操作"
            accessibilityRole="button"
            accessibilityState={{ disabled: !canUndo }}
          >
            <UndoIcon 
              color={!canUndo ? colors.textDisabled : colors.text} 
              size={toolbarConfig.iconSize}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.toolButton,
              !canRedo && styles.disabledToolButton
            ]}
            onPress={() => {
              onRedo?.();
              triggerHapticFeedback('light');
            }}
            disabled={!canRedo}
            accessibilityLabel="重做"
            accessibilityHint="重做撤销的操作"
            accessibilityRole="button"
            accessibilityState={{ disabled: !canRedo }}
          >
            <RedoIcon 
              color={!canRedo ? colors.textDisabled : colors.text} 
              size={toolbarConfig.iconSize}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.toolButton}
            onPress={() => {
              // 第一级菜单：选择清除类型
              Alert.alert(
                '清除',
                '选择清除类型：',
                [
                  { text: '取消', style: 'cancel' },
                  {
                    text: '按范围清除',
                    onPress: () => {
                      // 第二级菜单：范围选择
                      Alert.alert(
                        '清除范围',
                        '选择范围：',
                        [
                          { text: '返回', style: 'cancel' },
                          {
                            text: '当前视图',
                            onPress: () => onClear && onClear('current_view')
                          },
                          {
                            text: '当前页面',
                            onPress: () => {
                              // 第三级：确认
                              Alert.alert(
                                '确认',
                                '确定要清除当前页面吗？此操作无法撤销。',
                                [
                                  { text: '取消', style: 'cancel' },
                                  {
                                    text: '确定',
                                    style: 'destructive',
                                    onPress: () => onClear && onClear('current_page')
                                  }
                                ]
                              );
                            }
                          },
                          {
                            text: '整个文档',
                            onPress: () => {
                              // 第三级：确认
                              Alert.alert(
                                '确认',
                                '确定要清除整个文档吗？此操作无法撤销。',
                                [
                                  { text: '取消', style: 'cancel' },
                                  {
                                    text: '确定',
                                    style: 'destructive',
                                    onPress: () => onClear && onClear('entire_document')
                                  }
                                ]
                              );
                            },
                            style: 'destructive'
                          }
                        ]
                      );
                    }
                  },
                  {
                    text: '清除选中内容',
                    onPress: () => onClear && onClear('selected')
                  }
                ]
              );
            }}
            accessibilityLabel="清除"
            accessibilityHint="清除画布内容"
            accessibilityRole="button"
          >
            <ClearIcon 
              color={colors.text} 
              size={toolbarConfig.iconSize}
            />
          </TouchableOpacity>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        {/* 绘图工具组 */}
        <View style={styles.toolGroup}>
          <TouchableOpacity
            style={[
              styles.toolButton,
              activeTool === DRAWING_TOOLS.PEN && styles.activeToolButton,
              activeTool === DRAWING_TOOLS.PEN && { backgroundColor: colors.primary + '30' }
            ]}
            onPress={() => handleToolSelect(DRAWING_TOOLS.PEN)}
            accessibilityLabel="画笔工具"
            accessibilityHint="选择画笔进行绘图"
            accessibilityRole="button"
            accessibilityState={{ selected: activeTool === DRAWING_TOOLS.PEN }}
          >
            <PenIcon 
              color={activeTool === DRAWING_TOOLS.PEN ? colors.primary : colors.text} 
              size={toolbarConfig.iconSize}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.toolButton,
              activeTool === DRAWING_TOOLS.PENCIL && styles.activeToolButton,
              activeTool === DRAWING_TOOLS.PENCIL && { backgroundColor: colors.primary + '30' }
            ]}
            onPress={() => handleToolSelect(DRAWING_TOOLS.PENCIL)}
            accessibilityLabel="铅笔工具"
            accessibilityHint="选择铅笔进行绘图"
            accessibilityRole="button"
            accessibilityState={{ selected: activeTool === DRAWING_TOOLS.PENCIL }}
          >
            <PencilIcon 
              color={activeTool === DRAWING_TOOLS.PENCIL ? colors.primary : colors.text} 
              size={toolbarConfig.iconSize}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.toolButton,
              activeTool === DRAWING_TOOLS.BRUSH && styles.activeToolButton,
              activeTool === DRAWING_TOOLS.BRUSH && { backgroundColor: colors.primary + '30' }
            ]}
            onPress={() => handleToolSelect(DRAWING_TOOLS.BRUSH)}
            accessibilityLabel="刷子工具"
            accessibilityHint="选择刷子进行绘图"
            accessibilityRole="button"
            accessibilityState={{ selected: activeTool === DRAWING_TOOLS.BRUSH }}
          >
            <BrushIcon 
              color={activeTool === DRAWING_TOOLS.BRUSH ? colors.primary : colors.text} 
              size={toolbarConfig.iconSize}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.toolButton,
              activeTool === DRAWING_TOOLS.HIGHLIGHTER && styles.activeToolButton,
              activeTool === DRAWING_TOOLS.HIGHLIGHTER && { backgroundColor: colors.primary + '30' }
            ]}
            onPress={() => handleToolSelect(DRAWING_TOOLS.HIGHLIGHTER)}
            accessibilityLabel="荧光笔工具"
            accessibilityHint="选择荧光笔进行高亮标记"
            accessibilityRole="button"
            accessibilityState={{ selected: activeTool === DRAWING_TOOLS.HIGHLIGHTER }}
          >
            <HighlighterIcon 
              color={activeTool === DRAWING_TOOLS.HIGHLIGHTER ? colors.primary : colors.text} 
              size={toolbarConfig.iconSize}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.toolButton,
              activeTool === DRAWING_TOOLS.LASER && styles.activeToolButton,
              activeTool === DRAWING_TOOLS.LASER && { backgroundColor: colors.primary + '30' }
            ]}
            onPress={() => handleToolSelect(DRAWING_TOOLS.LASER)}
            accessibilityLabel="激光笔工具"
            accessibilityHint="选择激光笔进行临时标记"
            accessibilityRole="button"
            accessibilityState={{ selected: activeTool === DRAWING_TOOLS.LASER }}
          >
            <LaserIcon 
              color={activeTool === DRAWING_TOOLS.LASER ? colors.primary : colors.text} 
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
              activeTool === DRAWING_TOOLS.ERASER && styles.activeToolButton,
              activeTool === DRAWING_TOOLS.ERASER && { backgroundColor: colors.primary + '30' }
            ]}
            onPress={() => {
              handleToolSelect(DRAWING_TOOLS.ERASER);
            }}
            accessibilityLabel="橡皮擦工具"
            accessibilityHint="选择橡皮擦删除内容"
            accessibilityRole="button"
            accessibilityState={{ selected: activeTool === DRAWING_TOOLS.ERASER }}
          >
            <EraserIcon 
              color={activeTool === DRAWING_TOOLS.ERASER ? colors.primary : colors.text} 
              size={toolbarConfig.iconSize}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.toolButton,
              activeTool === DRAWING_TOOLS.LASSO && styles.activeToolButton,
              activeTool === DRAWING_TOOLS.LASSO && { backgroundColor: colors.primary + '30' }
            ]}
            onPress={() => handleToolSelect(DRAWING_TOOLS.LASSO)}
            accessibilityLabel="套索工具"
            accessibilityHint="自由绘制选区，选择和移动内容"
            accessibilityRole="button"
            accessibilityState={{ selected: activeTool === DRAWING_TOOLS.LASSO }}
          >
            <LassoIcon 
              color={activeTool === DRAWING_TOOLS.LASSO ? colors.primary : colors.text} 
              size={toolbarConfig.iconSize}
            />
          </TouchableOpacity>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        {/* 样式工具组 */}
        <View style={styles.toolGroup}>
          <TouchableOpacity
            style={styles.toolButton}
            onPress={() => setShowColorPicker(true)}
          >
            <View
              style={[
                styles.colorIndicator,
                { backgroundColor: activeColor, width: 24, height: 24, borderRadius: 12 }
              ]}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.toolButton}
            onPress={() => {
              setShowStrokeWidthPopover(!showStrokeWidthPopover);
              triggerHapticFeedback('light');
            }}
            accessibilityLabel="笔触粗细"
            accessibilityHint="调整画笔粗细"
            accessibilityRole="button"
          >
            <StrokeWidthIcon 
              color={colors.text} 
              size={toolbarConfig.iconSize}
              strokeWidth={Math.min(activeStrokeWidth / 5, 4)}
            />
          </TouchableOpacity>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        {/* AI工具组 */}
        <View style={styles.toolGroup}>
          <TouchableOpacity
            style={styles.toolButton}
            onPress={() => setShowAIToolModal(true)}
            accessibilityLabel="AI工具"
            accessibilityHint="打开AI工具选择面板"
            accessibilityRole="button"
          >
            <AIIcon 
              color={colors.text} 
              size={toolbarConfig.iconSize}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.toolButton}
            onPress={() => setShowAIHistoryModal(true)}
            accessibilityLabel="AI历史"
            accessibilityHint="查看AI工具使用历史"
            accessibilityRole="button"
          >
            <HistoryIcon 
              color={colors.text} 
              size={toolbarConfig.iconSize}
            />
          </TouchableOpacity>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        {/* 形状和文本工具组 */}
        <View style={styles.toolGroup}>
          <TouchableOpacity
            style={[
              styles.toolButton,
              activeTool === DRAWING_TOOLS.SHAPE && styles.activeToolButton,
              activeTool === DRAWING_TOOLS.SHAPE && { backgroundColor: colors.primary + '30' }
            ]}
            onPress={() => {
              handleToolSelect(DRAWING_TOOLS.SHAPE);
              setShowShapePicker(!showShapePicker);
            }}
            accessibilityLabel="形状工具"
            accessibilityHint="选择形状进行绘制"
            accessibilityRole="button"
            accessibilityState={{ selected: activeTool === DRAWING_TOOLS.SHAPE }}
          >
            <ShapeIcon 
              color={activeTool === DRAWING_TOOLS.SHAPE ? colors.primary : colors.text} 
              size={toolbarConfig.iconSize}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.toolButton,
              activeTool === DRAWING_TOOLS.TEXT && styles.activeToolButton,
              activeTool === DRAWING_TOOLS.TEXT && { backgroundColor: colors.primary + '30' }
            ]}
            onPress={handleTextToolSelect}
            accessibilityLabel="文本工具"
            accessibilityHint="添加文本内容"
            accessibilityRole="button"
            accessibilityState={{ selected: activeTool === DRAWING_TOOLS.TEXT }}
          >
            <TextIcon 
              color={activeTool === DRAWING_TOOLS.TEXT ? colors.primary : colors.text} 
              size={toolbarConfig.iconSize}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.toolButton}
            onPress={() => {
              console.log('图片按钮被点击');
              handleImageUpload();
            }}
            accessibilityLabel="图片工具"
            accessibilityHint="添加图片到画布"
            accessibilityRole="button"
          >
            <ImageIcon 
              color={colors.text} 
              size={toolbarConfig.iconSize}
            />
          </TouchableOpacity>
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
    borderRadius: 6,
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
    opacity: 0.5,
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
    borderRadius: 8,
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
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    backgroundColor: '#2563eb10',
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
    borderRadius: 12,
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
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  // 文本输入模态框样式
  textModalContent: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
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
    borderRadius: 8,
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