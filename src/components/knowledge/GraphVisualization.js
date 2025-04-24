/**
 * 知识图谱可视化组件
 * 用于渲染和交互知识图谱的节点和连接
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Svg, G, Line, Circle, Text as SvgText } from 'react-native-svg';
import { PanGestureHandler, PinchGestureHandler } from 'react-native-gesture-handler';
import Animated, { useAnimatedGestureHandler, useSharedValue, useAnimatedStyle } from 'react-native-reanimated';

// 导入常量
import { colors } from '../../utils/constants/colors';

// 屏幕尺寸
const { width, height } = Dimensions.get('window');

/**
 * 知识图谱可视化组件
 * @param {Array} nodes - 图谱节点数组
 * @param {Array} edges - 图谱连接数组
 * @param {Object} visualization - 可视化配置（高亮节点、边等）
 * @param {Function} onNodePress - 节点点击回调
 * @param {Function} onNodeLongPress - 节点长按回调
 */
const GraphVisualization = ({
  nodes = [],
  edges = [],
  visualization = {
    highlightedNodes: [],
    highlightedEdges: [],
    centerNode: null,
    zoomLevel: 1,
  },
  onNodePress,
  onNodeLongPress,
}) => {
  // 手势和动画相关
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const lastScale = useSharedValue(1);
  const lastTranslateX = useSharedValue(0);
  const lastTranslateY = useSharedValue(0);
  
  // 重置视图
  const resetView = () => {
    scale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
    lastScale.value = 1;
    lastTranslateX.value = 0;
    lastTranslateY.value = 0;
  };
  
  // 手势处理 - 缩放
  const pinchHandler = useAnimatedGestureHandler({
    onStart: (_, ctx) => {
      ctx.scale = lastScale.value;
    },
    onActive: (event, ctx) => {
      scale.value = Math.max(0.5, Math.min(ctx.scale * event.scale, 3));
    },
    onEnd: () => {
      lastScale.value = scale.value;
    },
  });
  
  // 手势处理 - 平移
  const panHandler = useAnimatedGestureHandler({
    onStart: (_, ctx) => {
      ctx.translateX = lastTranslateX.value;
      ctx.translateY = lastTranslateY.value;
    },
    onActive: (event, ctx) => {
      translateX.value = ctx.translateX + event.translationX;
      translateY.value = ctx.translateY + event.translationY;
    },
    onEnd: () => {
      lastTranslateX.value = translateX.value;
      lastTranslateY.value = translateY.value;
    },
  });
  
  // 动画样式
  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
      ],
    };
  });
  
  // 根据节点类型获取颜色
  const getNodeColorByType = (type) => {
    switch (type) {
      case 'note':
        return colors.primary;
      case 'tag':
        return colors.accent;
      case 'category':
        return colors.success;
      case 'concept':
        return colors.warning;
      default:
        return colors.textLight;
    }
  };
  
  // 渲染节点
  const renderNode = (node, index) => {
    const isHighlighted = visualization.highlightedNodes.includes(node.id) || 
                         node.id === visualization.centerNode;
    const nodeSize = node.size || 20;
    const nodeColor = isHighlighted ? colors.primary : 
                     (node.color || getNodeColorByType(node.type));
    
    return (
      <G key={`node-${node.id}`}>
        <Circle
          cx={node.x}
          cy={node.y}
          r={nodeSize}
          fill={nodeColor}
          stroke={isHighlighted ? colors.accent : colors.border}
          strokeWidth={isHighlighted ? 2 : 1}
          onPress={() => onNodePress && onNodePress(node)}
          onLongPress={() => onNodeLongPress && onNodeLongPress(node)}
        />
        <SvgText
          x={node.x}
          y={node.y + nodeSize + 10}
          fontSize="10"
          fill={colors.text}
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
    
    if (!sourceNode || !targetNode) return null;
    
    const isHighlighted = visualization.highlightedEdges.includes(edge.id);
    
    return (
      <Line
        key={`edge-${edge.id}`}
        x1={sourceNode.x}
        y1={sourceNode.y}
        x2={targetNode.x}
        y2={targetNode.y}
        stroke={isHighlighted ? colors.accent : colors.border}
        strokeWidth={isHighlighted ? 2 : 1}
        strokeDasharray={edge.type === 'dashed' ? '5,5' : undefined}
      />
    );
  };
  
  // 当visualization.centerNode变化时，重置视图
  useEffect(() => {
    if (visualization.centerNode) {
      // 可以在这里添加自动居中逻辑
    }
  }, [visualization.centerNode]);
  
  return (
    <View style={styles.container}>
      <PinchGestureHandler
        onGestureEvent={pinchHandler}
      >
        <Animated.View style={styles.graphContainer}>
          <PanGestureHandler
            onGestureEvent={panHandler}
          >
            <Animated.View style={[styles.graphWrapper, animatedStyle]}>
              <Svg width={width * 2} height={height * 2} viewBox={`0 0 ${width * 2} ${height * 2}`}>
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
});

export default GraphVisualization;