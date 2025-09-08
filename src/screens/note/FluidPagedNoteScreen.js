/**
 * 流畅分页笔记界面 - 优化版本
 * 支持流畅缩放（最小50%）、四种样式选择、页码器在底部
 */

import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  Dimensions,
  Platform,
  StatusBar,
  PanResponder,
  Animated
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useDispatch } from 'react-redux';
import { offlineStorageService } from '../../services/offline';
import { addNote, updateNote } from '../../redux/slices/notesSlice';

// 导入PDF界面的成熟组件
import AllInOneToolbar from '../../components/common/AllInOneToolbar';
import SaveButton from '../../components/common/SaveButton';
import LoadingIndicator from '../../components/common/LoadingIndicator';
import BackButton from '../../components/viewer/BackButton';
import ViewerLayout from '../../components/viewer/ViewerLayout';
import ToolbarContainer from '../../components/viewer/ToolbarContainer';
import ZoomIndicator from '../../components/common/ZoomIndicator';
import PageControl from '../../components/viewer/PageControl';
import HandwritingAdapter from '../../components/handwriting/HandwritingAdapter';
import handwritingOCRService from '../../services/ocr/HandwritingOCRService';
import Svg, { Rect, Line, Circle } from 'react-native-svg';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const FluidPagedNoteScreen = ({ route, navigation }) => {
  const { title = '新建笔记', noteId, createNew = false, isNew = false, noteStyle = 'blank' } = route.params || {};
  const { colors } = useTheme();
  const dispatch = useDispatch();
  
  // 核心状态
  const [isLoading, setIsLoading] = useState(true);
  const [noteData, setNoteData] = useState(null);
  const [content, setContent] = useState('');
  const [noteTitle, setNoteTitle] = useState(title);
  
  // 分页状态
  const [pages, setPages] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  // 缩放状态
  const [scale, setScale] = useState(1);
  const [showZoomIndicator, setShowZoomIndicator] = useState(false);
  
  // 移除滑动指示器状态，使用原生滚动指示器
  
  // 笔记样式状态
  const [currentNoteStyleKey, setCurrentNoteStyleKey] = useState(noteStyle);

  // 手写相关状态
  const [currentDrawingTool, setCurrentDrawingTool] = useState({ type: 'pen', size: 2 });
  const [currentDrawingColor, setCurrentDrawingColor] = useState('#000000');
  const [currentStrokeWidth, setCurrentStrokeWidth] = useState(2);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [isFingerMode, setIsFingerMode] = useState(true); // 默认为手指模式
  
  // 引用
  const scrollViewRef = useRef(null);
  const contentRef = useRef(null);
  const lastTap = useRef(null);
  const initialDistance = useRef(0);
  const initialScale = useRef(1);
  const isTransforming = useRef(false);
  const handwritingAdapterRef = useRef(null);
  const pendingStrokes = useRef([]);

  // 笔记样式配置 - 支持四种样式
  const noteStyles = {
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
    }
  };

  const currentNoteStyle = noteStyles[currentNoteStyleKey] || noteStyles.blank;
  
  // 调试日志：显示当前样式状态
  console.log('当前样式状态:', {
    noteStyle: currentNoteStyleKey,
    currentNoteStyle: currentNoteStyle,
    availableStyles: Object.keys(noteStyles)
  });

  // 隐藏底部状态栏
  useLayoutEffect(() => {
    navigation.setOptions({ tabBarVisible: false });
    StatusBar.setHidden(true);
    return () => {
      StatusBar.setHidden(false);
    };
  }, [navigation]);

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
      const newNoteId = `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const newNote = {
        _id: newNoteId,
        id: newNoteId,
        title: noteTitle || '新建笔记',
        content: content || '',
        type: 'note',
        noteType: 'paged_note',
        file_type: 'paged_note',
        noteStyle: currentNoteStyleKey,
        pages: [{ content: '', pageNumber: 1 }],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        user_id: 'current_user',
        is_deleted: false,
        is_synced: false,
        isNew: true,
        // 添加文件URI用于识别
        file_uri: `paged_note://${newNoteId}`,
        uri: `paged_note://${newNoteId}`
      };

      // 保存到本地存储
      const result = await offlineStorageService.saveNote(newNote);
      
      if (result.success) {
        // 使用保存后返回的笔记数据，确保ID字段一致
        const savedNote = result.note || newNote;
        
        // 确保ID字段一致
        const finalNote = {
          ...savedNote,
          id: savedNote.id || savedNote._id || newNoteId,
          _id: savedNote._id || savedNote.id || newNoteId,
          file_uri: savedNote.file_uri || `paged_note://${savedNote.id || savedNote._id || newNoteId}`,
          uri: savedNote.uri || `paged_note://${savedNote.id || savedNote._id || newNoteId}`
        };
        
        setNoteData(finalNote);
        const initialPages = finalNote.pages || [{ content: '', pageNumber: 1 }];
        console.log('设置初始pages:', initialPages, '类型:', typeof initialPages, '是否为数组:', Array.isArray(initialPages));
        
        // 确保initialPages是数组
        const safeInitialPages = Array.isArray(initialPages) ? initialPages : [{ content: '', pageNumber: 1 }];
        setPages(safeInitialPages);
        setTotalPages(1);
        
        // 更新Redux状态
        dispatch(addNote(finalNote));
        
        console.log('新笔记创建成功:', finalNote.id, 'isNew:', true);
        console.log('保存后的笔记数据:', {
          id: finalNote.id,
          _id: finalNote._id,
          file_uri: finalNote.file_uri,
          uri: finalNote.uri
        });
        
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

  // 加载笔记数据
  const loadNoteData = async () => {
    try {
      setIsLoading(true);
      console.log('开始加载笔记, noteId:', noteId, 'createNew:', createNew, 'isNew:', isNew);

      if (noteId) {
        // 尝试加载现有笔记
        const existingNote = await offlineStorageService.getNote(noteId);
        if (existingNote) {
          console.log('找到现有笔记:', existingNote.id);
          
          // 确保ID字段一致
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
          
          // 恢复笔记样式
          if (unifiedNote.noteStyle) {
            console.log('恢复笔记样式:', unifiedNote.noteStyle);
            setCurrentNoteStyleKey(unifiedNote.noteStyle);
          } else {
            console.log('未找到笔记样式，使用默认样式');
          }
          
          // 处理分页数据 - 确保正确解析
          let notePages = [];
          if (unifiedNote.pages) {
            if (typeof unifiedNote.pages === 'string') {
              try {
                notePages = JSON.parse(unifiedNote.pages);
              } catch (parseError) {
                console.warn('解析pages字段失败:', parseError);
                notePages = [{ content: unifiedNote.content || '', pageNumber: 1 }];
              }
            } else if (Array.isArray(unifiedNote.pages)) {
              notePages = unifiedNote.pages;
            } else {
              notePages = [{ content: unifiedNote.content || '', pageNumber: 1 }];
            }
          } else {
            notePages = [{ content: unifiedNote.content || '', pageNumber: 1 }];
          }
          
          console.log('设置加载的pages:', notePages, '类型:', typeof notePages, '是否为数组:', Array.isArray(notePages));
          
          // 确保notePages是数组
          const safeNotePages = Array.isArray(notePages) ? notePages : [{ content: unifiedNote.content || '', pageNumber: 1 }];
          setPages(safeNotePages);
          setTotalPages(notePages.length);
          
          console.log('加载的笔记数据:', {
            id: unifiedNote.id,
            _id: unifiedNote._id,
            file_uri: unifiedNote.file_uri,
            uri: unifiedNote.uri,
            pagesCount: notePages.length
          });
          
          setIsLoading(false);
          return;
        } else {
          console.log('未找到笔记:', noteId);
          // 如果明确要求创建新笔记
          if (createNew || isNew) {
            console.log('明确要求创建新笔记');
            const newNote = await createNewNote();
            if (newNote) {
              setIsLoading(false);
              return;
            }
          } else {
            // 保持空白状态，不创建新笔记
            console.log('保持空白状态，不创建新笔记');
            setNoteData(null);
            setContent('');
            setNoteTitle(title || '新建笔记');
            setIsLoading(false);
            return;
          }
        }
      } else {
        // 没有 noteId
        if (createNew || isNew) {
          console.log('没有 noteId，但要求创建新笔记');
          const newNote = await createNewNote();
          if (newNote) {
            setIsLoading(false);
            return;
          }
        } else {
          // 保持空白状态
          console.log('没有 noteId，保持空白状态');
          setNoteData(null);
          setContent('');
          setNoteTitle(title || '新建笔记');
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

  // 添加新页面
  const addNewPage = () => {
    const newPage = {
      content: '',
      pageNumber: totalPages + 1
    };
    
    setPages(prev => {
      const safePrev = Array.isArray(prev) ? prev : [];
      console.log('addNewPage - prev类型:', typeof prev, 'prev值:', prev, 'safePrev:', safePrev);
      return [...safePrev, newPage];
    });
    setTotalPages(prev => prev + 1);
    setCurrentPage(totalPages + 1);
  };

  // 更新当前页面内容
  const updateCurrentPageContent = (newContent) => {
    setPages(prev => {
      const safePrev = Array.isArray(prev) ? prev : [];
      console.log('updateCurrentPageContent - prev类型:', typeof prev, 'prev值:', prev, 'safePrev:', safePrev);
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

  // 手势处理 - 支持流畅缩放（最小50%）
  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: (evt) => {
      return evt.nativeEvent.touches.length === 2;
    },
    
    onMoveShouldSetPanResponder: (evt, gestureState) => {
      return evt.nativeEvent.touches.length === 2;
    },

    onPanResponderGrant: (evt) => {
      const { touches } = evt.nativeEvent;
      
      if (touches.length === 2) {
        const touch1 = touches[0];
        const touch2 = touches[1];
        const distance = Math.sqrt(
          Math.pow(touch2.pageX - touch1.pageX, 2) +
          Math.pow(touch2.pageY - touch1.pageY, 2)
        );
        initialDistance.current = distance;
        initialScale.current = scale;
        isTransforming.current = true;
        // 开始缩放时立即显示指示器
        setShowZoomIndicator(true);
      }
    },
    
    onPanResponderMove: (evt, gestureState) => {
      const { touches } = evt.nativeEvent;

      if (touches.length === 2 && isTransforming.current) {
        const touch1 = touches[0];
        const touch2 = touches[1];
        const distance = Math.sqrt(
          Math.pow(touch2.pageX - touch1.pageX, 2) +
          Math.pow(touch2.pageY - touch1.pageY, 2)
        );

        const scaleRatio = distance / initialDistance.current;
        let newScale = initialScale.current * scaleRatio;

        // 最小缩放限制为50%
        newScale = Math.max(0.5, Math.min(5, newScale));

        // 添加缩放步进，使缩放更平滑
        const scaleStep = 0.01;
        newScale = Math.round(newScale / scaleStep) * scaleStep;

        // 最原始的缩放实现：只设置scale，不进行复杂的translate计算
        setScale(newScale);
        
        // 调试信息（开发时使用）
        console.log('缩放更新:', {
          newScale: newScale.toFixed(2),
          scaleRatio: scaleRatio.toFixed(3)
        });
        
        // 在缩放过程中始终显示指示器
        setShowZoomIndicator(true);
      }
    },
    
    onPanResponderRelease: () => {
      isTransforming.current = false;
      // 延迟隐藏缩放指示器
      setTimeout(() => {
        setShowZoomIndicator(false);
      }, 3000);
    }
  });

  // 保存笔记数据
  const saveNoteData = async () => {
    try {
      if (!noteData) {
        const newNote = await createNewNote();
        return newNote !== null;
      }

      // 更新现有笔记
      const updatedNote = {
        ...noteData,
        title: noteTitle,
        content: content,
        pages: Array.isArray(pages) ? pages : [{ content: content || '', pageNumber: 1 }],
        noteStyle: currentNoteStyleKey,
        noteType: 'paged_note',
        updated_at: new Date().toISOString(),
        // 确保有文件URI
        file_uri: noteData.file_uri || `paged_note://${noteData.id}`,
        uri: noteData.uri || `paged_note://${noteData.id}`
      };

      console.log('准备保存笔记:', updatedNote.id);
      console.log('保存的笔记样式:', updatedNote.noteStyle);
      
      const result = await offlineStorageService.saveNote(updatedNote);

      if (result.success) {
        // 使用保存后返回的笔记数据，确保ID字段一致
        const savedNote = result.note || updatedNote;
        
        // 确保ID字段一致
        const finalNote = {
          ...savedNote,
          id: savedNote.id || savedNote._id || updatedNote.id,
          _id: savedNote._id || savedNote.id || updatedNote.id,
          file_uri: savedNote.file_uri || `paged_note://${savedNote.id || savedNote._id || updatedNote.id}`,
          uri: savedNote.uri || `paged_note://${savedNote.id || savedNote._id || updatedNote.id}`
        };
        
        setNoteData(finalNote);
        dispatch(updateNote(finalNote));
        
        console.log('笔记保存成功:', finalNote.id);
        console.log('保存后的笔记数据:', {
          id: finalNote.id,
          _id: finalNote._id,
          file_uri: finalNote.file_uri,
          uri: finalNote.uri
        });
        
        return true;
      } else {
        throw new Error('保存失败');
      }
    } catch (error) {
      console.error('保存笔记失败:', error);
      Alert.alert('保存失败', '笔记保存失败，请稍后重试');
      return false;
    }
  };

  // 组件挂载时加载数据 - 添加防重复加载机制
  const hasLoadedData = useRef(false);
  useEffect(() => {
    if (!hasLoadedData.current) {
      loadNoteData();
      hasLoadedData.current = true;
    }
  }, [noteId, createNew, isNew]);

  // 监控pages状态变化 - 减少日志输出以提升性能
  useEffect(() => {
    if (pages && pages.length > 0) {
      console.log('pages状态变化: 页数', pages.length);
    }
  }, [pages?.length]); // 只在页数变化时记录日志

  // 添加到文件历史记录 - 修复重复添加问题
  const hasAddedToHistory = useRef(false);
  useEffect(() => {
    if (noteData && noteData.id && !hasAddedToHistory.current) {
      try {
        const fileHistoryService = require('../../services/fileHistoryService').default;
        fileHistoryService.addFile({
          uri: noteData.file_uri || `paged_note://${noteData.id}`,
          title: noteData.title || '分页笔记',
          type: 'paged_note',
          noteType: 'paged_note',
          fileName: noteData.title || '分页笔记',
          noteId: noteData.id,
          file_uri: noteData.file_uri || `paged_note://${noteData.id}`
        });
        hasAddedToHistory.current = true;
        console.log('FluidPagedNoteScreen: 已添加到文件历史记录');
      } catch (error) {
        console.warn('添加到文件历史失败:', error);
      }
    }
  }, [noteData?.id]); // 只依赖noteData.id，避免其他属性变化导致重复添加

  // 手写处理函数
  const handleToolChange = useCallback((tool) => {
    setCurrentDrawingTool(tool);
    console.log('FluidPagedNoteScreen: 工具切换到:', tool);
  }, []);

  const handleColorChange = useCallback((color) => {
    setCurrentDrawingColor(color);
    console.log('FluidPagedNoteScreen: 颜色切换到:', color);
  }, []);

  const handleStrokeWidthChange = useCallback((width) => {
    setCurrentStrokeWidth(width);
    console.log('FluidPagedNoteScreen: 笔迹粗细切换到:', width);
  }, []);

  const handleStrokesChange = useCallback(async (strokes) => {
    try {
      if (!Array.isArray(strokes)) {
        console.warn('FluidPagedNoteScreen: 无效的笔迹数据');
        return;
      }

      setCanUndo(strokes.length > 0);
      setCanRedo(false);
      console.log(`FluidPagedNoteScreen: 笔迹更新，当前数量: ${strokes.length}`);

      // 性能优化：只存储笔迹数据，不立即保存
      pendingStrokes.current = strokes;
    } catch (error) {
      console.error('FluidPagedNoteScreen: 处理笔迹变化失败:', error);
    }
  }, []);

  const handleUndo = useCallback(() => {
    try {
      if (handwritingAdapterRef.current) {
        handwritingAdapterRef.current.undo();
      }
    } catch (error) {
      console.error('FluidPagedNoteScreen: 撤销操作失败:', error);
    }
  }, []);

  const handleRedo = useCallback(() => {
    try {
      if (handwritingAdapterRef.current) {
        handwritingAdapterRef.current.redo();
      }
    } catch (error) {
      console.error('FluidPagedNoteScreen: 重做操作失败:', error);
    }
  }, []);

  const handleClear = useCallback(() => {
    try {
      if (handwritingAdapterRef.current) {
        handwritingAdapterRef.current.clearStrokes();
      }
    } catch (error) {
      console.error('FluidPagedNoteScreen: 清空操作失败:', error);
    }
  }, []);

  const handleModeToggle = useCallback((newMode) => {
    setIsFingerMode(newMode);
    console.log('FluidPagedNoteScreen: 模式切换到:', newMode ? '手指模式' : '手写笔模式');
  }, []);

  const handleHandwritingOCR = useCallback(async () => {
    try {
      if (!handwritingAdapterRef.current) {
        console.warn('FluidPagedNoteScreen: 手写适配器未初始化');
        return { success: false, error: '手写适配器未初始化' };
      }

      const strokes = handwritingAdapterRef.current.getStrokes();
      if (!strokes || strokes.length === 0) {
        console.warn('FluidPagedNoteScreen: 没有可转换的笔迹');
        return { success: false, error: '没有可转换的笔迹' };
      }

      console.log('FluidPagedNoteScreen: 开始手写转换，笔迹数量:', strokes.length);
      const result = await handwritingOCRService.convertStrokesToText(strokes);

      if (result.success && result.text) {
        // 将转换的文本添加到当前页面内容
        const newContent = content + (content ? '\n' : '') + result.text;
        setContent(newContent);

        // 清空笔迹
        handwritingAdapterRef.current.clearStrokes();

        console.log('FluidPagedNoteScreen: 手写转换成功:', result.text);
        return { success: true, text: result.text };
      } else {
        console.error('FluidPagedNoteScreen: 手写转换失败:', result.error);
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('FluidPagedNoteScreen: 手写转换失败:', error);
      return { success: false, error: error.message };
    }
  }, [content]);

  // 渲染纸张背景
  const renderPaperBackground = () => {
    const style = currentNoteStyle;
    
    return (
      <View style={[styles.paperBackground, { backgroundColor: style.backgroundColor }]}>
        {style.pattern === 'lines' && renderLinesPattern()}
        {style.pattern === 'grid' && renderGridPattern()}
        {style.pattern === 'dots' && renderDotsPattern()}
      </View>
    );
  };

  // 渲染横线背景
  const renderLinesPattern = () => {
    return Array.from({ length: Math.floor(screenHeight / 30) }, (_, index) => (
      <View
        key={index}
        style={[
          styles.line,
          { top: (index + 1) * 30 }
        ]}
      />
    ));
  };

  // 渲染网格背景
  const renderGridPattern = () => {
    const gridSize = 20;
    const lines = [];
    
    // 垂直线
    for (let x = 0; x < screenWidth; x += gridSize) {
      lines.push(
        <View
          key={`v-${x}`}
          style={[
            styles.gridLine,
            { left: x, width: 1, height: screenHeight }
          ]}
        />
      );
    }
    
    // 水平线
    for (let y = 0; y < screenHeight; y += gridSize) {
      lines.push(
        <View
          key={`h-${y}`}
          style={[
            styles.gridLine,
            { top: y, height: 1, width: screenWidth }
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
    
    for (let x = dotSpacing; x < screenWidth; x += dotSpacing) {
      for (let y = dotSpacing; y < screenHeight; y += dotSpacing) {
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
  
  // 移除滑动指示器参数计算函数

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <LoadingIndicator message="正在加载笔记..." />
      </View>
    );
  }

  // 渲染页面内容
  const renderPage = (page, pageIndex) => {
    // 安全检查page对象
    if (!page) {
      console.warn('renderPage收到无效的page对象:', page, 'index:', pageIndex);
      return null;
    }
    
    return (
      <View key={pageIndex} style={styles.pageContainer}>
        {/* 页面背景 */}
        {renderPaperBackground()}
        
        {/* 页面内容 */}
        <View style={styles.pageContent}>
          <Text style={[styles.pageText, { color: colors.text }]}>
            {page.content || ''}
          </Text>
        </View>
        
        {/* 页面分隔线 - 优化版本，确保在缩放时也有适当间距 */}
        {pageIndex < (Array.isArray(pages) ? pages : []).length - 1 && (
          <View style={[
            styles.pageDivider, 
            { 
              backgroundColor: colors.border,
              marginBottom: Math.max(10, 20 * scale) // 根据缩放调整间距
            }
          ]} />
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ToolbarContainer>
        <AllInOneToolbar
          onToolChange={handleToolChange}
          onColorChange={handleColorChange}
          onStrokeWidthChange={handleStrokeWidthChange}
          onImageUpload={() => {}}
          onBookmarkAdd={() => {}}
          onBookmarkList={() => {}}
          onUndo={handleUndo}
          onRedo={handleRedo}
          canUndo={canUndo}
          canRedo={canRedo}
          onClear={handleClear}
          onHandwritingOCR={handleHandwritingOCR}
          initialTool={currentDrawingTool?.type || 'pen'}
          initialColor={currentDrawingColor}
          initialStrokeWidth={currentStrokeWidth}
          showModeToggle={true}
          onModeToggle={handleModeToggle}
          isFingerMode={isFingerMode}
        />
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
          <SaveButton
            onSave={saveNoteData}
            text="保存"
            showSuccessToast={true}
            showErrorAlert={true}
          />
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
            {
              transform: [
                { scale: scale }
              ]
            }
          ]}
          showsVerticalScrollIndicator={true}
          showsHorizontalScrollIndicator={false}
          scrollEnabled={true}
          bounces={true}
          onScroll={(event) => {
            const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
            
            // 当滚动到底部附近时，自动添加新页面
            if (contentOffset.y + layoutMeasurement.height > contentSize.height - 200) {
              addNewPage();
            }
            
            // 根据滚动位置更新当前页码
            const pageHeight = screenHeight;
            const currentPageIndex = Math.floor(contentOffset.y / pageHeight) + 1;
            const safeTotalPages = typeof totalPages === 'number' && totalPages > 0 ? totalPages : 1;
            if (currentPageIndex !== currentPage && currentPageIndex <= safeTotalPages) {
              setCurrentPage(currentPageIndex);
            }
          }}
          scrollEventThrottle={16}
          {...panResponder.panHandlers}
        >
          {/* 渲染所有页面 */}
          {(() => {
            // 严格检查pages是否为数组
            const safePages = Array.isArray(pages) ? pages : [];
            console.log('渲染页面，pages类型:', typeof pages, 'pages值:', pages, 'safePages:', safePages);
            
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
              const renderedPage = renderPage(page, index);
              return renderedPage || (
                <View key={index} style={styles.pageContainer}>
                  <Text style={[styles.pageText, { color: colors.text }]}>
                    页面加载中...
                  </Text>
                </View>
              );
            });
          })()}

          {/* 手写适配器层 */}
          <HandwritingAdapter
            ref={handwritingAdapterRef}
            currentTool={currentDrawingTool}
            currentColor={currentDrawingColor}
            currentStrokeWidth={currentStrokeWidth}
            documentId={noteData?.id}
            documentType="paged_note"
            enablePressure={true}
            enableTilt={true}
            fingerRejection={!isFingerMode} // 根据模式决定是否拒绝手指
            isFingerMode={isFingerMode} // 传递手指模式状态
            onStrokesChange={handleStrokesChange}
            style={styles.handwritingLayer}
            width={screenWidth}
            height={screenHeight * Math.max(1, totalPages || 1)}
            visible={true}
          />
        </ScrollView>
      </ViewerLayout>

      {/* 页码器 - 在底部 */}
      {(() => {
        const safeTotalPages = typeof totalPages === 'number' && totalPages > 0 ? totalPages : 1;
        return safeTotalPages > 1 ? (
          <PageControl
            total={safeTotalPages}
            current={currentPage}
            onPrev={() => {
              if (currentPage > 1) {
                setCurrentPage(currentPage - 1);
              }
            }}
            onNext={() => {
              if (currentPage < safeTotalPages) {
                setCurrentPage(currentPage + 1);
              }
            }}
          />
        ) : null;
      })()}

      {/* 移除自定义滑动指示器，使用原生滚动指示器 */}
      
      {/* 缩放指示器 */}
      <ZoomIndicator
        scale={scale}
        visible={showZoomIndicator}
        autoHideDelay={3000}
        topOffset={60}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  pageContainer: {
    position: 'relative',
    minHeight: screenHeight,
    padding: 0,
    paddingTop: 0,
    paddingBottom: 0,
  },
  paperBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  line: {
    position: 'absolute',
    left: 20,
    right: 20,
    height: 1,
    backgroundColor: '#E0E0E0',
  },
  gridLine: {
    position: 'absolute',
    backgroundColor: '#E0E0E0',
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
  pageContent: {
    position: 'relative',
    zIndex: 1,
    paddingTop: 20, // 减少顶部间距
    minHeight: screenHeight - 60, // 调整最小高度
    // 确保在缩放时内容不会超出边界
    maxWidth: '100%',
    overflow: 'hidden',
  },
  pageText: {
    fontSize: 16,
    lineHeight: 24,
    textAlignVertical: 'top',
  },
  pageDivider: {
    position: 'absolute',
    bottom: 0,
    left: 20,
    right: 20,
    height: 2,
  },
  pageIndicator: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    zIndex: 1000,
  },
  handwritingLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
    pointerEvents: 'auto',
  },
});

export default FluidPagedNoteScreen;