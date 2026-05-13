/**
 * 知识图谱可视化组件
 * 用于渲染和交互知识图谱的节点和连接
 */

import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Svg, G, Line, Circle, Text as SvgText, Path } from 'react-native-svg';
import { PanGestureHandler, PinchGestureHandler, TapGestureHandler, State } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedGestureHandler,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { colors } from '../../utils/constants/colors';
import { interpolateHsl } from '../../utils/colorUtils';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Text } from '../common/Typography';
import useForceLayout from '../../hooks/useForceLayout';

// 屏幕尺寸
const { width, height } = Dimensions.get('window');

/**
 * 知识图谱可视化组件
 * @param {Array} nodes - 图谱节点数组
 * @param {Array} edges - 图谱连接数组
 * @param {Object} visualization - 可视化配置（高亮节点、边等）
 * @param {Function} onNodePress - 节点点击回调
 * @param {Function} onNodeLongPress - 节点长按回调
 * @param {Function} onAddNode - 添加节点回调
 * @param {Function} onAddEdge - 添加边回调
 * @param {Function} onDeleteNode - 删除节点回调
 * @param {Function} onDeleteEdge - 删除边回调
 * @param {boolean} isEditable - 是否可编辑
 */
const GraphVisualization = ({
  nodes = [],
  edges = [],
  visualization = {
    highlightedNodes: [],
    secondDegreeHighlightedNodes: [],
    highlightedEdges: [],
    centerNode: null,
    zoomLevel: 1,
  },
  onNodePress,
  onNodeLongPress,
  onAddNode,
  onAddEdge,
  onDeleteNode,
  onDeleteEdge,
  isEditable = false,
}) => {
  // 使用静态颜色

  // Layout Engine
  const { positions, isConverged, restart } = useForceLayout({
    nodes,
    edges,
    width: width * 2,
    height: height * 2,
  });

  // 状态
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedEdge, setSelectedEdge] = useState(null);
  const [showNodeMenu, setShowNodeMenu] = useState(false);
  const [showEdgeMenu, setShowEdgeMenu] = useState(false);
  const [showToolbar, setShowToolbar] = useState(true);
  const [layoutType, setLayoutType] = useState('force'); // force, radial, hierarchical

  // 引用
  const svgRef = useRef(null);
  const doubleTapRef = useRef(null);

  // 手势和动画相关
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const lastScale = useSharedValue(1);
  const lastTranslateX = useSharedValue(0);
  const lastTranslateY = useSharedValue(0);

  // 重置视图
  const resetView = () => {
    scale.value = withTiming(1, { duration: 300 });
    translateX.value = withTiming(0, { duration: 300 });
    translateY.value = withTiming(0, { duration: 300 });
    lastScale.value = 1;
    lastTranslateX.value = 0;
    lastTranslateY.value = 0;
  };

  // 手势处理 - 缩放
  const pinchHandler = useAnimatedGestureHandler({
    onStart: (_, context) => {
      'worklet';
      // 避免直接修改context对象，创建本地变量
      const startScale = lastScale.value;
      context.scale = startScale;
    },
    onActive: (event, context) => {
      'worklet';
      // 使用本地变量避免修改worklet对象
      const baseScale = context.scale || 1;
      const newScale = Math.max(0.5, Math.min(baseScale * event.scale, 3));
      scale.value = newScale;
    },
    onEnd: () => {
      'worklet';
      lastScale.value = scale.value;
    },
  });

  // 手势处理 - 平移
  const panHandler = useAnimatedGestureHandler({
    onStart: (_, context) => {
      'worklet';
      // 避免直接修改context对象，创建本地变量
      const startTranslateX = lastTranslateX.value;
      const startTranslateY = lastTranslateY.value;
      context.translateX = startTranslateX;
      context.translateY = startTranslateY;
    },
    onActive: (event, context) => {
      'worklet';
      // 使用本地变量避免修改worklet对象
      const baseTranslateX = context.translateX || 0;
      const baseTranslateY = context.translateY || 0;
      translateX.value = baseTranslateX + event.translationX;
      translateY.value = baseTranslateY + event.translationY;
    },
    onEnd: () => {
      'worklet';
      lastTranslateX.value = translateX.value;
      lastTranslateY.value = translateY.value;
    },
  });

  // 动画样式
  const animatedStyle = useAnimatedStyle(() => {
    'worklet';
    // 创建本地副本避免修改传递给worklet的对象
    const currentTranslateX = translateX.value;
    const currentTranslateY = translateY.value;
    const currentScale = scale.value;

    return {
      transform: [
        { translateX: currentTranslateX },
        { translateY: currentTranslateY },
        { scale: currentScale },
      ],
    };
  }, []);

  // 根据节点类型获取颜色
  const getNodeColorByType = (type) => {
    switch (type) {
      case 'note':
        return colors.info;
      case 'tag':
        return colors.warning;
      case 'category':
        return colors.error;
      case 'concept':
        return colors.primary;
      case 'entity':
        return colors.success;
      case 'question':
        return '#9C27B0'; // 紫色
      case 'answer':
        return '#00BCD4'; // 青色
      case 'custom':
        return '#607D8B'; // 蓝灰色
      default:
        return colors.textSecondary;
    }
  };

  // 根据边类型获取颜色
  const getEdgeColorByType = (type) => {
    switch (type) {
      case 'related':
        return colors.primary;
      case 'includes':
        return colors.success;
      case 'causes':
        return colors.warning;
      case 'supports':
        return colors.info;
      case 'opposes':
        return colors.error;
      case 'precedes':
        return '#9C27B0'; // 紫色
      case 'follows':
        return '#00BCD4'; // 青色
      case 'custom':
        return '#607D8B'; // 蓝灰色
      default:
        return colors.border;
    }
  };

  // 处理节点点击
  const handleNodePress = (node) => {
    setSelectedNode(node);
    setSelectedEdge(null);
    setShowNodeMenu(true);
    setShowEdgeMenu(false);

    if (onNodePress) {
      onNodePress(node);
    }
  };

  // 处理节点长按
  const handleNodeLongPress = (node) => {
    if (onNodeLongPress) {
      onNodeLongPress(node);
    }
  };

  // 处理边点击
  const handleEdgePress = (edge) => {
    setSelectedEdge(edge);
    setSelectedNode(null);
    setShowEdgeMenu(true);
    setShowNodeMenu(false);
  };

  // 处理添加节点
  const handleAddNode = () => {
    if (onAddNode) {
      onAddNode();
    }
  };

  // 处理添加边
  const handleAddEdge = () => {
    if (onAddEdge) {
      if (selectedNode) {
        onAddEdge(selectedNode);
      } else {
        Alert.alert('提示', '请先选择一个节点作为起点');
      }
    }
  };

  // 处理删除节点
  const handleDeleteNode = () => {
    if (selectedNode && onDeleteNode) {
      Alert.alert(
        '确认删除',
        `确定要删除节点"${selectedNode.title || selectedNode.label || '未命名节点'}"吗？`,
        [
          {
            text: '取消',
            style: 'cancel',
          },
          {
            text: '删除',
            onPress: () => {
              onDeleteNode(selectedNode);
              setSelectedNode(null);
              setShowNodeMenu(false);
            },
            style: 'destructive',
          },
        ]
      );
    }
  };

  // 处理删除边
  const handleDeleteEdge = () => {
    if (selectedEdge && onDeleteEdge) {
      Alert.alert(
        '确认删除',
        '确定要删除这个关系吗？',
        [
          {
            text: '取消',
            style: 'cancel',
          },
          {
            text: '删除',
            onPress: () => {
              onDeleteEdge(selectedEdge);
              setSelectedEdge(null);
              setShowEdgeMenu(false);
            },
            style: 'destructive',
          },
        ]
      );
    }
  };

  // 渲染节点
  const renderNode = (node, index) => {
    const isPrimaryHighlighted = (visualization.highlightedNodes || []).includes(node.id) || node.id === visualization.centerNode;
    const isSecondaryHighlighted = (visualization.secondDegreeHighlightedNodes || []).includes(node.id) && !isPrimaryHighlighted;
    const isSelected = selectedNode?.id === node.id;

    // --- Dynamic Node Sizing (Refined) ---
    const baseSize = 12;
    const maxSize = 35;
    const linkFactor = Math.log1p(node.linkCount || 0) * 5;
    const nodeSize = Math.min(baseSize + linkFactor, maxSize);

    // --- Dynamic Node Coloring (Refined with HSL) ---
    const now = Date.now();
    const updatedAtRaw = node.updatedAt || node.updated_at;
    const updatedAt = updatedAtRaw ? new Date(updatedAtRaw).getTime() : Date.now();
    const ageInDays = (now - updatedAt) / (1000 * 60 * 60 * 24);
    const ageFactor = Math.min(ageInDays / 14, 1); // Normalize over two weeks

    const baseColor = getNodeColorByType(node.type);
    const fadedColor = colors.textSecondary;
    const nodeColor = interpolateHsl(baseColor, fadedColor, ageFactor);

    let finalNodeColor = node.color || nodeColor;
    let strokeColor = colors.border;
    let strokeWidth = 1;
    let fillOpacity = 0.9;

    if (isPrimaryHighlighted) {
      finalNodeColor = colors.primary;
      strokeColor = colors.primary;
      strokeWidth = 2;
    }
    if (isSecondaryHighlighted) {
      finalNodeColor = colors.secondary; // Or another distinct color
      strokeColor = colors.secondary;
      fillOpacity = 0.6;
    }
    if (isSelected) {
      finalNodeColor = colors.primary;
      strokeColor = colors.primary;
      strokeWidth = 2;
      fillOpacity = 1;
    }

    // Get position from layout engine, fallback to static node.x/y or center
    const layoutPos = positions.get(node.id);
    const fallbackPosition = node.position || {};
    const renderX = layoutPos ? layoutPos.x : (node.x ?? fallbackPosition.x ?? width);
    const renderY = layoutPos ? layoutPos.y : (node.y ?? fallbackPosition.y ?? height);

    return (
      <G key={`node-${node.id}`}>
        <Circle
          cx={renderX}
          cy={renderY}
          r={nodeSize}
          fill={nodeColor}
          fillOpacity={fillOpacity}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          onPress={() => handleNodePress(node)}
          onLongPress={() => handleNodeLongPress(node)}
        />
        <SvgText
          x={renderX}
          y={renderY + nodeSize + 10}
          fontSize="10"
          fontWeight={isSelected || isPrimaryHighlighted ? 'bold' : 'normal'}
          fill={isSelected || isPrimaryHighlighted ? colors.primary : colors.text}
          textAnchor="middle"
        >
          {node.label || node.title || `节点${index + 1}`}
        </SvgText>
      </G>
    );
  };

  // 渲染边
  const renderEdge = (edge) => {
    const sourceNode = nodes.find(node => node.id === edge.source);
    const targetNode = nodes.find(node => node.id === edge.target);

    if (!sourceNode || !targetNode) {return null;}

    const isHighlighted = visualization.highlightedEdges.includes(edge.id);
    const isSelected = selectedEdge?.id === edge.id;
    const edgeColor = isSelected ? colors.primary :
      (isHighlighted ? colors.primary :
        (edge.color || getEdgeColorByType(edge.type)));

    // Get positions
    const sourceFallbackPosition = sourceNode.position || {};
    const targetFallbackPosition = targetNode.position || {};
    const sourcePos = positions.get(sourceNode.id) || {
      x: sourceNode.x ?? sourceFallbackPosition.x ?? width,
      y: sourceNode.y ?? sourceFallbackPosition.y ?? height,
    };
    const targetPos = positions.get(targetNode.id) || {
      x: targetNode.x ?? targetFallbackPosition.x ?? width,
      y: targetNode.y ?? targetFallbackPosition.y ?? height,
    };

    // 计算箭头点
    const dx = targetPos.x - sourcePos.x;
    const dy = targetPos.y - sourcePos.y;
    const angle = Math.atan2(dy, dx);

    // 调整起点和终点，避免箭头与节点重叠
    const sourceNodeSize = typeof sourceNode.size === 'number'
      ? sourceNode.size
      : Math.max(sourceNode.size?.width || 20, sourceNode.size?.height || 20) / 2;
    const targetNodeSize = typeof targetNode.size === 'number'
      ? targetNode.size
      : Math.max(targetNode.size?.width || 20, targetNode.size?.height || 20) / 2;

    const startX = sourcePos.x + sourceNodeSize * Math.cos(angle);
    const startY = sourcePos.y + sourceNodeSize * Math.sin(angle);
    const endX = targetPos.x - targetNodeSize * Math.cos(angle);
    const endY = targetPos.y - targetNodeSize * Math.sin(angle);

    // 计算箭头
    const arrowLength = 10;
    const arrowWidth = 5;
    const arrowX = endX - arrowLength * Math.cos(angle);
    const arrowY = endY - arrowLength * Math.sin(angle);

    const arrowPoint1X = arrowX + arrowWidth * Math.cos(angle + Math.PI / 2);
    const arrowPoint1Y = arrowY + arrowWidth * Math.sin(angle + Math.PI / 2);
    const arrowPoint2X = arrowX + arrowWidth * Math.cos(angle - Math.PI / 2);
    const arrowPoint2Y = arrowY + arrowWidth * Math.sin(angle - Math.PI / 2);

    // 计算边的中点，用于显示标签
    const midX = (startX + endX) / 2;
    const midY = (startY + endY) / 2;

    return (
      <G key={`edge-${edge.id}`} onPress={() => handleEdgePress(edge)}>
        <Line
          x1={startX}
          y1={startY}
          x2={endX}
          y2={endY}
          stroke={edgeColor}
          strokeWidth={isSelected || isHighlighted ? 2 : 1}
          strokeDasharray={edge.type === 'dashed' ? '5,5' : undefined}
        />

        {/* 箭头 */}
        {edge.type !== 'related' && (
          <Path
            d={`M${endX},${endY} L${arrowPoint1X},${arrowPoint1Y} L${arrowPoint2X},${arrowPoint2Y} Z`}
            fill={edgeColor}
          />
        )}

        {/* 边标签 */}
        {edge.label && (
          <G>
            <Circle
              cx={midX}
              cy={midY}
              r={10}
              fill={colors.card}
              stroke={edgeColor}
              strokeWidth={1}
            />
            <SvgText
              x={midX}
              y={midY + 3}
              fontSize="8"
              fill={edgeColor}
              textAnchor="middle"
            >
              {edge.label}
            </SvgText>
          </G>
        )}
      </G>
    );
  };

  // 当visualization.centerNode变化时，重置视图
  useEffect(() => {
    if (visualization.centerNode) {
      // 找到中心节点
      const centerNode = nodes.find(node => node.id === visualization.centerNode);
      const centerPos = centerNode ? positions.get(centerNode.id) : null;

      if (centerNode && centerPos) {
        // 计算需要的平移量，使中心节点位于视图中心
        const targetX = width / 2 - centerPos.x;
        const targetY = height / 2 - centerPos.y;

        // 应用平移动画
        translateX.value = withTiming(targetX, { duration: 500 });
        translateY.value = withTiming(targetY, { duration: 500 });
        lastTranslateX.value = targetX;
        lastTranslateY.value = targetY;

        // 如果有缩放级别，也应用缩放
        if (visualization.zoomLevel) {
          scale.value = withTiming(visualization.zoomLevel, { duration: 500 });
          lastScale.value = visualization.zoomLevel;
        }
      }
    }
  }, [
    lastScale,
    lastTranslateX,
    lastTranslateY,
    nodes,
    positions,
    scale,
    translateX,
    translateY,
    visualization.centerNode,
    visualization.zoomLevel,
  ]);

  // 渲染工具栏
  const renderToolbar = () => {
    if (!showToolbar) {return null;}

    return (
      <View style={[styles.toolbar, { backgroundColor: colors.card }]}>
        <TouchableOpacity
          style={styles.toolbarButton}
          onPress={resetView}
        >
          <Icon name="center-focus-strong" size={24} color={colors.text} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.toolbarButton}
          onPress={() => setLayoutType('force')}
        >
          <Icon name="scatter-plot" size={24} color={layoutType === 'force' ? colors.primary : colors.text} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.toolbarButton}
          onPress={() => setLayoutType('radial')}
        >
          <Icon name="radio-button-checked" size={24} color={layoutType === 'radial' ? colors.primary : colors.text} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.toolbarButton}
          onPress={() => setLayoutType('hierarchical')}
        >
          <Icon name="account-tree" size={24} color={layoutType === 'hierarchical' ? colors.primary : colors.text} />
        </TouchableOpacity>

        {isEditable && (
          <TouchableOpacity
            style={styles.toolbarButton}
            onPress={handleAddNode}
          >
            <Icon name="add-circle" size={24} color={colors.success} />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // 渲染节点菜单
  const renderNodeMenu = () => {
    if (!showNodeMenu || !selectedNode) {return null;}

    return (
      <View style={[styles.nodeMenu, { backgroundColor: colors.card }]}>
        <View style={styles.nodeMenuHeader}>
          <View
            style={[
              styles.nodeTypeIndicator,
              { backgroundColor: getNodeColorByType(selectedNode.type) },
            ]}
          />
          <Text
            variant="body"
            size="medium"
            bold
            style={styles.nodeMenuTitle}
          >
            {selectedNode.title || selectedNode.label || '未命名节点'}
          </Text>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => {
              setShowNodeMenu(false);
              setSelectedNode(null);
            }}
          >
            <Icon name="close" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.nodeMenuContent}>
          <Text
            variant="body"
            size="small"
            style={styles.nodeDescription}
          >
            {selectedNode.description || '暂无描述'}
          </Text>

          {isEditable && (
            <View style={styles.nodeMenuActions}>
              <TouchableOpacity
                style={[styles.nodeMenuButton, { backgroundColor: colors.primary }]}
                onPress={handleAddEdge}
              >
                <Icon name="add-link" size={20} color="#FFFFFF" />
                <Text
                  variant="body"
                  size="small"
                  color="card"
                  style={styles.nodeMenuButtonText}
                >
                  添加关系
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.nodeMenuButton, { backgroundColor: colors.error }]}
                onPress={handleDeleteNode}
              >
                <Icon name="delete" size={20} color="#FFFFFF" />
                <Text
                  variant="body"
                  size="small"
                  color="card"
                  style={styles.nodeMenuButtonText}
                >
                  删除节点
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    );
  };

  // 渲染边菜单
  const renderEdgeMenu = () => {
    if (!showEdgeMenu || !selectedEdge) {return null;}

    // 获取源节点和目标节点
    const sourceNode = nodes.find(node => node.id === selectedEdge.source);
    const targetNode = nodes.find(node => node.id === selectedEdge.target);

    if (!sourceNode || !targetNode) {return null;}

    return (
      <View style={[styles.edgeMenu, { backgroundColor: colors.card }]}>
        <View style={styles.edgeMenuHeader}>
          <View
            style={[
              styles.edgeTypeIndicator,
              { backgroundColor: getEdgeColorByType(selectedEdge.type) },
            ]}
          />
          <Text
            variant="body"
            size="medium"
            bold
            style={styles.edgeMenuTitle}
          >
            {selectedEdge.label || selectedEdge.type || '关系'}
          </Text>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => {
              setShowEdgeMenu(false);
              setSelectedEdge(null);
            }}
          >
            <Icon name="close" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.edgeMenuContent}>
          <View style={styles.edgeNodes}>
            <View style={styles.edgeNodeItem}>
              <View
                style={[
                  styles.nodeTypeIndicator,
                  { backgroundColor: getNodeColorByType(sourceNode.type) },
                ]}
              />
              <Text
                variant="body"
                size="small"
                style={styles.edgeNodeText}
              >
                {sourceNode.title || sourceNode.label || '源节点'}
              </Text>
            </View>

            <Icon name="arrow-forward" size={16} color={colors.textSecondary} />

            <View style={styles.edgeNodeItem}>
              <View
                style={[
                  styles.nodeTypeIndicator,
                  { backgroundColor: getNodeColorByType(targetNode.type) },
                ]}
              />
              <Text
                variant="body"
                size="small"
                style={styles.edgeNodeText}
              >
                {targetNode.title || targetNode.label || '目标节点'}
              </Text>
            </View>
          </View>

          <Text
            variant="body"
            size="small"
            style={styles.edgeDescription}
          >
            {selectedEdge.description || '暂无描述'}
          </Text>

          {isEditable && (
            <View style={styles.edgeMenuActions}>
              <TouchableOpacity
                style={[styles.edgeMenuButton, { backgroundColor: colors.error }]}
                onPress={handleDeleteEdge}
              >
                <Icon name="delete" size={20} color="#FFFFFF" />
                <Text
                  variant="body"
                  size="small"
                  color="card"
                  style={styles.edgeMenuButtonText}
                >
                  删除关系
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {renderToolbar()}

      <PinchGestureHandler
        onGestureEvent={pinchHandler}
      >
        <Animated.View style={styles.graphContainer}>
          <PanGestureHandler
            onGestureEvent={panHandler}
          >
            <Animated.View style={[styles.graphWrapper, animatedStyle]}>
              <Svg
                ref={svgRef}
                width={width * 2}
                height={height * 2}
                viewBox={`0 0 ${width * 2} ${height * 2}`}
              >
                <G>
                  {/* 渲染边 */}
                  {edges.map(renderEdge)}
                  {/* 渲染节点 */}
                  {nodes.map(renderNode)}
                </G>
              </Svg>
            </Animated.View>
          </PanGestureHandler>
        </Animated.View>
      </PinchGestureHandler>

      {renderNodeMenu()}
      {renderEdgeMenu()}

      {isEditable && (
        <TouchableOpacity
          style={[styles.floatingButton, { backgroundColor: colors.primary }]}
          onPress={() => setShowToolbar(!showToolbar)}
        >
          <Icon name={showToolbar ? 'expand-more' : 'expand-less'} size={24} color="#FFFFFF" />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  graphContainer: {
    flex: 1,
    overflow: 'hidden',
  },
  graphWrapper: {
    width: width * 2,
    height: height * 2,
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  toolbarButton: {
    padding: 12,
    borderRadius: 20,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.03)',
    marginHorizontal: 4,
  },
  nodeMenu: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  nodeMenuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  nodeTypeIndicator: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  nodeMenuTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
  },
  closeButton: {
    padding: 8,
    borderRadius: 16,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  nodeMenuContent: {
    padding: 20,
  },
  nodeDescription: {
    marginBottom: 20,
    fontSize: 15,
    lineHeight: 22,
  },
  nodeMenuActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  nodeMenuButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  nodeMenuButtonText: {
    marginLeft: 10,
    fontSize: 15,
    fontWeight: '600',
  },
  edgeMenu: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  edgeMenuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  edgeTypeIndicator: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  edgeMenuTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
  },
  edgeMenuContent: {
    padding: 20,
  },
  edgeNodes: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    padding: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  edgeNodeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  edgeNodeText: {
    marginLeft: 10,
    fontSize: 14,
    fontWeight: '500',
  },
  edgeDescription: {
    marginBottom: 20,
    fontSize: 15,
    lineHeight: 22,
  },
  edgeMenuActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  edgeMenuButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  edgeMenuButtonText: {
    marginLeft: 10,
    fontSize: 15,
    fontWeight: '600',
  },
  floatingButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
});

export default GraphVisualization;
