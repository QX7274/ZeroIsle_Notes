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
  
  // 缩放状态 - 只对内容部分生效
  const [scale, setScale] = useState(1);
  const [showZoomIndicator, setShowZoomIndicator] = useState(false);
  
  // 画布位置状态 - 以界面中心为起点
  const [offsetX, setOffsetX] = useState((screenWidth * 5 - screenWidth) / 2);
  const [offsetY, setOffsetY] = useState((screenHeight * 5 - screenHeight) / 2);
  
  // 画布尺寸状态 - 支持无限扩展
  const [canvasWidth, setCanvasWidth] = useState(screenWidth * 5);
  const [canvasHeight, setCanvasHeight] = useState(screenHeight * 5);
  
  // 可见区域状态 - 优化渲染性能
  const [visibleRect, setVisibleRect] = useState({
    x: 0,
    y: 0,
    width: screenWidth,
    height: screenHeight
  });
  
  // 渲染优化状态
  const [isRendering, setIsRendering] = useState(false);
  const [renderQueue, setRenderQueue] = useState([]);
  const [renderedAreas, setRenderedAreas] = useState(new Set()); // 记录已渲染区域
  
  // 滑动指示器状态
  const [showScrollIndicators, setShowScrollIndicators] = useState(true); // 初始显示
  const [isMoving, setIsMoving] = useState(false);
  const [scrollOffsetY, setScrollOffsetY] = useState(0);
  const [scrollOffsetX, setScrollOffsetX] = useState(0);
  
  // 引用
  const scrollViewRef = useRef(null);
  const contentRef = useRef(null);
  const initialDistance = useRef(0);
  const initialScale = useRef(1);
  const initialOffset = useRef({ x: 0, y: 0 });
  const isTransforming = useRef(false);
  const lastPanTime = useRef(0);
  const panStartTime = useRef(0);
  const renderTimeout = useRef(null);
  const indicatorTimeout = useRef(null);
  const lastRenderTime = useRef(0);

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

  // 创建新画布
  const createNewCanvas = async () => {
    try {
      const newNoteId = `canvas_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
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
        offsetX: (screenWidth * 5 - screenWidth) / 2, // 初始位置在中央
        offsetY: (screenHeight * 5 - screenHeight) / 2, // 初始位置在中央
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
        setOffsetX(newCanvas.offsetX || (screenWidth * 5 - screenWidth) / 2);
        setOffsetY(newCanvas.offsetY || (screenHeight * 5 - screenHeight) / 2);
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
          setNoteData(existingCanvas);
          setContent(existingCanvas.content || '');
          setNoteTitle(existingCanvas.title || '无限画布');
          
          // 恢复画布样式
          const savedCanvasStyle = existingCanvas.canvasStyle || canvasStyle;
          console.log('恢复画布样式:', savedCanvasStyle);
          setCurrentCanvasStyleName(savedCanvasStyle);
          
          // 恢复缩放和移动状态
          setScale(existingCanvas.scale || 1);
          // 如果有保存的位置，使用保存的位置；否则使用中央位置
          const savedOffsetX = existingCanvas.offsetX !== undefined ? existingCanvas.offsetX : (screenWidth * 5 - screenWidth) / 2;
          const savedOffsetY = existingCanvas.offsetY !== undefined ? existingCanvas.offsetY : (screenHeight * 5 - screenHeight) / 2;
          setOffsetX(savedOffsetX);
          setOffsetY(savedOffsetY);
          setCanvasWidth(existingCanvas.canvasWidth || canvasWidth);
          setCanvasHeight(existingCanvas.canvasHeight || canvasHeight);
          
          setIsLoading(false);
          return;
        } else {
          console.log('未找到画布:', finalNoteId);
          // 如果明确要求创建新画布
          if (createNew) {
            console.log('明确要求创建新画布');
            const newCanvas = await createNewCanvas();
            if (newCanvas) {
              setIsLoading(false);
              return;
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
        if (createNew) {
          console.log('没有 finalNoteId，但要求创建新画布');
          const newCanvas = await createNewCanvas();
          if (newCanvas) {
            setIsLoading(false);
            return;
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

  // 手势处理 - 优化版本，防止误触发退出
  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: (evt) => {
      return evt.nativeEvent.touches.length === 1 || evt.nativeEvent.touches.length === 2;
    },
    
    onMoveShouldSetPanResponder: (evt, gestureState) => {
      const { touches } = evt.nativeEvent;
      
      // 双指触摸直接响应
      if (touches.length === 2) return true;
      
      // 单指触摸需要判断移动距离
      if (touches.length === 1) {
        const { dx, dy } = gestureState;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance > 10; // 移动超过10px才响应
      }
      
      return false;
    },

    onPanResponderGrant: (evt) => {
      const { touches } = evt.nativeEvent;
      panStartTime.current = Date.now();
      
      if (touches.length === 2) {
        // 双指缩放
        const touch1 = touches[0];
        const touch2 = touches[1];
        const distance = Math.sqrt(
          Math.pow(touch2.pageX - touch1.pageX, 2) +
          Math.pow(touch2.pageY - touch1.pageY, 2)
        );
        initialDistance.current = distance;
        initialScale.current = scale;
        isTransforming.current = true;
      } else if (touches.length === 1) {
        // 单指移动
        initialOffset.current = { x: offsetX, y: offsetY };
        isTransforming.current = true;
        lastPanTime.current = Date.now();
        
        // 显示滑动指示器
        setShowScrollIndicators(true);
        setIsMoving(true);
      }
    },
    
    onPanResponderMove: (evt, gestureState) => {
      const { touches } = evt.nativeEvent;

      if (touches.length === 2 && isTransforming.current) {
        // 双指缩放 - 只对内容部分生效
        const touch1 = touches[0];
        const touch2 = touches[1];
        const distance = Math.sqrt(
          Math.pow(touch2.pageX - touch1.pageX, 2) +
          Math.pow(touch2.pageY - touch1.pageY, 2)
        );

        const scaleRatio = distance / initialDistance.current;
        let newScale = initialScale.current * scaleRatio;

        // 最小缩放限制为50%
        newScale = Math.max(0.5, Math.min(3, newScale));

        // 添加缩放步进，使缩放更平滑
        const scaleStep = 0.02;
        newScale = Math.round(newScale / scaleStep) * scaleStep;

        setScale(newScale);
        
        // 只在缩放变化时显示指示器
        if (Math.abs(newScale - scale) > 0.01) {
          setShowZoomIndicator(true);
        }
      } else if (touches.length === 1 && isTransforming.current) {
        // 单指移动 - 支持各个方向，速度更快
        const newOffsetX = initialOffset.current.x - gestureState.dx * 1.5; // 增加移动速度
        const newOffsetY = initialOffset.current.y - gestureState.dy * 1.5;
        
        // 检查是否需要扩展画布 - 优化性能
        const currentTime = Date.now();
        if (currentTime - lastPanTime.current > 30) { // 进一步减少节流时间，提升响应速度
          checkAndExpandCanvas(newOffsetX, newOffsetY);
          lastPanTime.current = currentTime;
        }
        
        setOffsetX(newOffsetX);
        setOffsetY(newOffsetY);
        
        // 更新滑动偏移量
        setScrollOffsetX(Math.abs(newOffsetX));
        setScrollOffsetY(Math.abs(newOffsetY));
        
        // 更新可见区域并触发渲染优化
        updateVisibleRect(newOffsetX, newOffsetY);
        scheduleRenderUpdate();
      }
    },
    
    onPanResponderRelease: (evt, gestureState) => {
      const panDuration = Date.now() - panStartTime.current;
      const { dx, dy } = gestureState;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // 如果移动距离很小且时间很短，可能是误触
      if (distance < 20 && panDuration < 200) {
        // 重置状态，不执行任何操作
        isTransforming.current = false;
        setShowScrollIndicators(false);
        setIsMoving(false);
        return;
      }
      
      isTransforming.current = false;
      setIsMoving(false);
      
      // 延迟隐藏指示器
      if (indicatorTimeout.current) {
        clearTimeout(indicatorTimeout.current);
      }
      indicatorTimeout.current = setTimeout(() => {
        setShowScrollIndicators(false);
        setShowZoomIndicator(false);
      }, 1500);
    }
  });

  // 检查并扩展画布
  const checkAndExpandCanvas = useCallback((newOffsetX, newOffsetY) => {
    const expandThreshold = 300; // 增加扩展阈值
    let needExpand = false;
    let newWidth = canvasWidth;
    let newHeight = canvasHeight;

    // 检查左边界
    if (newOffsetX > -expandThreshold) {
      newWidth += screenWidth;
      needExpand = true;
    }
    
    // 检查右边界
    if (newOffsetX < -(canvasWidth - screenWidth) + expandThreshold) {
      newWidth += screenWidth;
      needExpand = true;
    }
    
    // 检查上边界
    if (newOffsetY > -expandThreshold) {
      newHeight += screenHeight;
      needExpand = true;
    }
    
    // 检查下边界
    if (newOffsetY < -(canvasHeight - screenHeight) + expandThreshold) {
      newHeight += screenHeight;
      needExpand = true;
    }

    if (needExpand) {
      setCanvasWidth(newWidth);
      setCanvasHeight(newHeight);
      console.log('画布已扩展:', newWidth, 'x', newHeight);
    }
  }, [canvasWidth, canvasHeight]);

  // 更新可见区域 - 优化版本，支持增量渲染
  const updateVisibleRect = useCallback((x, y) => {
    const newVisibleRect = {
      x: -x,
      y: -y,
      width: screenWidth,
      height: screenHeight
    };
    
    setVisibleRect(newVisibleRect);
    
    // 记录已渲染区域，避免重复渲染
    const areaKey = `${Math.floor(x / 100)}_${Math.floor(y / 100)}`;
    setRenderedAreas(prev => new Set([...prev, areaKey]));
  }, []);

  // 调度渲染更新 - 优化性能
  const scheduleRenderUpdate = useCallback(() => {
    if (renderTimeout.current) {
      clearTimeout(renderTimeout.current);
    }
    
    // 在移动时设置渲染状态
    setIsRendering(true);
    
    renderTimeout.current = setTimeout(() => {
      setIsRendering(false);
      setRenderQueue([]);
    }, 50); // 减少到50ms，提升响应速度
  }, []);

  // 保存画布数据
  const saveCanvasData = async () => {
    try {
      if (!noteData) {
        const newCanvas = await createNewCanvas();
        return newCanvas !== null;
      }

      // 更新现有画布
      const updatedCanvas = {
        ...noteData,
        title: noteTitle,
        content: content,
        canvasStyle: currentCanvasStyleName,
        scale: scale,
        offsetX: offsetX,
        offsetY: offsetY,
        canvasWidth: canvasWidth,
        canvasHeight: canvasHeight,
        updated_at: new Date().toISOString(),
        // 确保有文件URI
        file_uri: noteData.file_uri || `canvas://${noteData.id}`,
        uri: noteData.uri || `canvas://${noteData.id}`
      };

      console.log('准备保存画布:', updatedCanvas.id);
      
      const result = await offlineStorageService.saveNote(updatedCanvas);

      if (result.success) {
        setNoteData(updatedCanvas);
        dispatch(updateNote(updatedCanvas));
        console.log('画布保存成功:', updatedCanvas.id);
        return true;
      } else {
        throw new Error('保存失败');
      }
    } catch (error) {
      console.error('保存画布失败:', error);
      Alert.alert('保存失败', '画布保存失败，请稍后重试');
      return false;
    }
  };

  // 组件挂载时加载数据
  useEffect(() => {
    loadCanvasData();
  }, [finalNoteId, createNew, canvasStyle]);

  // 初始化滑动指示器位置 - 显示在中央
  useEffect(() => {
    if (!isLoading) {
      // 画布加载完成后立即显示指示器
      setShowScrollIndicators(true);
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

  // 渲染画布背景 - 优化版本，支持增量渲染
  const renderCanvasBackground = () => {
    const style = currentCanvasStyle;
    const { x, y, width, height } = visibleRect;
    
    // 检查当前区域是否已渲染
    const areaKey = `${Math.floor(-x / 100)}_${Math.floor(-y / 100)}`;
    const isAlreadyRendered = renderedAreas.has(areaKey);
    
    // 如果已渲染且不在移动状态，直接返回背景色
    if (isAlreadyRendered && !isMoving) {
      return (
        <View style={[
          styles.canvasBackground, 
          { 
            backgroundColor: style.backgroundColor,
            width: width,
            height: height,
            left: x,
            top: y
          }
        ]} />
      );
    }
    
    return (
      <View style={[
        styles.canvasBackground, 
        { 
          backgroundColor: style.backgroundColor,
          width: width,
          height: height,
          left: x,
          top: y
        }
      ]}>
        {style.pattern === 'lines' && renderLinesPattern(x, y, width, height)}
        {style.pattern === 'grid' && renderGridPattern(x, y, width, height)}
        {style.pattern === 'dots' && renderDotsPattern(x, y, width, height)}
      </View>
    );
  };

  // 渲染横线背景 - 只渲染可见区域
  const renderLinesPattern = (x, y, width, height) => {
    const lineSpacing = 30;
    const lines = [];
    
    const startY = Math.floor(y / lineSpacing) * lineSpacing;
    const endY = Math.ceil((y + height) / lineSpacing) * lineSpacing;
    
    for (let lineY = startY; lineY <= endY; lineY += lineSpacing) {
      if (lineY >= y && lineY <= y + height) {
        lines.push(
          <View
            key={`line-${lineY}`}
            style={[
              styles.line,
              { 
                top: lineY - y,
                width: width,
                left: 0
              }
            ]}
          />
        );
      }
    }
    
    return lines;
  };

  // 渲染网格背景 - 只渲染可见区域
  const renderGridPattern = (x, y, width, height) => {
    const gridSize = 20;
    const lines = [];
    
    const startX = Math.floor(x / gridSize) * gridSize;
    const endX = Math.ceil((x + width) / gridSize) * gridSize;
    const startY = Math.floor(y / gridSize) * gridSize;
    const endY = Math.ceil((y + height) / gridSize) * gridSize;
    
    // 垂直线
    for (let gridX = startX; gridX <= endX; gridX += gridSize) {
      if (gridX >= x && gridX <= x + width) {
        lines.push(
          <View
            key={`v-${gridX}`}
            style={[
              styles.gridLine,
              { left: gridX - x, width: 1, height: height }
            ]}
          />
        );
      }
    }
    
    // 水平线
    for (let gridY = startY; gridY <= endY; gridY += gridSize) {
      if (gridY >= y && gridY <= y + height) {
        lines.push(
          <View
            key={`h-${gridY}`}
            style={[
              styles.gridLine,
              { top: gridY - y, height: 1, width: width }
            ]}
          />
        );
      }
    }
    
    return lines;
  };

  // 渲染点阵背景 - 只渲染可见区域
  const renderDotsPattern = (x, y, width, height) => {
    const dotSpacing = 20;
    const dots = [];
    
    const startX = Math.floor(x / dotSpacing) * dotSpacing;
    const endX = Math.ceil((x + width) / dotSpacing) * dotSpacing;
    const startY = Math.floor(y / dotSpacing) * dotSpacing;
    const endY = Math.ceil((y + height) / dotSpacing) * dotSpacing;
    
    for (let dotX = startX; dotX <= endX; dotX += dotSpacing) {
      for (let dotY = startY; dotY <= endY; dotY += dotSpacing) {
        if (dotX >= x && dotX <= x + width && dotY >= y && dotY <= y + height) {
          dots.push(
            <View
              key={`dot-${dotX}-${dotY}`}
              style={[
                styles.dot,
                { left: dotX - x, top: dotY - y }
              ]}
            />
          );
        }
      }
    }
    
    return dots;
  };

  // 计算右侧滑动指示器参数
  const getRightScrollIndicatorProps = () => {
    const toolbarHeight = Platform.OS === 'ios' ? 50 : 28;
    
    // 计算滑动偏移量 - 从中央位置开始计算
    const maxScrollY = Math.max(0, canvasHeight - screenHeight);
    const centerOffsetY = (screenHeight * 5 - screenHeight) / 2;
    const currentScrollY = Math.abs(offsetY - centerOffsetY);
    const scrollOffset = Math.min(currentScrollY, maxScrollY);
    
    return {
      scrollOffset: scrollOffset,
      contentHeight: canvasHeight,
      visibleHeight: screenHeight,
      visible: showScrollIndicators && canvasHeight > screenHeight, // 只在有内容时显示
      autoHideDelay: 2000,
      position: 'right',
      backgroundColor: 'rgba(0, 0, 0, 0.4)',
      activeColor: 'rgba(0, 0, 0, 0.6)',
      borderRadius: 3,
      minSize: 30,
      maxSize: 100,
      toolbarHeight: toolbarHeight,
      toolbarOffset: 20,
      showPageDividers: false,
      fadeInDuration: 200,
      fadeOutDuration: 300
    };
  };

  // 计算底部滑动指示器参数
  const getBottomScrollIndicatorProps = () => {
    // 计算滑动偏移量 - 从中央位置开始计算
    const maxScrollX = Math.max(0, canvasWidth - screenWidth);
    const centerOffsetX = (screenWidth * 5 - screenWidth) / 2;
    const currentScrollX = Math.abs(offsetX - centerOffsetX);
    const scrollOffset = Math.min(currentScrollX, maxScrollX);
    
    return {
      scrollOffset: scrollOffset,
      contentWidth: canvasWidth,
      visibleWidth: screenWidth,
      visible: showScrollIndicators && canvasWidth > screenWidth, // 只在有内容时显示
      autoHideDelay: 2000,
      position: 'bottom',
      backgroundColor: 'rgba(0, 0, 0, 0.4)',
      activeColor: 'rgba(0, 0, 0, 0.6)',
      borderRadius: 3,
      minSize: 30,
      maxSize: 100,
      toolbarHeight: 0,
      toolbarOffset: 0,
      showPageDividers: false,
      fadeInDuration: 200,
      fadeOutDuration: 300
    };
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <LoadingIndicator message="正在加载画布..." />
      </View>
    );
  }

  // 渲染画布内容 - 优化版本，只渲染可见区域
  const renderCanvasContent = () => {
    // 如果正在渲染，显示背景色占位符
    if (isRendering) {
      return (
        <View style={[styles.canvasContainer, { backgroundColor: currentCanvasStyle.backgroundColor }]}>
          <View style={styles.renderingPlaceholder}>
            <Text style={styles.renderingText}>正在渲染...</Text>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.canvasContainer}>
        {/* 画布背景 - 只渲染可见区域 */}
        {renderCanvasBackground()}
        
        {/* 画布内容 - 只对内容部分应用缩放 */}
        <View style={[
          styles.canvasContent,
          {
            transform: [
              { translateX: -screenWidth / 2 }, 
              { translateY: -screenHeight / 2 },
              { scale: scale }
            ]
          }
        ]}>
          <Text style={[styles.canvasText, { color: colors.text }]}>
            {content || '点击开始绘制...'}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ToolbarContainer>
        <AllInOneToolbar
          onToolChange={() => {}}
          onColorChange={() => {}}
          onStrokeWidthChange={() => {}}
          onImageUpload={() => {}}
          onBookmarkAdd={() => {}}
          onBookmarkList={() => {}}
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
        <View
          ref={contentRef}
          style={styles.canvasWrapper}
          {...panResponder.panHandlers}
        >
          <View style={[
            styles.canvasInner,
            {
              transform: [
                { translateX: offsetX },
                { translateY: offsetY }
              ]
            }
          ]}>
            {/* 渲染画布内容 */}
            {renderCanvasContent()}
          </View>
        </View>
      </ViewerLayout>

      {/* 右侧滑动指示器 - 初始位置在中央 */}
      <CustomScrollIndicator {...getRightScrollIndicatorProps()} />

      {/* 底部滑动指示器 - 初始位置在中央 */}
      <CustomScrollIndicator {...getBottomScrollIndicatorProps()} />

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
  canvasWrapper: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  canvasInner: {
    position: 'absolute',
    width: screenWidth * 5,
    height: screenHeight * 5,
  },
  canvasContainer: {
    position: 'relative',
    width: screenWidth * 5,
    height: screenHeight * 5,
  },
  canvasBackground: {
    position: 'absolute',
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
    left: '50%',
    top: '50%',
  },
  canvasText: {
    fontSize: 16,
    lineHeight: 24,
    textAlignVertical: 'top',
  },
  // 渲染占位符样式
  renderingPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  renderingText: {
    fontSize: 14,
    color: '#999',
  },
  // 滑动指示器样式 - 优化版本，只保留滑动指示
  rightScrollIndicator: {
    position: 'absolute',
    right: 8,
    width: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: 3,
    zIndex: 1000,
  },
  bottomScrollIndicator: {
    position: 'absolute',
    bottom: 8,
    height: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: 3,
    zIndex: 1000,
  },
  scrollIndicatorThumb: {
    position: 'absolute',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: 3,
    minWidth: 6,
    minHeight: 6,
  },
});

export default FluidInfiniteCanvasScreen;