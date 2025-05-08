import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, StyleSheet, Dimensions, TouchableOpacity, Text, Alert } from 'react-native';
import Svg, { G, Path, Rect, Circle, Line, Polygon, Text as SvgText, Image as SvgImage, Defs, Pattern } from 'react-native-svg';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS
} from 'react-native-reanimated';
import { captureRef } from 'react-native-view-shot';
import { launchImageLibrary } from 'react-native-image-picker';
import { useTheme } from '../../context/ThemeContext';
import { offlineStorageService } from '../../services/offline/offlineStorage';
import analyticsService from '../../services/analytics/analyticsService';

// 常量定义
const TOOLS = {
  PEN: 'pen',
  PENCIL: 'pencil',
  HIGHLIGHTER: 'highlighter',
  ERASER: 'eraser',
  SHAPE: 'shape',
  TEXT: 'text',
  IMAGE: 'image',
  SELECT: 'select',
};

const SHAPES = {
  LINE: 'line',
  RECTANGLE: 'rectangle',
  CIRCLE: 'circle',
  TRIANGLE: 'triangle',
  ARROW: 'arrow',
};

// 主组件
const InfiniteCanvas = ({
  canvasId,
  initialElements = [],
  onSave,
  onContentChange,
  readOnly = false,
}) => {
  // 主题
  const { colors } = useTheme();

  // 画布尺寸
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
  const CANVAS_WIDTH = 5000;
  const CANVAS_HEIGHT = 5000;

  // 状态管理
  const [elements, setElements] = useState(initialElements);
  const [selectedElement, setSelectedElement] = useState(null);
  const [currentPath, setCurrentPath] = useState(null);
  const [currentText, setCurrentText] = useState(null);
  const [tool, setTool] = useState(TOOLS.PEN);
  const [shape, setShape] = useState(SHAPES.LINE);
  const [color, setColor] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [showGrid, setShowGrid] = useState(true);
  const [layers, setLayers] = useState([{ id: 'default', name: '默认图层', visible: true, locked: false }]);
  const [activeLayer, setActiveLayer] = useState('default');
  const [isLoading, setIsLoading] = useState(false);

  // 历史记录
  const [history, setHistory] = useState([]);
  const [redoStack, setRedoStack] = useState([]);

  // 引用
  const canvasRef = useRef(null);
  const svgRef = useRef(null);

  // 动画值
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const lastScale = useSharedValue(1);
  const lastTranslateX = useSharedValue(0);
  const lastTranslateY = useSharedValue(0);

  // 自动保存
  useEffect(() => {
    if (elements.length > 0 && canvasId) {
      const autoSaveTimer = setTimeout(() => {
        handleSave();
      }, 30000); // 30秒自动保存

      return () => clearTimeout(autoSaveTimer);
    }
  }, [elements, canvasId]);

  // 初始化加载
  useEffect(() => {
    if (canvasId) {
      loadCanvas(canvasId);
    }
  }, [canvasId]);

  // 加载画布
  const loadCanvas = async (id) => {
    try {
      setIsLoading(true);
      const canvas = await offlineStorageService.getCanvas(id);
      if (canvas) {
        setElements(canvas.elements || []);
        setLayers(canvas.layers || [{ id: 'default', name: '默认图层', visible: true, locked: false }]);
        setActiveLayer(canvas.activeLayer || 'default');

        // 设置视图位置
        if (canvas.viewState) {
          scale.value = canvas.viewState.scale || 1;
          translateX.value = canvas.viewState.translateX || 0;
          translateY.value = canvas.viewState.translateY || 0;
          lastScale.value = canvas.viewState.scale || 1;
          lastTranslateX.value = canvas.viewState.translateX || 0;
          lastTranslateY.value = canvas.viewState.translateY || 0;
        }

        // 清空历史记录
        setHistory([]);
        setRedoStack([]);
      }
    } catch (error) {
      console.error('加载画布失败:', error);
      Alert.alert('错误', '加载画布失败');
    } finally {
      setIsLoading(false);
    }
  };

  // 保存画布
  const handleSave = async () => {
    if (!canvasId) return;

    try {
      setIsLoading(true);

      // 捕获缩略图
      let thumbnail = null;
      try {
        thumbnail = await captureRef(svgRef, {
          format: 'jpg',
          quality: 0.5,
          result: 'base64',
        });
      } catch (e) {
        console.warn('生成缩略图失败:', e);
      }

      // 保存视图状态
      const viewState = {
        scale: scale.value,
        translateX: translateX.value,
        translateY: translateY.value,
      };

      // 保存画布数据
      const canvasData = {
        id: canvasId,
        elements,
        layers,
        activeLayer,
        viewState,
        thumbnail: thumbnail ? `data:image/jpeg;base64,${thumbnail}` : null,
        updatedAt: new Date().toISOString(),
      };

      await offlineStorageService.saveCanvas(canvasData);

      if (onSave) {
        onSave(canvasData);
      }

      analyticsService.trackCanvasAction('save', { canvasId });
    } catch (error) {
      console.error('保存画布失败:', error);
      Alert.alert('错误', '保存画布失败');
    } finally {
      setIsLoading(false);
    }
  };

  // 添加元素到历史记录
  const addToHistory = useCallback(() => {
    setHistory(prev => [...prev, [...elements]]);
    setRedoStack([]);
  }, [elements]);

  // 撤销操作
  const handleUndo = useCallback(() => {
    if (history.length === 0) return;

    const lastState = history[history.length - 1];
    setRedoStack(prev => [...prev, [...elements]]);
    setElements(lastState);
    setHistory(prev => prev.slice(0, -1));

    analyticsService.trackCanvasAction('undo');
  }, [history, elements]);

  // 重做操作
  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;

    const nextState = redoStack[redoStack.length - 1];
    setHistory(prev => [...prev, [...elements]]);
    setElements(nextState);
    setRedoStack(prev => prev.slice(0, -1));

    analyticsService.trackCanvasAction('redo');
  }, [redoStack, elements]);

  // 清空画布
  const handleClear = useCallback(() => {
    Alert.alert(
      '清空画布',
      '确定要清空画布吗？此操作不可撤销。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确定',
          onPress: () => {
            addToHistory();
            setElements([]);
            analyticsService.trackCanvasAction('clear');
          }
        }
      ]
    );
  }, [addToHistory]);

  // 导出为图片
  const handleExport = useCallback(async () => {
    try {
      setIsLoading(true);

      const uri = await captureRef(svgRef, {
        format: 'png',
        quality: 1,
      });

      // 这里可以添加保存图片到相册或分享的逻辑
      Alert.alert('导出成功', `画布已导出为图片: ${uri}`);
      analyticsService.trackCanvasAction('export');
    } catch (error) {
      console.error('导出画布失败:', error);
      Alert.alert('错误', '导出画布失败');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 添加图片
  const handleAddImage = useCallback(async () => {
    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        includeBase64: false,
        maxHeight: 1200,
        maxWidth: 1200,
        quality: 1,
      });

      if (!result.didCancel && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];

        // 计算图片在画布中的位置
        const canvasCenterX = CANVAS_WIDTH / 2;
        const canvasCenterY = CANVAS_HEIGHT / 2;

        // 转换为画布坐标
        const x = (canvasCenterX - translateX.value) / scale.value;
        const y = (canvasCenterY - translateY.value) / scale.value;

        // 创建图片元素
        const newImage = {
          id: Date.now().toString(),
          type: 'image',
          uri: asset.uri,
          x,
          y,
          width: (asset.width || 300) / 2,
          height: (asset.height || 300) / 2,
          layerId: activeLayer,
        };

        addToHistory();
        setElements(prev => [...prev, newImage]);
        analyticsService.trackCanvasAction('add_image');
      }
    } catch (error) {
      console.error('添加图片失败:', error);
      Alert.alert('错误', '添加图片失败');
    }
  }, [activeLayer, addToHistory, scale.value, translateX.value, translateY.value]);

  // 添加文本
  const handleAddText = useCallback(() => {
    // 计算文本在画布中的位置
    const canvasCenterX = CANVAS_WIDTH / 2;
    const canvasCenterY = CANVAS_HEIGHT / 2;

    // 转换为画布坐标
    const x = (canvasCenterX - translateX.value) / scale.value;
    const y = (canvasCenterY - translateY.value) / scale.value;

    // 创建文本元素
    const newText = {
      id: Date.now().toString(),
      type: 'text',
      content: '双击编辑文本',
      x,
      y,
      fontSize: 24,
      fontFamily: 'Arial',
      color: color,
      layerId: activeLayer,
    };

    addToHistory();
    setElements(prev => [...prev, newText]);
    setCurrentText(newText);
    analyticsService.trackCanvasAction('add_text');
  }, [activeLayer, addToHistory, color, scale.value, translateX.value, translateY.value]);

  // 手势处理 - 平移
  const panGesture = Gesture.Pan()
    .onStart(() => {
      lastTranslateX.value = translateX.value;
      lastTranslateY.value = translateY.value;
    })
    .onUpdate((e) => {
      // 只有在选择工具或没有当前路径时才允许平移
      if (tool === TOOLS.SELECT || !currentPath) {
        translateX.value = lastTranslateX.value + e.translationX;
        translateY.value = lastTranslateY.value + e.translationY;
      }
    })
    .onEnd(() => {
      // 保存最后的平移位置
      lastTranslateX.value = translateX.value;
      lastTranslateY.value = translateY.value;
    });

  // 手势处理 - 缩放
  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      lastScale.value = scale.value;
    })
    .onUpdate((e) => {
      // 计算新的缩放值，限制最小和最大缩放
      const newScale = Math.min(Math.max(lastScale.value * e.scale, 0.5), 5);
      scale.value = newScale;
    })
    .onEnd(() => {
      // 保存最后的缩放值
      lastScale.value = scale.value;
    });

  // 手势处理 - 绘图
  const drawGesture = Gesture.Pan()
    .onStart((e) => {
      if (tool !== TOOLS.SELECT && !readOnly) {
        // 计算画布坐标
        const x = (e.x - translateX.value) / scale.value;
        const y = (e.y - translateY.value) / scale.value;

        if (tool === TOOLS.SHAPE) {
          // 开始绘制形状
          const newShape = {
            id: Date.now().toString(),
            type: 'shape',
            shapeType: shape,
            startX: x,
            startY: y,
            endX: x,
            endY: y,
            color: color,
            strokeWidth: strokeWidth,
            layerId: activeLayer,
          };
          setCurrentPath(newShape);
        } else if (tool === TOOLS.TEXT) {
          // 文本工具 - 在点击位置添加文本
          handleAddText();
        } else if (tool === TOOLS.ERASER) {
          // 橡皮擦工具 - 开始擦除
          const newPath = {
            id: Date.now().toString(),
            type: 'path',
            tool: TOOLS.ERASER,
            points: [{ x, y }],
            color: 'rgba(255,255,255,0.9)',
            strokeWidth: strokeWidth * 3,
            layerId: activeLayer,
          };
          setCurrentPath(newPath);
        } else {
          // 其他绘图工具
          const newPath = {
            id: Date.now().toString(),
            type: 'path',
            tool: tool,
            points: [{ x, y }],
            color: color,
            strokeWidth: tool === TOOLS.HIGHLIGHTER ? strokeWidth * 2 : strokeWidth,
            opacity: tool === TOOLS.HIGHLIGHTER ? 0.5 : 1,
            layerId: activeLayer,
          };
          setCurrentPath(newPath);
        }

        // 添加到历史记录
        addToHistory();
      }
    })
    .onUpdate((e) => {
      if (currentPath && !readOnly) {
        // 计算画布坐标
        const x = (e.x - translateX.value) / scale.value;
        const y = (e.y - translateY.value) / scale.value;

        if (currentPath.type === 'shape') {
          // 更新形状的结束点
          setCurrentPath({
            ...currentPath,
            endX: x,
            endY: y,
          });
        } else if (currentPath.type === 'path') {
          // 更新路径点
          const newPoints = [...currentPath.points, { x, y }];
          setCurrentPath({
            ...currentPath,
            points: newPoints,
          });
        }
      }
    })
    .onEnd(() => {
      if (currentPath && !readOnly) {
        // 完成绘制，添加到元素列表
        setElements(prev => [...prev, currentPath]);
        setCurrentPath(null);

        // 通知内容变化
        if (onContentChange) {
          onContentChange([...elements, currentPath]);
        }
      }
    });

  // 组合手势
  const composedGestures = Gesture.Exclusive(
    drawGesture,
    Gesture.Simultaneous(panGesture, pinchGesture)
  );

  // 动画样式
  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value }
      ]
    };
  });

  // 渲染网格背景
  const renderGrid = useCallback(() => {
    if (!showGrid) return null;

    // 根据缩放级别调整网格大小
    const gridSize = Math.max(20, Math.min(50, 40 / scale.value));

    return (
      <Defs>
        <Pattern id="grid" width={gridSize} height={gridSize} patternUnits="userSpaceOnUse">
          <Path
            d={`M ${gridSize} 0 L 0 0 0 ${gridSize}`}
            fill="none"
            stroke="rgba(0, 0, 0, 0.1)"
            strokeWidth="1"
          />
        </Pattern>
      </Defs>
    );
  }, [showGrid, scale.value]);

  // 渲染路径
  const renderPath = useCallback((path) => {
    if (!path.points || path.points.length < 2) return null;

    // 创建SVG路径字符串
    let pathData = `M ${path.points[0].x} ${path.points[0].y}`;

    // 使用二次贝塞尔曲线使线条更平滑
    if (path.tool === TOOLS.PEN) {
      for (let i = 1; i < path.points.length; i++) {
        const p1 = path.points[i - 1];
        const p2 = path.points[i];
        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;

        if (i === 1) {
          pathData += ` L ${midX} ${midY}`;
        } else {
          pathData += ` Q ${p1.x} ${p1.y} ${midX} ${midY}`;
        }

        if (i === path.points.length - 1) {
          pathData += ` L ${p2.x} ${p2.y}`;
        }
      }
    } else {
      // 其他工具使用直线
      for (let i = 1; i < path.points.length; i++) {
        pathData += ` L ${path.points[i].x} ${path.points[i].y}`;
      }
    }

    return (
      <Path
        key={path.id}
        d={pathData}
        stroke={path.color}
        strokeWidth={path.strokeWidth}
        strokeOpacity={path.opacity || 1}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    );
  }, []);

  // 渲染形状
  const renderShape = useCallback((shape) => {
    const { startX, startY, endX, endY, shapeType, color, strokeWidth } = shape;

    switch (shapeType) {
      case SHAPES.LINE:
        return (
          <Line
            key={shape.id}
            x1={startX}
            y1={startY}
            x2={endX}
            y2={endY}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
        );
      case SHAPES.RECTANGLE:
        const rectX = Math.min(startX, endX);
        const rectY = Math.min(startY, endY);
        const rectWidth = Math.abs(endX - startX);
        const rectHeight = Math.abs(endY - startY);

        return (
          <Rect
            key={shape.id}
            x={rectX}
            y={rectY}
            width={rectWidth}
            height={rectHeight}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="none"
          />
        );
      case SHAPES.CIRCLE:
        const radius = Math.sqrt(
          Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2)
        );

        return (
          <Circle
            key={shape.id}
            cx={startX}
            cy={startY}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="none"
          />
        );
      case SHAPES.TRIANGLE:
        // 计算三角形的三个点
        const midX = (startX + endX) / 2;

        return (
          <Polygon
            key={shape.id}
            points={`${midX},${startY} ${startX},${endY} ${endX},${endY}`}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="none"
          />
        );
      case SHAPES.ARROW:
        // 计算箭头
        const angle = Math.atan2(endY - startY, endX - startX);
        const arrowLength = 15;
        const arrowAngle = Math.PI / 6; // 30度

        const arrowPoint1X = endX - arrowLength * Math.cos(angle - arrowAngle);
        const arrowPoint1Y = endY - arrowLength * Math.sin(angle - arrowAngle);
        const arrowPoint2X = endX - arrowLength * Math.cos(angle + arrowAngle);
        const arrowPoint2Y = endY - arrowLength * Math.sin(angle + arrowAngle);

        return (
          <G key={shape.id}>
            <Line
              x1={startX}
              y1={startY}
              x2={endX}
              y2={endY}
              stroke={color}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
            />
            <Polygon
              points={`${endX},${endY} ${arrowPoint1X},${arrowPoint1Y} ${arrowPoint2X},${arrowPoint2Y}`}
              fill={color}
              stroke={color}
              strokeWidth={1}
            />
          </G>
        );
      default:
        return null;
    }
  }, []);

  // 渲染文本
  const renderText = useCallback((text) => {
    return (
      <SvgText
        key={text.id}
        x={text.x}
        y={text.y}
        fontSize={text.fontSize}
        fontFamily={text.fontFamily}
        fill={text.color}
        textAnchor="middle"
      >
        {text.content}
      </SvgText>
    );
  }, []);

  // 渲染图片
  const renderImage = useCallback((image) => {
    return (
      <SvgImage
        key={image.id}
        href={{ uri: image.uri }}
        x={image.x}
        y={image.y}
        width={image.width}
        height={image.height}
        preserveAspectRatio="xMidYMid slice"
      />
    );
  }, []);

  // 渲染元素
  const renderElement = useCallback((element) => {
    // 检查元素是否在可见图层中
    const layer = layers.find(l => l.id === element.layerId);
    if (layer && !layer.visible) return null;

    switch (element.type) {
      case 'path':
        return renderPath(element);
      case 'shape':
        return renderShape(element);
      case 'text':
        return renderText(element);
      case 'image':
        return renderImage(element);
      default:
        return null;
    }
  }, [layers, renderPath, renderShape, renderText, renderImage]);

  // 渲染当前绘制的路径或形状
  const renderCurrentElement = useCallback(() => {
    if (!currentPath) return null;

    switch (currentPath.type) {
      case 'path':
        return renderPath(currentPath);
      case 'shape':
        return renderShape(currentPath);
      default:
        return null;
    }
  }, [currentPath, renderPath, renderShape]);

  // 渲染可见区域内的元素
  const renderVisibleElements = useCallback(() => {
    // 计算可见区域的边界
    const visibleLeft = -translateX.value / scale.value;
    const visibleTop = -translateY.value / scale.value;
    const visibleRight = visibleLeft + screenWidth / scale.value;
    const visibleBottom = visibleTop + screenHeight / scale.value;

    // 添加边距以确保边缘元素也被渲染
    const margin = 100;

    // 过滤出可见区域内的元素
    return elements.filter(element => {
      // 简单的边界框检查
      let x, y, width, height;

      switch (element.type) {
        case 'path':
          if (!element.points || element.points.length === 0) return false;

          // 计算路径的边界框
          const xs = element.points.map(p => p.x);
          const ys = element.points.map(p => p.y);
          x = Math.min(...xs);
          y = Math.min(...ys);
          width = Math.max(...xs) - x;
          height = Math.max(...ys) - y;
          break;

        case 'shape':
          x = Math.min(element.startX, element.endX);
          y = Math.min(element.startY, element.endY);
          width = Math.abs(element.endX - element.startX);
          height = Math.abs(element.endY - element.startY);
          break;

        case 'text':
          x = element.x - 100; // 估计文本宽度
          y = element.y - 20; // 估计文本高度
          width = 200;
          height = 40;
          break;

        case 'image':
          x = element.x;
          y = element.y;
          width = element.width;
          height = element.height;
          break;

        default:
          return false;
      }

      // 检查元素是否在可见区域内
      return (
        x - margin < visibleRight &&
        x + width + margin > visibleLeft &&
        y - margin < visibleBottom &&
        y + height + margin > visibleTop
      );
    }).map(renderElement);
  }, [elements, renderElement, scale.value, translateX.value, translateY.value, screenWidth, screenHeight]);

  // 工具栏组件
  const ToolbarButton = ({ icon, label, active, onPress }) => (
    <TouchableOpacity
      style={[
        styles.toolbarButton,
        active && { backgroundColor: colors.primary + '33' }
      ]}
      onPress={onPress}
    >
      <Text style={[styles.toolbarButtonText, active && { color: colors.primary }]}>
        {icon}
      </Text>
      <Text style={[styles.toolbarButtonLabel, active && { color: colors.primary }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  // 渲染工具栏
  const renderToolbar = () => (
    <View style={styles.toolbar}>
      <ToolbarButton
        icon="✏️"
        label="笔"
        active={tool === TOOLS.PEN}
        onPress={() => setTool(TOOLS.PEN)}
      />
      <ToolbarButton
        icon="🖌️"
        label="荧光笔"
        active={tool === TOOLS.HIGHLIGHTER}
        onPress={() => setTool(TOOLS.HIGHLIGHTER)}
      />
      <ToolbarButton
        icon="🧽"
        label="橡皮擦"
        active={tool === TOOLS.ERASER}
        onPress={() => setTool(TOOLS.ERASER)}
      />
      <ToolbarButton
        icon="📐"
        label="形状"
        active={tool === TOOLS.SHAPE}
        onPress={() => setTool(TOOLS.SHAPE)}
      />
      <ToolbarButton
        icon="📝"
        label="文本"
        active={tool === TOOLS.TEXT}
        onPress={() => setTool(TOOLS.TEXT)}
      />
      <ToolbarButton
        icon="🖼️"
        label="图片"
        active={tool === TOOLS.IMAGE}
        onPress={handleAddImage}
      />
      <ToolbarButton
        icon="👆"
        label="选择"
        active={tool === TOOLS.SELECT}
        onPress={() => setTool(TOOLS.SELECT)}
      />
    </View>
  );

  // 渲染形状工具栏
  const renderShapeToolbar = () => {
    if (tool !== TOOLS.SHAPE) return null;

    return (
      <View style={styles.shapeToolbar}>
        <ToolbarButton
          icon="━"
          label="直线"
          active={shape === SHAPES.LINE}
          onPress={() => setShape(SHAPES.LINE)}
        />
        <ToolbarButton
          icon="□"
          label="矩形"
          active={shape === SHAPES.RECTANGLE}
          onPress={() => setShape(SHAPES.RECTANGLE)}
        />
        <ToolbarButton
          icon="○"
          label="圆形"
          active={shape === SHAPES.CIRCLE}
          onPress={() => setShape(SHAPES.CIRCLE)}
        />
        <ToolbarButton
          icon="△"
          label="三角形"
          active={shape === SHAPES.TRIANGLE}
          onPress={() => setShape(SHAPES.TRIANGLE)}
        />
        <ToolbarButton
          icon="→"
          label="箭头"
          active={shape === SHAPES.ARROW}
          onPress={() => setShape(SHAPES.ARROW)}
        />
      </View>
    );
  };

  // 渲染颜色选择器
  const renderColorPicker = () => {
    const colors = [
      '#000000', '#FF0000', '#00FF00', '#0000FF',
      '#FFFF00', '#FF00FF', '#00FFFF', '#FF9900'
    ];

    return (
      <View style={styles.colorPicker}>
        {colors.map(c => (
          <TouchableOpacity
            key={c}
            style={[
              styles.colorButton,
              { backgroundColor: c },
              color === c && styles.colorButtonActive
            ]}
            onPress={() => setColor(c)}
          />
        ))}
      </View>
    );
  };

  // 渲染线宽选择器
  const renderStrokeWidthPicker = () => {
    const widths = [1, 2, 4, 6, 8];

    return (
      <View style={styles.strokeWidthPicker}>
        {widths.map(w => (
          <TouchableOpacity
            key={w}
            style={[
              styles.strokeWidthButton,
              strokeWidth === w && styles.strokeWidthButtonActive
            ]}
            onPress={() => setStrokeWidth(w)}
          >
            <View style={[styles.strokeWidthIndicator, { height: w }]} />
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  // 渲染操作按钮
  const renderActionButtons = () => (
    <View style={styles.actionButtons}>
      <TouchableOpacity
        style={styles.actionButton}
        onPress={handleUndo}
        disabled={history.length === 0}
      >
        <Text style={[styles.actionButtonText, history.length === 0 && styles.actionButtonDisabled]}>
          ↩️ 撤销
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.actionButton}
        onPress={handleRedo}
        disabled={redoStack.length === 0}
      >
        <Text style={[styles.actionButtonText, redoStack.length === 0 && styles.actionButtonDisabled]}>
          ↪️ 重做
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.actionButton}
        onPress={handleClear}
      >
        <Text style={styles.actionButtonText}>
          🗑️ 清空
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.actionButton}
        onPress={handleSave}
      >
        <Text style={styles.actionButtonText}>
          💾 保存
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.actionButton}
        onPress={handleExport}
      >
        <Text style={styles.actionButtonText}>
          📤 导出
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.actionButton}
        onPress={() => setShowGrid(!showGrid)}
      >
        <Text style={styles.actionButtonText}>
          {showGrid ? '🔲 隐藏网格' : '🔳 显示网格'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  // 主渲染函数
  return (
    <View style={styles.container}>
      {/* 加载指示器 */}
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      )}

      {/* 工具栏 */}
      {!readOnly && (
        <>
          {renderToolbar()}
          {renderShapeToolbar()}
          {renderColorPicker()}
          {renderStrokeWidthPicker()}
          {renderActionButtons()}
        </>
      )}

      {/* 画布 */}
      <GestureDetector gesture={composedGestures}>
        <Animated.View style={[styles.canvasContainer, animatedStyle]}>
          <Svg
            ref={svgRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
          >
            {/* 网格背景 */}
            {renderGrid()}
            {showGrid && (
              <Rect
                x={0}
                y={0}
                width={CANVAS_WIDTH}
                height={CANVAS_HEIGHT}
                fill="url(#grid)"
              />
            )}

            {/* 画布元素 - 使用虚拟化技术只渲染可见区域的元素 */}
            {renderVisibleElements()}

            {/* 当前绘制的元素 */}
            {renderCurrentElement()}
          </Svg>
        </Animated.View>
      </GestureDetector>
    </View>
  );
};

// 样式
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  canvasContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingText: {
    color: '#ffffff',
    marginTop: 10,
    fontSize: 16,
  },
  toolbar: {
    flexDirection: 'row',
    padding: 8,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    justifyContent: 'space-around',
  },
  shapeToolbar: {
    flexDirection: 'row',
    padding: 8,
    backgroundColor: '#f0f0f0',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    justifyContent: 'space-around',
  },
  toolbarButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    borderRadius: 8,
  },
  toolbarButtonText: {
    fontSize: 20,
    marginBottom: 4,
  },
  toolbarButtonLabel: {
    fontSize: 12,
    color: '#666666',
  },
  colorPicker: {
    flexDirection: 'row',
    padding: 8,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    justifyContent: 'space-around',
  },
  colorButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  colorButtonActive: {
    borderWidth: 3,
    borderColor: '#000000',
  },
  strokeWidthPicker: {
    flexDirection: 'row',
    padding: 8,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  strokeWidthButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  strokeWidthButtonActive: {
    borderWidth: 2,
    borderColor: '#000000',
    backgroundColor: '#e0e0e0',
  },
  strokeWidthIndicator: {
    width: '80%',
    backgroundColor: '#000000',
    borderRadius: 4,
  },
  actionButtons: {
    flexDirection: 'row',
    padding: 8,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    justifyContent: 'space-around',
  },
  actionButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  actionButtonText: {
    fontSize: 14,
    color: '#333333',
  },
  actionButtonDisabled: {
    color: '#999999',
  },
});

export default InfiniteCanvas;