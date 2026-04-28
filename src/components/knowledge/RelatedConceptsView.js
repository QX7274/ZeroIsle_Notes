/**
 * 相关概念可视化组件
 * 用于可视化展示与指定知识点相关的概念网络
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Svg, G, Circle, Text as SvgText, Line } from 'react-native-svg';
import { useTheme } from '../../context/ThemeContext';

/**
 * 相关概念可视化组件
 * @param {Array} concepts - 相关概念数据
 * @param {Object} centerNode - 中心节点
 * @param {Function} onNodePress - 节点点击回调
 * @param {boolean} isLoading - 是否正在加载
 * @param {string} error - 错误信息
 */
const RelatedConceptsView = ({
  concepts = [],
  centerNode = null,
  onNodePress,
  isLoading = false,
  error = null,
}) => {
  // 获取主题颜色
  const { colors } = useTheme();

  // 获取动态样式
  const dynamicStyles = getStyles(colors);

  // 本地状态
  const [svgDimensions, setSvgDimensions] = useState({
    width: 600,
    height: 400,
    centerX: 300,
    centerY: 200,
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

  // 计算节点位置 - 使用径向布局
  const calculateNodePositions = () => {
    if (!centerNode || concepts.length === 0) {return [];}

    const result = [];
    const centerX = svgDimensions.centerX;
    const centerY = svgDimensions.centerY;

    // 添加中心节点
    result.push({
      ...centerNode,
      x: centerX,
      y: centerY,
      isCenter: true,
    });

    // 按深度分组
    const depthGroups = {};
    concepts.forEach(concept => {
      if (concept.node.id === centerNode.id) {return;} // 跳过中心节点

      const depth = concept.depth;
      if (!depthGroups[depth]) {
        depthGroups[depth] = [];
      }
      depthGroups[depth].push(concept);
    });

    // 计算每个深度层的节点位置
    Object.keys(depthGroups).forEach(depth => {
      const nodesInDepth = depthGroups[depth];
      const radius = 100 * parseInt(depth); // 根据深度确定半径
      const angleStep = (2 * Math.PI) / nodesInDepth.length;

      nodesInDepth.forEach((concept, index) => {
        const angle = index * angleStep;
        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);

        result.push({
          ...concept.node,
          x,
          y,
          depth: concept.depth,
          isCenter: false,
        });
      });
    });

    return result;
  };

  // 渲染加载状态
  if (isLoading) {
    return (
      <View style={dynamicStyles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={dynamicStyles.loadingText}>正在查找相关概念...</Text>
      </View>
    );
  }

  // 渲染错误状态
  if (error) {
    return (
      <View style={dynamicStyles.centerContainer}>
        <Icon name="error-outline" size={50} color={colors.error} />
        <Text style={dynamicStyles.errorText}>{error}</Text>
      </View>
    );
  }

  // 渲染空状态
  if (!centerNode || concepts.length === 0) {
    return (
      <View style={dynamicStyles.centerContainer}>
        <Icon name="share" size={50} color={colors.textLight} />
        <Text style={dynamicStyles.emptyText}>暂无相关概念数据</Text>
        <Text style={dynamicStyles.emptySubText}>请选择一个知识点查找相关概念</Text>
      </View>
    );
  }

  // 计算节点位置
  const positionedNodes = calculateNodePositions();

  return (
    <View style={dynamicStyles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={true}>
        <ScrollView showsVerticalScrollIndicator={true}>
          <Svg
            width={svgDimensions.width}
            height={svgDimensions.height}
            viewBox={`0 0 ${svgDimensions.width} ${svgDimensions.height}`}
          >
            <G>
              {/* 渲染连接线 */}
              {positionedNodes.map((node, index) => {
                if (node.isCenter) {return null;} // 跳过中心节点

                // 连接到中心节点
                const centerNode = positionedNodes[0];
                return (
                  <Line
                    key={`line-${index}`}
                    x1={centerNode.x}
                    y1={centerNode.y}
                    x2={node.x}
                    y2={node.y}
                    stroke={colors.border}
                    strokeWidth={1}
                    strokeOpacity={1 / node.depth} // 根据深度调整透明度
                  />
                );
              })}

              {/* 渲染节点 */}
              {positionedNodes.map((node, index) => {
                const nodeSize = node.isCenter ? 30 : 20 - (node.depth || 1) * 3; // 根据深度调整大小
                const nodeColor = getNodeColorByType(node.type);

                return (
                  <G key={`node-${index}`}>
                    <Circle
                      cx={node.x}
                      cy={node.y}
                      r={nodeSize}
                      fill={nodeColor}
                      stroke={colors.border}
                      strokeWidth={node.isCenter ? 2 : 1}
                      onPress={() => onNodePress && onNodePress(node)}
                    />
                    <SvgText
                      x={node.x}
                      y={node.y}
                      fontSize={node.isCenter ? '14' : '10'}
                      fill={colors.white}
                      textAnchor="middle"
                      alignmentBaseline="middle"
                    >
                      {index + 1}
                    </SvgText>
                    <SvgText
                      x={node.x}
                      y={node.y + nodeSize + 15}
                      fontSize="12"
                      fill={colors.text}
                      textAnchor="middle"
                    >
                      {node.title}
                    </SvgText>
                  </G>
                );
              })}
            </G>
          </Svg>
        </ScrollView>
      </ScrollView>

      {/* 节点列表 */}
      <View style={dynamicStyles.nodeListContainer}>
        <Text style={dynamicStyles.nodeListTitle}>相关概念列表</Text>
        <ScrollView style={dynamicStyles.nodeList}>
          {positionedNodes.map((node, index) => (
            <TouchableOpacity
              key={`list-node-${index}`}
              style={[dynamicStyles.nodeItem, node.isCenter && dynamicStyles.centerNodeItem]}
              onPress={() => onNodePress && onNodePress(node)}
            >
              <View
                style={[dynamicStyles.nodeTypeIndicator, { backgroundColor: getNodeColorByType(node.type) }]}
              />
              <View style={dynamicStyles.nodeItemContent}>
                <Text style={dynamicStyles.nodeItemTitle}>{index + 1}. {node.title}</Text>
                <Text style={dynamicStyles.nodeItemType}>
                  {node.type === 'note' ? '笔记' :
                    node.type === 'tag' ? '标签' :
                      node.type === 'category' ? '分类' : '概念'}
                </Text>
              </View>
              {!node.isCenter && (
                <View style={dynamicStyles.depthIndicator}>
                  <Text style={dynamicStyles.depthText}>深度: {node.depth}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </View>
  );
};

// 使用内联样式，因为我们需要访问动态的颜色主题
const getStyles = (colors) => ({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: colors.text,
  },
  errorText: {
    marginTop: 10,
    fontSize: 16,
    color: colors.error,
    textAlign: 'center',
  },
  emptyText: {
    marginTop: 10,
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  emptySubText: {
    marginTop: 5,
    fontSize: 14,
    color: colors.textLight,
    textAlign: 'center',
  },
  nodeListContainer: {
    padding: 15,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    maxHeight: 200,
  },
  nodeListTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 10,
  },
  nodeList: {
    maxHeight: 150,
  },
  nodeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: colors.background,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  centerNodeItem: {
    backgroundColor: colors.backgroundLight,
    borderColor: colors.primary,
    borderWidth: 2,
  },
  nodeTypeIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10,
  },
  nodeItemContent: {
    flex: 1,
  },
  nodeItemTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.text,
  },
  nodeItemType: {
    fontSize: 12,
    color: colors.textLight,
    marginTop: 2,
  },
  depthIndicator: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: colors.backgroundLight,
    borderRadius: 4,
  },
  depthText: {
    fontSize: 12,
    color: colors.textLight,
  },
});

// 创建一个空的StyleSheet，实际样式将在组件内部动态生成
const styles = StyleSheet.create({
  container: {},
  centerContainer: {},
  loadingText: {},
  errorText: {},
  emptyText: {},
  emptySubText: {},
  nodeListContainer: {},
  nodeListTitle: {},
  nodeList: {},
  nodeItem: {},
  centerNodeItem: {},
  nodeTypeIndicator: {},
  nodeItemContent: {},
  nodeItemTitle: {},
  nodeItemType: {},
  depthIndicator: {},
  depthText: {},
});

export default RelatedConceptsView;
