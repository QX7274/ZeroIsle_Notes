/**
 * 流畅无限画布界面 - 完全重写版
 * 使用 Skia Group Transform 实现真正的无限画布
 * 
 * 核心设计：
 * - Canvas固定为屏幕大小
 * - 笔迹使用世界坐标系统（-50000 到 50000）
 * - 通过Skia的Group transform实现缩放和平移
 * - 触摸坐标直接转换为世界坐标，简单准确
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  Platform,
  Alert,
  Text,
} from 'react-native';
import { Canvas, Group, Rect, Line, Path, Skia } from '@shopify/react-native-skia';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { useSharedValue, clamp, runOnJS } from 'react-native-reanimated';

// 导入组件
import { useTheme } from '../../context/ThemeContext';
import ViewerLayout from '../../components/viewer/ViewerLayout';
import ToolbarContainer from '../../components/viewer/ToolbarContainer';
import AllInOneToolbar from '../../components/common/AllInOneToolbar';
import ZoomIndicator from '../../components/common/ZoomIndicator';
import LoadingIndicator from '../../components/common/LoadingIndicator';
import BackButton from '../../components/viewer/BackButton';
import SaveButton from '../../components/common/SaveButton';

// 导入服务
import { offlineStorageService } from '../../services/offline';
import { useDispatch } from 'react-redux';
import { addNote, updateNote } from '../../redux/slices/notesSlice';

// 屏幕尺寸
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// 世界坐标范围（两倍固定大小画布）
const WORLD_SIZE = SCREEN_WIDTH * 2; // 两倍屏幕宽度
const WORLD_BOUNDS = {
  left: -WORLD_SIZE,
  top: -WORLD_SIZE,
  right: WORLD_SIZE,
  bottom: WORLD_SIZE,
};

// 缩放范围
const MIN_SCALE = 0.1;
const MAX_SCALE = 10.0;

// 画布样式
const canvasStyles = {
  white: { backgroundColor: '#FFFFFF', pattern: null },
  yellow: { backgroundColor: '#FFF8DC', pattern: null },
  grid: { backgroundColor: '#FFFFFF', pattern: 'grid' },
  lines: { backgroundColor: '#FFFFFF', pattern: 'lines' },
};

const FluidInfiniteCanvasScreen = ({ route, navigation }) => {
  const { 
    noteId, 
    title: initialTitle = '无限画布', 
    content: initialContent = '',
    canvasStyle = 'white', 
    createNew = false 
  } = route.params || {};
  const { colors } = useTheme();
  const dispatch = useDispatch();

  // 基础状态
  const [isLoading, setIsLoading] = useState(true);
  const [noteData, setNoteData] = useState(null);
  const [noteTitle, setNoteTitle] = useState(initialTitle);
  const [currentCanvasStyle, setCurrentCanvasStyle] = useState(canvasStyle);

  // 视口状态（世界坐标系统）
  const [viewport, setViewport] = useState({
    x: 0,      // 视口中心的世界坐标
    y: 0,
    scale: 1,  // 缩放级别
  });

  // 手势临时状态
  const gestureState = useRef({
    lastViewport: { x: 0, y: 0, scale: 1 },
    focalPoint: { x: 0, y: 0 },
  });

  // 批量更新的帧ID
  const updateFrameRef = useRef(null);
  
  // 节流更新视口
  const updateViewport = useCallback((newViewport) => {
    if (updateFrameRef.current) {
      cancelAnimationFrame(updateFrameRef.current);
    }
    
    updateFrameRef.current = requestAnimationFrame(() => {
      setViewport(newViewport);
    });
  }, []);

  // 背景渲染缓存
  const lastBackgroundViewport = useRef({ x: 0, y: 0, scale: 1 });
  const [backgroundKey, setBackgroundKey] = useState(0);

  // 绘图状态
  const [currentTool, setCurrentTool] = useState('move');
  const [currentColor, setCurrentColor] = useState('#000000');
  const [currentStrokeWidth, setCurrentStrokeWidth] = useState(2);
  const [isDrawingMode, setIsDrawingMode] = useState(false);

  // 笔迹数据
  const [strokes, setStrokes] = useState([]);
  const [currentStroke, setCurrentStroke] = useState(null);
  const drawingState = useRef({ 
    isDrawing: false, 
    currentStroke: null,
    points: [],  // 临时点缓冲
    lastUpdateTime: 0,
  });

  // UI状态
  const [showZoomIndicator, setShowZoomIndicator] = useState(false);

  const styleConfig = canvasStyles[currentCanvasStyle] || canvasStyles.white;

  // 监听viewport变化，只在显著移动时更新背景
  useEffect(() => {
    const last = lastBackgroundViewport.current;
    const deltaX = Math.abs(viewport.x - last.x);
    const deltaY = Math.abs(viewport.y - last.y);
    const deltaScale = Math.abs(viewport.scale - last.scale);
    
    // 只在移动超过100像素或缩放变化超过0.1时更新背景
    if (deltaX > 100 || deltaY > 100 || deltaScale > 0.1) {
      lastBackgroundViewport.current = { ...viewport };
      setBackgroundKey(prev => prev + 1);
    }
  }, [viewport]);

  // =================================================================
  // 坐标转换函数
  // =================================================================
  
  // 屏幕坐标 -> 世界坐标（关键函数）
  const screenToWorld = useCallback((screenX, screenY) => {
    // 触摸点相对于屏幕中心的偏移
    const offsetX = screenX - SCREEN_WIDTH / 2;
    const offsetY = screenY - SCREEN_HEIGHT / 2;
    
    // 转换为世界坐标
    const worldX = offsetX / viewport.scale + viewport.x;
    const worldY = offsetY / viewport.scale + viewport.y;
    
    return { x: worldX, y: worldY };
  }, [viewport]);

  // =================================================================
  // 数据加载和保存
  // =================================================================
  
  useEffect(() => {
    loadCanvasData();
  }, [noteId, createNew]);

  const loadCanvasData = async () => {
    try {
      setIsLoading(true);

      if (noteId) {
        const canvas = await offlineStorageService.getNote(noteId);
        if (canvas) {
          setNoteData(canvas);
          setNoteTitle(canvas.title || '无限画布');
          setCurrentCanvasStyle(canvas.canvasStyle || canvasStyle);

          if (canvas.viewport) {
            setViewport(canvas.viewport);
          }

          if (canvas.strokes && Array.isArray(canvas.strokes)) {
            setStrokes(canvas.strokes);
          }
        }
      } else if (createNew) {
        await createNewCanvas();
      }

      setIsLoading(false);
    } catch (error) {
      console.error('加载画布失败:', error);
      Alert.alert('错误', '加载画布失败');
      setIsLoading(false);
    }
  };

  const createNewCanvas = async () => {
    try {
      // ✅ 采用CardNoteScreen的安全策略：必须有noteId才能创建
      if (!noteId) {
        console.error('FluidInfiniteCanvasScreen: 缺少noteId，无法创建画布');
        Alert.alert('错误', '无法创建画布：缺少笔记ID');
        return { success: false, error: 'Missing noteId' };
      }

      console.log('FluidInfiniteCanvasScreen: 创建新画布，ID:', noteId);

      const newCanvas = {
        _id: noteId,
        id: noteId,
        title: noteTitle || initialTitle || '新建画布',
        content: initialContent || '',
        type: 'canvas',
        noteType: 'canvas',
        file_type: 'canvas',
        content_type: 'canvas',
        canvasStyle: currentCanvasStyle,
        viewport: { x: 0, y: 0, scale: 1 },
        strokes: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        word_count: 0,
        is_deleted: false,
        is_synced: false,
        is_offline: true,
        user_id: 'current_user',
        // 确保文件URI一致 - 与CardNoteScreen保持一致
        file_uri: `canvas://${noteId}`,
        uri: `canvas://${noteId}`
      };

      const result = await offlineStorageService.saveNote(newCanvas);
      if (result.success) {
        // 使用保存后返回的笔记数据，确保ID字段一致
        const savedNote = result.note || newCanvas;
        setNoteData(savedNote);
        dispatch(addNote(savedNote));
        console.log('FluidInfiniteCanvasScreen: 新画布创建成功');
        return { success: true, note: savedNote };
      } else {
        throw new Error('保存新画布失败');
      }
    } catch (error) {
      console.error('FluidInfiniteCanvasScreen: 创建新画布失败:', error);
      Alert.alert('错误', '创建画布失败');
      return { success: false, error: error.message };
    }
  };

  const saveCanvas = useCallback(async () => {
    try {
      // ✅ 采用CardNoteScreen的安全策略：只在noteData有效时保存
      if (!noteData) {
        if (__DEV__) {
          console.warn('⚠️ [FluidInfiniteCanvas] noteData为空，跳过保存');
        }
        return { success: false, error: 'No noteData available' };
      }

      // ✅ 额外检查：确保noteData有有效的ID
      if (!noteData._id && !noteData.id) {
        if (__DEV__) {
          console.warn('⚠️ [FluidInfiniteCanvas] noteData缺少ID，跳过保存');
        }
        return { success: false, error: 'No noteId available' };
      }

      const updated = {
        ...noteData,
        viewport: viewport,
        strokes: strokes,
        updated_at: new Date().toISOString(),
        is_synced: false,
        is_offline: true,
        // 确保文件URI一致
        file_uri: noteData.file_uri || `canvas://${noteData.id || noteData._id}`,
        uri: noteData.uri || `canvas://${noteData.id || noteData._id}`,
      };

      const result = await offlineStorageService.saveNote(updated);
      if (result.success) {
        // 使用保存后返回的笔记数据，确保ID字段一致
        const savedNote = result.note || updated;
        setNoteData(savedNote);
        dispatch(updateNote(savedNote));
        return { success: true, note: savedNote };
      } else {
        console.warn('保存失败:', result.error);
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.warn('保存失败:', error);
      return { success: false, error: error.message };
    }
  }, [noteData, dispatch, viewport, strokes]);

  // 返回处理
  const handleGoBack = useCallback(() => {
    saveCanvas();
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Home');
    }
  }, [saveCanvas, navigation]);

  // =================================================================
  // 手势处理（简化版）
  // =================================================================
  
  const pinchGesture = Gesture.Pinch()
    .onStart((e) => {
      gestureState.current.lastViewport = { ...viewport };
      gestureState.current.focalPoint = { x: e.focalX, y: e.focalY };
      runOnJS(setShowZoomIndicator)(true);
    })
    .onUpdate((e) => {
      const newScale = clamp(
        gestureState.current.lastViewport.scale * e.scale,
        MIN_SCALE,
        MAX_SCALE
      );
      
      // 计算焦点在世界坐标中的位置，保持不变
      const focal = gestureState.current.focalPoint;
      const focalOffsetX = focal.x - SCREEN_WIDTH / 2;
      const focalOffsetY = focal.y - SCREEN_HEIGHT / 2;
      
      const oldWorldX = focalOffsetX / gestureState.current.lastViewport.scale + gestureState.current.lastViewport.x;
      const oldWorldY = focalOffsetY / gestureState.current.lastViewport.scale + gestureState.current.lastViewport.y;
      
      const newX = oldWorldX - focalOffsetX / newScale;
      const newY = oldWorldY - focalOffsetY / newScale;
      
      // 使用节流更新，减少卡顿
      runOnJS(updateViewport)({ x: newX, y: newY, scale: newScale });
    })
    .onEnd(() => {
      runOnJS(setShowZoomIndicator)(false);
    });

  const panGesture = Gesture.Pan()
    .onStart(() => {
      gestureState.current.lastViewport = { ...viewport };
    })
    .onUpdate((e) => {
      const newX = gestureState.current.lastViewport.x - e.translationX / gestureState.current.lastViewport.scale;
      const newY = gestureState.current.lastViewport.y - e.translationY / gestureState.current.lastViewport.scale;
      
      // 使用节流更新，减少卡顿
      runOnJS(updateViewport)({ x: newX, y: newY, scale: gestureState.current.lastViewport.scale });
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((e) => {
      const targetScale = viewport.scale > 1.5 ? 1 : 2.5;
      
      // 以触摸点为中心缩放
      const touchOffsetX = e.x - SCREEN_WIDTH / 2;
      const touchOffsetY = e.y - SCREEN_HEIGHT / 2;
      
      const worldX = touchOffsetX / viewport.scale + viewport.x;
      const worldY = touchOffsetY / viewport.scale + viewport.y;
      
      const newX = worldX - touchOffsetX / targetScale;
      const newY = worldY - touchOffsetY / targetScale;
      
      runOnJS(updateViewport)({ x: newX, y: newY, scale: targetScale });
      runOnJS(setShowZoomIndicator)(true);
      runOnJS(() => {
        setTimeout(() => setShowZoomIndicator(false), 1500);
      })();
    });

  // 简化手势组合 - 减少卡顿
  const composedGesture = isDrawingMode
    ? doubleTapGesture  // 绘图模式只允许双击缩放
    : Gesture.Race(pinchGesture, panGesture, doubleTapGesture);  // 移动模式使用Race减少冲突

  // =================================================================
  // 绘图功能
  // =================================================================
  
  const handleTouchStart = useCallback((e) => {
    if (!isDrawingMode) return;

    const touch = e.nativeEvent;
    const worldPoint = screenToWorld(touch.locationX || touch.pageX, touch.locationY || touch.pageY);
    
    const newStroke = {
      id: `stroke_${Date.now()}`,
      tool: currentTool,
      color: currentColor,
      strokeWidth: currentStrokeWidth,
      points: [worldPoint],
    };
    
    setCurrentStroke(newStroke);
    drawingState.current = { 
      isDrawing: true, 
      currentStroke: newStroke,
      points: [],
      lastUpdateTime: Date.now(),
    };
    
    console.log('开始绘图:', worldPoint);
  }, [isDrawingMode, currentTool, currentColor, currentStrokeWidth, screenToWorld]);

  const handleTouchMove = useCallback((e) => {
    if (!isDrawingMode || !drawingState.current.isDrawing) return;

    const touch = e.nativeEvent;
    const worldPoint = screenToWorld(touch.locationX || touch.pageX, touch.locationY || touch.pageY);
    
    // 点简化：跳过距离太近的点
    const lastStroke = drawingState.current.currentStroke;
    if (lastStroke && lastStroke.points.length > 0) {
      const lastPoint = lastStroke.points[lastStroke.points.length - 1];
      const distance = Math.sqrt(
        Math.pow(worldPoint.x - lastPoint.x, 2) + 
        Math.pow(worldPoint.y - lastPoint.y, 2)
      );
      
      // 如果点太近，跳过（提升性能）
      const minDistance = 2 / viewport.scale;  // 根据缩放调整最小距离
      if (distance < minDistance) {
        return;
      }
    }
    
    // 添加点到缓冲区
    drawingState.current.points.push(worldPoint);
    
    // 节流更新：每16ms（60fps）更新一次UI
    const now = Date.now();
    if (now - drawingState.current.lastUpdateTime > 16) {
      drawingState.current.lastUpdateTime = now;
      
      setCurrentStroke(prev => {
        if (!prev) return prev;
        const updated = { 
          ...prev, 
          points: [...prev.points, ...drawingState.current.points] 
        };
        drawingState.current.points = [];  // 清空缓冲
        drawingState.current.currentStroke = updated;
        return updated;
      });
    }
  }, [isDrawingMode, screenToWorld, viewport.scale]);

  const handleTouchEnd = useCallback(() => {
    if (!isDrawingMode || !drawingState.current.isDrawing) return;

    // 先把缓冲区的点添加到当前笔迹
    const bufferedPoints = drawingState.current.points;
    let finalStroke = drawingState.current.currentStroke;
    
    if (bufferedPoints.length > 0 && finalStroke) {
      finalStroke = {
        ...finalStroke,
        points: [...finalStroke.points, ...bufferedPoints]
      };
    }
    
    if (finalStroke && finalStroke.points.length > 0) {
      setStrokes(prev => {
        const newStrokes = [...prev, finalStroke];
        console.log('完成笔迹，总笔迹数:', newStrokes.length, '当前笔迹点数:', finalStroke.points.length);
        return newStrokes;
      });
      // ✅ 修复：只在noteData有效时自动保存
      if (noteData && (noteData._id || noteData.id)) {
        setTimeout(() => saveCanvas(), 500);
      } else {
        if (__DEV__) {
          console.warn('⚠️ [FluidInfiniteCanvas] noteData无效，跳过自动保存');
        }
      }
    }
    
    setCurrentStroke(null);
    drawingState.current = { 
      isDrawing: false, 
      currentStroke: null,
      points: [],
      lastUpdateTime: 0,
    };
    
    console.log('结束绘图');
  }, [isDrawingMode, saveCanvas]);

  // =================================================================
  // 渲染函数
  // =================================================================
  
  // 创建平滑的Skia路径（使用贝塞尔曲线）
  const createPath = useCallback((points) => {
    if (!points || points.length === 0) return null;
    
    const path = Skia.Path.Make();
    
    if (points.length === 1) {
      // 单点绘制为小圆
      path.addCircle(points[0].x, points[0].y, 2);
    } else if (points.length === 2) {
      // 两点直接连线
      path.moveTo(points[0].x, points[0].y);
      path.lineTo(points[1].x, points[1].y);
          } else {
      // 多点使用二次贝塞尔曲线平滑
      path.moveTo(points[0].x, points[0].y);
      
      for (let i = 1; i < points.length - 1; i++) {
        const p0 = points[i];
        const p1 = points[i + 1];
        
        // 计算中点
        const midX = (p0.x + p1.x) / 2;
        const midY = (p0.y + p1.y) / 2;
        
        // 使用二次贝塞尔曲线连接到中点
        path.quadTo(p0.x, p0.y, midX, midY);
      }
      
      // 最后一段连到终点
      const lastPoint = points[points.length - 1];
      path.lineTo(lastPoint.x, lastPoint.y);
    }
    
    return path;
  }, []);

  // 渲染背景网格（世界坐标） - 缓存优化
  const renderBackground = useCallback(() => {
    if (!styleConfig.pattern) return null;
    
    // 使用lastBackgroundViewport的缓存数据
    const cachedViewport = lastBackgroundViewport.current;

    const elements = [];
    
    // 计算可见区域（世界坐标） - 使用缓存的viewport
    const visibleLeft = cachedViewport.x - (SCREEN_WIDTH / 2) / cachedViewport.scale;
    const visibleRight = cachedViewport.x + (SCREEN_WIDTH / 2) / cachedViewport.scale;
    const visibleTop = cachedViewport.y - (SCREEN_HEIGHT / 2) / cachedViewport.scale;
    const visibleBottom = cachedViewport.y + (SCREEN_HEIGHT / 2) / cachedViewport.scale;
    
    const gridSize = 50;
    const lineColor = '#E0E0E0';

    // 计算网格线的起止位置
    const startX = Math.floor(visibleLeft / gridSize) * gridSize;
    const endX = Math.ceil(visibleRight / gridSize) * gridSize;
    const startY = Math.floor(visibleTop / gridSize) * gridSize;
    const endY = Math.ceil(visibleBottom / gridSize) * gridSize;
    
    // 严格限制网格线数量，提升性能
    const maxLines = 50;  // 减少到50条
    const xCount = (endX - startX) / gridSize;
    const yCount = (endY - startY) / gridSize;
    const xStep = Math.max(gridSize, Math.ceil(xCount / maxLines) * gridSize);
    const yStep = Math.max(gridSize, Math.ceil(yCount / maxLines) * gridSize);

    if (styleConfig.pattern === 'grid') {
        // 垂直线
      for (let x = startX; x <= endX; x += xStep) {
          elements.push(
            <Line
              key={`v${x}`}
              p1={{ x, y: startY }}
              p2={{ x, y: endY }}
              color={lineColor}
              strokeWidth={0.5}
            />
          );
        }
        // 水平线
      for (let y = startY; y <= endY; y += yStep) {
          elements.push(
            <Line
              key={`h${y}`}
              p1={{ x: startX, y }}
              p2={{ x: endX, y }}
              color={lineColor}
              strokeWidth={0.5}
            />
          );
        }
    } else if (styleConfig.pattern === 'lines') {
      // 只画水平线
      for (let y = startY; y <= endY; y += yStep) {
          elements.push(
            <Line
            key={`l${y}`}
            p1={{ x: startX, y }}
            p2={{ x: endX, y }}
              color={lineColor}
              strokeWidth={0.5}
            />
          );
        }
    }

    return elements;
  }, [backgroundKey, styleConfig.pattern]);  // 只在backgroundKey变化时重新渲染

  // =================================================================
  // 工具栏处理
  // =================================================================
  
  const handleToolChange = useCallback((tool) => {
    const toolType = typeof tool === 'object' ? tool.type : tool;
    setCurrentTool(toolType);
    const drawingTools = ['pen', 'pencil', 'marker', 'highlighter', 'brush'];
    setIsDrawingMode(drawingTools.includes(toolType));
  }, []);

  const handleModeToggle = useCallback((isFingerMode) => {
    setIsDrawingMode(!isFingerMode);
    setCurrentTool(isFingerMode ? 'move' : 'pen');
  }, []);

  const handleUndo = useCallback(() => {
    setStrokes(prev => prev.slice(0, -1));
  }, []);

  const handleClear = useCallback(() => {
    setStrokes([]);
    setCurrentStroke(null);
  }, []);

  // =================================================================
  // 渲染
  // =================================================================

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <LoadingIndicator message="加载中..." />
      </View>
    );
  }

  // 计算Group的transform矩阵
  const groupTransform = [
    { translateX: SCREEN_WIDTH / 2 - viewport.x * viewport.scale },
    { translateY: SCREEN_HEIGHT / 2 - viewport.y * viewport.scale },
    { scale: viewport.scale },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ToolbarContainer>
        <AllInOneToolbar
          onToolChange={handleToolChange}
          onColorChange={setCurrentColor}
          onStrokeWidthChange={setCurrentStrokeWidth}
          onUndo={handleUndo}
          onRedo={() => {}}
          canUndo={strokes.length > 0}
          canRedo={false}
          onClear={handleClear}
          initialTool={currentTool}
          initialColor={currentColor}
          initialStrokeWidth={currentStrokeWidth}
          showModeToggle={true}
          isFingerMode={!isDrawingMode}
          onModeToggle={() => {
            setIsDrawingMode(prev => {
              const newMode = !prev;
              console.log('画布模式切换:', newMode ? '绘图模式' : '移动模式');
              return newMode;
            });
          }}
          onImageUpload={() => {}}
          onBookmarkAdd={() => {}}
          onBookmarkList={() => {}}
        />
      </ToolbarContainer>

      <ViewerLayout
        colors={colors}
        title={noteTitle}
        headerLeft={
          <BackButton
            onPress={handleGoBack}
            color={colors.primary}
            background={colors.primary + '20'}
          />
        }
        headerRight={
          <View style={styles.headerRightContainer}>
            <SaveButton
              onSave={saveCanvas}
              text="保存"
              showSuccessToast={true}
              showErrorAlert={true}
              style={styles.saveButtonCompact}
            />
          </View>
        }
        hasExternalToolbar={true}
        externalToolbarHeight={Platform.OS === 'ios' ? 50 : 28}
        showHistoryNavigation={true}
        historyNavigationHeight={25}
        noteId={noteData?.id || noteId}
        navigation={navigation}
      >
        <View style={styles.canvasContainer}>
          <GestureDetector gesture={composedGesture}>
            <View
              style={styles.canvasWrapper}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onTouchCancel={handleTouchEnd}
            >
              <Canvas style={styles.canvas}>
                {/* 使用Group实现transform */}
                <Group transform={groupTransform}>
                {/* 背景色 */}
                <Rect
                    x={WORLD_BOUNDS.left}
                    y={WORLD_BOUNDS.top}
                    width={WORLD_BOUNDS.right - WORLD_BOUNDS.left}
                    height={WORLD_BOUNDS.bottom - WORLD_BOUNDS.top}
                  color={styleConfig.backgroundColor}
                />

                  {/* 背景网格 */}
                  {renderBackground()}

                  {/* 已完成的笔迹 */}
                  {strokes.map(stroke => {
                    const path = createPath(stroke.points);
                    if (!path) return null;
                    return (
                      <Path
                        key={stroke.id}
                        path={path}
                        color={stroke.color}
                        style="stroke"
                        strokeWidth={stroke.strokeWidth}
                        strokeCap="round"
                        strokeJoin="round"
                      />
                    );
                  })}

                  {/* 当前笔迹 */}
                  {currentStroke && currentStroke.points.length > 0 && (() => {
                    const path = createPath(currentStroke.points);
                    if (!path) return null;
                    return (
                      <Path
                        key="current"
                        path={path}
                        color={currentStroke.color}
                        style="stroke"
                        strokeWidth={currentStroke.strokeWidth}
                        strokeCap="round"
                        strokeJoin="round"
                      />
                    );
                  })()}
                </Group>
              </Canvas>
            </View>
          </GestureDetector>
        </View>
      </ViewerLayout>

      {isDrawingMode && (
        <View style={styles.drawingModeIndicator}>
          <Text style={styles.indicatorText}>✏️ 绘图模式</Text>
        </View>
      )}

      {/* 性能监控信息 */}
      {__DEV__ && (
        <View style={styles.debugInfo}>
          <Text style={styles.debugText}>笔迹数: {strokes.length}</Text>
          <Text style={styles.debugText}>缩放: {viewport.scale.toFixed(2)}x</Text>
          <Text style={styles.debugText}>位置: ({viewport.x.toFixed(0)}, {viewport.y.toFixed(0)})</Text>
          <Text style={styles.debugText}>模式: {isDrawingMode ? '绘图' : '移动'}</Text>
        </View>
      )}

      <ZoomIndicator
        scale={{ value: viewport.scale }}
        visible={showZoomIndicator}
        autoHideDelay={2000}
        topOffset={-90}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  canvasContainer: {
    flex: 1,
  },
  canvasWrapper: {
    flex: 1,
  },
  canvas: {
    flex: 1,
  },
  headerRightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  saveButtonCompact: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    marginRight: 4,
    minHeight: 24,
  },
  drawingModeIndicator: {
    position: 'absolute',
    top: 100,
    left: 20,
    backgroundColor: 'rgba(0, 150, 255, 0.9)',
    padding: 8,
    borderRadius: 4,
  },
  indicatorText: {
    color: 'white',
    fontSize: 12,
  },
  debugInfo: {
    position: 'absolute',
    top: 120,
    left: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 8,
    borderRadius: 4,
    minWidth: 150,
  },
  debugText: {
    color: 'white',
    fontSize: 10,
    marginBottom: 2,
  },
});

export default FluidInfiniteCanvasScreen;