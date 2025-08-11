import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, Dimensions, PanResponder, Alert, Platform } from 'react-native';
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
import { addNote } from '../../redux/slices/notesSlice';

/**
 * 无限画布屏幕
 * 提供无限缩放和移动的画布功能，支持多种纸张样式
 */
const InfiniteCanvasScreen = ({ route, navigation }) => {
  const { title = '无限画布', noteId, canvasStyle = 'white' } = route.params || {};
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
  
  // 引用
  const canvasRef = useRef(null);
  const lastTap = useRef(null);
  const initialDistance = useRef(0);
  const initialScale = useRef(1);
  const initialTranslate = useRef({ x: 0, y: 0 });
  
  const docId = noteId || `canvas_${Date.now()}`;
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
  
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
      }
    },
    
    onPanResponderMove: (evt, gestureState) => {
      const { touches } = evt.nativeEvent;
      const enhancedEvent = enhanceTouchEvent(evt.nativeEvent);
      const operationType = getOperationType(evt.nativeEvent);

      if (touches.length === 1) {
        if (operationType === 'navigate' || currentTool === 'hand') {
          // 手指操作或手型工具 - 移动画布
          setTranslateX(initialTranslate.current.x + gestureState.dx);
          setTranslateY(initialTranslate.current.y + gestureState.dy);
        } else if (isDrawing && enhancedEvent.isStylusInput) {
          // 触控笔操作 - 绘画
          const x = (evt.nativeEvent.locationX - translateX) / scale;
          const y = (evt.nativeEvent.locationY - translateY) / scale;
          setCurrentPath(prev => `${prev} L${x},${y}`);
        }
      } else if (touches.length === 2) {
        // 缩放
        const touch1 = touches[0];
        const touch2 = touches[1];
        const distance = Math.sqrt(
          Math.pow(touch2.pageX - touch1.pageX, 2) + 
          Math.pow(touch2.pageY - touch1.pageY, 2)
        );
        
        const newScale = Math.max(0.1, Math.min(5, initialScale.current * (distance / initialDistance.current)));
        setScale(newScale);
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
  
  const handleImageUpload = (imageUri) => {
    const newImage = {
      id: Date.now(),
      uri: imageUri,
      x: (screenWidth / 2 - translateX) / scale,
      y: (screenHeight / 2 - translateY) / scale,
      scale: 1,
      rotation: 0
    };
    setImages(prev => [...prev, newImage]);
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
        canvasStyle,
        scale,
        translateX,
        translateY,
        paths,
        images,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // 保存到离线存储
      await offlineStorageService.saveNote(canvasData);

      // 添加到Redux store
      dispatch(addNote(canvasData));

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
        externalToolbarHeight={Platform.OS === 'ios' ? 65 : 35}
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
            
            {/* 绘制路径 */}
            {paths.map((pathData, index) => (
              <Path
                key={index}
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
        </View>
      </ViewerLayout>

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
