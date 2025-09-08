/**
 * 流畅无限画布界面 - 优化版本
 * 支持流畅缩放（最小50%）、各个方向移动、四种样式选择
 * 只渲染当前可见区域，提升性能
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
import { Canvas, Rect, Line, Circle, Skia } from '@shopify/react-native-skia';
import { useTheme } from '../../context/ThemeContext';
import { useDispatch } from 'react-redux';
import HandwritingAdapter from '../../components/handwriting/HandwritingAdapter';
import { offlineStorageService } from '../../services/offline';
import { addNote, updateNote } from '../../redux/slices/notesSlice';
// import * as uuid from 'react-native-uuid'; // 暂时注释，使用备用方案

// 导入PDF界面的成熟组件
import AllInOneToolbar from '../../components/common/AllInOneToolbar';
import SaveButton from '../../components/common/SaveButton';
import LoadingIndicator from '../../components/common/LoadingIndicator';
import BackButton from '../../components/viewer/BackButton';
import ViewerLayout from '../../components/viewer/ViewerLayout';
import ToolbarContainer from '../../components/viewer/ToolbarContainer';
import ZoomIndicator from '../../components/common/ZoomIndicator';
import CustomScrollIndicator from '../../components/common/CustomScrollIndicator';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const FluidInfiniteCanvasScreen = ({ route, navigation }) => {
  const { title = '无限画布', noteId, canvasId, canvasStyle = 'white', createNew = false } = route.params || {};
  // 统一处理 noteId 和 canvasId
  const finalNoteId = noteId || canvasId;
  const { colors } = useTheme();
  const dispatch = useDispatch();
  
  // 核心状态
  const [isLoading, setIsLoading] = useState(true);
  const [noteData, setNoteData] = useState(null);
  const [content, setContent] = useState('');
  const [noteTitle, setNoteTitle] = useState(title);
  const [currentCanvasStyleName, setCurrentCanvasStyleName] = useState(canvasStyle);
  
  // 缩放状态 - 参考PDF界面实现
  const [scale, setScale] = useState(1);
  const [showZoomIndicator, setShowZoomIndicator] = useState(false);
  const lastScale = useRef(1);
  
  // 画布位置状态 - 确保画布中心处于界面屏幕中心
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  
  // 画布尺寸状态 - 简化为两倍大小
  const [canvasWidth, setCanvasWidth] = useState(screenWidth * 2);
  const [canvasHeight, setCanvasHeight] = useState(screenHeight * 2);
  
  // 可见区域状态 - 优化渲染性能
  const [visibleRect, setVisibleRect] = useState({
    x: 0,
    y: 0,
    width: screenWidth,
    height: screenHeight
  });
  
  // 渲染优化状态 - 简化版本
  const [isRendering, setIsRendering] = useState(false);
  
  // 移动状态
  const [isMoving, setIsMoving] = useState(false);
  
  // 手写模式状态
  const [isHandwritingMode, setIsHandwritingMode] = useState(false);
  const [currentDrawingTool, setCurrentDrawingTool] = useState({ type: 'pen' });
  const [currentDrawingColor, setCurrentDrawingColor] = useState('#000000');
  const [currentStrokeWidth, setCurrentStrokeWidth] = useState(2);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // 引用
  const scrollViewRef = useRef(null);
  const contentRef = useRef(null);
  const handwritingAdapterRef = useRef(null);
  const renderTimeout = useRef(null);
  const isCreatingRef = useRef(false); // 防止重复创建标志
  const abortControllerRef = useRef(null); // 用于取消异步操作

  // 手写模式切换处理函数 - 修复按钮显示与操作一致
  const handleModeToggle = useCallback((newMode) => {
    // AllInOneToolbar传递的是!isFingerMode，所以需要取反
    const newHandwritingMode = !newMode;
    setIsHandwritingMode(newHandwritingMode);
    
    // 不在这里清空笔迹，保持笔迹数据
    console.log('FluidInfiniteCanvasScreen: 模式切换到:', newHandwritingMode ? '手写模式' : '手指模式');
  }, []);

  // 手写转换按钮处理函数
  const handleHandwritingOCR = useCallback(() => {
    setIsHandwritingMode(!isHandwritingMode);
    console.log('FluidInfiniteCanvasScreen: 手写转换按钮点击，当前模式:', isHandwritingMode ? '手指模式' : '手写模式');
  }, [isHandwritingMode]);

  // 使用ScrollView原生缩放功能，不再需要PanResponder

  const handleToolChange = useCallback((tool) => {
    setCurrentDrawingTool(tool);
    console.log('FluidInfiniteCanvasScreen: 工具切换到:', tool);
  }, []);

  const handleColorChange = useCallback((color) => {
    setCurrentDrawingColor(color);
    console.log('FluidInfiniteCanvasScreen: 颜色切换到:', color);
  }, []);

  const handleStrokeWidthChange = useCallback((width) => {
    setCurrentStrokeWidth(width);
    console.log('FluidInfiniteCanvasScreen: 笔迹粗细切换到:', width);
  }, []);

  const handleUndo = useCallback(() => {
    try {
      if (handwritingAdapterRef.current) {
        handwritingAdapterRef.current.undoLastStroke();
      }
    } catch (error) {
      console.error('FluidInfiniteCanvasScreen: 撤销操作失败:', error);
    }
  }, []);

  const handleRedo = useCallback(() => {
    try {
      // TODO: 实现重做功能
      console.log('FluidInfiniteCanvasScreen: 重做功能待实现');
    } catch (error) {
      console.error('FluidInfiniteCanvasScreen: 重做操作失败:', error);
    }
  }, []);

  const handleClear = useCallback(() => {
    try {
      if (handwritingAdapterRef.current) {
        handwritingAdapterRef.current.clearStrokes();
      }
    } catch (error) {
      console.error('FluidInfiniteCanvasScreen: 清空操作失败:', error);
    }
  }, []);

  // 存储待保存的笔迹数据
  const pendingStrokes = useRef([]);
  const saveTimeoutRef = useRef(null);
  const noteDataRef = useRef(null);

  const handleStrokesChange = useCallback(async (strokes) => {
    try {
      if (!Array.isArray(strokes)) {
        console.warn('FluidInfiniteCanvasScreen: 无效的笔迹数据');
        return;
      }

      setCanUndo(strokes.length > 0);
      setCanRedo(false); // TODO: 实现重做逻辑
      console.log(`FluidInfiniteCanvasScreen: 笔迹更新，当前数量: ${strokes.length}`);

      // 性能优化：只存储笔迹数据，不立即保存
      pendingStrokes.current = strokes;

      // 防抖保存：清除之前的保存定时器，设置新的定时器
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // 如果有画布数据，延迟保存笔迹到文件（防抖机制）
      // 使用ref获取最新的noteData，避免依赖项循环
      const currentNoteData = noteDataRef.current;
      if (currentNoteData && currentNoteData.id) {
        saveTimeoutRef.current = setTimeout(async () => {
          await saveStrokesToCanvas(strokes);
        }, 2000); // 2秒后保存，避免频繁保存
      }
    } catch (error) {
      console.error('FluidInfiniteCanvasScreen: 处理笔迹变化失败:', error);
    }
  }, []); // 移除noteData依赖项，避免循环

  // 自动保存笔迹到画布文件（防抖保存）
  const saveStrokesToCanvas = useCallback(async (strokes) => {
    try {
      // 检查是否已取消
      if (abortControllerRef.current?.signal.aborted) {
        console.log('FluidInfiniteCanvasScreen: 保存操作已取消');
        return;
      }

      // 使用ref获取最新的noteData，避免依赖项循环
      const currentNoteData = noteDataRef.current;
      if (!currentNoteData || !currentNoteData.id) {
        console.warn('FluidInfiniteCanvasScreen: 没有画布数据，无法保存笔迹');
        return;
      }

      // 统一ID字段处理 - 确保id和_id字段一致
      const unifiedId = currentNoteData.id || currentNoteData._id;
      if (!unifiedId) {
        console.error('FluidInfiniteCanvasScreen: 画布数据缺少ID字段');
        return;
      }

      // 更新画布数据，包含笔迹信息
      const updatedCanvas = {
        ...currentNoteData,
        id: unifiedId,
        _id: unifiedId, // 确保两个字段一致
        title: noteTitle,
        content: content,
        canvasStyle: currentCanvasStyleName,
        scale: scale,
        offsetX: offsetX,
        offsetY: offsetY,
        canvasWidth: canvasWidth,
        canvasHeight: canvasHeight,
        // 保存笔迹数据
        strokes: strokes,
        strokesData: JSON.stringify(strokes), // 同时保存JSON格式
        updated_at: new Date().toISOString(),
        file_uri: currentNoteData.file_uri || `canvas://${unifiedId}`,
        uri: currentNoteData.uri || `canvas://${unifiedId}`
      };

      console.log('FluidInfiniteCanvasScreen: 自动保存笔迹到画布:', updatedCanvas.id, '笔迹数量:', strokes.length);
      
      const result = await offlineStorageService.saveNote(updatedCanvas);

      // 再次检查是否已取消
      if (abortControllerRef.current?.signal.aborted) {
        console.log('FluidInfiniteCanvasScreen: 保存操作在完成后被取消');
        return;
      }

      if (result.success) {
        // 只更新Redux状态，不更新本地noteData状态，避免循环
        dispatch(updateNote(updatedCanvas));
        console.log('FluidInfiniteCanvasScreen: 笔迹自动保存成功');
      } else {
        throw new Error('自动保存笔迹失败');
      }
    } catch (error) {
      if (abortControllerRef.current?.signal.aborted) {
        console.log('FluidInfiniteCanvasScreen: 保存操作被取消');
        return;
      }
      console.error('FluidInfiniteCanvasScreen: 自动保存笔迹到画布失败:', error);
    }
  }, [noteTitle, content, currentCanvasStyleName, scale, offsetX, offsetY, canvasWidth, canvasHeight, dispatch]);

  const indicatorTimeout = useRef(null);

  // 画布样式配置 - 与CanvasStyleModal.js保持一致
  const canvasStyles = {
    white: {
      backgroundColor: '#FFFFFF',
      pattern: null,
      name: '白色纸张',
      description: '纯白色背景，适合一般绘画'
    },
    yellow: {
      backgroundColor: '#FFF8DC',
      pattern: null,
      name: '淡黄色纸张',
      description: '温暖的淡黄色背景，护眼舒适'
    },
    grid: {
      backgroundColor: '#FFFFFF',
      pattern: 'grid',
      name: '方格纸',
      description: '网格背景，适合绘制图表和几何图形'
    },
    lines: {
      backgroundColor: '#FFFFFF',
      pattern: 'lines',
      name: '横线纸',
      description: '横线背景，适合书写和笔记'
    }
  };

  const currentCanvasStyle = canvasStyles[currentCanvasStyleName] || canvasStyles.white;

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

  // 生成唯一ID并检查是否已存在
  const generateUniqueCanvasId = async () => {
    let attempts = 0;
    const maxAttempts = 10;
    
    while (attempts < maxAttempts) {
      // 使用增强的时间戳+随机数方案，增加更多随机性
      const timestamp = Date.now();
      const random1 = Math.random().toString(36).substr(2, 9);
      const random2 = Math.random().toString(36).substr(2, 9);
      const random3 = Math.floor(Math.random() * 10000);
      const newNoteId = `canvas_${timestamp}_${random1}_${random2}_${random3}`;
      
      // 检查ID是否已存在
      try {
        const existing = await offlineStorageService.getNote(newNoteId);
        if (!existing) {
          console.log('生成唯一画布ID:', newNoteId);
          return newNoteId;
        }
        console.warn('画布ID已存在，重新生成:', newNoteId);
      } catch (error) {
        console.warn('检查画布ID存在性失败，使用当前ID:', newNoteId, error);
        return newNoteId; // 如果检查失败，使用当前ID
      }
      
      attempts++;
    }
    
    // 如果多次尝试都失败，使用最终后备方案
    const finalFallbackId = `canvas_${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${Math.floor(Math.random() * 1000000)}`;
    console.warn('多次尝试生成唯一ID失败，使用最终后备方案:', finalFallbackId);
    return finalFallbackId;
  };

  // 创建新画布
  const createNewCanvas = async () => {
    try {
      const newNoteId = await generateUniqueCanvasId();
      
      const newCanvas = {
        _id: newNoteId,
        id: newNoteId,
        title: noteTitle || '无限画布',
        content: content || '',
        type: 'canvas',
        file_type: 'canvas',
        content_type: 'canvas',
        canvasStyle: canvasStyle,
        scale: 1,
        offsetX: 0, // 初始位置在中央
        offsetY: 0, // 初始位置在中央
        canvasWidth: canvasWidth,
        canvasHeight: canvasHeight,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        user_id: 'current_user',
        is_deleted: false,
        is_synced: false,
        isNew: true,
        // 添加文件URI用于识别
        file_uri: `canvas://${newNoteId}`,
        uri: `canvas://${newNoteId}`
      };

      // 保存到本地存储
      const result = await offlineStorageService.saveNote(newCanvas);
      
      if (result.success) {
        setNoteData(newCanvas);
        setCurrentCanvasStyleName(newCanvas.canvasStyle || canvasStyle);
        setScale(newCanvas.scale || 1);
        setOffsetX(newCanvas.offsetX || 0);
        setOffsetY(newCanvas.offsetY || 0);
        setCanvasWidth(newCanvas.canvasWidth || canvasWidth);
        setCanvasHeight(newCanvas.canvasHeight || canvasHeight);
        dispatch(addNote(newCanvas));
        console.log('新画布创建成功:', newNoteId, 'isNew:', true);
        return newCanvas;
      } else {
        throw new Error('保存失败');
      }
    } catch (error) {
      console.error('创建新画布失败:', error);
      Alert.alert('错误', '创建画布失败，请重试');
      return null;
    }
  };

  // 加载画布数据
  const loadCanvasData = async () => {
    try {
      setIsLoading(true);
      console.log('开始加载画布, finalNoteId:', finalNoteId, 'createNew:', createNew, 'canvasStyle:', canvasStyle);

      if (finalNoteId) {
        // 尝试加载现有画布
        const existingCanvas = await offlineStorageService.getNote(finalNoteId);
        if (existingCanvas) {
          console.log('找到现有画布:', existingCanvas.id);
          
          // 确保ID字段一致 - 参考分页笔记的实现
          const unifiedCanvas = {
            ...existingCanvas,
            id: existingCanvas.id || existingCanvas._id,
            _id: existingCanvas._id || existingCanvas.id,
            file_uri: existingCanvas.file_uri || `canvas://${existingCanvas.id || existingCanvas._id}`,
            uri: existingCanvas.uri || `canvas://${existingCanvas.id || existingCanvas._id}`
          };
          
          setNoteData(unifiedCanvas);
          setContent(unifiedCanvas.content || '');
          setNoteTitle(unifiedCanvas.title || '无限画布');
          
          // 恢复画布样式
          const savedCanvasStyle = unifiedCanvas.canvasStyle || canvasStyle;
          console.log('恢复画布样式:', savedCanvasStyle);
          setCurrentCanvasStyleName(savedCanvasStyle);
          
          // 恢复缩放和移动状态
          setScale(unifiedCanvas.scale || 1);
          // 如果有保存的位置，使用保存的位置；否则使用中央位置
          const savedOffsetX = unifiedCanvas.offsetX !== undefined ? unifiedCanvas.offsetX : 0;
          const savedOffsetY = unifiedCanvas.offsetY !== undefined ? unifiedCanvas.offsetY : 0;
          setOffsetX(savedOffsetX);
          setOffsetY(savedOffsetY);
          setCanvasWidth(unifiedCanvas.canvasWidth || canvasWidth);
          setCanvasHeight(unifiedCanvas.canvasHeight || canvasHeight);
          
          // 恢复笔迹数据
          if (unifiedCanvas.strokes && Array.isArray(unifiedCanvas.strokes)) {
            pendingStrokes.current = unifiedCanvas.strokes;
            console.log('FluidInfiniteCanvasScreen: 恢复笔迹数据，数量:', unifiedCanvas.strokes.length);
          } else if (unifiedCanvas.strokesData) {
            try {
              const strokes = JSON.parse(unifiedCanvas.strokesData);
              if (Array.isArray(strokes)) {
                pendingStrokes.current = strokes;
                console.log('FluidInfiniteCanvasScreen: 从JSON恢复笔迹数据，数量:', strokes.length);
              }
            } catch (error) {
              console.warn('FluidInfiniteCanvasScreen: 解析笔迹数据失败:', error);
            }
          }
          
          // 确保笔迹数据同步到noteData，供HandwritingAdapter使用
          if (pendingStrokes.current.length > 0) {
            unifiedCanvas.strokes = pendingStrokes.current;
          }
          
          setIsLoading(false);
          return;
        } else {
          console.log('未找到画布:', finalNoteId);
          // 如果明确要求创建新画布且当前没有正在创建
          if (createNew && !isCreatingRef.current) {
            console.log('明确要求创建新画布');
            isCreatingRef.current = true;
            try {
              const newCanvas = await createNewCanvas();
              if (newCanvas) {
                setIsLoading(false);
                return;
              }
            } finally {
              isCreatingRef.current = false;
            }
          } else {
            // 保持空白状态，不创建新画布
            console.log('保持空白状态，不创建新画布');
            setNoteData(null);
            setContent('');
            setNoteTitle(title || '无限画布');
            setIsLoading(false);
            return;
          }
        }
      } else {
        // 没有 finalNoteId
        if (createNew && !isCreatingRef.current) {
          console.log('没有 finalNoteId，但要求创建新画布');
          isCreatingRef.current = true;
          try {
            const newCanvas = await createNewCanvas();
            if (newCanvas) {
              setIsLoading(false);
              return;
            }
          } finally {
            isCreatingRef.current = false;
          }
        } else {
          // 保持空白状态
          console.log('没有 finalNoteId，保持空白状态');
          setNoteData(null);
          setContent('');
          setNoteTitle(title || '无限画布');
          setIsLoading(false);
          return;
        }
      }

      setIsLoading(false);
    } catch (error) {
      console.error('加载画布失败:', error);
      Alert.alert('错误', '加载画布失败，请重试');
      setIsLoading(false);
    }
  };

  // 使用ScrollView原生缩放功能，不再需要PanResponder

  // 检查并扩展画布 - 简化为两倍大小，不需要动态扩展
  const checkAndExpandCanvas = useCallback((newOffsetX, newOffsetY) => {
    // 简化为两倍大小，不需要动态扩展
    // 保持画布为固定的两倍大小
  }, []);

  // 处理ScrollView滚动和缩放事件
  const handleScroll = useCallback((event) => {
    const { contentOffset, zoomScale } = event.nativeEvent;
    const { x, y } = contentOffset;
    
    // 更新缩放状态 - 修复缩放检测逻辑
    const newScale = zoomScale || scale;
    if (newScale !== scale) {
      setScale(newScale);
      setShowZoomIndicator(true);
      
      // 延迟隐藏缩放指示器
      if (indicatorTimeout.current) {
        clearTimeout(indicatorTimeout.current);
      }
      indicatorTimeout.current = setTimeout(() => {
        setShowZoomIndicator(false);
      }, 2000);
    }
    
    // 更新位置状态
    setOffsetX(x);
    setOffsetY(y);
    
    // 保存当前位置和缩放到画布数据
    if (noteData && noteData.id) {
      const updatedCanvas = {
        ...noteData,
        offsetX: x,
        offsetY: y,
        scale: newScale,
        updated_at: new Date().toISOString()
      };
      
      // 异步保存位置，不阻塞界面
      offlineStorageService.saveNote(updatedCanvas).then(result => {
        if (result.success) {
          setNoteData(updatedCanvas);
          dispatch(updateNote(updatedCanvas));
        }
      }).catch(error => {
        console.warn('保存画布位置失败:', error);
      });
    }
  }, [noteData, dispatch, scale]);

  // 更新可见区域 - 简化版本，减少状态更新
  const updateVisibleRect = useCallback((x, y) => {
    const newVisibleRect = {
      x: -x,
      y: -y,
      width: screenWidth,
      height: screenHeight
    };
    
    setVisibleRect(newVisibleRect);
  }, []);

  // 调度渲染更新 - 简化版本，减少不必要的状态更新
  const scheduleRenderUpdate = useCallback(() => {
    if (renderTimeout.current) {
      clearTimeout(renderTimeout.current);
    }
    
    // 简化渲染逻辑，减少状态更新
    renderTimeout.current = setTimeout(() => {
      // 移动完成后可以做一些清理工作
    }, 100);
  }, []);

  // 保存画布数据 - 参考分页笔记的流畅保存机制
  const saveCanvasData = async () => {
    try {
      // 检查是否已取消
      if (abortControllerRef.current?.signal.aborted) {
        console.log('FluidInfiniteCanvasScreen: 保存操作已取消');
        return false;
      }

      if (!noteData) {
        const newCanvas = await createNewCanvas();
        return newCanvas !== null;
      }

      // 统一ID字段处理 - 确保id和_id字段一致
      const unifiedId = noteData.id || noteData._id;
      if (!unifiedId) {
        console.error('FluidInfiniteCanvasScreen: 画布数据缺少ID字段');
        throw new Error('画布数据缺少ID字段');
      }

      // 更新现有画布 - 确保ID字段一致
      const updatedCanvas = {
        ...noteData,
        id: unifiedId,
        _id: unifiedId, // 确保两个字段一致
        title: noteTitle,
        content: content,
        canvasStyle: currentCanvasStyleName,
        scale: scale,
        offsetX: offsetX,
        offsetY: offsetY,
        canvasWidth: canvasWidth,
        canvasHeight: canvasHeight,
        // 保存笔迹数据
        strokes: pendingStrokes.current,
        strokesData: JSON.stringify(pendingStrokes.current),
        updated_at: new Date().toISOString(),
        // 确保有文件URI - 参考分页笔记的实现
        file_uri: noteData.file_uri || `canvas://${unifiedId}`,
        uri: noteData.uri || `canvas://${unifiedId}`
      };

      console.log('准备保存画布:', updatedCanvas.id);
      
      const result = await offlineStorageService.saveNote(updatedCanvas);

      // 再次检查是否已取消
      if (abortControllerRef.current?.signal.aborted) {
        console.log('FluidInfiniteCanvasScreen: 保存操作在完成后被取消');
        return false;
      }

      if (result.success) {
        setNoteData(updatedCanvas);
        dispatch(updateNote(updatedCanvas));
        console.log('画布保存成功:', updatedCanvas.id);
        return true;
      } else {
        throw new Error('保存失败');
      }
    } catch (error) {
      if (abortControllerRef.current?.signal.aborted) {
        console.log('FluidInfiniteCanvasScreen: 保存操作被取消');
        return false;
      }
      console.error('保存画布失败:', error);
      Alert.alert('保存失败', '画布保存失败，请稍后重试');
      return false;
    }
  };

  // 组件挂载时加载数据
  useEffect(() => {
    loadCanvasData();
  }, [finalNoteId, createNew, canvasStyle]);

  // 同步noteData到ref，避免依赖项循环
  useEffect(() => {
    noteDataRef.current = noteData;
  }, [noteData]);

  // 组件卸载时清理定时器和取消异步操作
  useEffect(() => {
    // 创建AbortController
    abortControllerRef.current = new AbortController();
    
    return () => {
      // 取消所有关联的异步操作
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      // 清理定时器
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      
      if (renderTimeout.current) {
        clearTimeout(renderTimeout.current);
      }
      
      if (indicatorTimeout.current) {
        clearTimeout(indicatorTimeout.current);
      }
    };
  }, []);

  // 初始化完成
  useEffect(() => {
    if (!isLoading) {
      console.log('画布加载完成');
    }
  }, [isLoading]);

  // 添加到文件历史记录
  useEffect(() => {
    if (noteData && noteData.id) {
      try {
        const fileHistoryService = require('../../services/fileHistoryService').default;
        fileHistoryService.addFile({
          uri: noteData.file_uri || `canvas://${noteData.id}`,
          title: noteData.title || '无限画布',
          type: 'canvas',
          noteType: 'canvas',
          fileName: noteData.title || '无限画布',
          noteId: noteData.id,
          file_uri: noteData.file_uri || `canvas://${noteData.id}`
        });
      } catch (error) {
        console.warn('添加到文件历史失败:', error);
      }
    }
  }, [noteData]);

  // 渲染Skia画布背景
  const renderSkiaCanvasBackground = () => {
    const style = currentCanvasStyle;
    
    return (
      <Canvas style={{ width: canvasWidth, height: canvasHeight }}>
        {/* 背景色 */}
        <Rect
          x={0}
          y={0}
          width={canvasWidth}
          height={canvasHeight}
          color={style.backgroundColor}
        />
        
        {/* 横线图案 */}
        {style.pattern === 'lines' && renderSkiaLinesPattern()}
        
        {/* 网格图案 */}
        {style.pattern === 'grid' && renderSkiaGridPattern()}
        
        {/* 点状图案 */}
        {style.pattern === 'dots' && renderSkiaDotsPattern()}
      </Canvas>
    );
  };

  // 渲染Skia横线图案
  const renderSkiaLinesPattern = () => {
    const lineSpacing = 30;
    const lines = [];
    
    for (let lineY = 0; lineY <= canvasHeight; lineY += lineSpacing) {
      lines.push(
        <Line
          key={`line-${lineY}`}
          p1={{ x: 0, y: lineY }}
          p2={{ x: canvasWidth, y: lineY }}
          color="#E0E0E0"
          style="stroke"
          strokeWidth={1}
        />
      );
    }
    
    return lines;
  };

  // 渲染Skia网格图案
  const renderSkiaGridPattern = () => {
    const gridSize = 20;
    const lines = [];
    
    // 垂直线
    for (let gridX = 0; gridX <= canvasWidth; gridX += gridSize) {
      lines.push(
        <Line
          key={`vline-${gridX}`}
          p1={{ x: gridX, y: 0 }}
          p2={{ x: gridX, y: canvasHeight }}
          color="#E0E0E0"
          style="stroke"
          strokeWidth={1}
        />
      );
    }
    
    // 水平线
    for (let gridY = 0; gridY <= canvasHeight; gridY += gridSize) {
      lines.push(
        <Line
          key={`hline-${gridY}`}
          p1={{ x: 0, y: gridY }}
          p2={{ x: canvasWidth, y: gridY }}
          color="#E0E0E0"
          style="stroke"
          strokeWidth={1}
        />
      );
    }
    
    return lines;
  };

  // 渲染Skia点阵图案
  const renderSkiaDotsPattern = () => {
    const dotSpacing = 20;
    const dots = [];
    
    for (let dotX = 0; dotX <= canvasWidth; dotX += dotSpacing) {
      for (let dotY = 0; dotY <= canvasHeight; dotY += dotSpacing) {
        dots.push(
          <Circle
            key={`dot-${dotX}-${dotY}`}
            cx={dotX}
            cy={dotY}
            r={1}
            color="#E0E0E0"
          />
        );
      }
    }
    
    return dots;
  };


  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <LoadingIndicator message="正在加载画布..." />
      </View>
    );
  }

  // 渲染Skia画布内容
  const renderSkiaCanvasContent = () => {
    return (
      <>
        {/* Skia画布背景 */}
        {renderSkiaCanvasBackground()}
        
        {/* 文本内容层 - 使用View承载文本 */}
        <View style={[
          styles.canvasContent,
          {
            transform: [
              { scale: scale }
            ]
          }
        ]}>
          <Text style={[styles.canvasText, { color: colors.text }]}>
            {content || ''}
          </Text>
        </View>
      </>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ToolbarContainer>
        <AllInOneToolbar
          onToolChange={handleToolChange}
          onColorChange={handleColorChange}
          onStrokeWidthChange={handleStrokeWidthChange}
          onUndo={handleUndo}
          onRedo={handleRedo}
          canUndo={canUndo}
          canRedo={canRedo}
          onClear={handleClear}
          initialTool={currentDrawingTool?.type || 'pen'}
          initialColor={currentDrawingColor}
          initialStrokeWidth={currentStrokeWidth}
          onImageUpload={() => {}}
          onBookmarkAdd={() => {}}
          onBookmarkList={() => {}}
          onHandwritingOCR={handleHandwritingOCR}
          showModeToggle={true}
          onModeToggle={handleModeToggle}
          isFingerMode={!isHandwritingMode}
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
            onSave={saveCanvasData}
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
          ref={contentRef}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={true}
          showsHorizontalScrollIndicator={false}
          scrollEnabled={!isHandwritingMode} // 在手写模式下禁用滚动
          bounces={true}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          maximumZoomScale={3.0}
          minimumZoomScale={0.5}
          zoomEnabled={true}
          onScrollEndDrag={handleScroll}
          onMomentumScrollEnd={handleScroll}
        >
          {/* 画布内容区域 - 支持上下左右扩展 */}
          <View style={[
            styles.canvasInner,
            {
              width: canvasWidth,
              height: canvasHeight,
              transform: [
                { scale: scale }
              ]
            }
          ]}>
            {/* 渲染Skia画布内容 */}
            {renderSkiaCanvasContent()}
          </View>

          {/* 手写适配器层 - 覆盖整个画布区域，参考分页笔记实现 */}
          <HandwritingAdapter
            ref={handwritingAdapterRef}
            currentTool={currentDrawingTool}
            currentColor={currentDrawingColor}
            currentStrokeWidth={currentStrokeWidth}
            documentId={noteData?.id}
            documentType="canvas"
            enablePressure={true}
            enableTilt={true}
            fingerRejection={!isHandwritingMode} // 根据模式决定是否拒绝手指
            isFingerMode={!isHandwritingMode} // 传递手指模式状态
            onStrokesChange={handleStrokesChange}
            initialStrokes={noteData?.strokes || []} // 加载已保存的笔迹数据
            style={[
              styles.handwritingLayer,
              { pointerEvents: isHandwritingMode ? 'auto' : 'none' }
            ]}
            width={canvasWidth}
            height={canvasHeight}
            visible={true}
          />
        </ScrollView>
      </ViewerLayout>


      {/* 缩放指示器 */}
      <ZoomIndicator
        scale={scale}
        visible={showZoomIndicator}
        autoHideDelay={2000}
        topOffset={30}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    minHeight: screenHeight * 2,
    minWidth: screenWidth * 2,
  },
  canvasInner: {
    position: 'relative',
    width: screenWidth * 2,
    height: screenHeight * 2,
  },
  canvasContainer: {
    position: 'relative',
    width: screenWidth * 2,
    height: screenHeight * 2,
  },
  canvasBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  line: {
    position: 'absolute',
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
  canvasContent: {
    position: 'absolute',
    zIndex: 1,
    padding: 40,
    minHeight: screenHeight - 80,
    minWidth: screenWidth - 80,
    // 确保内容显示在画布中央
    left: screenWidth / 2 - (screenWidth - 80) / 2,
    top: screenHeight / 2 - (screenHeight - 80) / 2,
  },
  canvasText: {
    fontSize: 16,
    lineHeight: 24,
    textAlignVertical: 'top',
  },
  // 手写相关样式
  handwritingLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 10,
    pointerEvents: 'auto',
  },
  handwritingEngine: {
    flex: 1,
  },
});

export default FluidInfiniteCanvasScreen;