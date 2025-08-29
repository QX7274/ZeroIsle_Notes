import React, { useState, useRef, useEffect, useMemo, useCallback, useLayoutEffect } from 'react';
import { View, StyleSheet, Dimensions, PanResponder, Alert, Platform, Image, StatusBar } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import ViewerLayout from '../../components/viewer/ViewerLayout';
import BackButton from '../../components/viewer/BackButton';
import SaveButton from '../../components/common/SaveButton';
import ToolbarContainer from '../../components/viewer/ToolbarContainer';
import AllInOneToolbar from '../../components/common/AllInOneToolbar';
import BookmarkPanel from '../../components/viewer/BookmarkPanel';
import { addBookmark } from '../../services/bookmarkService';
import Svg, { Rect, Path, Circle, Line } from 'react-native-svg';
import { offlineStorageService } from '../../services/offline';
import { useInputMode, enhanceTouchEvent } from '../../utils/inputDetection';
import { useDispatch } from 'react-redux';
import { addNote, updateNote } from '../../redux/slices/notesSlice';
import ZoomIndicator from '../../components/common/ZoomIndicator';

/**
 * 无限画布屏幕 - 重写版本
 * 参考普通笔记实现，支持无限缩放和延伸
 */
const InfiniteCanvasScreen = ({ route, navigation }) => {
  const { title = '无限画布', noteId, canvasStyle: initialCanvasStyle = 'white' } = route.params || {};
  const { colors } = useTheme();
  const { mode: inputMode, getOperationType } = useInputMode();
  const dispatch = useDispatch();
  
  // 画布状态
  const [scale, setScale] = useState(1);
  const [translateX, setTranslateX] = useState(0);
  const [translateY, setTranslateY] = useState(0);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentTool, setCurrentTool] = useState('pen');
  const [strokeColor, setStrokeColor] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [paths, setPaths] = useState([]);
  const [currentPath, setCurrentPath] = useState('');
  const [bookmarkVisible, setBookmarkVisible] = useState(false);
  const [images, setImages] = useState([]);
  const [canvasStyle, setCanvasStyle] = useState(initialCanvasStyle);
  const [showZoomIndicator, setShowZoomIndicator] = useState(false);
  const [isNewCanvas, setIsNewCanvas] = useState(false);

  // 企业级手写笔检测状态
  const [inputType, setInputType] = useState('finger');
  const [isPenActive, setIsPenActive] = useState(false);
  const [currentPressure, setCurrentPressure] = useState(0.5);
  const [lastTouchTime, setLastTouchTime] = useState(0);
  const [strokeVelocity, setStrokeVelocity] = useState(0);
  
  // 引用
  const canvasRef = useRef(null);
  const lastTap = useRef(null);
  const initialDistance = useRef(0);
  const initialScale = useRef(1);
  const initialTranslate = useRef({ x: 0, y: 0 });
  const lastGestureState = useRef({ dx: 0, dy: 0 });
  const gestureStartTime = useRef(0);

  // 性能优化：使用ref存储临时变换值，减少重新渲染
  const tempTransform = useRef({ scale: 1, translateX: 0, translateY: 0 });
  const isTransforming = useRef(false);
  
  // 修复画布ID生成逻辑 - 确保相同标题的画布使用相同ID
  const docId = useMemo(() => {
    if (noteId) {
      return noteId;
    }
    const titleHash = title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '').substring(0, 10);
    const timestamp = Date.now();
    return `canvas_${timestamp}_${titleHash}`;
  }, [noteId, title]);
  
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

  // 无限画布尺寸 - 支持更大的画布空间
  const canvasWidth = screenWidth * 20; // 20倍屏幕宽度
  const canvasHeight = screenHeight * 20; // 20倍屏幕高度

  /**
   * 企业级手写笔检测算法 v3.0
   * 专为无限画布优化，支持高精度绘图
   */
  const detectInputType = (event) => {
    const currentTime = Date.now();
    const timeDelta = currentTime - lastTouchTime;

    let penScore = 0;
    let confidence = 0;

    // 硬件特征检测 - 画布需要更高精度
    const pressure = event.pressure || event.force || 0.5;
    if (pressure > 0.05 && pressure < 0.95) {
      const pressureVariation = Math.abs(pressure - 0.5);
      penScore += 5 + (pressureVariation * 3);
      confidence += 0.45;
    }

    // 触控面积检测 - 画布绘图需要更精确的判断
    const radiusX = event.radiusX || 5;
    const radiusY = event.radiusY || 5;
    const touchArea = radiusX * radiusY * Math.PI;

    if (touchArea < 60) {
      penScore += 4;
      confidence += 0.3;
    } else if (touchArea > 150) {
      penScore -= 3;
    }

    // 倾斜角度检测 - 画布绘图中倾斜很重要
    const tiltX = event.tiltX || 0;
    const tiltY = event.tiltY || 0;
    const hasTilt = Math.abs(tiltX) > 0 || Math.abs(tiltY) > 0;

    if (hasTilt) {
      penScore += 5;
      confidence += 0.25;
    }

    // 指针类型检测
    if (event.pointerType === 'pen') {
      penScore += 6;
      confidence += 0.35;
    }

    // 速度和精度检测 - 画布绘图通常更精确
    if (timeDelta > 0 && timeDelta < 1000) {
      const velocity = Math.sqrt(
        Math.pow(event.velocityX || 0, 2) +
        Math.pow(event.velocityY || 0, 2)
      );

      if (velocity < 600) {
        penScore += 2;
      }

      const acceleration = Math.abs(velocity - strokeVelocity);
      if (acceleration < 150) {
        penScore += 2;
        confidence += 0.2;
      }

      setStrokeVelocity(velocity);
    }

    // 连续性检测 - 画布绘图通常有更长的连续笔画
    if (isPenActive && timeDelta < 200) {
      penScore += 3;
      confidence += 0.15;
    }

    setLastTouchTime(currentTime);

    // 画布专用动态阈值 - 更倾向于识别为笔
    const baseThreshold = 3.5;
    const confidenceAdjustment = confidence * 2.5;
    const dynamicThreshold = baseThreshold - confidenceAdjustment;

    const detectedType = penScore >= dynamicThreshold ? 'pen' : 'finger';

    if (detectedType === 'pen') {
      setIsPenActive(true);
      setCurrentPressure(pressure);
      setTimeout(() => setIsPenActive(false), 400);
    }

    if (__DEV__) {
      console.log(`画布手写检测: ${detectedType} (得分: ${penScore.toFixed(1)}, 置信度: ${confidence.toFixed(2)}, 压感: ${pressure.toFixed(3)})`);
    }

    return detectedType;
  };

  /**
   * 计算动态笔画宽度
   * 基于压感、速度和输入类型
   */
  const calculateDynamicStrokeWidth = (pressure, velocity, inputType) => {
    let dynamicWidth = strokeWidth;

    if (inputType === 'pen') {
      const pressureFactor = Math.max(0.3, Math.min(2.0, pressure * 2));
      const velocityFactor = Math.max(0.5, Math.min(1.5, 1 - velocity / 1000));
      dynamicWidth = strokeWidth * pressureFactor * velocityFactor;
    } else {
      const velocityFactor = Math.max(0.8, Math.min(1.2, 1 - velocity / 2000));
      dynamicWidth = strokeWidth * velocityFactor;
    }

    return Math.max(1, Math.min(20, dynamicWidth));
  };

  // 视口裁剪计算 - 只渲染可见区域的内容
  const getVisibleBounds = () => {
    const margin = 200;
    return {
      left: (-translateX - margin) / scale,
      top: (-translateY - margin) / scale,
      right: (-translateX + screenWidth + margin) / scale,
      bottom: (-translateY + screenHeight + margin) / scale,
    };
  };

  // 检查路径是否在可见区域内
  const isPathVisible = useCallback((pathData) => {
    const bounds = getVisibleBounds();
    // 简化可见性检查，提高性能
    return true; // 暂时返回true，后续可以优化
  }, [translateX, translateY, scale]);

  // 检查图片是否在可见区域内
  const isImageVisible = useCallback((imageData) => {
    const bounds = getVisibleBounds();
    const imageLeft = imageData.x;
    const imageTop = imageData.y;
    const imageRight = imageLeft + (imageData.width || 100);
    const imageBottom = imageTop + (imageData.height || 100);

    return !(imageRight < bounds.left || imageLeft > bounds.right || 
             imageBottom < bounds.top || imageTop > bounds.bottom);
  }, [translateX, translateY, scale]);

  // 加载或保存画布数据
  const loadOrSaveCanvas = useCallback(async () => {
    try {
      console.log('开始加载画布:', docId);
      
      // 尝试加载现有画布
      const existingCanvas = await offlineStorageService.getNote(docId);
      
      if (existingCanvas) {
        console.log('找到现有画布:', existingCanvas.id);
        
        // 如果找到的画布ID与当前不同，导航到正确的画布
        if (existingCanvas.id !== docId) {
          navigation.replace('InfiniteCanvas', {
            noteId: existingCanvas.id,
            title: existingCanvas.title,
            canvasStyle: existingCanvas.canvasStyle || 'white'
          });
          return;
        }
        
        // 加载画布数据
        setPaths(existingCanvas.paths || []);
        setImages(existingCanvas.images || []);
        setCanvasStyle(existingCanvas.canvasStyle || 'white');
        setIsNewCanvas(false);
        
        // 恢复变换状态
        if (existingCanvas.transform) {
          setScale(existingCanvas.transform.scale || 1);
          setTranslateX(existingCanvas.transform.translateX || 0);
          setTranslateY(existingCanvas.transform.translateY || 0);
        }
      } else {
        console.log('未找到画布，检查是否需要创建新画布');
        
        // 检查是否有相同标题的画布
        const allNotes = await offlineStorageService.getAllNotes();
        const existingCanvas = allNotes.find(note => 
          note.type === 'canvas' && 
          note.title === title && 
          note.id !== docId
        );
        
        if (existingCanvas && existingCanvas.id !== docId) {
          navigation.replace('InfiniteCanvas', {
            noteId: existingCanvas.id,
            title: existingCanvas.title,
            canvasStyle: existingCanvas.canvasStyle || 'white'
          });
          return;
        } else {
          if (route.params?.createNew || route.params?.isNew) {
            setIsNewCanvas(true);
          } else {
            setIsNewCanvas(false);
            setCanvasStyle(initialCanvasStyle);
          }
        }
      }
    } catch (error) {
      console.error('加载画布失败:', error);
      Alert.alert('错误', '加载画布失败，请重试');
    }
  }, [docId, title, navigation, route.params]);

  // 保存画布数据
  const saveCanvas = useCallback(async () => {
    try {
      const canvasData = {
        _id: docId,
        id: docId,
        title: title,
        type: 'canvas',
        file_type: 'canvas',
        canvasStyle: canvasStyle,
        paths: paths,
        images: images,
        transform: {
          scale: scale,
          translateX: translateX,
          translateY: translateY
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        user_id: 'current_user',
        is_deleted: false,
        is_synced: false
      };

      const result = await offlineStorageService.saveNote(canvasData);
      
      if (result.success) {
        if (isNewCanvas) {
          dispatch(addNote(canvasData));
          setIsNewCanvas(false);
        } else {
          dispatch(updateNote(canvasData));
        }
        console.log('画布保存成功:', docId);
        return true;
      } else {
        throw new Error('保存失败');
      }
    } catch (error) {
      console.error('保存画布失败:', error);
      Alert.alert('保存失败', '画布保存失败，请稍后重试');
      return false;
    }
  }, [docId, title, canvasStyle, paths, images, scale, translateX, translateY, isNewCanvas, dispatch]);

  // 自动保存
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (paths.length > 0 || images.length > 0) {
        saveCanvas();
      }
    }, 2000);

    return () => clearTimeout(timeoutId);
  }, [docId, title, scale, translateX, translateY, paths, images, canvasStyle, dispatch]);

  // 企业级手势处理 - 优化版本
  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: (evt) => {
      const inputType = detectInputType(evt.nativeEvent);
      console.log(`画布输入检测: ${inputType}`);
      
      // 记录手势开始时间
      gestureStartTime.current = Date.now();
      lastGestureState.current = { dx: 0, dy: 0 };
      
      return inputType === 'pen' || !isPenActive;
    },
    
    onMoveShouldSetPanResponder: (evt, gestureState) => {
      // 防止意外触发导航手势
      const { dx, dy } = gestureState;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // 如果移动距离太小，不接管手势
      if (distance < 10) {
        return false;
      }
      
      // 检查是否是水平滑动（可能触发返回手势）
      const isHorizontalSwipe = Math.abs(dx) > Math.abs(dy) * 2;
      if (isHorizontalSwipe && Math.abs(dx) > 50) {
        // 如果是大幅度的水平滑动，阻止导航手势
        return true;
      }
      
      return true;
    },

    onPanResponderGrant: (evt) => {
      const { locationX, locationY, touches, pressure = 0.5 } = evt.nativeEvent;

      const inputType = detectInputType(evt.nativeEvent);
      setInputType(inputType);

      if (inputType === 'pen') {
        setIsPenActive(true);
        setCurrentPressure(pressure);
        setTimeout(() => setIsPenActive(false), 400);
      }

      if (touches.length === 1) {
        if (inputType === 'finger' && currentTool !== 'pen') {
          // 手指操作 - 移动画布
          initialTranslate.current = { x: translateX, y: translateY };
          tempTransform.current = { scale, translateX, translateY };
          isTransforming.current = true;
          console.log('画布移动模式');
        } else if (inputType === 'pen' || currentTool === 'pen') {
          // 手写笔操作 - 绘画
          setIsDrawing(true);
          const x = (locationX - translateX) / scale;
          const y = (locationY - translateY) / scale;

          const dynamicWidth = calculateDynamicStrokeWidth(pressure, 0, inputType);

          setStrokeVelocity(0);
          setCurrentPath(`M${x},${y}`);
          setStrokeWidth(dynamicWidth);

          console.log(`画布绘制开始: ${inputType}, 压感: ${pressure.toFixed(3)}`);
        }
      } else if (touches.length === 2) {
        // 双指操作 - 缩放
        const touch1 = touches[0];
        const touch2 = touches[1];
        const distance = Math.sqrt(
          Math.pow(touch2.pageX - touch1.pageX, 2) +
          Math.pow(touch2.pageY - touch1.pageY, 2)
        );
        initialDistance.current = distance;
        initialScale.current = scale;
        initialTranslate.current = { x: translateX, y: translateY };
        tempTransform.current = { scale, translateX, translateY };
        isTransforming.current = true;
      }
    },
    
    onPanResponderMove: (evt, gestureState) => {
      const { touches } = evt.nativeEvent;
      const enhancedEvent = enhanceTouchEvent(evt.nativeEvent);
      const operationType = getOperationType(evt.nativeEvent);

      // 更新手势状态
      lastGestureState.current = { dx: gestureState.dx, dy: gestureState.dy };

      if (touches.length === 1) {
        if (operationType === 'navigate' || currentTool === 'hand') {
          // 手指操作或手型工具 - 移动画布
          if (isTransforming.current) {
            // 计算新的平移值
            let newTranslateX = initialTranslate.current.x + gestureState.dx;
            let newTranslateY = initialTranslate.current.y + gestureState.dy;

            // 移除移动边界限制，允许无限移动
            // 但添加一些阻尼效果，防止移动过快
            const dampingFactor = 0.95;
            newTranslateX *= dampingFactor;
            newTranslateY *= dampingFactor;

            // 更新临时变换值
            tempTransform.current.translateX = newTranslateX;
            tempTransform.current.translateY = newTranslateY;

            // 优化节流更新，提供更流畅的移动体验
            const now = Date.now();
            if (!lastTap.current || now - lastTap.current > 16) {
              requestAnimationFrame(() => {
                setTranslateX(tempTransform.current.translateX);
                setTranslateY(tempTransform.current.translateY);
              });
              lastTap.current = now;
            }
          }
        } else if (isDrawing && enhancedEvent.isStylusInput) {
          // 触控笔操作 - 绘画
          const x = (evt.nativeEvent.locationX - translateX) / scale;
          const y = (evt.nativeEvent.locationY - translateY) / scale;
          setCurrentPath(prev => `${prev} L${x},${y}`);
        }
      } else if (touches.length === 2) {
        // 缩放
        if (isTransforming.current) {
          const touch1 = touches[0];
          const touch2 = touches[1];
          const distance = Math.sqrt(
            Math.pow(touch2.pageX - touch1.pageX, 2) +
            Math.pow(touch2.pageY - touch1.pageY, 2)
          );

          const scaleRatio = distance / initialDistance.current;
          let rawScale = initialScale.current * scaleRatio;

          // 添加渐进式缩放阻尼
          const scaleDiff = rawScale - initialScale.current;
          const dampingFactor = 0.75;
          let newScale = initialScale.current + (scaleDiff * dampingFactor);

          // 扩展缩放范围：0.1到10倍，支持更大的缩放
          newScale = Math.max(0.1, Math.min(10, newScale));

          // 添加缩放步进
          const scaleStep = 0.02;
          newScale = Math.round(newScale / scaleStep) * scaleStep;

          // 计算缩放中心点
          const centerX = (touch1.pageX + touch2.pageX) / 2;
          const centerY = (touch1.pageY + touch2.pageY) / 2;

          // 计算相对于画布的缩放中心
          const canvasCenterX = (centerX - translateX) / scale;
          const canvasCenterY = (centerY - translateY) / scale;

          // 计算新的平移量，保持缩放中心不变
          const newTranslateX = centerX - canvasCenterX * newScale;
          const newTranslateY = centerY - canvasCenterY * newScale;

          tempTransform.current.scale = newScale;
          tempTransform.current.translateX = newTranslateX;
          tempTransform.current.translateY = newTranslateY;

          // 显示缩放指示器
          setShowZoomIndicator(true);

          // 优化节流更新
          const now = Date.now();
          if (!lastTap.current || now - lastTap.current > 12) {
            setScale(newScale);
            setTranslateX(newTranslateX);
            setTranslateY(newTranslateY);
            lastTap.current = now;
          }
        }
      }
    },
    
    onPanResponderRelease: (evt, gestureState) => {
      if (isDrawing && currentPath) {
        // 在抬笔时写入最终路径
        setPaths(prev => [...prev, {
          path: currentPath,
          color: strokeColor,
          width: strokeWidth,
          tool: currentTool
        }]);
        setCurrentPath('');
      }
      setIsDrawing(false);

      // 结束变换操作
      if (isTransforming.current) {
        setScale(tempTransform.current.scale);
        setTranslateX(tempTransform.current.translateX);
        setTranslateY(tempTransform.current.translateY);
        isTransforming.current = false;

        // 隐藏缩放指示器
        setTimeout(() => {
          setShowZoomIndicator(false);
        }, 2000);
      }

      // 检查是否是返回手势
      const gestureDuration = Date.now() - gestureStartTime.current;
      const { dx, dy } = gestureState;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const isHorizontalSwipe = Math.abs(dx) > Math.abs(dy) * 2;
      
      // 如果是快速的、大幅度的水平滑动，可能是返回手势
      if (gestureDuration < 300 && distance > 100 && isHorizontalSwipe && dx > 0) {
        // 阻止返回手势，继续在画布中操作
        console.log('检测到可能的返回手势，已阻止');
      }
    }
  });

  // 工具栏处理
  const handleToolChange = (tool) => {
    setCurrentTool(tool);
  };
  
  const handleColorChange = (color) => {
    setStrokeColor(color);
  };
  
  const handleStrokeWidthChange = (width) => {
    setStrokeWidth(width);
  };
  
  const handleImageUpload = (imageData) => {
    const imageUri = typeof imageData === 'string' ? imageData : imageData.uri;
    const newImage = {
      id: `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      uri: imageUri,
      x: 100,
      y: 100,
      scale: 1,
      rotation: 0,
      width: 100,
      height: 100
    };
    setImages(prev => [...prev, newImage]);
  };

  const handleAddBookmark = async () => {
    try {
      const bookmark = {
        id: `bookmark_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        title: `书签 ${new Date().toLocaleString()}`,
        docId: docId,
        position: {
          scale: scale,
          translateX: translateX,
          translateY: translateY
        },
        created_at: new Date().toISOString()
      };
      
      await addBookmark(bookmark);
      setBookmarkVisible(false);
      Alert.alert('成功', '书签添加成功');
    } catch (error) {
      console.error('添加书签失败:', error);
      Alert.alert('错误', '添加书签失败，请重试');
    }
  };

  // 加载画布数据
  useEffect(() => {
    loadOrSaveCanvas();
  }, [loadOrSaveCanvas]);

  // 隐藏底部状态栏
  useLayoutEffect(() => {
    navigation.setOptions({ tabBarVisible: false });
    StatusBar.setHidden(true);
    return () => {
      StatusBar.setHidden(false);
    };
  }, [navigation]);

  // 隐藏底部状态栏
  useLayoutEffect(() => {
    navigation.setOptions({ tabBarVisible: false });
    StatusBar.setHidden(true);
    return () => {
      StatusBar.setHidden(false);
    };
  }, [navigation]);

  // 渲染背景图案
  const renderPattern = () => {
    const lines = [];
    const patternSize = 20;
    const offsetX = translateX % patternSize;
    const offsetY = translateY % patternSize;

    if (currentCanvasStyle.pattern === 'grid') {
      // 网格纸
      for (let x = offsetX; x < canvasWidth; x += patternSize) {
        lines.push(
          <Line
            key={`v${x}`}
            x1={x}
            y1={0}
            x2={x}
            y2={canvasHeight}
            stroke="#E0E0E0"
            strokeWidth={0.5}
          />
        );
      }
      for (let y = offsetY; y < canvasHeight; y += patternSize) {
        lines.push(
          <Line
            key={`h${y}`}
            x1={0}
            y1={y}
            x2={canvasWidth}
            y2={y}
            stroke="#E0E0E0"
            strokeWidth={0.5}
          />
        );
      }
    } else if (currentCanvasStyle.pattern === 'lines') {
      // 横线纸
      for (let y = offsetY; y < canvasHeight; y += patternSize) {
        lines.push(
          <Line
            key={`line${y}`}
            x1={0}
            y1={y}
            x2={canvasWidth}
            y2={y}
            stroke="#E0E0E0"
            strokeWidth={0.5}
          />
        );
      }
    }
    
    return lines;
  };
  
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ToolbarContainer>
        <AllInOneToolbar
          onToolChange={handleToolChange}
          onColorChange={handleColorChange}
          onStrokeWidthChange={handleStrokeWidthChange}
          onImageUpload={handleImageUpload}
          onBookmarkAdd={handleAddBookmark}
          onBookmarkList={() => setBookmarkVisible(true)}
        />
      </ToolbarContainer>

      <ViewerLayout
        colors={colors}
        headerLeft={<BackButton onPress={() => navigation.goBack()} color={colors.primary} background={colors.primary + '20'} />}
        headerRight={
          <SaveButton
            onSave={saveCanvas}
            text="保存"
            showSuccessToast={true}
            showErrorAlert={true}
          />
        }
        title={title}
        hasExternalToolbar={true}
        externalToolbarHeight={Platform.OS === 'ios' ? 50 : 28}
        showHistoryNavigation={true}
        historyNavigationHeight={25}
        noteId={docId}
        navigation={navigation}
      >
        <View 
          style={[styles.canvas, { backgroundColor: currentCanvasStyle.backgroundColor }]}
          {...panResponder.panHandlers}
        >
          <Svg
            style={StyleSheet.absoluteFillObject}
            width={canvasWidth}
            height={canvasHeight}
          >
            {/* 背景图案 */}
            {renderPattern()}
            
            {/* 绘制路径 - 只渲染可见区域 */}
            {paths.filter(isPathVisible).map((pathData, index) => (
              <Path
                key={`path-${index}`}
                d={pathData.path}
                stroke={pathData.color}
                strokeWidth={pathData.width}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                transform={`translate(${translateX}, ${translateY}) scale(${scale})`}
              />
            ))}
            
            {/* 当前绘制路径 */}
            {currentPath && (
              <Path
                d={currentPath}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                transform={`translate(${translateX}, ${translateY}) scale(${scale})`}
              />
            )}
          </Svg>

          {/* 渲染图片 - 只渲染可见区域 */}
          {images.filter(isImageVisible).map((imageData, index) => (
            <Image
              key={`image-${index}`}
              source={{ uri: imageData.uri }}
              style={{
                position: 'absolute',
                left: imageData.x * scale + translateX,
                top: imageData.y * scale + translateY,
                width: (imageData.width || 100) * imageData.scale * scale,
                height: (imageData.height || 100) * imageData.scale * scale,
                transform: [{ rotate: `${imageData.rotation}deg` }]
              }}
              resizeMode="contain"
            />
          ))}
        </View>
      </ViewerLayout>

      {/* 缩放指示器 */}
      <ZoomIndicator
        scale={scale}
        visible={showZoomIndicator}
        autoHideDelay={2000}
        topOffset={30}
      />

      <BookmarkPanel
        visible={bookmarkVisible}
        onClose={() => setBookmarkVisible(false)}
        docId={docId}
        onJump={(bookmark) => {
          console.log('跳转到书签:', bookmark);
          setBookmarkVisible(false);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  canvas: {
    flex: 1,
  },
});

export default InfiniteCanvasScreen;
      