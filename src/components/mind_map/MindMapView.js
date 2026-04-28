/**
 * 思维导图视图组件
 * 用于显示和交互思维导图
 */

import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import {
  View,
  Text,
  StyleSheet,
  PanResponder,
  Animated,
  Dimensions,
  Platform,
  PixelRatio,
  TouchableOpacity,
} from 'react-native';
import Svg, { G, Circle, Rect, Path, Text as SvgText, Line, Defs, Marker, Pattern } from 'react-native-svg';
import { useTheme } from '../../context/ThemeContext';
import mindMapLayoutUtils from '../../utils/mindMapLayoutUtils';

const { width, height } = Dimensions.get('window');

// 获取设备像素比
const pixelRatio = PixelRatio.get();

// 根据屏幕尺寸调整节点大小和间距 - 增强版
const getResponsiveNodeSize = () => {
  // 获取屏幕尺寸和像素密度
  const screenWidth = width;
  const screenHeight = height;
  const isLandscape = screenWidth > screenHeight;
  const aspectRatio = screenWidth / screenHeight;

  // 根据设备类型和方向调整尺寸

  // 手机 - 小屏幕
  if (screenWidth < 360) {
    return {
      NODE_WIDTH: 90,
      NODE_HEIGHT: 45,
      NODE_MARGIN_X: 50,
      NODE_MARGIN_Y: 40,
      FONT_SIZE_ROOT: 14,
      FONT_SIZE_CHILD: 12,
      FONT_SIZE_GRANDCHILD: 10,
      MINIMAP_WIDTH: 80,
      MINIMAP_HEIGHT: 60,
      SHOW_MINIMAP: false, // 小屏幕默认不显示迷你地图
      SHOW_GRID: false,    // 小屏幕默认不显示网格
    };
  }

  // 手机 - 中等屏幕
  if (screenWidth < 480) {
    return {
      NODE_WIDTH: 100,
      NODE_HEIGHT: 50,
      NODE_MARGIN_X: 60,
      NODE_MARGIN_Y: 50,
      FONT_SIZE_ROOT: 15,
      FONT_SIZE_CHILD: 13,
      FONT_SIZE_GRANDCHILD: 11,
      MINIMAP_WIDTH: 90,
      MINIMAP_HEIGHT: 70,
      SHOW_MINIMAP: true,
      SHOW_GRID: true,
    };
  }

  // 平板 - 小屏幕或手机横屏
  if (screenWidth < 768 || (isLandscape && screenWidth < 900)) {
    return {
      NODE_WIDTH: 120,
      NODE_HEIGHT: 60,
      NODE_MARGIN_X: 80,
      NODE_MARGIN_Y: 60,
      FONT_SIZE_ROOT: 16,
      FONT_SIZE_CHILD: 14,
      FONT_SIZE_GRANDCHILD: 12,
      MINIMAP_WIDTH: 100,
      MINIMAP_HEIGHT: 80,
      SHOW_MINIMAP: true,
      SHOW_GRID: true,
    };
  }

  // 平板 - 大屏幕
  if (screenWidth < 1024) {
    return {
      NODE_WIDTH: 140,
      NODE_HEIGHT: 70,
      NODE_MARGIN_X: 100,
      NODE_MARGIN_Y: 80,
      FONT_SIZE_ROOT: 18,
      FONT_SIZE_CHILD: 16,
      FONT_SIZE_GRANDCHILD: 14,
      MINIMAP_WIDTH: 120,
      MINIMAP_HEIGHT: 90,
      SHOW_MINIMAP: true,
      SHOW_GRID: true,
    };
  }

  // 桌面或大屏设备
  return {
    NODE_WIDTH: 160,
    NODE_HEIGHT: 80,
    NODE_MARGIN_X: 120,
    NODE_MARGIN_Y: 100,
    FONT_SIZE_ROOT: 20,
    FONT_SIZE_CHILD: 18,
    FONT_SIZE_GRANDCHILD: 16,
    MINIMAP_WIDTH: 150,
    MINIMAP_HEIGHT: 120,
    SHOW_MINIMAP: true,
    SHOW_GRID: true,
  };
};

// 获取响应式节点尺寸和配置
const {
  NODE_WIDTH,
  NODE_HEIGHT,
  NODE_MARGIN_X,
  NODE_MARGIN_Y,
  FONT_SIZE_ROOT,
  FONT_SIZE_CHILD,
  FONT_SIZE_GRANDCHILD,
  MINIMAP_WIDTH,
  MINIMAP_HEIGHT,
  SHOW_MINIMAP,
  SHOW_GRID,
} = getResponsiveNodeSize();

// 思维导图视图组件
const MindMapView = forwardRef(({
  nodes = [],
  edges = [],
  layoutType = 'tree',
  theme = 'default',
  onNodePress,
  onNodeLongPress,
}, ref) => {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  // 状态
  const [pan] = useState(new Animated.ValueXY());
  const [scale] = useState(new Animated.Value(1));
  const [lastScale, setLastScale] = useState(1);
  const [lastPan, setLastPan] = useState({ x: 0, y: 0 });
  const [nodePositions, setNodePositions] = useState({});

  // 引用
  const viewRef = useRef(null);

  // 暴露给父组件的方法
  useImperativeHandle(ref, () => ({
    updateLayout: (newLayoutType) => {
      calculateNodePositions(newLayoutType);
    },
    resetView: () => {
      resetView();
    },
    zoomIn: () => {
      zoomIn();
    },
    zoomOut: () => {
      zoomOut();
    },
  }));

  // 手势状态 - 增强版
  const gestureState = useRef({
    initialDistance: 0,
    initialScale: 1,
    initialRotation: 0,
    isPinching: false,
    initialFocus: { x: 0, y: 0 },
    lastPinchDistance: 0,
    lastPinchScale: 1,
    lastPinchRotation: 0,
    lastPinchCenter: { x: 0, y: 0 },
    draggedNodeId: null,
    lastTapTime: 0,        // 用于检测双击
    lastTapPosition: { x: 0, y: 0 }, // 用于检测双击位置
    isDoubleTap: false,    // 是否是双击
    isDragging: false,     // 是否正在拖动
    dragStartTime: 0,      // 拖动开始时间
    dragStartPosition: { x: 0, y: 0 }, // 拖动开始位置
    velocityX: 0,          // X方向速度
    velocityY: 0,          // Y方向速度
    lastMoveTime: 0,       // 上次移动时间
    lastMovePosition: { x: 0, y: 0 }, // 上次移动位置
  });

  // 计算两点之间的距离
  const distance = (p1, p2) => {
    const dx = p1.pageX - p2.pageX;
    const dy = p1.pageY - p2.pageY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // 计算两点的中心点
  const center = (p1, p2) => {
    return {
      x: (p1.pageX + p2.pageX) / 2,
      y: (p1.pageY + p2.pageY) / 2,
    };
  };

  // 计算两点的旋转角度
  const rotation = (p1, p2) => {
    return Math.atan2(p2.pageY - p1.pageY, p2.pageX - p1.pageX) * 180 / Math.PI;
  };

  // 手势处理 - 增强版
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (evt, gs) => {
        // 如果移动距离太小，不触发拖动
        return Math.abs(gs.dx) > 2 || Math.abs(gs.dy) > 2;
      },

      onPanResponderGrant: (evt, gs) => {
        const now = Date.now();
        const touch = evt.nativeEvent.touches[0];
        const touchX = touch.pageX;
        const touchY = touch.pageY;

        // 保存拖动开始信息
        gestureState.current.isDragging = true;
        gestureState.current.dragStartTime = now;
        gestureState.current.dragStartPosition = { x: touchX, y: touchY };
        gestureState.current.lastMoveTime = now;
        gestureState.current.lastMovePosition = { x: touchX, y: touchY };

        // 检查是否是双击
        const isDoubleTap =
          now - gestureState.current.lastTapTime < 300 &&
          Math.abs(touchX - gestureState.current.lastTapPosition.x) < 30 &&
          Math.abs(touchY - gestureState.current.lastTapPosition.y) < 30;

        gestureState.current.isDoubleTap = isDoubleTap;

        // 更新最后一次点击信息
        gestureState.current.lastTapTime = now;
        gestureState.current.lastTapPosition = { x: touchX, y: touchY };

        // 检查是否是多点触控
        if (evt.nativeEvent.touches.length > 1) {
          const touch1 = evt.nativeEvent.touches[0];
          const touch2 = evt.nativeEvent.touches[1];

          gestureState.current.initialDistance = distance(touch1, touch2);
          gestureState.current.initialScale = lastScale;
          gestureState.current.initialRotation = rotation(touch1, touch2);
          gestureState.current.isPinching = true;
          gestureState.current.initialFocus = center(touch1, touch2);

          // 保存当前状态
          gestureState.current.lastPinchDistance = gestureState.current.initialDistance;
          gestureState.current.lastPinchScale = gestureState.current.initialScale;
          gestureState.current.lastPinchRotation = gestureState.current.initialRotation;
          gestureState.current.lastPinchCenter = gestureState.current.initialFocus;
        } else {
          // 如果是双击，处理双击缩放
          if (isDoubleTap) {
            // 双击缩放
            const newScale = lastScale > 1.5 ? 1 : 2;
            Animated.spring(scale, {
              toValue: newScale,
              friction: 7,
              tension: 40,
              useNativeDriver: false,
            }).start();
            setLastScale(newScale);
            return;
          }

          // 单点触控 - 平移或拖拽节点
          pan.setOffset({
            x: pan.x._value,
            y: pan.y._value,
          });
          pan.setValue({ x: 0, y: 0 });

          // 检查是否点击了节点
          const nodeId = findNodeAtPosition(touchX, touchY);
          gestureState.current.draggedNodeId = nodeId;
        }
      },

      onPanResponderMove: (evt, gs) => {
        const now = Date.now();
        const touch = evt.nativeEvent.touches[0];
        const touchX = touch.pageX;
        const touchY = touch.pageY;

        // 计算移动速度
        const timeDelta = now - gestureState.current.lastMoveTime;
        if (timeDelta > 0) {
          gestureState.current.velocityX = (touchX - gestureState.current.lastMovePosition.x) / timeDelta;
          gestureState.current.velocityY = (touchY - gestureState.current.lastMovePosition.y) / timeDelta;
        }

        // 更新最后移动信息
        gestureState.current.lastMoveTime = now;
        gestureState.current.lastMovePosition = { x: touchX, y: touchY };

        // 如果是双击，不处理移动
        if (gestureState.current.isDoubleTap) {
          return;
        }

        // 检查是否是多点触控
        if (evt.nativeEvent.touches.length > 1) {
          const touch1 = evt.nativeEvent.touches[0];
          const touch2 = evt.nativeEvent.touches[1];

          // 计算新的距离、缩放和旋转
          const newDistance = distance(touch1, touch2);
          const newCenter = center(touch1, touch2);
          const newRotation = rotation(touch1, touch2);

          // 计算缩放比例变化
          const scaleChange = newDistance / gestureState.current.lastPinchDistance;
          const newScale = gestureState.current.lastPinchScale * scaleChange;

          // 限制缩放范围
          const clampedScale = Math.min(Math.max(newScale, 0.3), 5);

          // 应用缩放
          scale.setValue(clampedScale);

          // 计算缩放中心点的偏移
          const focusShiftX = newCenter.x - gestureState.current.initialFocus.x;
          const focusShiftY = newCenter.y - gestureState.current.initialFocus.y;

          // 应用平移补偿，使缩放围绕手指中心点
          pan.setValue({
            x: lastPan.x + focusShiftX * (1 - scaleChange),
            y: lastPan.y + focusShiftY * (1 - scaleChange),
          });

          // 更新状态
          gestureState.current.lastPinchDistance = newDistance;
          gestureState.current.lastPinchScale = clampedScale;
          gestureState.current.lastPinchRotation = newRotation;
          gestureState.current.lastPinchCenter = newCenter;
        } else if (gestureState.current.draggedNodeId) {
          // 拖拽节点
          const nodeId = gestureState.current.draggedNodeId;
          const nodePosition = nodePositions[nodeId];

          if (nodePosition) {
            // 更新节点位置
            const updatedPositions = { ...nodePositions };
            updatedPositions[nodeId] = {
              x: nodePosition.x + gs.dx / scale._value,
              y: nodePosition.y + gs.dy / scale._value,
            };
            setNodePositions(updatedPositions);
          }
        } else {
          // 平移整个视图
          Animated.event(
            [null, { dx: pan.x, dy: pan.y }],
            { useNativeDriver: false }
          )(evt, gs);
        }
      },

      onPanResponderRelease: (evt, gs) => {
        const now = Date.now();
        const dragDuration = now - gestureState.current.dragStartTime;

        // 处理惯性滑动
        if (!gestureState.current.isPinching && !gestureState.current.draggedNodeId && dragDuration < 300) {
          const velocityX = gestureState.current.velocityX;
          const velocityY = gestureState.current.velocityY;
          const speed = Math.sqrt(velocityX * velocityX + velocityY * velocityY);

          // 如果速度足够大，应用惯性
          if (speed > 0.5) {
            // 计算惯性距离
            const inertiaX = velocityX * 200; // 惯性系数
            const inertiaY = velocityY * 200;

            // 应用惯性滑动
            Animated.decay(pan, {
              velocity: { x: velocityX, y: velocityY },
              deceleration: 0.997,
              useNativeDriver: false,
            }).start(() => {
              // 惯性滑动结束后更新最终位置
              pan.flattenOffset();
              setLastPan({
                x: pan.x._value,
                y: pan.y._value,
              });
            });
          } else {
            // 速度不够大，直接结束平移
            pan.flattenOffset();
            setLastPan({
              x: pan.x._value,
              y: pan.y._value,
            });
          }
        } else if (gestureState.current.isPinching) {
          // 结束缩放手势
          setLastScale(scale._value);
          setLastPan({
            x: pan.x._value,
            y: pan.y._value,
          });
          gestureState.current.isPinching = false;
        } else if (gestureState.current.draggedNodeId) {
          // 结束拖拽节点
          gestureState.current.draggedNodeId = null;
        } else {
          // 结束平移
          pan.flattenOffset();
          setLastPan({
            x: pan.x._value,
            y: pan.y._value,
          });
        }

        // 重置拖动状态
        gestureState.current.isDragging = false;
        gestureState.current.isDoubleTap = false;
      },

      onPanResponderTerminate: () => {
        // 手势被中断时的处理
        pan.flattenOffset();
        setLastPan({
          x: pan.x._value,
          y: pan.y._value,
        });
        gestureState.current.isPinching = false;
        gestureState.current.draggedNodeId = null;
        gestureState.current.isDragging = false;
        gestureState.current.isDoubleTap = false;
      },
    })
  ).current;

  // 查找指定位置的节点
  const findNodeAtPosition = (x, y) => {
    // 考虑当前的平移和缩放
    const adjustedX = (x - width / 2 - pan.x._value) / scale._value + width / 2;
    const adjustedY = (y - height / 2 - pan.y._value) / scale._value + height / 2;

    // 检查每个节点
    for (const nodeId in nodePositions) {
      const position = nodePositions[nodeId];

      // 检查点是否在节点内
      if (
        Math.abs(adjustedX - position.x) < NODE_WIDTH / 2 &&
        Math.abs(adjustedY - position.y) < NODE_HEIGHT / 2
      ) {
        return nodeId;
      }
    }

    return null;
  };

  // 计算节点位置
  const calculateNodePositions = (currentLayoutType = layoutType) => {
    if (!nodes.length) {return;}

    // 使用布局工具构建节点树
    const { nodeMap, rootNode } = mindMapLayoutUtils.buildNodeTree(nodes);

    if (!rootNode) {return;}

    // 布局选项
    const layoutOptions = {
      nodeWidth: NODE_WIDTH,
      nodeHeight: NODE_HEIGHT,
      nodeMarginX: NODE_MARGIN_X,
      nodeMarginY: NODE_MARGIN_Y,
      startX: width / 2,
      startY: 100,
      centerX: width / 2,
      centerY: height / 2,
      avoidOverlap: true,
    };

    // 根据布局类型计算位置
    let positions = {};

    switch (currentLayoutType) {
      case 'tree':
        positions = mindMapLayoutUtils.calculateTreeLayout(rootNode, layoutOptions);
        break;
      case 'radial':
        positions = mindMapLayoutUtils.calculateRadialLayout(rootNode, layoutOptions);
        break;
      case 'horizontal':
        positions = mindMapLayoutUtils.calculateHorizontalLayout(rootNode, {
          ...layoutOptions,
          startX: 100,
          startY: height / 2,
        });
        break;
      case 'vertical':
        positions = mindMapLayoutUtils.calculateTreeLayout(rootNode, layoutOptions);
        break;
      case 'force':
        positions = mindMapLayoutUtils.calculateForceDirectedLayout(nodes, edges, layoutOptions);
        break;
      default:
        positions = mindMapLayoutUtils.calculateTreeLayout(rootNode, layoutOptions);
    }

    setNodePositions(positions);
  };

  // 重置视图 - 增强版
  const resetView = () => {
    // 重置缩放和平移到初始状态，使用更自然的动画
    Animated.parallel([
      Animated.spring(pan, {
        toValue: { x: 0, y: 0 },
        friction: 7,
        tension: 40,
        useNativeDriver: false,
      }),
      Animated.spring(scale, {
        toValue: 1,
        friction: 7,
        tension: 40,
        useNativeDriver: false,
      }),
    ]).start();

    // 更新状态
    setLastPan({ x: 0, y: 0 });
    setLastScale(1);

    // 如果有自定义节点位置，也重置它们
    if (nodes.length > 0 && edges.length > 0) {
      calculateNodePositions();
    }
  };

  // 放大 - 增强版
  const zoomIn = () => {
    // 计算新的缩放值，使用乘法而不是加法，提供更自然的缩放感觉
    const newScale = Math.min(lastScale * 1.2, 5);

    // 应用缩放动画，使用更自然的弹簧动画
    Animated.spring(scale, {
      toValue: newScale,
      friction: 7,
      tension: 40,
      useNativeDriver: false,
    }).start();

    // 更新最后缩放值
    setLastScale(newScale);
  };

  // 缩小 - 增强版
  const zoomOut = () => {
    // 计算新的缩放值，使用乘法而不是减法
    const newScale = Math.max(lastScale * 0.8, 0.3);

    // 应用缩放动画
    Animated.spring(scale, {
      toValue: newScale,
      friction: 7,
      tension: 40,
      useNativeDriver: false,
    }).start();

    // 更新最后缩放值
    setLastScale(newScale);
  };

  // 初始化和布局变化时计算节点位置
  useEffect(() => {
    calculateNodePositions();
  }, [nodes, edges, layoutType]);

  // 渲染节点
  const renderNode = (node) => {
    const position = nodePositions[node.id];
    if (!position) {return null;}

    // 根据主题获取节点样式
    const nodeStyle = getNodeStyle(node, theme);

    // 检查节点是否被拖拽
    const isDragged = gestureState.current?.draggedNodeId === node.id;

    // 节点阴影和高亮效果
    const shadowProps = isDragged ? {
      shadowOpacity: 0.8,
      shadowRadius: 5,
      shadowOffset: { width: 0, height: 3 },
      elevation: 10,
    } : {};

    // 节点内容溢出处理
    const title = node.title || '';
    const displayTitle = title.length > 15 ? title.substring(0, 12) + '...' : title;

    // 计算节点尺寸（可能根据内容长度调整）
    const nodeWidth = NODE_WIDTH;
    const nodeHeight = NODE_HEIGHT;

    return (
      <G
        key={node.id}
        onPress={() => onNodePress && onNodePress(node)}
        onLongPress={() => onNodeLongPress && onNodeLongPress(node)}
      >
        {/* 节点阴影（仅在SVG中模拟） */}
        {isDragged && (
          <Rect
            x={position.x - nodeWidth / 2 + 2}
            y={position.y - nodeHeight / 2 + 2}
            width={nodeWidth}
            height={nodeHeight}
            rx={8}
            ry={8}
            fill="#00000022"
          />
        )}

        {/* 节点形状 */}
        {nodeStyle.shape === 'rectangle' ? (
          <Rect
            x={validateTransform(position.x - nodeWidth / 2)}
            y={validateTransform(position.y - nodeHeight / 2)}
            width={validateTransform(nodeWidth)}
            height={validateTransform(nodeHeight)}
            rx={8}
            ry={8}
            fill={nodeStyle.fill}
            stroke={nodeStyle.stroke}
            strokeWidth={isDragged ? 3 : 2}
            {...shadowProps}
          />
        ) : nodeStyle.shape === 'ellipse' ? (
          <Circle
            cx={validateTransform(position.x)}
            cy={validateTransform(position.y)}
            r={validateTransform(nodeWidth / 2)}
            fill={nodeStyle.fill}
            stroke={nodeStyle.stroke}
            strokeWidth={isDragged ? 3 : 2}
            {...shadowProps}
          />
        ) : nodeStyle.shape === 'diamond' ? (
          <Path
            d={`M ${validateTransform(position.x)} ${validateTransform(position.y - nodeHeight / 2)}
               L ${validateTransform(position.x + nodeWidth / 2)} ${validateTransform(position.y)}
               L ${validateTransform(position.x)} ${validateTransform(position.y + nodeHeight / 2)}
               L ${validateTransform(position.x - nodeWidth / 2)} ${validateTransform(position.y)} Z`}
            fill={nodeStyle.fill}
            stroke={nodeStyle.stroke}
            strokeWidth={isDragged ? 3 : 2}
            {...shadowProps}
          />
        ) : (
          // 默认为圆角矩形
          <Rect
            x={validateTransform(position.x - nodeWidth / 2)}
            y={validateTransform(position.y - nodeHeight / 2)}
            width={validateTransform(nodeWidth)}
            height={validateTransform(nodeHeight)}
            rx={8}
            ry={8}
            fill={nodeStyle.fill}
            stroke={nodeStyle.stroke}
            strokeWidth={isDragged ? 3 : 2}
            {...shadowProps}
          />
        )}

        {/* 节点文本 */}
        <SvgText
          x={validateTransform(position.x)}
          y={validateTransform(position.y)}
          fontSize={nodeStyle.fontSize}
          fontWeight={nodeStyle.fontWeight}
          fill={nodeStyle.textColor}
          textAnchor="middle"
          alignmentBaseline="middle"
        >
          {displayTitle}
        </SvgText>

        {/* 如果有子节点且被折叠，显示展开指示器 */}
        {node.is_collapsed && (
          <Circle
            cx={validateTransform(position.x + nodeWidth / 2 - 10)}
            cy={validateTransform(position.y + nodeHeight / 2 - 10)}
            r={8}
            fill={nodeStyle.stroke}
            stroke="#ffffff"
            strokeWidth={1}
          />
        )}
      </G>
    );
  };

  // 渲染边
  const renderEdge = (edge) => {
    const sourcePosition = nodePositions[edge.source];
    const targetPosition = nodePositions[edge.target];

    if (!sourcePosition || !targetPosition) {return null;}

    // 根据主题获取边样式
    const edgeStyle = getEdgeStyle(edge, theme);

    // 计算边的控制点（用于曲线）
    const dx = targetPosition.x - sourcePosition.x;
    const dy = targetPosition.y - sourcePosition.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // 根据距离决定是直线还是曲线
    if (distance < NODE_WIDTH * 2) {
      // 短距离使用直线
      return (
        <G key={edge.id}>
          <Line
            x1={validateTransform(sourcePosition.x)}
            y1={validateTransform(sourcePosition.y)}
            x2={validateTransform(targetPosition.x)}
            y2={validateTransform(targetPosition.y)}
            stroke={edgeStyle.stroke}
            strokeWidth={edgeStyle.strokeWidth}
            strokeDasharray={edgeStyle.strokeDasharray}
          />

          {/* 如果有标签，显示在边的中间 */}
          {edge.label && (
            <SvgText
              x={validateTransform((sourcePosition.x + targetPosition.x) / 2)}
              y={validateTransform((sourcePosition.y + targetPosition.y) / 2 - 10)}
              fontSize={12}
              fill={edgeStyle.stroke}
              textAnchor="middle"
              alignmentBaseline="middle"
            >
              {edge.label}
            </SvgText>
          )}

          {/* 箭头 */}
          {renderArrowhead(sourcePosition, targetPosition, edgeStyle)}
        </G>
      );
    } else {
      // 长距离使用贝塞尔曲线
      const controlPointX = (sourcePosition.x + targetPosition.x) / 2;
      const controlPointY = (sourcePosition.y + targetPosition.y) / 2 - distance / 3;

      const path = `M ${validateTransform(sourcePosition.x)} ${validateTransform(sourcePosition.y)}
                   Q ${validateTransform(controlPointX)} ${validateTransform(controlPointY)}
                   ${validateTransform(targetPosition.x)} ${validateTransform(targetPosition.y)}`;

      return (
        <G key={edge.id}>
          <Path
            d={path}
            fill="none"
            stroke={edgeStyle.stroke}
            strokeWidth={edgeStyle.strokeWidth}
            strokeDasharray={edgeStyle.strokeDasharray}
          />

          {/* 如果有标签，显示在曲线的控制点附近 */}
          {edge.label && (
            <SvgText
              x={validateTransform(controlPointX)}
              y={validateTransform(controlPointY - 10)}
              fontSize={12}
              fill={edgeStyle.stroke}
              textAnchor="middle"
              alignmentBaseline="middle"
            >
              {edge.label}
            </SvgText>
          )}

          {/* 箭头 */}
          {renderArrowhead(sourcePosition, targetPosition, edgeStyle, controlPointX, controlPointY)}
        </G>
      );
    }
  };

  // 渲染箭头
  const renderArrowhead = (source, target, style, controlX, controlY) => {
    // 计算箭头方向
    let endX, endY, angle;

    if (controlX && controlY) {
      // 贝塞尔曲线的箭头方向
      const t = 0.95; // 靠近终点的位置
      const x = (1 - t) * (1 - t) * source.x + 2 * (1 - t) * t * controlX + t * t * target.x;
      const y = (1 - t) * (1 - t) * source.y + 2 * (1 - t) * t * controlY + t * t * target.y;

      endX = target.x;
      endY = target.y;
      angle = Math.atan2(target.y - y, target.x - x);
    } else {
      // 直线的箭头方向
      endX = target.x;
      endY = target.y;
      angle = Math.atan2(target.y - source.y, target.x - source.x);
    }

    // 箭头大小
    const arrowSize = 10;

    // 箭头顶点
    const arrowTip = { x: endX, y: endY };

    // 箭头两侧的点
    const arrowLeft = {
      x: endX - arrowSize * Math.cos(angle - Math.PI / 6),
      y: endY - arrowSize * Math.sin(angle - Math.PI / 6),
    };

    const arrowRight = {
      x: endX - arrowSize * Math.cos(angle + Math.PI / 6),
      y: endY - arrowSize * Math.sin(angle + Math.PI / 6),
    };

    // 绘制箭头
    return (
      <Path
        d={`M ${validateTransform(arrowTip.x)} ${validateTransform(arrowTip.y)} L ${validateTransform(arrowLeft.x)} ${validateTransform(arrowLeft.y)} L ${validateTransform(arrowRight.x)} ${validateTransform(arrowRight.y)} Z`}
        fill={style.stroke}
        stroke={style.stroke}
      />
    );
  };

  // 获取节点样式
  const getNodeStyle = (node, theme) => {
    // 计算节点层级
    const level = calculateNodeLevel(node);

    // 默认样式
    const defaultStyle = {
      shape: 'rectangle',
      fill: colors.primary,
      stroke: colors.primary,
      textColor: '#fff',
      fontSize: 14,
      fontWeight: 'normal',
    };

    // 根据节点属性和主题调整样式
    let style = { ...defaultStyle };

    // 应用主题样式
    switch (theme) {
      case 'colorful':
        // 为不同层级节点使用不同颜色
        const colorPalette = ['#4285F4', '#EA4335', '#FBBC05', '#34A853', '#8E24AA', '#16A2D7'];
        style.fill = colorPalette[level % colorPalette.length];
        style.stroke = style.fill;
        style.textColor = '#fff';
        break;

      case 'minimal':
        style.fill = colors.card;
        style.stroke = colors.border;
        style.textColor = colors.text;
        break;

      case 'pastel':
        // 柔和的色彩
        const pastelPalette = ['#B5EAD7', '#C7CEEA', '#E2F0CB', '#FFDAC1', '#FFB7B2', '#FF9AA2'];
        style.fill = pastelPalette[level % pastelPalette.length];
        style.stroke = colors.border;
        style.textColor = '#333';
        break;

      case 'dark':
        // 深色主题
        const darkPalette = ['#2C3E50', '#34495E', '#7F8C8D', '#8E44AD', '#2980B9', '#16A085'];
        style.fill = darkPalette[level % darkPalette.length];
        style.stroke = '#ddd';
        style.textColor = '#fff';
        break;

      case 'gradient':
        // 渐变效果（在SVG中模拟）
        const gradientBase = level % 2 === 0 ? colors.primary : colors.secondary;
        style.fill = gradientBase;
        style.stroke = colors.border;
        style.textColor = '#fff';
        break;

      case 'professional':
        // 专业风格
        const proColors = ['#1A237E', '#0D47A1', '#01579B', '#006064', '#004D40', '#1B5E20'];
        style.fill = proColors[level % proColors.length];
        style.stroke = style.fill;
        style.textColor = '#fff';
        style.shape = 'rectangle'; // 统一使用矩形
        break;

      default:
        // 默认主题
        if (level === 0) {
          // 根节点样式
          style.fill = colors.primary;
          style.stroke = colors.primary;
          style.fontSize = 16;
          style.fontWeight = 'bold';
        } else {
          // 子节点样式
          style.fill = colors.card;
          style.stroke = colors.primary;
          style.textColor = colors.text;
        }
    }

    // 应用节点自定义样式（覆盖主题样式）
    if (node.shape) {style.shape = node.shape;}
    if (node.color) {style.fill = node.color;}
    if (node.font_size) {style.fontSize = node.font_size;}
    if (node.font_weight) {style.fontWeight = node.font_weight;}

    // 根据节点类型调整样式
    if (node.type === 'important') {
      style.stroke = '#FF5252';
      style.strokeWidth = 3;
    } else if (node.type === 'note') {
      style.shape = 'ellipse';
      style.fill = '#FFECB3';
      style.textColor = '#333';
    }

    return style;
  };

  // 计算节点层级
  const calculateNodeLevel = (node) => {
    // 简单实现：根据parent_id判断层级
    // 实际应用中可能需要更复杂的逻辑
    if (!node.parent_id) {return 0;}

    // 查找父节点
    const parentNode = nodes.find(n => n.id === node.parent_id);
    if (!parentNode) {return 1;}

    // 递归计算父节点层级
    return calculateNodeLevel(parentNode) + 1;
  };

  // 获取边样式
  const getEdgeStyle = (edge, theme) => {
    // 默认样式
    const defaultStyle = {
      stroke: colors.border,
      strokeWidth: 2,
      strokeDasharray: edge.style === 'dashed' ? '5,5' : '',
    };

    // 根据边属性和主题调整样式
    let style = { ...defaultStyle };

    // 应用主题样式
    switch (theme) {
      case 'colorful':
        // 根据连接的节点颜色调整边的颜色
        const sourceNode = nodes.find(n => n.id === edge.source);
        if (sourceNode) {
          const sourceStyle = getNodeStyle(sourceNode, theme);
          style.stroke = sourceStyle.stroke;
        } else {
          style.stroke = colors.primary;
        }
        break;

      case 'minimal':
        style.stroke = colors.border;
        style.strokeWidth = 1;
        break;

      case 'pastel':
        style.stroke = '#B5B5B5';
        break;

      case 'dark':
        style.stroke = '#ddd';
        break;

      case 'gradient':
        style.stroke = colors.border;
        break;

      case 'professional':
        style.stroke = '#455A64';
        style.strokeWidth = 1.5;
        break;

      default:
        style.stroke = colors.border;
    }

    // 应用边自定义样式（覆盖主题样式）
    if (edge.color) {style.stroke = edge.color;}
    if (edge.width) {style.strokeWidth = edge.width;}

    // 根据边类型调整样式
    if (edge.type === 'important') {
      style.strokeWidth = 3;
      style.stroke = '#FF5252';
    } else if (edge.type === 'weak') {
      style.strokeDasharray = '3,3';
      style.strokeWidth = 1;
    }

    return style;
  };

  // 动画样式
  const animatedStyle = {
    transform: [
      { translateX: pan.x },
      { translateY: pan.y },
      { scale: scale },
    ],
  };

  // 确保转换值是有效的数字
  const validateTransform = (value) => {
    if (value === undefined || value === null || isNaN(value)) {
      return 0;
    }
    return value;
  };

  // 添加缩放指示器
  const renderZoomIndicator = () => {
    const scaleValue = scale._value || 1;
    const zoomPercentage = Math.round(scaleValue * 100);
    return (
      <View style={styles.zoomIndicator}>
        <Text style={styles.zoomText}>{zoomPercentage}%</Text>
      </View>
    );
  };

  // 添加迷你地图 - 增强版
  const renderMinimap = () => {
    // 如果配置为不显示迷你地图，则返回null
    if (!SHOW_MINIMAP) {return null;}

    // 计算视口在整个画布中的位置
    const viewportWidth = width / scale._value;
    const viewportHeight = height / scale._value;
    const viewportX = (width * 1.5 - viewportWidth / 2) - pan.x._value / scale._value;
    const viewportY = (height * 1.5 - viewportHeight / 2) - pan.y._value / scale._value;

    // 使用响应式迷你地图尺寸
    const minimapWidth = MINIMAP_WIDTH;
    const minimapHeight = MINIMAP_HEIGHT;

    // 计算缩放比例
    const minimapScale = Math.min(minimapWidth / (width * 3), minimapHeight / (height * 3));

    // 计算视口在迷你地图中的位置和尺寸
    const viewportMinimapWidth = viewportWidth * minimapScale;
    const viewportMinimapHeight = viewportHeight * minimapScale;
    const viewportMinimapX = viewportX * minimapScale;
    const viewportMinimapY = viewportY * minimapScale;

    // 迷你地图状态
    const [isMinimapExpanded, setIsMinimapExpanded] = useState(false);
    const [isDraggingMinimap, setIsDraggingMinimap] = useState(false);

    // 处理迷你地图点击 - 移动视图到点击位置
    const handleMinimapPress = (evt) => {
      const { locationX, locationY } = evt.nativeEvent;

      // 将迷你地图坐标转换为画布坐标
      const canvasX = locationX / minimapScale;
      const canvasY = locationY / minimapScale;

      // 计算新的平移值，使点击位置居中
      const newPanX = -(canvasX - width / 2 * scale._value);
      const newPanY = -(canvasY - height / 2 * scale._value);

      // 应用平移动画
      Animated.spring(pan, {
        toValue: { x: newPanX, y: newPanY },
        useNativeDriver: false,
        friction: 7,
        tension: 40,
      }).start();

      // 更新最后平移位置
      setLastPan({ x: newPanX, y: newPanY });
    };

    // 切换迷你地图展开/折叠状态
    const toggleMinimapExpanded = () => {
      setIsMinimapExpanded(!isMinimapExpanded);
    };

    // 计算实际使用的迷你地图尺寸
    const actualMinimapWidth = isMinimapExpanded ? minimapWidth * 1.5 : minimapWidth;
    const actualMinimapHeight = isMinimapExpanded ? minimapHeight * 1.5 : minimapHeight;

    return (
      <View style={[
        styles.minimapContainer,
        isMinimapExpanded && styles.minimapContainerExpanded,
      ]}>
        {/* 迷你地图标题栏 */}
        <View style={styles.minimapHeader}>
          <Text style={styles.minimapTitle}>导图概览</Text>
          <TouchableOpacity onPress={toggleMinimapExpanded}>
            <Text style={styles.minimapToggle}>{isMinimapExpanded ? '收起' : '展开'}</Text>
          </TouchableOpacity>
        </View>

        {/* 迷你地图内容 */}
        <TouchableOpacity
          style={[styles.minimap, { width: actualMinimapWidth, height: actualMinimapHeight }]}
          onPress={handleMinimapPress}
          activeOpacity={0.7}
        >
          <Svg
            width={validateTransform(actualMinimapWidth)}
            height={validateTransform(actualMinimapHeight)}
            viewBox={`0 0 ${validateTransform(width * 3)} ${validateTransform(height * 3)}`}
          >
            {/* 迷你地图背景 */}
            <Rect
              width={validateTransform(width * 3)}
              height={validateTransform(height * 3)}
              fill={colors.background}
              opacity={0.5}
            />

            <G transform={`scale(${validateTransform(minimapScale)})`}>
              {/* 渲染简化的边 */}
              {edges.map(edge => {
                const sourcePosition = nodePositions[edge.source];
                const targetPosition = nodePositions[edge.target];
                if (!sourcePosition || !targetPosition) {return null;}

                return (
                  <Line
                    key={edge.id}
                    x1={sourcePosition.x}
                    y1={sourcePosition.y}
                    x2={targetPosition.x}
                    y2={targetPosition.y}
                    stroke={colors.border}
                    strokeWidth={1}
                    opacity={0.6}
                  />
                );
              })}

              {/* 渲染简化的节点 */}
              {nodes.map(node => {
                const position = nodePositions[node.id];
                if (!position) {return null;}

                // 根节点使用不同颜色和大小
                const isRoot = !node.parent_id;
                const nodeSize = isRoot ? 8 : 4;
                const nodeColor = isRoot ? colors.primary : colors.text;

                return (
                  <Circle
                    key={node.id}
                    cx={position.x}
                    cy={position.y}
                    r={nodeSize}
                    fill={nodeColor}
                    opacity={0.7}
                  />
                );
              })}
            </G>

            {/* 当前视口 */}
            <Rect
              x={validateTransform(viewportMinimapX)}
              y={validateTransform(viewportMinimapY)}
              width={validateTransform(viewportMinimapWidth)}
              height={validateTransform(viewportMinimapHeight)}
              fill="rgba(0, 120, 255, 0.2)"
              stroke={colors.primary}
              strokeWidth={1.5}
              strokeDasharray="2,2"
            />
          </Svg>
        </TouchableOpacity>
      </View>
    );
  };

  // 添加交互提示
  const renderInteractionHints = () => {
    // 只在初次加载时显示提示
    const [showHints, setShowHints] = useState(true);

    useEffect(() => {
      // 5秒后自动隐藏提示
      const timer = setTimeout(() => {
        setShowHints(false);
      }, 5000);

      return () => clearTimeout(timer);
    }, []);

    if (!showHints) {return null;}

    return (
      <View style={styles.hintsContainer}>
        <View style={styles.hintItem}>
          <Text style={styles.hintText}>双击: 放大/缩小</Text>
        </View>
        <View style={styles.hintItem}>
          <Text style={styles.hintText}>捏合: 缩放</Text>
        </View>
        <View style={styles.hintItem}>
          <Text style={styles.hintText}>拖动: 平移</Text>
        </View>
        <View style={styles.hintItem}>
          <Text style={styles.hintText}>长按节点: 更多选项</Text>
        </View>
      </View>
    );
  };

  // 渲染网格背景
  const renderGridBackground = () => {
    if (!SHOW_GRID) {return null;}

    // 根据缩放级别调整网格大小
    const scaleValue = scale._value || 1;
    const gridSize = Math.max(20, Math.min(60, 40 / scaleValue));
    const validGridSize = validateTransform(gridSize);

    return (
      <Defs>
        <Pattern id="grid" width={validGridSize} height={validGridSize} patternUnits="userSpaceOnUse">
          <Path
            d={`M ${validGridSize} 0 L 0 0 0 ${validGridSize}`}
            fill="none"
            stroke={colors.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'}
            strokeWidth="1"
          />
        </Pattern>
      </Defs>
    );
  };

  // 渲染控制按钮
  const renderControlButtons = () => {
    return (
      <View style={styles.controlButtonsContainer}>
        <TouchableOpacity
          style={styles.controlButton}
          onPress={zoomIn}
          activeOpacity={0.7}
        >
          <Text style={styles.controlButtonText}>+</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.controlButton}
          onPress={zoomOut}
          activeOpacity={0.7}
        >
          <Text style={styles.controlButtonText}>-</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.controlButton}
          onPress={resetView}
          activeOpacity={0.7}
        >
          <Text style={styles.controlButtonText}>⟲</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container} ref={viewRef}>
      <Animated.View
        style={[styles.mindMapContainer, animatedStyle]}
        {...panResponder.panHandlers}
      >
        <Svg
          width={width * 3}
          height={height * 3}
          viewBox={`0 0 ${validateTransform(width * 3)} ${validateTransform(height * 3)}`}
        >
          {/* 添加网格背景 */}
          {renderGridBackground()}
          {SHOW_GRID && <Rect
            width={validateTransform(width * 3)}
            height={validateTransform(height * 3)}
            fill="url(#grid)"
          />}

          {/* 添加中心点标记 */}
          <Circle
            cx={validateTransform(width * 1.5)}
            cy={validateTransform(height * 1.5)}
            r={5}
            fill="rgba(0, 0, 0, 0.1)"
            stroke="rgba(0, 0, 0, 0.2)"
            strokeWidth={1}
          />

          <G>
            {/* 渲染边 */}
            {edges.map(renderEdge)}

            {/* 渲染节点 */}
            {nodes.map(renderNode)}
          </G>
        </Svg>
      </Animated.View>

      {/* 缩放指示器 */}
      {renderZoomIndicator()}

      {/* 控制按钮 */}
      {renderControlButtons()}

      {/* 迷你地图 */}
      {renderMinimap()}

      {/* 交互提示 */}
      {renderInteractionHints()}
    </View>
  );
});

// 样式 - 增强版
const getStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
  mindMapContainer: {
    position: 'absolute',
    width: width * 3,
    height: height * 3,
    left: -width,
    top: -height / 2,
  },
  // 缩放指示器样式
  zoomIndicator: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  zoomText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  // 迷你地图样式
  minimapContainer: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    backgroundColor: colors.mode === 'dark' ? 'rgba(40, 40, 40, 0.9)' : 'rgba(255, 255, 255, 0.9)',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
    zIndex: 10,
  },
  minimapContainerExpanded: {
    width: 'auto',
    height: 'auto',
  },
  minimapHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  minimapTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.text,
  },
  minimapToggle: {
    fontSize: 10,
    color: colors.primary,
    paddingHorizontal: 4,
  },
  minimap: {
    backgroundColor: colors.card,
    borderRadius: 4,
    overflow: 'hidden',
  },
  // 控制按钮样式
  controlButtonsContainer: {
    position: 'absolute',
    right: 16,
    top: '50%',
    transform: [{ translateY: -50 }],
    backgroundColor: colors.mode === 'dark' ? 'rgba(40, 40, 40, 0.8)' : 'rgba(255, 255, 255, 0.8)',
    borderRadius: 20,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
    zIndex: 10,
  },
  controlButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.mode === 'dark' ? 'rgba(60, 60, 60, 0.8)' : 'rgba(240, 240, 240, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  controlButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  // 交互提示样式
  hintsContainer: {
    position: 'absolute',
    top: 16,
    left: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 8,
    padding: 10,
    maxWidth: 200,
    zIndex: 10,
  },
  hintItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  hintText: {
    color: '#fff',
    fontSize: 12,
    marginLeft: 6,
  },
  // 节点悬停效果
  nodeHover: {
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 8,
  },
  // 节点选中效果
  nodeSelected: {
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 15,
    elevation: 10,
  },
  // 节点拖动效果
  nodeDragging: {
    opacity: 0.8,
    shadowColor: '#000',
    shadowOffset: { width: 5, height: 5 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 15,
  },
  // 节点上下文菜单
  nodeContextMenu: {
    position: 'absolute',
    backgroundColor: colors.mode === 'dark' ? 'rgba(40, 40, 40, 0.95)' : 'rgba(255, 255, 255, 0.95)',
    borderRadius: 8,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
    zIndex: 20,
  },
  contextMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  contextMenuItemText: {
    fontSize: 14,
    color: colors.text,
    marginLeft: 8,
  },
  // 节点详情弹窗
  nodeDetailModal: {
    position: 'absolute',
    width: '80%',
    maxHeight: '60%',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    alignSelf: 'center',
    top: '20%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
    zIndex: 30,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    flex: 1,
  },
  modalCloseButton: {
    padding: 4,
  },
  modalContent: {
    flex: 1,
  },
  modalContentText: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  modalButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginLeft: 8,
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default MindMapView;
