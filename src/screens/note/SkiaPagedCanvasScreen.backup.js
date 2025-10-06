/**
 * 分页笔记界面 - Skia实现（基于ScrollView）
 * 支持流畅滑动、缩放和手写绘制的分页笔记界面
 * 使用ScrollView的成熟滚动逻辑，结合Skia的高性能渲染
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Platform,
  Alert,
  ScrollView,
  PanResponder,
  Animated,
  TouchableOpacity,
} from 'react-native';
import { Canvas } from '@shopify/react-native-skia';

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
import { renderPageBackground, renderStroke, DrawingEngine, DRAWING_TOOLS } from '../../components/canvas/DrawingEngine';
import { SPACING } from '../../theme/dimensions';
import noteTypeDetectionService from '../../services/notes/noteTypeDetectionService';

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
 * 优化的页面渲染器组件
 * 支持懒加载和内存管理
 */
const PageRenderer = React.memo(({ noteStyle, colors, pageData, onTouchStart, onTouchMove, onTouchEnd, drawingEngine, currentTool, isDrawing, currentLiveStroke, isManualMode }) => {
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
        <Canvas style={[styles.backgroundCanvas, { backgroundColor: 'transparent' }]}>
          {renderPageBackground(noteStyle, PAGE_WIDTH, PAGE_HEIGHT)}
        </Canvas>

        {/* 绘制层 - 简化的实时绘制 */}
        <Canvas style={[styles.drawingCanvas, { backgroundColor: 'transparent' }]}>
          {/* 渲染已保存的笔画 */}
          {pageData?.strokes?.map(stroke => 
            renderStroke(stroke, drawingEngine)
          )}

          {/* 渲染当前笔画 - 实时预览 */}
          {isDrawing && currentLiveStroke && 
            renderStroke(currentLiveStroke, drawingEngine)}
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
          </View>
        )}

        {/* 手写层已暂时移除，专注于滑动和缩放功能 */}


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

  // 核心状态
  const [isLoading, setIsLoading] = useState(true);
  const [noteData, setNoteData] = useState(null);
  const [content, setContent] = useState('');
  const [noteTitle, setNoteTitle] = useState(title);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // 分页状态
  const [pages, setPages] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);

  // 缩放/滚动状态
  const [scale, setScale] = useState(1);
  const [showZoomIndicator, setShowZoomIndicator] = useState(false);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  
  // 滚动位置状态
  const [scrollPosition, setScrollPosition] = useState({ x: 0, y: 0 });

  // 绘制状态
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentTool, setCurrentTool] = useState('pen');
  const [currentColor, setCurrentColor] = useState('#000000');
  const [currentStrokeWidth, setCurrentStrokeWidth] = useState(2);
  const [currentStroke, setCurrentStroke] = useState(null);
  // drawingMode 已移除，现在使用 isManualMode 控制模式
  
  // 手动模式切换状态
  const [isManualMode, setIsManualMode] = useState(false); // false=滚动模式, true=书写模式

  // 取消坐标转换，直接使用屏幕坐标进行绘制

  // 缩放相关状态
  const scaleRef = useRef(1);
  const lastScaleRef = useRef(1);
  const isScalingRef = useRef(false);
  const initialDistanceRef = useRef(0);
  const lastContentOffsetRef = useRef({ x: 0, y: 0 });
  const [currentNoteStyle, setCurrentNoteStyle] = useState(noteStyle);

  // 引用
  const scrollViewRef = useRef(null);
  const initialDistance = useRef(0);
  const initialScale = useRef(1);
  const drawingEngineRef = useRef(null);

  const isTransforming = useRef(false);
  
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
        scale: scale,
        scrollPosition: scrollPosition,
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
            setScale(existingNote.scale || 1);
            setCurrentPage(existingNote.currentPage || 1);
            setScrollPosition(existingNote.scrollPosition || { x: 0, y: 0 });
            
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
    if (!isLoading && scrollViewRef.current && scrollPosition.y > 0) {
      // 延迟恢复滚动位置，确保ScrollView已完全渲染
      setTimeout(() => {
        scrollViewRef.current?.scrollTo(scrollPosition, false);
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

  // 初始化DrawingEngine
  useEffect(() => {
    if (PAGE_WIDTH && PAGE_HEIGHT) {
      drawingEngineRef.current = new DrawingEngine(PAGE_WIDTH, PAGE_HEIGHT);
    }
  }, [PAGE_WIDTH, PAGE_HEIGHT]);



  // 自动保存功能已暂时移除

  // 页面定位保持机制 - 优化版本
  const handleScaleChange = useCallback((newScale) => {
    const currentScale = scaleRef.current;
    if (Math.abs(currentScale - newScale) < 0.001) return; // 降低阈值，提高灵敏度

    // 更新缩放状态
    scaleRef.current = newScale;
    setScale(newScale);
  }, []);

  // 缩放结束后的位置调整 - 无延迟版本
  const handleScaleEnd = useCallback(() => {
    const currentScale = scaleRef.current;
    if (currentScale === 1) return; // 如果缩放为1，不需要调整

    // 立即调整位置，无延迟
    const currentOffset = lastContentOffsetRef.current;
    const adjustedOffset = {
      x: currentOffset.x * currentScale,
      y: Math.max(0, currentOffset.y * currentScale)
    };

    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo(adjustedOffset, false);
    }
    lastContentOffsetRef.current = adjustedOffset;
  }, []);

  // 监听缩放变化，显示缩放指示器 - 优化版本
  useEffect(() => {
    if (scale !== 1 && !showZoomIndicator) {
      setShowZoomIndicator(true);
    }
    
    if (scale !== 1) {
      const timer = setTimeout(() => {
        setShowZoomIndicator(false);
      }, 2000);
      return () => clearTimeout(timer);
    } else if (showZoomIndicator) {
      setShowZoomIndicator(false);
    }
  }, [scale]);

  // ❌ 禁用自动保存机制 - 避免卡顿，只在退出时保存
  // useEffect(() => {
  //   ... 自动保存逻辑已禁用 ...
  // }, [pages, currentPage, scale, noteTitle, currentNoteStyle, noteData]);

  // 组件卸载时保存
  useEffect(() => {
    return () => {
      // ✅ 增强检查条件：确保noteData有有效ID
      if (noteData && noteData._id && !isLoading) {
        // 在保存前更新滚动位置
        const currentScrollPosition = lastContentOffsetRef.current;
        setScrollPosition(currentScrollPosition);
        
        // 延迟保存，确保状态更新完成
        setTimeout(() => {
          saveNoteData().catch(error => {
            if (__DEV__) {
              console.error('💾 [SkiaPagedCanvas] 组件卸载时保存失败:', error);
            }
          });
        }, 50);
      } else if (__DEV__) {
        console.log('⏭️ [SkiaPagedCanvas] 组件卸载：跳过保存（noteData无效或仍在加载）');
      }
    };
  }, []); // 保持空依赖数组，仅在卸载时执行

  // 缩放手势处理 - 笔模式下禁用缩放
  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: (evt, gestureState) => {
      // 笔模式下禁用缩放
      return !isManualMode && evt.nativeEvent.touches.length === 2;
    },

    onMoveShouldSetPanResponder: (evt, gestureState) => {
      // 笔模式下禁用缩放
      return !isManualMode && evt.nativeEvent.touches.length === 2;
    },

    onPanResponderGrant: (evt) => {
      // 立即同步提取nativeEvent数据
      const nativeEvent = evt.nativeEvent;
      const touches = nativeEvent.touches;
      
      if (__DEV__) {
        console.log('🔍 PanResponder Grant - 开始缩放, 触摸点:', touches.length);
      }
      
      // Android平台：缩放时禁用滚动，避免手势冲突
      if (Platform.OS === 'android' && touches.length === 2) {
        setScrollEnabled(false);
        console.log('🔍 Android缩放：禁用滚动');
      }
      
      isScalingRef.current = true;
      lastScaleRef.current = scaleRef.current;
      setShowZoomIndicator(true);
      
      // 记录初始距离
      if (touches.length === 2) {
        const touch1 = touches[0];
        const touch2 = touches[1];
        initialDistanceRef.current = Math.sqrt(
          Math.pow(touch2.pageX - touch1.pageX, 2) +
          Math.pow(touch2.pageY - touch1.pageY, 2)
        );
        if (__DEV__ && Math.random() < 0.2) { // 仅20%概率输出，减少性能影响
          console.log('📏 初始距离:', initialDistanceRef.current);
          console.log('📏 触摸点1:', { pageX: touch1.pageX, pageY: touch1.pageY });
          console.log('📏 触摸点2:', { pageX: touch2.pageX, pageY: touch2.pageY });
        }
      }
    },

    onPanResponderMove: (evt) => {
      // 立即同步提取nativeEvent数据
      const nativeEvent = evt.nativeEvent;
      const touches = nativeEvent.touches;

      if (touches.length === 2 && isScalingRef.current && initialDistanceRef.current > 0) {
        const touch1 = touches[0];
        const touch2 = touches[1];

        const distance = Math.sqrt(
          Math.pow(touch2.pageX - touch1.pageX, 2) +
          Math.pow(touch2.pageY - touch1.pageY, 2)
        );

        const scaleChange = distance / initialDistanceRef.current;
        const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, lastScaleRef.current * scaleChange));

        if (__DEV__ && Math.random() < 0.1) { // 仅10%概率输出
          console.log('🔄 缩放变化:', { 
            distance, 
            initialDistance: initialDistanceRef.current, 
            scaleChange, 
            newScale,
            lastScale: lastScaleRef.current,
            currentScale: scaleRef.current
          });
        }
        
        // 使用新的缩放处理函数
        handleScaleChange(newScale);
      } else if (__DEV__ && Math.random() < 0.05) { // 仅5%概率输出
        console.log('🔄 缩放条件不满足:', {
          touchesLength: touches.length,
          isScaling: isScalingRef.current,
          initialDistance: initialDistanceRef.current
        });
      }
    },

    onPanResponderRelease: () => {
      isScalingRef.current = false;
      initialDistanceRef.current = 0;
      setShowZoomIndicator(false);
      
      // Android平台：缩放结束后恢复滚动
      if (Platform.OS === 'android') {
        setScrollEnabled(true);
        console.log('🔍 Android缩放：恢复滚动');
      }
      
      // 缩放结束后调整位置
      handleScaleEnd();
    },
  });

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

  // 高性能绘制函数 - 借鉴无限画布的优化技术
  const currentStrokeRef = useRef(null);
  const drawingStateRef = useRef({
    isDrawing: false,
    points: [], // 点缓冲区
    lastUpdateTime: 0,
  });
  
  const startDrawing = useCallback((x, y) => {
    if (!isManualMode) return;
    
    const newStroke = {
      id: `stroke_${Date.now()}`,
      tool: currentTool,
      color: currentColor,
      width: currentStrokeWidth,
      points: [{ x, y, timestamp: Date.now() }]
    };
    
    currentStrokeRef.current = newStroke;
    drawingStateRef.current = {
      isDrawing: true,
      points: [],
      lastUpdateTime: Date.now(),
    };
    setIsDrawing(true);
    setCurrentStroke(newStroke);
    console.log('🎨 开始绘制:', { x, y, tool: currentTool });
  }, [isManualMode, currentTool, currentColor, currentStrokeWidth]);

  const updateDrawing = useCallback((x, y) => {
    if (!isDrawing || !currentStrokeRef.current) return;
    
    // 点简化：跳过距离太近的点（提升性能）
    const points = currentStrokeRef.current.points;
    if (points.length > 0) {
      const lastPoint = points[points.length - 1];
      const distance = Math.sqrt(
        Math.pow(x - lastPoint.x, 2) + 
        Math.pow(y - lastPoint.y, 2)
      );
      
      // 最小距离2像素，跳过太近的点
      const minDistance = 2;
      if (distance < minDistance) {
        return;
      }
    }
    
    const newPoint = { x, y, timestamp: Date.now() };
    
    // 添加点到缓冲区
    drawingStateRef.current.points.push(newPoint);
    
    // 节流更新：每16ms（60fps）更新一次UI
    const now = Date.now();
    if (now - drawingStateRef.current.lastUpdateTime > 16) {
      drawingStateRef.current.lastUpdateTime = now;
      
      // 批量添加缓冲区的点到stroke
      if (drawingStateRef.current.points.length > 0) {
        currentStrokeRef.current.points.push(...drawingStateRef.current.points);
        drawingStateRef.current.points = []; // 清空缓冲区
        setCurrentStroke({...currentStrokeRef.current});
      }
    }
  }, [isDrawing]);

  const finishDrawing = useCallback(() => {
    if (!isDrawing || !currentStrokeRef.current) return;
    
    // 添加缓冲区剩余的点
    if (drawingStateRef.current.points.length > 0) {
      currentStrokeRef.current.points.push(...drawingStateRef.current.points);
      drawingStateRef.current.points = [];
    }
    
    if (currentStrokeRef.current.points.length > 1) {
      // 最终更新state
      setCurrentStroke({...currentStrokeRef.current});
      
      // 保存到当前页面
      const currentPageIndex = currentPage - 1;
      setPages(prevPages => {
        const updatedPages = [...prevPages];
        if (!updatedPages[currentPageIndex]) {
          updatedPages[currentPageIndex] = { content: '', pageNumber: currentPage, strokes: [] };
        }
        if (!updatedPages[currentPageIndex].strokes) {
          updatedPages[currentPageIndex].strokes = [];
        }
        updatedPages[currentPageIndex].strokes.push({...currentStrokeRef.current});
        return updatedPages;
      });
      
      console.log('✅ 笔画完成，点数:', currentStrokeRef.current.points.length);
    }
    
    setIsDrawing(false);
    setCurrentStroke(null);
    currentStrokeRef.current = null;
    drawingStateRef.current = {
      isDrawing: false,
      points: [],
      lastUpdateTime: 0,
    };
  }, [isDrawing, currentPage]);

  // 触摸事件处理 - 根据模式决定行为
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
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            // 在笔模式下禁用缩放变换
            Platform.OS === 'android' && !isManualMode ? {
              transform: [{ scale: scale }],
              transformOrigin: 'top center'
            } : {}
          ]}
          showsVerticalScrollIndicator={!isManualMode}
          showsHorizontalScrollIndicator={false}
          scrollEnabled={!isManualMode} // 滚动模式启用滚动，书写模式禁用滚动
          scrollEventThrottle={16}
          decelerationRate="fast"
          bounces={!isManualMode} // 笔模式下禁用弹跳
          // iOS优先的缩放支持 - 笔模式下禁用
          minimumZoomScale={Platform.OS === 'ios' && !isManualMode ? MIN_SCALE : undefined}
          maximumZoomScale={Platform.OS === 'ios' && !isManualMode ? MAX_SCALE : undefined}
          pinchGestureEnabled={Platform.OS === 'ios' && !isManualMode} // 笔模式下禁用缩放手势
          bouncesZoom={Platform.OS === 'ios' && !isManualMode} // 笔模式下禁用缩放弹跳
          onScrollBeginDrag={Platform.OS === 'ios' ? () => {
            setShowZoomIndicator(false);
          } : undefined}
          onScroll={(event) => {
            // onScroll是同步的，可以安全访问nativeEvent
            const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;

            // 更新最后的内容偏移量
            lastContentOffsetRef.current = contentOffset;

            // 当滚动到底部附近时，自动添加新页面
            if (contentOffset.y + layoutMeasurement.height > contentSize.height - 200) {
              addNewPage();
            }

            // 根据滚动位置更新当前页码
            const pageHeight = PAGE_HEIGHT + PAGE_SPACING;
            const currentPageIndex = Math.floor(contentOffset.y / pageHeight) + 1;
            const safeTotalPages = typeof totalPages === 'number' && totalPages > 0 ? totalPages : 1;
            if (currentPageIndex !== currentPage && currentPageIndex <= safeTotalPages) {
              setCurrentPage(currentPageIndex);
            }
          }}
          onScrollEndDrag={Platform.OS === 'ios' ? () => {
            // iOS缩放结束时隐藏指示器
            setTimeout(() => setShowZoomIndicator(false), 2000);
          } : undefined}
          // Android使用PanResponder
          {...(Platform.OS === 'android' ? panResponder.panHandlers : {})}
        >
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
                    currentLiveStroke={currentStroke}
                    isManualMode={isManualMode}
                  />
                </React.Fragment>
              );
            });
          })()}
        </ScrollView>
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
              // 滚动到指定页面
              const pageHeight = PAGE_HEIGHT + PAGE_SPACING;
              const targetY = (newPage - 1) * pageHeight;
              scrollViewRef.current?.scrollTo({ y: targetY, animated: true });
            }
          }}
          onNext={() => {
            if (currentPage < totalPages) {
              const newPage = currentPage + 1;
              setCurrentPage(newPage);
              // 滚动到指定页面
              const pageHeight = PAGE_HEIGHT + PAGE_SPACING;
              const targetY = (newPage - 1) * pageHeight;
              scrollViewRef.current?.scrollTo({ y: targetY, animated: true });
            }
          }}
          onSubmitPage={(pageNum) => {
            if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
              setCurrentPage(pageNum);
              // 滚动到指定页面
              const pageHeight = PAGE_HEIGHT + PAGE_SPACING;
              const targetY = (pageNum - 1) * pageHeight;
              scrollViewRef.current?.scrollTo({ y: targetY, animated: true });
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