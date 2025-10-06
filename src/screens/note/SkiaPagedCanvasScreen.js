/**
 * 分页笔记界面 - 高性能重构版
 * 使用Gesture Handler + Reanimated + Skia Group Transform
 * 核心改进：原生手势处理、UI线程状态管理、GPU加速变换
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Platform,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { Canvas, Group, Path as SkiaPath } from '@shopify/react-native-skia';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  runOnJS,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

// 导入组件
import { useTheme } from '../../context/ThemeContext';
import { useDispatch } from 'react-redux';
import ViewerLayout from '../../components/viewer/ViewerLayout';
import AllInOneToolbar from '../../components/common/AllInOneToolbar';
import ToolbarContainer from '../../components/viewer/ToolbarContainer';
import BackButton from '../../components/viewer/BackButton';
import SaveButton, { SaveUtils } from '../../components/common/SaveButton';
import PageControl from '../../components/viewer/PageControl';
import ZoomIndicator from '../../components/common/ZoomIndicator';
import LoadingIndicator from '../../components/common/LoadingIndicator';
import FileHistoryNavigation from '../../components/viewer/FileHistoryNavigation';
import fileHistoryService from '../../services/fileHistoryService';

// 导入服务和工具
import { offlineStorageService } from '../../services/offline';
import { addNote, updateOneNote } from '../../redux/slices/notesSlice';
import { noteStyles } from '../../components/note/NoteStyleModal';
import { renderPageBackground, renderStroke, renderLayerStrokes, DrawingEngine, DRAWING_TOOLS } from '../../components/canvas/DrawingEngine';
import { SPACING } from '../../theme/dimensions';
import noteTypeDetectionService from '../../services/notes/noteTypeDetectionService';

// ✅ 导入智能内存管理服务
import { memoryManager, MEMORY_STATE } from '../../services/memory/MemoryManager';
import { incrementalSaveService, CHANGE_TYPE } from '../../services/memory/IncrementalSaveService';

// ✅ 导入高级手势处理服务
import { advancedGestureService, GESTURE_TYPE } from '../../services/gesture/AdvancedGestureService';

// ✅ 导入渲染管线管理服务
import { renderPipelineService, RENDER_QUALITY, RENDER_STATE } from '../../services/render/RenderPipelineService';

// ✅ 导入服务检查器
import { checkAllServices } from '../../services/serviceChecker';

// 触摸检测相关导入已移除，改为手动模式切换

// 获取屏幕尺寸
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// 页面尺寸配置 - A4纸竖版比例
const PAGE_MARGIN = 20;

// A4纸竖版：宽高比约为1:1.414 (210:297mm)
const availableWidth = screenWidth - PAGE_MARGIN * 2;
const availableHeight = screenHeight; // 减去工具栏和安全区域

// 计算合适的A4竖版尺寸，优先保证高度大于宽度
const A4_RATIO = 1.414; // 高度/宽度
let PAGE_WIDTH, PAGE_HEIGHT;

// 页面宽度与屏幕宽度一致，高度按A4比例计算
PAGE_WIDTH = availableWidth; // 与屏幕宽度一致（减去边距）
PAGE_HEIGHT = PAGE_WIDTH * A4_RATIO; // 按A4比例计算高度

const PAGE_SPACING = 30; // 页面间距

// 缩放配置
const MIN_SCALE = 0.5;
const MAX_SCALE = 3.0;
const DEFAULT_SCALE = 1.0;

/**
 * 页面分隔器组件
 * 显示淡淡的横线，居中位置有三个圆点
 */
const PageSeparator = ({ colors }) => (
  <View style={styles.separatorContainer}>
    {/* 左侧横线 */}
    <View style={[styles.separatorLine, { backgroundColor: colors.border }]} />

    {/* 居中的三个圆点 */}
    <View style={styles.dotsContainer}>
      <View style={[styles.separatorDot, { backgroundColor: colors.textSecondary || '#666' }]} />
      <View style={[styles.separatorDot, { backgroundColor: colors.textSecondary || '#666' }]} />
      <View style={[styles.separatorDot, { backgroundColor: colors.textSecondary || '#666' }]} />
    </View>

    {/* 右侧横线 */}
    <View style={[styles.separatorLine, { backgroundColor: colors.border }]} />
  </View>
);

/**
 * ✅ 优化的页面渲染器组件 - 分层渲染与缓存
 * 支持懒加载、内存管理和分层渲染
 */
const PageRenderer = React.memo(({ 
  noteStyle, 
  colors, 
  pageData, 
  onTouchStart, 
  onTouchMove, 
  onTouchEnd, 
  drawingEngine, 
  currentTool, 
  isDrawing, 
  currentLiveStroke, 
  isManualMode,
  // 调试信息相关的 props
  memoryUsage = 0,
  memoryState = 'NORMAL',
  pendingChangesCount = 0,
  currentGesture = null,
  gesturePressure = 1.0,
  gesturePrediction = null,
  renderQuality = 'HIGH',
  renderState = 'IDLE',
  frameRate = 60,
  gpuAcceleration = true,
  // 添加缺失的调试信息 props
  gestureServiceStatus = null,
  platformCompatibility = null
}) => {
  // ✅ 渲染管线优化：根据当前状态调整渲染质量 - 优化：使用useMemo缓存
  const adaptiveQuality = useMemo(() => {
    try {
      return renderPipelineService.getAdaptiveQuality();
    } catch (error) {
      console.warn('⚠️ [PageRenderer] 获取自适应质量失败:', error);
      return 'HIGH';
    }
  }, [renderQuality]);
  
  const shouldUseGPU = useMemo(() => {
    try {
      return renderPipelineService.shouldUseGPUAcceleration();
    } catch (error) {
      console.warn('⚠️ [PageRenderer] 获取GPU加速状态失败:', error);
      return true;
    }
  }, [gpuAcceleration]);
  
  // ✅ 缓存历史笔画的Path和Paint - 优化：添加安全检查
  const cachedStrokes = useMemo(() => {
    if (!pageData?.strokes || !drawingEngine) return [];
    
    try {
      return pageData.strokes.map(stroke => {
        // 如果stroke已有缓存，直接使用
        if (stroke.cachePath && stroke.cachePaint) {
          return stroke;
        }
        
        // 否则计算并缓存Path和Paint
        const cachePath = drawingEngine.createStrokePath(stroke.points, stroke.tool);
        const cachePaint = drawingEngine.getToolConfig(stroke.tool);
        
        return {
          ...stroke,
          cachePath,
          cachePaint
        };
      });
    } catch (error) {
      console.error('❌ [PageRenderer] 缓存笔画失败:', error);
      return [];
    }
  }, [pageData?.strokes, drawingEngine]);

  return (
    <View style={styles.pageContainer}>
      {/* 页面内容区域 */}
      <View style={[styles.pageContent, {
        width: PAGE_WIDTH,
        height: PAGE_HEIGHT,
        backgroundColor: '#FFFFFF',
        borderRadius: 8,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      }]}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}>
        {/* 背景层 */}
        <Canvas 
          style={[styles.backgroundCanvas, { backgroundColor: 'transparent' }]}
          // ✅ 渲染管线优化：启用GPU加速和自适应质量
          gpuAcceleration={shouldUseGPU}
          renderQuality={adaptiveQuality}
        >
          {renderPageBackground(noteStyle, PAGE_WIDTH, PAGE_HEIGHT)}
        </Canvas>

        {/* ✅ 分层绘制层 - 使用离屏渲染优化 */}
        <Canvas 
          style={[styles.drawingCanvas, { backgroundColor: 'transparent' }]}
          // ✅ 渲染管线优化：启用GPU加速和自适应质量
          gpuAcceleration={shouldUseGPU}
          renderQuality={adaptiveQuality}
        >
          <Group>
            {/* 历史笔画层：使用离屏渲染的Picture，避免重复计算 */}
            {cachedStrokes.length > 0 && renderLayerStrokes(cachedStrokes, drawingEngine)}
          </Group>
          
          <Group>
            {/* 当前笔画层：只渲染当前笔画，不影响历史层 */}
            {isDrawing && currentLiveStroke && 
              renderStroke(currentLiveStroke, drawingEngine)}
          </Group>
        </Canvas>

        {/* 调试信息 */}
        {__DEV__ && (
          <View style={{ position: 'absolute', top: 10, left: 10, backgroundColor: 'rgba(0,0,0,0.7)', padding: 5, borderRadius: 3 }}>
            <Text style={{ color: 'white', fontSize: 10 }}>
              Style: {noteStyle} | W: {PAGE_WIDTH} | H: {PAGE_HEIGHT}
            </Text>
            <Text style={{ color: 'white', fontSize: 10 }}>
              {`Mode: ${isManualMode ? '书写' : '滚动'} | Tool: ${String(currentTool)} | Drawing: ${isDrawing ? 'Yes' : 'No'}`}
            </Text>
            <Text style={{ color: 'white', fontSize: 10 }}>
              {`Cached Strokes: ${cachedStrokes.length}`}
            </Text>
            <Text style={{ color: 'white', fontSize: 10 }}>
              {`Memory: ${Math.round(memoryUsage / 1024 / 1024)}MB | State: ${memoryState}`}
            </Text>
            <Text style={{ color: 'white', fontSize: 10 }}>
              {`Pending Changes: ${pendingChangesCount}`}
            </Text>
            <Text style={{ color: 'white', fontSize: 10 }}>
              {`Gesture: ${currentGesture || 'None'} | Pressure: ${gesturePressure.toFixed(2)}`}
            </Text>
            <Text style={{ color: 'white', fontSize: 10 }}>
              {`Gesture Service: ${gestureServiceStatus?.initialized ? '✅' : '❌'} | Platform: ${platformCompatibility?.features?.advancedGestures ? '✅' : '❌'}`}
            </Text>
            {gesturePrediction && (
              <Text style={{ color: 'white', fontSize: 10 }}>
                {`Prediction: (${gesturePrediction.x.toFixed(1)}, ${gesturePrediction.y.toFixed(1)})`}
              </Text>
            )}
            <Text style={{ color: 'white', fontSize: 10 }}>
              {`Render Quality: ${renderQuality} | State: ${renderState}`}
            </Text>
            <Text style={{ color: 'white', fontSize: 10 }}>
              {`Frame Rate: ${frameRate}fps | GPU: ${gpuAcceleration ? 'Yes' : 'No'}`}
            </Text>
            <Text style={{ color: gestureServiceStatus?.initialized ? 'lightgreen' : 'orange', fontSize: 10 }}>
              {`Gesture Service: ${gestureServiceStatus?.initialized ? 'OK' : 'FAILED'}`}
            </Text>
            {gestureServiceStatus?.error && (
              <Text style={{ color: 'red', fontSize: 10 }}>
                {`Error: ${gestureServiceStatus.error}`}
              </Text>
            )}
            <Text style={{ color: 'white', fontSize: 10 }}>
              {`Platform: ${platformCompatibility.platform} | Manual: ${platformCompatibility.gestureManualSupported ? 'Yes' : 'No'}`}
            </Text>
            <Text style={{ color: 'white', fontSize: 10 }}>
              {`Pressure: ${platformCompatibility.features.pressureSensing ? 'Yes' : 'No'} | Prediction: ${platformCompatibility.features.gesturePrediction ? 'Yes' : 'No'}`}
            </Text>
          </View>
        )}
      </View>

      {/* 页面分隔器 */}
      <PageSeparator colors={colors} />
    </View>
  );
});

/**
 * 分页笔记主组件
 */
const SkiaPagedCanvasScreen = ({ route, navigation }) => {
  const { title = '分页笔记', noteId, noteStyle = 'blank', createNew = false } = route.params || {};
  const { colors } = useTheme();
  const dispatch = useDispatch();

  // 检测是否频繁重新初始化
  const renderCountRef = useRef(0);
  renderCountRef.current += 1;
  console.log('🚀 [初始化] SkiaPagedCanvasScreen 渲染次数:', renderCountRef.current, { title, noteId, noteStyle, createNew });
  console.log('📐 [初始化] 屏幕和页面尺寸:', {
    screenWidth,
    screenHeight,
    PAGE_WIDTH,
    PAGE_HEIGHT,
    PAGE_MARGIN
  });

  // ==================== 状态管理 ====================
  
  // ✅ UI线程状态（高频更新 - useSharedValue）
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedScale = useSharedValue(1);
  const startTranslateY = useSharedValue(0);
  const isDrawingShared = useSharedValue(false);
  const currentStrokePoints = useSharedValue([]);
  
  // ✅ 手写绘制状态（原生线程管理）
  const currentLiveStroke = useSharedValue(null);
  const isManualModeShared = useSharedValue(false);
  const currentToolShared = useSharedValue('pen');
  const currentColorShared = useSharedValue('#000000');
  const currentStrokeWidthShared = useSharedValue(2);
  
  // ✅ JS线程状态（低频更新 - useState）
  const [isLoading, setIsLoading] = useState(true);
  const [noteData, setNoteData] = useState(null);
  const [content, setContent] = useState('');
  const [noteTitle, setNoteTitle] = useState(title);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  
  // 分页状态
  const [pages, setPages] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  
  // UI状态（低频更新）
  const [showZoomIndicator, setShowZoomIndicator] = useState(false);
  const [scrollPosition, setScrollPosition] = useState({ x: 0, y: 0 });
  const [currentNoteStyle, setCurrentNoteStyle] = useState(noteStyle);
  
  // 绘制工具状态
  const [currentTool, setCurrentTool] = useState('pen');
  const [currentColor, setCurrentColor] = useState('#000000');
  const [currentStrokeWidth, setCurrentStrokeWidth] = useState(2);
  const [currentStroke, setCurrentStroke] = useState(null);
  const [isManualMode, setIsManualMode] = useState(false); // false=滚动模式, true=书写模式
  
  // ✅ 同步Shared Values与JS状态
  useEffect(() => {
    isManualModeShared.value = isManualMode;
  }, [isManualMode]);
  
  useEffect(() => {
    currentToolShared.value = currentTool;
  }, [currentTool]);
  
  useEffect(() => {
    currentColorShared.value = currentColor;
  }, [currentColor]);
  
  useEffect(() => {
    currentStrokeWidthShared.value = currentStrokeWidth;
  }, [currentStrokeWidth]);
  
  // ✅ Refs
  const drawingEngineRef = useRef(null);
  const maxScrollY = useRef(0);
  const scrollViewRef = useRef(null);
  const lastContentOffsetRef = useRef({ x: 0, y: 0 });
  
  // ✅ 智能内存管理状态
  const [memoryState, setMemoryState] = useState(MEMORY_STATE.NORMAL);
  const [memoryUsage, setMemoryUsage] = useState(0);
  const [pendingChangesCount, setPendingChangesCount] = useState(0);
  
  // ✅ 高级手势处理状态
  const [currentGesture, setCurrentGesture] = useState(null);
  const [gesturePressure, setGesturePressure] = useState(1.0);
  const [gesturePrediction, setGesturePrediction] = useState(null);

  // ✅ 渲染管线状态
  const [renderQuality, setRenderQuality] = useState(RENDER_QUALITY.HIGH);
  const [renderState, setRenderState] = useState(RENDER_STATE.IDLE);
  const [frameRate, setFrameRate] = useState(60);
  const [gpuAcceleration, setGpuAcceleration] = useState(true);
  
  // ✅ 服务状态检查
  const [gestureServiceStatus, setGestureServiceStatus] = useState({
    initialized: false,
    health: { predictor: false, pressureProcessor: false, recognizer: false, overall: false },
    error: null
  });
  
  // ✅ 平台兼容性状态
  const [platformCompatibility, setPlatformCompatibility] = useState({
    gestureManualSupported: false,
    pressureSensingSupported: false,
    platform: Platform.OS,
    features: {
      advancedGestures: false,
      pressureSensing: false,
      gesturePrediction: false
    }
  });
  
  // ✅ 性能监控状态
  const [performanceMetrics, setPerformanceMetrics] = useState({
    gestureResponseTime: 0,
    frameDrops: 0,
    memoryUsage: 0,
    lastUpdateTime: Date.now()
  });
  
  // 打印初始状态
  console.log('🔍 [初始化] 当前模式:', isManualMode ? '书写模式' : '滚动模式');

  // 笔记样式配置 - 支持6种样式（从NoteStyleModal导入）
  const noteStylesMap = {
    blank: {
      backgroundColor: '#FFFFFF',
      pattern: null,
      name: '空白笔记',
      description: '纯白色背景，适合自由书写和绘画'
    },
    lined: {
      backgroundColor: '#FFFFFF',
      pattern: 'lines',
      name: '横线笔记',
      description: '横线背景，适合文字书写和笔记'
    },
    grid: {
      backgroundColor: '#FFFFFF',
      pattern: 'grid',
      name: '方格笔记',
      description: '网格背景，适合绘制图表和几何图形'
    },
    dotted: {
      backgroundColor: '#FFFFFF',
      pattern: 'dots',
      name: '点阵笔记',
      description: '点阵背景，适合手写和创意绘画'
    },
    yellow_lined: {
      backgroundColor: '#FFF8DC',
      pattern: 'lines',
      name: '淡黄横线',
      description: '温暖的淡黄色横线背景，护眼舒适'
    },
    cornell: {
      backgroundColor: '#FFFFFF',
      pattern: 'cornell',
      name: '康奈尔笔记',
      description: '康奈尔笔记格式，适合学习和整理'
    }
  };

  const currentNoteStyleData = noteStylesMap[currentNoteStyle] || noteStylesMap.blank;

  // 渲染横线背景
  const renderLinesPattern = () => {
    const lineSpacing = 30;
    const lineCount = Math.floor(PAGE_HEIGHT / lineSpacing);
    return Array.from({ length: lineCount }, (_, index) => (
      <View
        key={index}
        style={[
          styles.line,
          { top: (index + 1) * lineSpacing }
        ]}
      />
    ));
  };

  // 渲染网格背景
  const renderGridPattern = () => {
    const gridSize = 20;
    const lines = [];

    // 垂直线
    for (let x = 0; x < PAGE_WIDTH; x += gridSize) {
      lines.push(
        <View
          key={`v-${x}`}
          style={[
            styles.gridLine,
            { left: x, width: 1, height: PAGE_HEIGHT }
          ]}
        />
      );
    }

    // 水平线
    for (let y = 0; y < PAGE_HEIGHT; y += gridSize) {
      lines.push(
        <View
          key={`h-${y}`}
          style={[
            styles.gridLine,
            { top: y, height: 1, width: PAGE_WIDTH }
          ]}
        />
      );
    }

    return lines;
  };

  // 渲染点阵背景
  const renderDotsPattern = () => {
    const dotSpacing = 20;
    const dots = [];

    for (let x = dotSpacing; x < PAGE_WIDTH; x += dotSpacing) {
      for (let y = dotSpacing; y < PAGE_HEIGHT; y += dotSpacing) {
        dots.push(
          <View
            key={`dot-${x}-${y}`}
            style={[
              styles.dot,
              { left: x, top: y }
            ]}
          />
        );
      }
    }

    return dots;
  };

  // 渲染康奈尔笔记背景
  const renderCornellPattern = () => {
    const lines = [];

    // 左侧分割线（约1/4处）
    const leftMargin = PAGE_WIDTH * 0.25;
    lines.push(
      <View
        key="cornell-left"
        style={[
          styles.gridLine,
          { left: leftMargin, width: 1, height: PAGE_HEIGHT }
        ]}
      />
    );

    // 底部分割线（约3/4处）
    const bottomMargin = PAGE_HEIGHT * 0.75;
    lines.push(
      <View
        key="cornell-bottom"
        style={[
          styles.gridLine,
          { top: bottomMargin, height: 1, width: PAGE_WIDTH }
        ]}
      />
    );

    // 右侧区域的横线
    const lineSpacing = 30;
    for (let y = lineSpacing; y < bottomMargin; y += lineSpacing) {
      lines.push(
        <View
          key={`cornell-line-${y}`}
          style={[
            styles.line,
            {
              top: y,
              left: leftMargin + 10,
              width: PAGE_WIDTH - leftMargin - 30,
              backgroundColor: '#E0E0E0',
              opacity: 0.6
            }
          ]}
        />
      );
    }

    return lines;
  };

  // 返回处理
  const handleGoBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Home');
    }
  };

  // 创建新笔记
  const createNewNote = async () => {
    try {
      // ✅ 优先使用传入的noteId，如果没有则生成新ID
      const newNoteId = noteId || `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const newNote = {
        _id: newNoteId,
        id: newNoteId,
        title: noteTitle || '新建笔记',
        content: content || '',
        type: 'paged_note', // 确保type字段正确设置
        noteType: 'paged_note',
        file_type: 'paged_note',
        noteStyle: currentNoteStyle,
        pages: [{ content: '', pageNumber: 1, strokes: [] }], // 确保pages字段包含strokes
        totalPages: 1,
        currentPage: 1,
        scale: 1.0,
        scrollPosition: { x: 0, y: 0 },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        user_id: 'current_user',
        is_deleted: false,
        is_synced: false,
        isNew: true,
        file_uri: `paged_note://${newNoteId}`,
        uri: `paged_note://${newNoteId}`,
        // 添加分页笔记特有的元数据
        metadata: JSON.stringify({
          noteType: 'paged_note',
          version: '1.0',
          features: ['pagination', 'drawing', 'scaling']
        })
      };

      // 使用类型识别服务验证笔记类型
      const validation = noteTypeDetectionService.validateNoteType(newNote, 'paged_note');
      if (!validation.isValid) {
        if (__DEV__) {
          console.warn('🔍 分页笔记类型验证失败，尝试修复:', validation);
        }
        const fixedNote = noteTypeDetectionService.fixNoteType(newNote);
        Object.assign(newNote, fixedNote);
      }

      const result = await offlineStorageService.saveNote(newNote);

      if (result.success) {
        const savedNote = result.note || newNote;
        const finalNote = {
          ...savedNote,
          id: savedNote.id || savedNote._id || newNoteId,
          _id: savedNote._id || savedNote.id || newNoteId,
          file_uri: savedNote.file_uri || `paged_note://${savedNote.id || savedNote._id || newNoteId}`,
          uri: savedNote.uri || `paged_note://${savedNote.id || savedNote._id || newNoteId}`
        };

        setNoteData(finalNote);
        const initialPages = finalNote.pages || [
          { content: '第一页内容', pageNumber: 1 },
          { content: '第二页内容', pageNumber: 2 },
          { content: '第三页内容', pageNumber: 3 }
        ];
        const safeInitialPages = Array.isArray(initialPages) ? initialPages : [
          { content: '第一页内容', pageNumber: 1 },
          { content: '第二页内容', pageNumber: 2 },
          { content: '第三页内容', pageNumber: 3 }
        ];
        setPages(safeInitialPages);
        setTotalPages(safeInitialPages.length);

        dispatch(addNote(finalNote));
        if (__DEV__) {
          console.log('新笔记创建成功:', finalNote.id);
        }
        return finalNote;
      } else {
        throw new Error('保存失败');
      }
    } catch (error) {
      console.error('创建新笔记失败:', error);
      Alert.alert('错误', '创建笔记失败，请重试');
      return null;
    }
  };

  // 保存笔记数据
  const saveNoteData = async () => {
    try {
      // ✅ 采用CardNoteScreen的安全策略：只在noteData有效时保存
      if (!noteData) {
        if (__DEV__) {
          console.warn('⚠️ [SkiaPagedCanvas] noteData为空，跳过保存');
        }
        return false;
      }

      // ✅ 额外检查：确保noteData有有效的ID
      if (!noteData._id && !noteData.id) {
        if (__DEV__) {
          console.warn('⚠️ [SkiaPagedCanvas] noteData缺少ID，跳过保存');
        }
        return false;
      }

      const updatedNote = {
        ...noteData,
        title: noteTitle,
        content: content,
        pages: Array.isArray(pages) ? pages : [{ content: content || '', pageNumber: 1 }],
        noteStyle: currentNoteStyle,
        noteType: 'paged_note',
        // 保存状态信息
        currentPage: currentPage,
        scale: scale.value,
        scrollPosition: { x: translateX.value, y: translateY.value },
        totalPages: totalPages,
        updated_at: new Date().toISOString(),
        file_uri: noteData.file_uri || `paged_note://${noteData.id || noteData._id}`,
        uri: noteData.uri || `paged_note://${noteData.id || noteData._id}`,
        // 清理可能有问题的字段
        tags: Array.isArray(noteData.tags) ? noteData.tags : []
      };

      const result = await offlineStorageService.saveNote(updatedNote);

      if (result.success) {
        const savedNote = result.note || updatedNote;
        const finalNote = {
          ...savedNote,
          id: savedNote.id || savedNote._id || updatedNote.id,
          _id: savedNote._id || savedNote.id || updatedNote.id,
          file_uri: savedNote.file_uri || `paged_note://${savedNote.id || savedNote._id || updatedNote.id}`,
          uri: savedNote.uri || `paged_note://${savedNote.id || savedNote._id || updatedNote.id}`
        };

        setNoteData(finalNote);
        // ✅ 使用同步action直接更新Redux状态，避免触发二次保存
        dispatch(updateOneNote({
          id: finalNote.id || finalNote._id,
          changes: finalNote
        }));
        if (__DEV__) {
          console.log('✅ [SkiaPagedCanvas] 笔记保存成功:', finalNote.id);
        }
        return true;
      } else {
        throw new Error('保存失败');
      }
    } catch (error) {
      console.error('❌ [SkiaPagedCanvas] 保存笔记失败:', error);
      Alert.alert('保存失败', '笔记保存失败，请稍后重试');
      return false;
    }
  };

  // 加载笔记数据
  const loadNoteData = async () => {
    try {
      setIsLoading(true);
      if (__DEV__) {
        console.log('开始加载笔记, noteId:', noteId, 'createNew:', createNew);
      }

      if (noteId) {
        // 尝试加载现有笔记
        const existingNote = await offlineStorageService.getNote(noteId);
        if (existingNote) {
          if (__DEV__) {
            console.log('找到现有笔记:', existingNote.id);
          }

          const unifiedNote = {
            ...existingNote,
            id: existingNote.id || existingNote._id,
            _id: existingNote._id || existingNote.id,
            file_uri: existingNote.file_uri || `paged_note://${existingNote.id || existingNote._id}`,
            uri: existingNote.uri || `paged_note://${existingNote.id || existingNote._id}`
          };

          setNoteData(unifiedNote);
          setContent(unifiedNote.content || '');
          setNoteTitle(unifiedNote.title || '新建笔记');

          if (unifiedNote.noteStyle) {
            setCurrentNoteStyle(unifiedNote.noteStyle);
          }

          // 处理分页数据
          let notePages = [];
          if (unifiedNote.pages) {
            if (typeof unifiedNote.pages === 'string') {
              try {
                notePages = JSON.parse(unifiedNote.pages);
              } catch (parseError) {
                if (__DEV__) {
                  console.warn('解析pages字段失败:', parseError);
                }
                notePages = [{ content: unifiedNote.content || '', pageNumber: 1 }];
              }
            } else if (Array.isArray(unifiedNote.pages)) {
              notePages = unifiedNote.pages;
            } else {
              notePages = [{ content: unifiedNote.content || '', pageNumber: 1 }];
            }
          } else {
            notePages = [
              { content: unifiedNote.content || '第一页内容', pageNumber: 1 },
              { content: '第二页内容', pageNumber: 2 },
              { content: '第三页内容', pageNumber: 3 }
            ];
          }

          const safeNotePages = Array.isArray(notePages) && notePages.length > 0 ? notePages : [
            { content: unifiedNote.content || '第一页内容', pageNumber: 1 },
            { content: '第二页内容', pageNumber: 2 },
            { content: '第三页内容', pageNumber: 3 }
          ];
          setPages(safeNotePages);
          setTotalPages(safeNotePages.length);

          setIsLoading(false);
          return;
        } else if (createNew) {
          const newNote = await createNewNote();
          if (newNote) {
            setIsLoading(false);
            return;
          }
        }
      } else if (createNew) {
        const newNote = await createNewNote();
        if (newNote) {
          setIsLoading(false);
          return;
        }
      }

      setIsLoading(false);
    } catch (error) {
      console.error('加载笔记失败:', error);
      Alert.alert('错误', '加载笔记失败，请重试');
      setIsLoading(false);
    }
  };

  // 组件挂载时加载数据
  useEffect(() => {
    loadNoteData();
  }, [noteId, createNew]);

  // 简化渲染逻辑 - 移除虚拟化，直接渲染所有页面

  // 滚动状态管理已移除

  // 添加新页面
  const addNewPage = () => {
    const newPage = {
      content: '',
      pageNumber: totalPages + 1
    };

    setPages(prev => {
      const safePrev = Array.isArray(prev) ? prev : [];
      if (__DEV__ && !Array.isArray(prev)) {
        console.log('addNewPage - prev类型:', typeof prev, 'prev值:', prev, 'safePrev:', safePrev);
      }
      return [...safePrev, newPage];
    });
    setTotalPages(prev => prev + 1);
    setCurrentPage(totalPages + 1);
  };

  // 更新当前页面内容
  const updateCurrentPageContent = (newContent) => {
    setPages(prev => {
      const safePrev = Array.isArray(prev) ? prev : [];
      if (__DEV__ && !Array.isArray(prev)) {
        console.log('updateCurrentPageContent - prev类型:', typeof prev, 'prev值:', prev, 'safePrev:', safePrev);
      }
      return safePrev.map((page, index) =>
        index === currentPage - 1
          ? { ...page, content: newContent }
          : page
      );
    });
    setContent(newContent);

    // 同时更新noteData中的content字段
    if (noteData) {
      setNoteData(prev => ({
        ...prev,
        content: newContent
      }));
    }
  };


  // ScrollView不需要复杂的边界约束，原生处理

  // 缩放由PanResponder处理

  // 滚动由ScrollView处理，缩放由PanResponder处理

  // 初始化加载
  useEffect(() => {
    const initializeNote = async () => {
      try {
        if (createNew) {
          // ✅ 创建新笔记：调用createNewNote函数创建完整的笔记对象并保存到数据库
          if (__DEV__) {
            console.log('🆕 [SkiaPagedCanvas] 创建新笔记，noteId:', noteId);
          }
          const newNote = await createNewNote();
          if (newNote) {
            if (__DEV__) {
              console.log('✅ [SkiaPagedCanvas] 新笔记创建完成:', newNote.id || newNote._id);
            }
          }
        } else if (noteId) {
          // 加载现有笔记
          if (__DEV__) {
            console.log('📂 [SkiaPagedCanvas] 加载现有笔记，noteId:', noteId);
          }
          const existingNote = await offlineStorageService.getNote(noteId);
          if (existingNote) {
            setNoteData(existingNote);
            setNoteTitle(existingNote.title || noteTitle);
            setCurrentNoteStyle(existingNote.noteStyle || noteStyle);
            setTotalPages(existingNote.totalPages || 1);

            // 恢复状态信息
            scale.value = existingNote.scale || 1;
            savedScale.value = existingNote.scale || 1;
            setCurrentPage(existingNote.currentPage || 1);
            const scrollPos = existingNote.scrollPosition || { x: 0, y: 0 };
            translateX.value = scrollPos.x;
            translateY.value = scrollPos.y;
            setScrollPosition(scrollPos);
            
            // 恢复页面数据
            if (existingNote.pages && Array.isArray(existingNote.pages)) {
              setPages(existingNote.pages);
            }

            if (__DEV__) {
              console.log('📖 [SkiaPagedCanvas] 恢复笔记状态:', {
                currentPage: existingNote.currentPage || 1,
                scale: existingNote.scale || 1,
                scrollPosition: existingNote.scrollPosition || { x: 0, y: 0 },
                totalPages: existingNote.totalPages || 1
              });
            }
          } else {
            if (__DEV__) {
              console.warn('⚠️ [SkiaPagedCanvas] 未找到笔记，noteId:', noteId);
            }
          }
        }
      } catch (error) {
        console.error('❌ [SkiaPagedCanvas] 初始化笔记失败:', error);
        Alert.alert('错误', '加载笔记失败，请重试');
      } finally {
        setIsLoading(false);
      }
    };

    initializeNote();
  }, [noteId, createNew]); // ✅ 移除noteStyle和noteTitle依赖，避免不必要的重新初始化

  // 恢复滚动位置 - 在加载完成后执行
  useEffect(() => {
    if (!isLoading && scrollPosition.y > 0) {
      // 延迟恢复滚动位置，使用Shared Value更新位置
      setTimeout(() => {
        translateY.value = withSpring(scrollPosition.y, {
          damping: 20,
          stiffness: 90,
        });
        if (__DEV__) {
          console.log('📍 恢复滚动位置:', scrollPosition);
        }
      }, 100);
    }
  }, [isLoading, scrollPosition]);

  // 添加到文件历史记录
  useEffect(() => {
    if (noteId && noteTitle) {
      fileHistoryService.addFile({
        uri: `paged_note://${noteId}`,
        title: noteTitle,
        type: 'paged_note',
        fileName: noteTitle,
        noteId,
        noteType: 'paged_note'
      });
    }
  }, [noteId, noteTitle]);

  // ✅ 检查手势服务状态 - 优化：添加更好的错误处理和降级机制
  useEffect(() => {
    const checkGestureService = async () => {
      try {
        console.log('🔍 [Gesture] 检查手势服务状态...');
        
        // 检查高级手势服务状态
        const serviceStatus = advancedGestureService.getStatus();
        console.log('📊 [Gesture] 手势服务状态:', serviceStatus);
        
        // 只在状态真正改变时才更新
        setGestureServiceStatus(prevStatus => {
          if (prevStatus.initialized === serviceStatus.initialized && 
              prevStatus.error === serviceStatus.error) {
            return prevStatus; // 避免不必要的重新渲染
          }
          return {
            initialized: serviceStatus.initialized,
            health: serviceStatus.health,
            error: serviceStatus.error
          };
        });
        
        // 如果服务未初始化，尝试重新初始化（最多3次）
        if (!serviceStatus.initialized) {
          console.log('🔄 [Gesture] 尝试重新初始化手势服务...');
          let retryCount = 0;
          const maxRetries = 3;
          
          while (retryCount < maxRetries && !serviceStatus.initialized) {
            try {
              await advancedGestureService.reinitialize();
              const newStatus = advancedGestureService.getStatus();
              
              if (newStatus.initialized) {
                console.log('✅ [Gesture] 手势服务重新初始化成功');
                setGestureServiceStatus({
                  initialized: newStatus.initialized,
                  health: newStatus.health,
                  error: newStatus.error
                });
                break;
              } else {
                retryCount++;
                console.warn(`⚠️ [Gesture] 手势服务初始化失败，重试 ${retryCount}/${maxRetries}`);
                await new Promise(resolve => setTimeout(resolve, 1000)); // 等待1秒后重试
              }
            } catch (retryError) {
              retryCount++;
              console.error(`❌ [Gesture] 手势服务重试失败 ${retryCount}/${maxRetries}:`, retryError);
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
          
          // 如果所有重试都失败，使用降级模式
          if (!serviceStatus.initialized) {
            console.warn('⚠️ [Gesture] 手势服务初始化失败，使用降级模式');
            setGestureServiceStatus({
              initialized: false,
              health: { predictor: false, pressureProcessor: false, recognizer: false, overall: false },
              error: '手势服务初始化失败，使用降级模式'
            });
          }
        }
      } catch (error) {
        console.error('❌ [Gesture] 检查手势服务失败:', error);
        setGestureServiceStatus(prevStatus => {
          if (prevStatus.initialized === false && prevStatus.error === error.message) {
            return prevStatus;
          }
          return {
            initialized: false,
            health: { predictor: false, pressureProcessor: false, recognizer: false, overall: false },
            error: error.message
          };
        });
      }
    };
    
    checkGestureService();
  }, []);

  // ✅ 手势服务健康监控 - 优化：减少监控频率，避免频繁重新渲染
  useEffect(() => {
    const monitorGestureService = () => {
      if (!gestureServiceStatus.initialized) {
        console.warn('⚠️ [Gesture] 手势服务未初始化，功能受限');
        
        // 尝试自动恢复
        const attemptRecovery = async () => {
          try {
            console.log('🔄 [Gesture] 尝试自动恢复手势服务...');
            await advancedGestureService.reinitialize();
            
            const newStatus = advancedGestureService.getStatus();
            setGestureServiceStatus({
              initialized: newStatus.initialized,
              health: newStatus.health,
              error: newStatus.error
            });
            
            if (newStatus.initialized) {
              console.log('✅ [Gesture] 手势服务自动恢复成功');
            }
          } catch (error) {
            console.error('❌ [Gesture] 自动恢复失败:', error);
          }
        };
        
        // 延迟5秒后尝试恢复
        setTimeout(attemptRecovery, 5000);
      }
    };
    
    // 仅在服务未初始化时执行监控，避免重复执行
    if (!gestureServiceStatus.initialized) {
      monitorGestureService();
    }
  }, [gestureServiceStatus.initialized]);

  // ✅ 平台兼容性检测 - 优化：移除对gestureServiceStatus的依赖，避免循环渲染
  useEffect(() => {
    const detectPlatformCompatibility = () => {
      try {
        console.log('🔍 [Platform] 检测平台兼容性...');
        
        // 检测Gesture.Manual()支持性
        let gestureManualSupported = false;
        try {
          // 尝试创建Gesture.Manual()来检测支持性
          const testGesture = Gesture.Manual();
          gestureManualSupported = true;
          console.log('✅ [Platform] Gesture.Manual() 支持');
        } catch (error) {
          console.warn('⚠️ [Platform] Gesture.Manual() 不支持:', error.message);
        }
        
        // 检测压力感应支持性
        const pressureSensingSupported = Platform.OS === 'ios';
        
        // 基础平台兼容性（不依赖手势服务状态）
        const compatibility = {
          gestureManualSupported,
          pressureSensingSupported,
          platform: Platform.OS,
          features: {
            advancedGestures: gestureManualSupported, // 仅基于平台支持性
            pressureSensing: pressureSensingSupported,
            gesturePrediction: gestureManualSupported // 仅基于平台支持性
          }
        };
        
        console.log('📊 [Platform] 平台兼容性:', compatibility);
        setPlatformCompatibility(prevCompatibility => {
          // 只在兼容性真正改变时才更新
          if (prevCompatibility.gestureManualSupported === compatibility.gestureManualSupported &&
              prevCompatibility.pressureSensingSupported === compatibility.pressureSensingSupported &&
              prevCompatibility.platform === compatibility.platform) {
            return prevCompatibility;
          }
          return compatibility;
        });
        
      } catch (error) {
        console.error('❌ [Platform] 平台兼容性检测失败:', error);
        setPlatformCompatibility({
          gestureManualSupported: false,
          pressureSensingSupported: false,
          platform: Platform.OS,
          features: {
            advancedGestures: false,
            pressureSensing: false,
            gesturePrediction: false
          }
        });
      }
    };
    
    detectPlatformCompatibility();
  }, []); // 移除依赖，仅在组件挂载时执行一次

  // ✅ 性能监控（已禁用，等待进一步调试）
  // useEffect(() => {
  //   const monitorPerformance = () => {
  //     try {
  //       const now = Date.now();
  //       const timeSinceLastUpdate = now - (performanceMetrics?.lastUpdateTime || now);
  //       
  //       // 计算帧率
  //       const targetFrameTime = 16.67; // 60fps
  //       const frameDrops = Math.max(0, Math.floor(timeSinceLastUpdate / targetFrameTime) - 1);
  //       
  //       // 更新性能指标
  //       setPerformanceMetrics(prev => ({
  //         ...prev,
  //         frameDrops: prev.frameDrops + frameDrops,
  //         lastUpdateTime: now,
  //         memoryUsage: memoryUsage
  //       }));
  //       
  //       // 如果性能下降，调整渲染质量
  //       if (frameDrops > 5) {
  //         console.warn('⚠️ [Performance] 检测到性能下降，调整渲染质量');
  //         setRenderQuality(RENDER_QUALITY.MEDIUM);
  //       } else if (frameDrops === 0 && renderQuality !== RENDER_QUALITY.HIGH) {
  //         console.log('✅ [Performance] 性能良好，恢复高质量渲染');
  //         setRenderQuality(RENDER_QUALITY.HIGH);
  //       }
  //       
  //     } catch (error) {
  //       console.error('❌ [Performance] 性能监控失败:', error);
  //     }
  //   };
  //   
  //   // 每100ms检查一次性能
  //   const performanceInterval = setInterval(monitorPerformance, 100);
  //   
  //   return () => clearInterval(performanceInterval);
  // }, [memoryUsage, renderQuality]);

  // 初始化DrawingEngine
  useEffect(() => {
    if (PAGE_WIDTH && PAGE_HEIGHT) {
      drawingEngineRef.current = new DrawingEngine(PAGE_WIDTH, PAGE_HEIGHT);
    }
  }, [PAGE_WIDTH, PAGE_HEIGHT]);
  
  // ✅ 初始化智能内存管理
  useEffect(() => {
    // 注册增量保存回调
    incrementalSaveService.registerSaveCallback('addStroke', async (strokeData, metadata) => {
      if (noteData && noteData._id) {
        const currentPageIndex = metadata.pageIndex || 0;
        setPages(prevPages => {
          const updatedPages = [...prevPages];
          if (!updatedPages[currentPageIndex]) {
            updatedPages[currentPageIndex] = { content: '', pageNumber: currentPageIndex + 1, strokes: [] };
          }
          if (!updatedPages[currentPageIndex].strokes) {
            updatedPages[currentPageIndex].strokes = [];
          }
          updatedPages[currentPageIndex].strokes.push(strokeData);
          return updatedPages;
        });
      }
    });
    
    // 启动内存监控
    const memoryMonitor = setInterval(() => {
      const memoryInfo = memoryManager.getMemoryState();
      setMemoryState(memoryInfo.state);
      setMemoryUsage(memoryInfo.usage);
      setPendingChangesCount(incrementalSaveService.getPendingChangesCount());
    }, 5000);
    
    return () => {
      clearInterval(memoryMonitor);
      incrementalSaveService.destroy();
    };
  }, [noteData]);
  
  // ✅ 初始化高级手势处理
  useEffect(() => {
    // 注册手势回调
    advancedGestureService.registerCallback('touchStart', (data) => {
      setCurrentGesture(data.gestureType);
      setGesturePressure(data.pressure);
      console.log('🎯 [Gesture] 手势开始:', data.gestureType, '压力:', data.pressure);
    });
    
    advancedGestureService.registerCallback('touchMove', (data) => {
      setGesturePressure(data.pressure);
      setGesturePrediction(data.predictedPoint);
      
      // 根据手势类型调整绘制行为
      if (data.gestureChange) {
        setCurrentGesture(data.gestureChange);
        console.log('🎯 [Gesture] 手势变化:', data.gestureChange);
      }
    });
    
    advancedGestureService.registerCallback('touchEnd', (data) => {
      setCurrentGesture(data.finalGesture);
      setGesturePrediction(null);
      console.log('🎯 [Gesture] 手势结束:', data.finalGesture, '平滑点数:', data.smoothedPoints.length);
    });
    
    return () => {
      advancedGestureService.destroy();
    };
  }, []);

  // ✅ 初始化渲染管线服务
  useEffect(() => {
    // 注册渲染回调
    renderPipelineService.registerCallback('qualityChange', (quality) => {
      setRenderQuality(quality);
    });

    renderPipelineService.registerCallback('stateChange', (state) => {
      setRenderState(state);
    });

    renderPipelineService.registerCallback('frameRateChange', (rate) => {
      setFrameRate(rate);
    });

    renderPipelineService.registerCallback('gpuAccelerationChange', (enabled) => {
      setGpuAcceleration(enabled);
    });

    // 启动渲染管线
    renderPipelineService.start();

    return () => {
      renderPipelineService.stop();
    };
  }, []);



  // ==================== 计算属性 ====================
  
  // 计算最大滚动距离
  useEffect(() => {
    const pageHeight = PAGE_HEIGHT + PAGE_SPACING;
    maxScrollY.current = Math.max(0, totalPages * pageHeight - screenHeight / 2);
  }, [totalPages]);
  
  // 监听缩放变化，显示缩放指示器
  useEffect(() => {
    // 移除直接访问 scale.value，避免 Reanimated 警告
    // 缩放指示器将通过手势处理器控制
  }, [showZoomIndicator]);
  
  // ==================== 手势处理器 ====================
  
  // 平移手势（滚动）- 优化：使用useMemo稳定引用
  const panGesture = useMemo(() => {
    return Gesture.Pan()
      .enabled(!isManualMode)
      .onBegin(() => {
        'worklet';
        startTranslateY.value = translateY.value;
        runOnJS(setShowZoomIndicator)(false);
      })
      .onUpdate((e) => {
        'worklet';
        // 更新translateY实现滚动
        const newY = startTranslateY.value - e.translationY / scale.value;
        translateY.value = Math.max(0, Math.min(maxScrollY.current, newY));
        
        // 计算当前页面
        const pageHeight = PAGE_HEIGHT + PAGE_SPACING;
        const page = Math.round(translateY.value / pageHeight) + 1;
        if (page !== currentPage && page >= 1 && page <= totalPages) {
          runOnJS(setCurrentPage)(page);
        }
      })
      .onEnd(() => {
        'worklet';
        // 可选：添加惯性滚动
      });
  }, [isManualMode, currentPage, totalPages]);
  
  // 缩放手势（双指缩放）- 优化：使用useMemo稳定引用
  const pinchGesture = useMemo(() => {
    return Gesture.Pinch()
      .enabled(!isManualMode)
      .onBegin(() => {
        'worklet';
        savedScale.value = scale.value;
        runOnJS(setShowZoomIndicator)(true);
      })
      .onUpdate((e) => {
        'worklet';
        scale.value = Math.max(
          MIN_SCALE,
          Math.min(MAX_SCALE, savedScale.value * e.scale)
        );
      })
      .onEnd(() => {
        'worklet';
        savedScale.value = scale.value;
        
        // 使用 runOnJS 包装 setTimeout 调用
        runOnJS(() => {
          setTimeout(() => {
            setShowZoomIndicator(false);
          }, 2000);
        })();
      });
  }, [isManualMode]);
  
  // ✅ 降级绘制手势 - 当高级手势服务不可用时使用
  const fallbackDrawingGesture = useMemo(() => {
    try {
      return Gesture.Pan()
        .enabled(isManualMode)
        .minDistance(0)
        .onBegin((e) => {
          'worklet';
          if (!isManualModeShared.value) return;
          
          // 基础绘制开始
          const pressure = 1.0; // 降级模式不支持压力感应
          startDrawing(e.x, e.y, pressure, pressure);
        })
        .onUpdate((e) => {
          'worklet';
          if (!isDrawingShared.value) return;
          
          // 基础绘制更新
          const pressure = 1.0; // 降级模式不支持压力感应
          updateDrawing(e.x, e.y, pressure, pressure);
        })
        .onEnd((e) => {
          'worklet';
          if (!isDrawingShared.value) return;
          
          // 基础绘制结束
          const pressure = 1.0; // 降级模式不支持压力感应
          finishDrawing(e.x, e.y, pressure, pressure);
        });
    } catch (error) {
      console.error('❌ [Gesture] 创建降级绘制手势失败:', error);
      return null;
    }
  }, [startDrawing, updateDrawing, finishDrawing]);
  
  // ✅ 分层手势架构 - 基础手势层 + 高级手势层 + 降级机制
  const composedGesture = useMemo(() => {
    try {
      console.log('🔧 [Gesture] 构建分层手势架构...');
      
      // 检查基础手势（必须可用）
      if (!panGesture || !pinchGesture) {
        console.error('❌ [Gesture] 基础手势未正确初始化');
        return null;
      }
      
      // 基础手势层：始终可用的滚动和缩放
      const baseGestures = Gesture.Simultaneous(panGesture, pinchGesture);
      console.log('✅ [Gesture] 基础手势层已创建');
      
      // 检查高级手势服务状态和平台兼容性 - 添加安全检查
      const serviceHealthy = gestureServiceStatus?.initialized && 
                           gestureServiceStatus?.health?.overall;
      const platformCompatible = platformCompatibility?.features?.advancedGestures;
      
      if (!serviceHealthy || !platformCompatible) {
        console.warn('⚠️ [Gesture] 高级手势服务不可用或平台不兼容，使用基础手势');
        console.log('📊 [Gesture] 服务状态:', serviceHealthy, '平台兼容:', platformCompatible);
        return baseGestures;
      }
      
      // 检查drawingGesture是否可用
      if (!drawingGesture) {
        console.warn('⚠️ [Gesture] drawingGesture初始化失败，使用降级绘制手势');
        // 使用降级绘制手势
        if (fallbackDrawingGesture) {
          return Gesture.Race(
            fallbackDrawingGesture,
            baseGestures
          );
        } else {
          return baseGestures;
        }
      }
      
      // 高级手势层：完整的绘制功能
      console.log('✅ [Gesture] 高级手势层已创建');
      return Gesture.Race(
        drawingGesture,
        baseGestures
      );
      
    } catch (error) {
      console.error('❌ [Gesture] 创建分层手势失败:', error);
      // 降级到基础手势
      try {
        return Gesture.Simultaneous(panGesture, pinchGesture);
      } catch (fallbackError) {
        console.error('❌ [Gesture] 降级手势也失败:', fallbackError);
        return null;
      }
    }
  }, [drawingGesture, panGesture, pinchGesture, fallbackDrawingGesture]);

  // ❌ 禁用自动保存机制 - 避免卡顿，只在退出时保存
  // useEffect(() => {
  //   ... 自动保存逻辑已禁用 ...
  // }, [pages, currentPage, scale, noteTitle, currentNoteStyle, noteData]);

  // ✅ 组件卸载时保存和清理 - 同步保存，避免内存泄漏
  useEffect(() => {
    return () => {
      // ✅ 增强检查条件：确保noteData有有效ID
      if (noteData && noteData._id && !isLoading) {
        // 在保存前更新滚动位置
        const currentScrollPosition = { x: translateX.value, y: translateY.value };
        setScrollPosition(currentScrollPosition);
        
        // ✅ 同步保存，避免setTimeout导致的内存泄漏
        try {
          saveNoteData().catch(error => {
            if (__DEV__) {
              console.error('💾 [SkiaPagedCanvas] 组件卸载时保存失败:', error);
            }
          });
        } catch (error) {
          if (__DEV__) {
            console.error('💾 [SkiaPagedCanvas] 同步保存失败:', error);
          }
        }
      } else if (__DEV__) {
        console.log('⏭️ [SkiaPagedCanvas] 组件卸载：跳过保存（noteData无效或仍在加载）');
      }
      
      // ✅ 清理DrawingEngine缓存，释放内存
      if (drawingEngineRef.current) {
        drawingEngineRef.current.clearAllCache();
        if (__DEV__) {
          console.log('🧹 [SkiaPagedCanvas] 清理DrawingEngine缓存完成');
        }
      }
      
      // ✅ 强制保存所有待保存的变更
      try {
        incrementalSaveService.forceSave().then(() => {
          if (__DEV__) {
            console.log('💾 [SkiaPagedCanvas] 强制保存所有待保存变更完成');
          }
        }).catch(error => {
          console.error('❌ [SkiaPagedCanvas] 强制保存失败:', error);
        });
      } catch (error) {
        console.error('❌ [SkiaPagedCanvas] 强制保存失败:', error);
      }
      
      // ✅ 清理内存管理器
      memoryManager.clearAllCache();
      if (__DEV__) {
        console.log('🧹 [SkiaPagedCanvas] 清理内存管理器完成');
      }
    };
  }, []); // 保持空依赖数组，仅在卸载时执行

  // ✅ PanResponder已替换为Gesture Handler（见上方）

  // 规范化工具栏输入，防止把对象直接渲染到 Text
  const normalizeTool = useCallback((tool) => {
    if (typeof tool === 'string') return tool;
    if (tool && typeof tool === 'object') {
      return tool.id || tool.type || tool.key || 'pen';
    }
    return 'pen';
  }, []);

  const normalizeColor = useCallback((color) => {
    if (typeof color === 'string') return color;
    if (color && typeof color === 'object') {
      return color.hex || color.value || '#000000';
    }
    return '#000000';
  }, []);

  const normalizeWidth = useCallback((width) => {
    const n = Number(width);
    return Number.isFinite(n) && n > 0 ? n : 2;
  }, []);

  // 样式切换功能
  const handleStyleChange = useCallback((newStyle) => {
    setCurrentNoteStyle(newStyle);
    setShowStyleModal(false);

    // 更新笔记数据
    if (noteData) {
      const updatedNote = {
        ...noteData,
        noteStyle: newStyle,
        updated_at: new Date().toISOString(),
      };
      setNoteData(updatedNote);
    }
  }, [noteData]);

  // ✅ 高性能绘制函数 - 原生线程执行（worklet）
  const currentStrokeRef = useRef(null);
  const drawingStateRef = useRef({
    isDrawing: false,
    points: [], // 点缓冲区
    lastUpdateTime: 0,
  });
  
  // ✅ 原生线程绘制函数 - 集成高级手势处理，添加错误处理
  const startDrawing = useCallback((x, y, pressure = 1.0, force = 1.0) => {
    'worklet';
    if (!isManualModeShared.value) return;
    
    try {
      // ✅ 使用高级手势处理，添加错误处理
      if (advancedGestureService && typeof advancedGestureService.handleTouchStart === 'function') {
        runOnJS(advancedGestureService.handleTouchStart)(x, y, Date.now(), pressure, force);
      }
    } catch (error) {
      console.warn('⚠️ [Gesture] 高级手势处理失败，使用基础绘制:', error);
    }
    
    // 根据压力调整笔画宽度
    const adjustedWidth = currentStrokeWidthShared.value * (0.5 + pressure * 1.5);
    
    const newStroke = {
      id: `stroke_${Date.now()}`,
      tool: currentToolShared.value,
      color: currentColorShared.value,
      width: adjustedWidth,
      pressure: pressure,
      points: [{ x, y, timestamp: Date.now(), pressure }]
    };
    
    currentLiveStroke.value = newStroke;
    isDrawingShared.value = true;
    
    // 同步到JS线程用于状态更新
    runOnJS(setIsDrawing)(true);
    runOnJS(setCurrentStroke)(newStroke);
  }, []);

  const updateDrawing = useCallback((x, y, pressure = 1.0, force = 1.0) => {
    'worklet';
    if (!isDrawingShared.value || !currentLiveStroke.value) return;
    
    try {
      // ✅ 使用高级手势处理，添加错误处理
      if (advancedGestureService && typeof advancedGestureService.handleTouchMove === 'function') {
        runOnJS(advancedGestureService.handleTouchMove)(x, y, Date.now(), pressure, force);
      }
    } catch (error) {
      console.warn('⚠️ [Gesture] 高级手势处理失败，使用基础绘制:', error);
    }
    
    // 点简化：跳过距离太近的点（提升性能）
    const points = currentLiveStroke.value.points;
    if (points.length > 0) {
      const lastPoint = points[points.length - 1];
      const distance = Math.hypot(x - lastPoint.x, y - lastPoint.y); // 比Math.sqrt快
      
      // 最小距离3像素，跳过太近的点
      const minDistance = 3;
      if (distance < minDistance) {
        return;
      }
    }
    
    // 根据压力调整笔画宽度
    const adjustedWidth = currentStrokeWidthShared.value * (0.5 + pressure * 1.5);
    
    const newPoint = { x, y, timestamp: Date.now(), pressure };
    
    // 直接更新Shared Value，避免JS线程阻塞
    currentLiveStroke.value = {
      ...currentLiveStroke.value,
      width: adjustedWidth,
      points: [...currentLiveStroke.value.points, newPoint]
    };
    
    // 节流更新JS状态：每16ms（60fps）更新一次
    const now = Date.now();
    if (now - drawingStateRef.current.lastUpdateTime > 16) {
      drawingStateRef.current.lastUpdateTime = now;
      runOnJS(setCurrentStroke)({...currentLiveStroke.value});
    }
  }, []);

  const finishDrawing = useCallback((x, y, pressure = 1.0, force = 1.0) => {
    'worklet';
    if (!isDrawingShared.value || !currentLiveStroke.value) return;
    
    try {
      // ✅ 使用高级手势处理，添加错误处理
      if (advancedGestureService && typeof advancedGestureService.handleTouchEnd === 'function') {
        runOnJS(advancedGestureService.handleTouchEnd)(x, y, Date.now(), pressure, force);
      }
    } catch (error) {
      console.warn('⚠️ [Gesture] 高级手势处理失败，使用基础绘制:', error);
    }
    
    if (currentLiveStroke.value.points.length > 1) {
      // 同步到JS线程保存笔画
      runOnJS(saveStrokeToPage)({...currentLiveStroke.value});
      console.log('✅ 笔画完成，点数:', currentLiveStroke.value.points.length);
    }
    
    // 重置原生线程状态
    currentLiveStroke.value = null;
    isDrawingShared.value = false;
    
    // 同步到JS线程
    runOnJS(setIsDrawing)(false);
    runOnJS(setCurrentStroke)(null);
  }, []);
  
  // ✅ 保存笔画到页面的JS函数 - 使用增量保存
  const saveStrokeToPage = useCallback((stroke) => {
    const currentPageIndex = currentPage - 1;
    
    // ✅ 使用增量保存服务
    incrementalSaveService.addChange(
      `stroke_${stroke.id}`,
      CHANGE_TYPE.ADD_STROKE,
      stroke,
      {
        priority: 'high',
        critical: false,
        metadata: {
          pageIndex: currentPageIndex,
          pageNumber: currentPage,
          timestamp: Date.now()
        }
      }
    );
    
    // 立即更新本地状态（用于实时显示）
    setPages(prevPages => {
      const updatedPages = [...prevPages];
      if (!updatedPages[currentPageIndex]) {
        updatedPages[currentPageIndex] = { content: '', pageNumber: currentPage, strokes: [] };
      }
      if (!updatedPages[currentPageIndex].strokes) {
        updatedPages[currentPageIndex].strokes = [];
      }
      updatedPages[currentPageIndex].strokes.push(stroke);
      return updatedPages;
    });
  }, [currentPage]);

  // ✅ 优化的触摸事件处理 - 使用Gesture Handler
  const handleTouchStart = useCallback((event) => {
    if (!isManualMode) {
      // 滚动模式：让ScrollView处理，不拦截触摸事件
      return;
    }
    
    // 书写模式：拦截触摸事件，开始绘制
    const touch = event.nativeEvent.touches[0];
    if (touch) {
      startDrawing(touch.pageX, touch.pageY);
    }
  }, [isManualMode, startDrawing]);

  const handleTouchMove = useCallback((event) => {
    if (isManualMode && isDrawing) {
      // 书写模式：继续绘制
      const touch = event.nativeEvent.touches[0];
      if (touch) {
        updateDrawing(touch.pageX, touch.pageY);
      }
    }
    // 滚动模式：不处理，让ScrollView处理
  }, [isManualMode, isDrawing, updateDrawing]);

  const handleTouchEnd = useCallback(() => {
    if (isManualMode && isDrawing) {
      // 书写模式：完成绘制
      finishDrawing();
    }
    // 滚动模式：不处理，让ScrollView处理
  }, [isManualMode, isDrawing, finishDrawing]);
  
  // ✅ 原生线程触摸处理 - 使用Gesture Handler，支持压力感应，优化错误处理
  const drawingGesture = useMemo(() => {
    try {
      // 检查必要的函数是否可用
      if (!startDrawing || !updateDrawing || !finishDrawing) {
        console.warn('⚠️ [Gesture] 绘制函数未正确初始化');
        return null;
      }
      
      // 检查手势服务状态
      const serviceStatus = advancedGestureService.getStatus();
      if (!serviceStatus.initialized) {
        console.warn('⚠️ [Gesture] 手势服务未初始化，drawingGesture创建失败');
        return null;
      }
      
      return Gesture.Manual()
        .onTouchesDown((e, manager) => {
          'worklet';
          if (!isManualModeShared.value) return;
          
          for (const touch of e.changedTouches) {
            // ✅ 支持压力感应（iOS）
            const pressure = touch.force || 1.0;
            const force = touch.force || 1.0;
            startDrawing(touch.x, touch.y, pressure, force);
          }
          
          if (e.numberOfTouches >= 1) {
            manager.activate();
          }
        })
        .onTouchesMove((e, manager) => {
          'worklet';
          if (!isManualModeShared.value || !isDrawingShared.value) return;
          
          for (const touch of e.changedTouches) {
            // ✅ 支持压力感应（iOS）
            const pressure = touch.force || 1.0;
            const force = touch.force || 1.0;
            updateDrawing(touch.x, touch.y, pressure, force);
          }
        })
        .onTouchesUp((e, manager) => {
          'worklet';
          if (!isManualModeShared.value || !isDrawingShared.value) return;
          
          for (const touch of e.changedTouches) {
            // ✅ 支持压力感应（iOS）
            const pressure = touch.force || 1.0;
            const force = touch.force || 1.0;
            finishDrawing(touch.x, touch.y, pressure, force);
          }
          
          if (e.numberOfTouches === 0) {
            manager.end();
          }
        });
    } catch (error) {
      console.error('❌ [Gesture] 创建drawingGesture失败:', error);
      return null;
    }
  }, [startDrawing, updateDrawing, finishDrawing]);

  // 手写功能已暂时移除

  // 清除和撤销功能已暂时移除

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <LoadingIndicator message="正在加载分页笔记..." />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* 通用工具栏（恢复绘图参数回调） */}
      <ToolbarContainer>
        <AllInOneToolbar
          onToolChange={(tool) => setCurrentTool(normalizeTool(tool))}
          onColorChange={(color) => setCurrentColor(normalizeColor(color))}
          onStrokeWidthChange={(width) => setCurrentStrokeWidth(normalizeWidth(width))}
          onImageUpload={() => {}}
          onAIToolSelect={() => {}}
          onBookmarkAdd={() => {}}
          onBookmarkList={() => {}}
          onModeToggle={() => setIsManualMode(!isManualMode)}
          isFingerMode={!isManualMode}
          showModeToggle={true}
        />
        
        {/* 手动模式切换按钮 */}
        <View style={styles.modeToggleContainer}>
          <TouchableOpacity
            style={[
              styles.modeToggleButton,
              { backgroundColor: isManualMode ? colors.primary : colors.background }
            ]}
            onPress={() => {
              const newMode = !isManualMode;
              setIsManualMode(newMode);
              console.log('🔄 模式切换:', newMode ? '书写模式' : '滚动模式');
            }}
          >
            <Text style={[
              styles.modeToggleText,
              { color: isManualMode ? colors.background : colors.text }
            ]}>
              {isManualMode ? '✍️ 书写' : '👆 滚动'}
            </Text>
          </TouchableOpacity>
        </View>
      </ToolbarContainer>

      <ViewerLayout
        colors={colors}
        headerLeft={
          <BackButton
            onPress={handleGoBack}
            color={colors.primary}
            background={colors.primary + '20'}
          />
        }
        headerRight={
          <View style={styles.headerRightContainer}>
            {/* 保存按钮 - 最右侧位置，使用PDF一致的样式 */}
            <SaveButton
              onSave={saveNoteData}
              text="保存"
              showSuccessToast={true}
              showErrorAlert={true}
              style={styles.saveButtonCompact}
            />
          </View>
        }
        title={noteTitle}
        hasExternalToolbar={true}
        externalToolbarHeight={Platform.OS === 'ios' ? 50 : 28}
        showHistoryNavigation={true}
        historyNavigationHeight={25}
        noteId={noteData?.id}
        navigation={navigation}
      >
        {composedGesture ? (
          <GestureDetector gesture={composedGesture}>
            <View style={styles.canvasContainer}>
              {/* 渲染所有页面 */}
              {(() => {
                // 严格检查pages是否为数组
                const safePages = Array.isArray(pages) ? pages : [];
                if (__DEV__ && !Array.isArray(pages)) {
                  console.log('渲染页面，pages类型:', typeof pages, 'pages值:', pages, 'safePages:', safePages);
                  console.log('页面尺寸:', { PAGE_WIDTH, PAGE_HEIGHT, PAGE_SPACING });
                  console.log('ScrollView配置:', { scrollEnabled: true, bounces: true });
                }

                if (safePages.length === 0) {
                  return (
                    <View style={styles.pageContainer}>
                      <Text style={[styles.pageText, { color: colors.text }]}>
                        正在初始化页面...
                      </Text>
                    </View>
                  );
                }

                return safePages.map((page, index) => {
                  return (
                    <React.Fragment key={index}>
                      <PageRenderer
                        noteStyle={currentNoteStyle}
                        colors={colors}
                        pageData={page}
                        onTouchStart={handleTouchStart}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={handleTouchEnd}
                        drawingEngine={drawingEngineRef.current}
                        currentTool={currentTool}
                        isDrawing={isDrawing}
                        currentLiveStroke={currentLiveStroke}
                        isManualMode={isManualMode}
                        // 调试信息相关的 props
                        memoryUsage={memoryUsage}
                        memoryState={memoryState}
                        pendingChangesCount={pendingChangesCount}
                        currentGesture={currentGesture}
                        gesturePressure={gesturePressure}
                        gesturePrediction={gesturePrediction}
                        renderQuality={renderQuality}
                        renderState={renderState}
                        frameRate={frameRate}
                        gpuAcceleration={gpuAcceleration}
                        // 添加缺失的调试信息 props
                        gestureServiceStatus={gestureServiceStatus}
                        platformCompatibility={platformCompatibility}
                      />
                    </React.Fragment>
                  );
                });
              })()}
            </View>
          </GestureDetector>
        ) : (
          <View style={styles.canvasContainer}>
            {/* 渲染所有页面 */}
            {(() => {
              // 严格检查pages是否为数组
              const safePages = Array.isArray(pages) ? pages : [];
              if (__DEV__ && !Array.isArray(pages)) {
                console.log('渲染页面，pages类型:', typeof pages, 'pages值:', pages, 'safePages:', safePages);
                console.log('页面尺寸:', { PAGE_WIDTH, PAGE_HEIGHT, PAGE_SPACING });
                console.log('ScrollView配置:', { scrollEnabled: true, bounces: true });
              }

              if (safePages.length === 0) {
                return (
                  <View style={styles.pageContainer}>
                    <Text style={[styles.pageText, { color: colors.text }]}>
                      正在初始化页面...
                    </Text>
                  </View>
                );
              }

              return safePages.map((page, index) => {
                return (
                  <React.Fragment key={index}>
                    <PageRenderer
                      noteStyle={currentNoteStyle}
                      colors={colors}
                      pageData={page}
                      onTouchStart={handleTouchStart}
                      onTouchMove={handleTouchMove}
                      onTouchEnd={handleTouchEnd}
                      drawingEngine={drawingEngineRef.current}
                      currentTool={currentTool}
                      isDrawing={isDrawing}
                      currentLiveStroke={currentLiveStroke}
                      isManualMode={isManualMode}
                      // 调试信息相关的 props
                      memoryUsage={memoryUsage}
                      memoryState={memoryState}
                      pendingChangesCount={pendingChangesCount}
                      currentGesture={currentGesture}
                      gesturePressure={gesturePressure}
                      gesturePrediction={gesturePrediction}
                      renderQuality={renderQuality}
                      renderState={renderState}
                      frameRate={frameRate}
                      gpuAcceleration={gpuAcceleration}
                      // 添加缺失的调试信息 props
                      gestureServiceStatus={gestureServiceStatus}
                      platformCompatibility={platformCompatibility}
                    />
                  </React.Fragment>
                );
              });
            })()}
          </View>
        )}
      </ViewerLayout>



      {/* 使用PDF一致的PageControl组件 */}
      {totalPages > 1 && (
        <PageControl
          total={totalPages}
          current={currentPage}
          onPrev={() => {
            if (currentPage > 1) {
              const newPage = currentPage - 1;
              setCurrentPage(newPage);
              // ✅ 使用Shared Value更新位置
              const pageHeight = PAGE_HEIGHT + PAGE_SPACING;
              const targetY = (newPage - 1) * pageHeight;
              translateY.value = withSpring(targetY, {
                damping: 20,
                stiffness: 90,
              });
            }
          }}
          onNext={() => {
            if (currentPage < totalPages) {
              const newPage = currentPage + 1;
              setCurrentPage(newPage);
              // ✅ 使用Shared Value更新位置
              const pageHeight = PAGE_HEIGHT + PAGE_SPACING;
              const targetY = (newPage - 1) * pageHeight;
              translateY.value = withSpring(targetY, {
                damping: 20,
                stiffness: 90,
              });
            }
          }}
          onSubmitPage={(pageNum) => {
            if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
              setCurrentPage(pageNum);
              // ✅ 使用Shared Value更新位置
              const pageHeight = PAGE_HEIGHT + PAGE_SPACING;
              const targetY = (pageNum - 1) * pageHeight;
              translateY.value = withSpring(targetY, {
                damping: 20,
                stiffness: 90,
              });
            }
          }}
          storageKey="skia_paged_canvas_pagecontrol_pos"
        />
      )}

      {/* 使用PDF一致的缩放指示器 */}
      <ZoomIndicator
        scale={scale}
        visible={showZoomIndicator}
        autoHideDelay={2000}
        topOffset={60}
      />

      {/* 绘制模式指示器隐藏 */}

      {/* 原生触摸检测器已移除，改为手动模式切换 */}
    </View>
  );
};

// 样式定义
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  canvasContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  headerRightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  saveButtonCompact: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 4,
    minHeight: 24,
  },
  saveIndicator: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginRight: 6,
  },
  saveIndicatorText: {
    fontSize: 10,
    fontWeight: '500',
  },
  contentArea: {
    flex: 1,
    position: 'relative',
  },
  pagesContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  pageContainer: {
    position: 'relative',
    width: PAGE_WIDTH,
    height: PAGE_HEIGHT,
    marginBottom: PAGE_SPACING,
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    // 添加阴影效果，模拟纸张
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  pageContent: {
    position: 'relative',
    width: PAGE_WIDTH,
    height: PAGE_HEIGHT,
    padding: 20,
  },
  backgroundCanvas: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  drawingCanvas: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10, // 确保绘制层在背景层之上
  },
  separatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: PAGE_SPACING,
    width: PAGE_WIDTH,
    alignSelf: 'center',
    marginVertical: 6, // 减少垂直边距
  },
  separatorLine: {
    height: StyleSheet.hairlineWidth,
    flex: 1,
    opacity: 0.3,
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  separatorDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginHorizontal: 3,
    opacity: 0.6,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginHorizontal: 3,
    opacity: 0.5,
  },
  // 占位符样式
  placeholderPage: {
    opacity: 0.6,
  },
  placeholderContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderLine: {
    width: PAGE_WIDTH * 0.6,
    height: 2,
    backgroundColor: '#E0E0E0',
    marginVertical: 8,
    borderRadius: 1,
  },
  // ScrollView样式
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    minHeight: screenHeight, // 确保内容高度至少等于屏幕高度
    paddingVertical: 20,
    alignItems: 'center',
  },
  paperBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: PAGE_WIDTH,
    height: PAGE_HEIGHT,
  },
  line: {
    position: 'absolute',
    left: 20,
    width: PAGE_WIDTH - 40,
    height: 1,
    backgroundColor: '#E0E0E0',
  },
  gridLine: {
    position: 'absolute',
    backgroundColor: '#E0E0E0',
  },
  pageText: {
    fontSize: 16,
    lineHeight: 24,
    textAlignVertical: 'top',
  },
  dot: {
    position: 'absolute',
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#E0E0E0',
    marginLeft: -1,
    marginTop: -1,
  },
  // PDF一致的样式
  headerRightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  saveButtonCompact: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 4,
    minHeight: 24,
  },
  modeIndicator: {
    position: 'absolute',
    top: 120,
    left: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    zIndex: 1000,
  },
  modeText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  toolText: {
    fontSize: 10,
    fontWeight: '400',
    textAlign: 'center',
    marginTop: 2,
    opacity: 0.8,
  },
  // 模式切换按钮样式
  modeToggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  modeToggleButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeToggleText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default SkiaPagedCanvasScreen;