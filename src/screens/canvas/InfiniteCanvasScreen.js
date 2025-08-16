import React, { useState, useRef, useEffect, useMemo } from 'react';
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
 * 无限画布屏幕
 * 提供无限缩放和移动的画布功能，支持多种纸张样式
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
  
  // 引用
  const canvasRef = useRef(null);
  const lastTap = useRef(null);
  const initialDistance = useRef(0);
  const initialScale = useRef(1);
  const initialTranslate = useRef({ x: 0, y: 0 });

  // 性能优化：使用ref存储临时变换值，减少重新渲染
  const tempTransform = useRef({ scale: 1, translateX: 0, translateY: 0 });
  const isTransforming = useRef(false);
  
  // 修复画布ID生成逻辑 - 确保相同标题的画布使用相同ID
  const docId = useMemo(() => {
    if (noteId) {
      return noteId;
    }
    // 基于标题生成稳定的ID，避免重复创建
    const titleHash = title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '').substring(0, 10);
    const timestamp = Date.now();
    return `canvas_${timestamp}_${titleHash}`;
  }, [noteId, title]);
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

  // 视口裁剪计算 - 只渲染可见区域的内容
  const getVisibleBounds = () => {
    const margin = 200; // 额外渲染边距，确保滑动时内容不会突然出现
    return {
      left: (-translateX - margin) / scale,
      top: (-translateY - margin) / scale,
      right: (-translateX + screenWidth + margin) / scale,
      bottom: (-translateY + screenHeight + margin) / scale,
    };
  };

  // 检查路径是否在可见区域内
  const isPathVisible = (pathData) => {
    if (!pathData.path) return false;

    // 简单的边界检查 - 解析路径中的坐标
    const coords = pathData.path.match(/[\d.-]+/g);
    if (!coords || coords.length < 2) return true; // 如果无法解析，则渲染

    const bounds = getVisibleBounds();
    const x = parseFloat(coords[0]);
    const y = parseFloat(coords[1]);

    return x >= bounds.left && x <= bounds.right && y >= bounds.top && y <= bounds.bottom;
  };

  // 检查图片是否在可见区域内
  const isImageVisible = (imageData) => {
    const bounds = getVisibleBounds();
    const imgWidth = (imageData.width || 100) * (imageData.scale || 1);
    const imgHeight = (imageData.height || 100) * (imageData.scale || 1);

    return (
      imageData.x + imgWidth >= bounds.left &&
      imageData.x <= bounds.right &&
      imageData.y + imgHeight >= bounds.top &&
      imageData.y <= bounds.bottom
    );
  };
  
  // 画布样式配置
  const canvasStyles = {
    white: {
      backgroundColor: '#FFFFFF',
      pattern: null
    },
    yellow: {
      backgroundColor: '#FFF8DC',
      pattern: null
    },
    grid: {
      backgroundColor: '#FFFFFF',
      pattern: 'grid'
    },
    lines: {
      backgroundColor: '#FFFFFF',
      pattern: 'lines'
    }
  };
  
  const currentCanvasStyle = canvasStyles[canvasStyle] || canvasStyles.white;

  // 调试信息
  console.log('InfiniteCanvasScreen: 当前画布样式状态:', canvasStyle);
  console.log('InfiniteCanvasScreen: 计算的样式对象:', currentCanvasStyle);

  // 组件加载时恢复画布数据或保存初始状态
  useEffect(() => {
    const loadOrSaveCanvas = async () => {
      try {
        // 首先尝试从存储中加载现有画布数据
        let existingCanvas = await offlineStorageService.getNote(docId);

        // 如果没有找到，尝试通过标题查找现有画布
        if (!existingCanvas) {
          console.log('InfiniteCanvasScreen: 通过ID未找到画布，尝试通过标题查找:', title);
          const allNotes = await offlineStorageService.getNotes();
          existingCanvas = allNotes.find(note =>
            note.type === 'canvas' &&
            note.title === title &&
            !note.is_deleted
          );

          if (existingCanvas) {
            console.log('InfiniteCanvasScreen: 通过标题找到现有画布:', existingCanvas.id);
            // 更新docId以使用找到的画布ID
            // 注意：这里不能直接修改docId，因为它是通过useMemo计算的
          }
        }

        if (existingCanvas && existingCanvas.type === 'canvas') {
          console.log('InfiniteCanvasScreen: 恢复现有画布数据:', existingCanvas.title);

          // 导入JSON工具函数
          const { safeParseJSON } = require('../../utils/jsonUtils');

          // 恢复画布状态
          setScale(existingCanvas.scale || 1);
          setTranslateX(existingCanvas.translateX || 0);
          setTranslateY(existingCanvas.translateY || 0);

          // 安全解析paths和images字段
          const paths = safeParseJSON(existingCanvas.paths, []);
          const images = safeParseJSON(existingCanvas.images, []);
          setPaths(Array.isArray(paths) ? paths : []);
          setImages(Array.isArray(images) ? images : []);

          // 恢复画布样式
          if (existingCanvas.canvasStyle) {
            setCanvasStyle(existingCanvas.canvasStyle);
            console.log('InfiniteCanvasScreen: 恢复画布样式:', existingCanvas.canvasStyle);
          } else {
            // 如果没有保存的样式，使用传入的初始样式
            setCanvasStyle(initialCanvasStyle);
            console.log('InfiniteCanvasScreen: 使用初始画布样式:', initialCanvasStyle);
          }
        } else if (existingCanvas) {
          // 存在笔记但不是画布类型，可能是从其他类型转换而来
          console.log('InfiniteCanvasScreen: 现有笔记ID但不是画布类型，转换为画布');
          
          // 创建新画布，保留原有笔记的ID和标题
          const convertedCanvasData = {
            _id: docId,
            id: docId,
            title: existingCanvas.title || title,
            type: 'canvas',
            file_type: 'canvas',
            canvasStyle: initialCanvasStyle,
            scale: 1,
            translateX: 0,
            translateY: 0,
            paths: [],
            images: [],
            created_at: existingCanvas.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          
          // 更新到离线存储
          await offlineStorageService.updateNote(docId, convertedCanvasData);
          
          // 更新Redux store
          dispatch(updateNote(convertedCanvasData));
          console.log('InfiniteCanvasScreen: 笔记已转换为画布');
        } else {
          // 如果不存在，检查是否是从其他界面传递过来的现有画布
          console.log('InfiniteCanvasScreen: 画布不存在，检查是否需要创建新画布');

          // 如果画布数据不存在，创建新画布
          console.log('InfiniteCanvasScreen: 创建新画布，docId:', docId);
          const initialCanvasData = {
            _id: docId,
            id: docId,
            title,
            type: 'canvas',
            file_type: 'canvas',
            canvasStyle: initialCanvasStyle,
            scale: 1,
            translateX: 0,
            translateY: 0,
            paths: [],
            images: [],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };

          // 保存到离线存储
          await offlineStorageService.saveNote(initialCanvasData);

          // 添加到Redux store
          dispatch(addNote(initialCanvasData));
          console.log('InfiniteCanvasScreen: 新画布已添加到Redux store');

          console.log('InfiniteCanvasScreen: 初始状态已保存', initialCanvasData);
        }
      } catch (error) {
        console.error('InfiniteCanvasScreen: 加载/保存画布失败:', error);
      }
    };

    loadOrSaveCanvas();
  }, []); // 只在组件挂载时执行一次，防止重复创建

  // 自动保存功能 - 改进保存逻辑
  useEffect(() => {
    const autoSave = async () => {
      try {
        // 检查是否有实际内容需要保存
        const hasContent = paths.length > 0 || images.length > 0 ||
                          scale !== 1 || translateX !== 0 || translateY !== 0;

        const canvasData = {
          _id: docId,
          id: docId,
          title,
          type: 'canvas',
          file_type: 'canvas',
          canvasStyle, // 确保画布样式被保存
          scale,
          translateX,
          translateY,
          paths,
          images,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          // 添加内容标记，便于后续查找
          hasContent
        };

        // 自动保存到离线存储
        await offlineStorageService.saveNote(canvasData);

        // 同时更新Redux store以保持同步
        dispatch(updateNote(canvasData));

        console.log('InfiniteCanvasScreen: 自动保存完成，样式:', canvasStyle, '内容:', hasContent);
      } catch (error) {
        console.error('InfiniteCanvasScreen: 自动保存失败:', error);
      }
    };

    // 延迟自动保存，避免频繁保存
    const timeoutId = setTimeout(autoSave, 3000); // 增加到3秒以减少保存频率
    return () => clearTimeout(timeoutId);
  }, [docId, title, scale, translateX, translateY, paths, images, canvasStyle, dispatch]); // 当画布数据变化时自动保存

  // 手势处理
  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    
    onPanResponderGrant: (evt) => {
      const { locationX, locationY, touches } = evt.nativeEvent;
      const enhancedEvent = enhanceTouchEvent(evt.nativeEvent);
      const operationType = getOperationType(evt.nativeEvent);

      if (touches.length === 1) {
        // 单指操作 - 根据输入设备类型决定行为
        if (operationType === 'navigate' || currentTool === 'hand') {
          // 手指操作或手型工具 - 移动画布
          initialTranslate.current = { x: translateX, y: translateY };
          tempTransform.current = { scale, translateX, translateY };
          isTransforming.current = true;
        } else if (operationType === 'draw' && enhancedEvent.isStylusInput) {
          // 触控笔操作 - 绘画
          setIsDrawing(true);
          const x = (locationX - translateX) / scale;
          const y = (locationY - translateY) / scale;
          setCurrentPath(`M${x},${y}`);
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

      if (touches.length === 1) {
        if (operationType === 'navigate' || currentTool === 'hand') {
          // 手指操作或手型工具 - 移动画布
          if (isTransforming.current) {
            // 计算新的平移值
            let newTranslateX = initialTranslate.current.x + gestureState.dx;
            let newTranslateY = initialTranslate.current.y + gestureState.dy;

            // 添加移动边界限制，防止画布移动过远
            const screenWidth = Dimensions.get('window').width;
            const screenHeight = Dimensions.get('window').height;
            const maxTranslateX = screenWidth * 0.5; // 最大水平移动距离
            const maxTranslateY = screenHeight * 0.5; // 最大垂直移动距离

            newTranslateX = Math.max(-maxTranslateX, Math.min(maxTranslateX, newTranslateX));
            newTranslateY = Math.max(-maxTranslateY, Math.min(maxTranslateY, newTranslateY));

            // 更新临时变换值
            tempTransform.current.translateX = newTranslateX;
            tempTransform.current.translateY = newTranslateY;

            // 进一步优化节流更新，提供更流畅的移动体验
            const now = Date.now();
            if (!lastTap.current || now - lastTap.current > 16) { // 提高到16ms，减少更新频率
              // 使用requestAnimationFrame确保在下一帧更新
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

          // 修复缩放算法，确保正确的缩放方向
          const scaleRatio = distance / initialDistance.current;
          let rawScale = initialScale.current * scaleRatio;

          // 添加渐进式缩放阻尼，防止一次性放大到最大倍数
          const scaleDiff = rawScale - initialScale.current;
          const dampingFactor = 0.75; // 优化阻尼系数，提高流畅度
          let newScale = initialScale.current + (scaleDiff * dampingFactor);

          // 限制缩放范围：0.3到3倍，提供合理的缩放空间，防止过度缩放
          newScale = Math.max(0.3, Math.min(3, newScale));

          // 添加缩放步进，使缩放更加平滑
          const scaleStep = 0.03; // 更细的步进，提高精度
          newScale = Math.round(newScale / scaleStep) * scaleStep;

          // 计算缩放中心点，实现以双指中心为基准的缩放
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

          // 优化节流更新，提高响应性
          const now = Date.now();
          if (!lastTap.current || now - lastTap.current > 12) { // 提高更新频率，增强响应性
            // 直接更新状态，避免requestAnimationFrame的额外开销
            setScale(newScale);
            setTranslateX(newTranslateX);
            setTranslateY(newTranslateY);
            lastTap.current = now;
          }
        }
      }
    },
    
    onPanResponderRelease: () => {
      if (isDrawing && currentPath) {
        setPaths(prev => [...prev, {
          path: currentPath,
          color: strokeColor,
          width: strokeWidth,
          tool: currentTool
        }]);
        setCurrentPath('');
      }
      setIsDrawing(false);

      // 结束变换操作，确保最终状态正确
      if (isTransforming.current) {
        setScale(tempTransform.current.scale);
        setTranslateX(tempTransform.current.translateX);
        setTranslateY(tempTransform.current.translateY);
        isTransforming.current = false;

        // 隐藏缩放指示器（延迟隐藏，让用户看到最终缩放值）
        setTimeout(() => {
          setShowZoomIndicator(false);
        }, 100);
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
    // 处理不同的参数格式
    const imageUri = typeof imageData === 'string' ? imageData : imageData.uri;

    if (!imageUri) {
      console.warn('图片上传失败：无效的图片URI');
      return;
    }

    const newImage = {
      id: Date.now(),
      uri: imageUri,
      x: (screenWidth / 2 - translateX) / scale,
      y: (screenHeight / 2 - translateY) / scale,
      scale: 1,
      rotation: 0,
      width: imageData.width || 100,
      height: imageData.height || 100
    };
    setImages(prev => [...prev, newImage]);

    console.log('图片已添加到画布中央:', newImage);
  };
  
  // 书签功能
  const handleAddBookmark = () => {
    setBookmarkVisible(true);
  };
  
  // 保存功能
  const saveCanvas = async () => {
    try {
      const canvasData = {
        _id: docId,
        id: docId,
        title,
        type: 'canvas',
        file_type: 'canvas',
        canvasStyle, // 确保画布样式被保存
        scale,
        translateX,
        translateY,
        paths,
        images,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      console.log('保存画布数据，样式:', canvasStyle);

      // 保存到离线存储
      await offlineStorageService.saveNote(canvasData);

      // 更新Redux store
      dispatch(updateNote(canvasData));

      Alert.alert('成功', '画布已保存');
    } catch (error) {
      console.error('保存画布失败:', error);
      Alert.alert('错误', '保存失败: ' + error.message);
    }
  };
  
  // 渲染背景图案
  const renderPattern = () => {
    if (!currentCanvasStyle.pattern) return null;
    
    const patternSize = 20 * scale;
    const offsetX = translateX % patternSize;
    const offsetY = translateY % patternSize;
    
    const lines = [];
    const canvasWidth = screenWidth * 3; // 扩大画布范围
    const canvasHeight = screenHeight * 3;
    
    if (currentCanvasStyle.pattern === 'grid') {
      // 方格纸
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
        noteId={noteId}
        navigation={navigation}
      >
        <View 
          style={[styles.canvas, { backgroundColor: currentCanvasStyle.backgroundColor }]}
          {...panResponder.panHandlers}
        >
          <Svg
            style={StyleSheet.absoluteFillObject}
            width={screenWidth}
            height={screenHeight}
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
        topOffset={30} // 画布中的缩放指示器向下偏移30px
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
      