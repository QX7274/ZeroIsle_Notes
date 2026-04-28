/**
 * 知识图谱路径可视化组件
 * 用于可视化展示两个知识点之间的最短路径
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
import { Svg, G, Line, Circle, Text as SvgText, Path } from 'react-native-svg';
import { useTheme } from '../../context/ThemeContext';

/**
 * 知识图谱路径可视化组件
 * @param {Array} path - 路径数据，包含节点和边的信息
 * @param {Function} onNodePress - 节点点击回调
 * @param {boolean} isLoading - 是否正在加载
 * @param {string} error - 错误信息
 */
const PathVisualization = ({
  path = [],
  onNodePress,
  isLoading = false,
  error = null,
}) => {
  // 获取主题颜色
  const { colors } = useTheme();

  // 获取动态样式
  const dynamicStyles = getStyles(colors);

  // 计算SVG视图的尺寸和位置
  const [svgDimensions, setSvgDimensions] = useState({
    width: 1000,
    height: 300,
    paddingX: 50,
    paddingY: 50,
  });

  // 根据路径计算节点位置
  useEffect(() => {
    if (path && path.length > 0) {
      // 根据路径长度调整SVG尺寸
      setSvgDimensions(prev => ({
        ...prev,
        width: Math.max(1000, path.length * 200),
      }));
    }
  }, [path]);

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

  // 根据边类型获取描述
  const getEdgeDescription = (type) => {
    switch (type) {
      case 'related':
        return '相关';
      case 'cause':
        return '因果';
      case 'include':
        return '包含';
      case 'reference':
        return '引用';
      case 'custom':
        return '自定义';
      default:
        return '关联';
    }
  };

  // 渲染加载状态
  if (isLoading) {
    return (
      <View style={dynamicStyles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={dynamicStyles.loadingText}>正在查找路径...</Text>
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
  if (!path || path.length === 0) {
    return (
      <View style={dynamicStyles.centerContainer}>
        <Icon name="timeline" size={50} color={colors.textLight} />
        <Text style={dynamicStyles.emptyText}>未找到连接路径</Text>
        <Text style={dynamicStyles.emptySubText}>请选择两个知识点查找它们之间的路径</Text>
      </View>
    );
  }

  return (
    <View style={dynamicStyles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={true}>
        <Svg
          width={svgDimensions.width}
          height={svgDimensions.height}
          viewBox={`0 0 ${svgDimensions.width} ${svgDimensions.height}`}
        >
          <G>
            {/* 渲染连接线和标签 */}
            {path.map((item, index) => {
              if (index === 0 || !item.edge) {return null;}

              const prevItem = path[index - 1];
              const startX = svgDimensions.paddingX + (index - 1) * 200;
              const endX = svgDimensions.paddingX + index * 200;
              const y = svgDimensions.height / 2;

              return (
                <G key={`edge-${index}`}>
                  <Line
                    x1={startX}
                    y1={y}
                    x2={endX}
                    y2={y}
                    stroke={colors.border}
                    strokeWidth={2}
                    strokeDasharray={item.edge.type === 'dashed' ? '5,5' : undefined}
                  />
                  <SvgText
                    x={(startX + endX) / 2}
                    y={y - 15}
                    fontSize="12"
                    fill={colors.text}
                    textAnchor="middle"
                  >
                    {item.edge.label || getEdgeDescription(item.edge.type)}
                  </SvgText>
                  {/* 显示权重 */}
                  {item.edge.weight && (
                    <SvgText
                      x={(startX + endX) / 2}
                      y={y + 25}
                      fontSize="10"
                      fill={colors.textLight}
                      textAnchor="middle"
                    >
                      权重: {item.edge.weight}
                    </SvgText>
                  )}
                </G>
              );
            })}

            {/* 渲染节点 */}
            {path.map((item, index) => {
              const x = svgDimensions.paddingX + index * 200;
              const y = svgDimensions.height / 2;
              const nodeSize = 25;
              const nodeColor = getNodeColorByType(item.node.type);

              return (
                <G key={`node-${index}`}>
                  <Circle
                    cx={x}
                    cy={y}
                    r={nodeSize}
                    fill={nodeColor}
                    stroke={colors.border}
                    strokeWidth={1}
                    onPress={() => onNodePress && onNodePress(item.node)}
                  />
                  <SvgText
                    x={x}
                    y={y}
                    fontSize="12"
                    fill={colors.white}
                    textAnchor="middle"
                    alignmentBaseline="middle"
                  >
                    {index + 1}
                  </SvgText>
                  <SvgText
                    x={x}
                    y={y + nodeSize + 15}
                    fontSize="12"
                    fill={colors.text}
                    textAnchor="middle"
                  >
                    {item.node.title}
                  </SvgText>
                  <SvgText
                    x={x}
                    y={y + nodeSize + 35}
                    fontSize="10"
                    fill={colors.textLight}
                    textAnchor="middle"
                  >
                    {item.node.type === 'note' ? '笔记' :
                     item.node.type === 'tag' ? '标签' :
                     item.node.type === 'category' ? '分类' : '概念'}
                  </SvgText>
                </G>
              );
            })}
          </G>
        </Svg>
      </ScrollView>

      {/* 路径信息 */}
      <View style={dynamicStyles.pathInfoContainer}>
        <Text style={dynamicStyles.pathInfoTitle}>路径信息</Text>
        <Text style={dynamicStyles.pathInfoText}>
          从 <Text style={dynamicStyles.highlightText}>{path[0]?.node.title}</Text> 到
          <Text style={dynamicStyles.highlightText}>{path[path.length - 1]?.node.title}</Text>
        </Text>
        <Text style={dynamicStyles.pathInfoText}>共 {path.length} 个节点，{path.length - 1} 个连接</Text>
      </View>

      {/* 节点列表 */}
      <View style={dynamicStyles.nodeListContainer}>
        <Text style={dynamicStyles.nodeListTitle}>路径节点</Text>
        <ScrollView style={dynamicStyles.nodeList}>
          {path.map((item, index) => (
            <TouchableOpacity
              key={`list-node-${index}`}
              style={dynamicStyles.nodeItem}
              onPress={() => onNodePress && onNodePress(item.node)}
            >
              <View
                style={[dynamicStyles.nodeTypeIndicator, { backgroundColor: getNodeColorByType(item.node.type) }]}
              />
              <View style={dynamicStyles.nodeItemContent}>
                <Text style={dynamicStyles.nodeItemTitle}>{index + 1}. {item.node.title}</Text>
                <Text style={dynamicStyles.nodeItemType}>
                  {item.node.type === 'note' ? '笔记' :
                   item.node.type === 'tag' ? '标签' :
                   item.node.type === 'category' ? '分类' : '概念'}
                </Text>
              </View>
              <Icon name="chevron-right" size={20} color={colors.textLight} />
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
  pathInfoContainer: {
    padding: 15,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  pathInfoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 5,
  },
  pathInfoText: {
    fontSize: 14,
    color: colors.text,
    marginBottom: 3,
  },
  highlightText: {
    fontWeight: 'bold',
    color: colors.primary,
  },
  nodeListContainer: {
    flex: 1,
    padding: 15,
  },
  nodeListTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 10,
  },
  nodeList: {
    flex: 1,
  },
  nodeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: colors.card,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  nodeTypeIndicator: {
    width: 16,
    height: 16,
    borderRadius: 8,
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
});

// 创建一个空的StyleSheet，实际样式将在组件内部动态生成
const styles = StyleSheet.create({
  container: {},
  centerContainer: {},
  loadingText: {},
  errorText: {},
  emptyText: {},
  emptySubText: {},
  pathInfoContainer: {},
  pathInfoTitle: {},
  pathInfoText: {},
  highlightText: {},
  nodeListContainer: {},
  nodeListTitle: {},
  nodeList: {},
  nodeItem: {},
  nodeTypeIndicator: {},
  nodeItemContent: {},
  nodeItemTitle: {},
  nodeItemType: {},
});

export default PathVisualization;
