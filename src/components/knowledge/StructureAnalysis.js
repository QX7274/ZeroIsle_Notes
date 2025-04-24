/**
 * 知识结构分析组件
 * 用于可视化展示知识图谱的结构分析结果
 */

import React, { useState } from 'react';
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
 * 知识结构分析组件
 * @param {Object} analysis - 分析结果数据
 * @param {Function} onNodePress - 节点点击回调
 * @param {boolean} isLoading - 是否正在加载
 * @param {string} error - 错误信息
 */
const StructureAnalysis = ({
  analysis = null,
  onNodePress,
  isLoading = false,
  error = null,
}) => {
  // 本地状态
  const [activeTab, setActiveTab] = useState('central'); // 'central' 或 'components'
  const { colors } = useTheme();

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

  // 渲染加载状态
  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>正在分析知识结构...</Text>
      </View>
    );
  }

  // 渲染错误状态
  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Icon name="error-outline" size={50} color={colors.error} />
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  // 渲染空状态
  if (!analysis) {
    return (
      <View style={styles.centerContainer}>
        <Icon name="bubble-chart" size={50} color={colors.textLight} />
        <Text style={styles.emptyText}>暂无分析数据</Text>
        <Text style={styles.emptySubText}>请先创建更多知识节点和连接</Text>
      </View>
    );
  }

  // 渲染中心节点可视化
  const renderCentralNodesVisualization = () => {
    const { central_nodes } = analysis;
    if (!central_nodes || central_nodes.length === 0) {
      return (
        <View style={styles.emptyVisualization}>
          <Text style={styles.emptyVisualizationText}>暂无中心节点数据</Text>
        </View>
      );
    }

    // 计算最大度数，用于比例缩放
    const maxDegree = Math.max(...central_nodes.map(item => item.degree));

    return (
      <Svg width="100%" height={300} viewBox="0 0 400 300">
        <G>
          {/* 渲染中心节点 */}
          {central_nodes.map((item, index) => {
            const x = 200;
            const y = 50 + index * 60;
            const nodeSize = 15 + (item.degree / maxDegree) * 25; // 根据度数调整大小
            const nodeColor = getNodeColorByType(item.node.type);

            return (
              <G key={`central-node-${index}`}>
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
                  x={x + nodeSize + 15}
                  y={y - 10}
                  fontSize="14"
                  fill={colors.text}
                  textAnchor="start"
                >
                  {item.node.title}
                </SvgText>
                <SvgText
                  x={x + nodeSize + 15}
                  y={y + 10}
                  fontSize="12"
                  fill={colors.textLight}
                  textAnchor="start"
                >
                  度数: {item.degree}
                </SvgText>
              </G>
            );
          })}
        </G>
      </Svg>
    );
  };

  // 渲染连通分量可视化
  const renderComponentsVisualization = () => {
    const { components } = analysis;
    if (!components || components.length === 0) {
      return (
        <View style={styles.emptyVisualization}>
          <Text style={styles.emptyVisualizationText}>暂无连通分量数据</Text>
        </View>
      );
    }

    // 计算最大分量大小，用于比例缩放
    const maxSize = Math.max(...components.map(comp => comp.size));

    return (
      <Svg width="100%" height={300} viewBox="0 0 400 300">
        <G>
          {/* 渲染连通分量 */}
          {components.map((component, index) => {
            const x = 200;
            const y = 50 + index * 60;
            const componentSize = 20 + (component.size / maxSize) * 30; // 根据大小调整圆的大小

            return (
              <G key={`component-${index}`}>
                <Circle
                  cx={x}
                  cy={y}
                  r={componentSize}
                  fill={colors.backgroundLight}
                  stroke={colors.primary}
                  strokeWidth={1}
                />
                <SvgText
                  x={x}
                  y={y}
                  fontSize="14"
                  fill={colors.text}
                  textAnchor="middle"
                  alignmentBaseline="middle"
                >
                  {component.size}
                </SvgText>
                <SvgText
                  x={x + componentSize + 15}
                  y={y}
                  fontSize="14"
                  fill={colors.text}
                  textAnchor="start"
                >
                  连通分量 {index + 1}
                </SvgText>
                <SvgText
                  x={x + componentSize + 15}
                  y={y + 20}
                  fontSize="12"
                  fill={colors.textLight}
                  textAnchor="start"
                >
                  包含 {component.size} 个节点
                </SvgText>
              </G>
            );
          })}
        </G>
      </Svg>
    );
  };

  return (
    <View style={styles.container}>
      {/* 选项卡 */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'central' && styles.activeTab]}
          onPress={() => setActiveTab('central')}
        >
          <Text style={[styles.tabText, activeTab === 'central' && styles.activeTabText]}>
            中心节点
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'components' && styles.activeTab]}
          onPress={() => setActiveTab('components')}
        >
          <Text style={[styles.tabText, activeTab === 'components' && styles.activeTabText]}>
            连通分量
          </Text>
        </TouchableOpacity>
      </View>

      {/* 可视化区域 */}
      <View style={styles.visualizationContainer}>
        {activeTab === 'central' ? renderCentralNodesVisualization() : renderComponentsVisualization()}
      </View>

      {/* 详细信息 */}
      <ScrollView style={styles.detailsContainer}>
        {activeTab === 'central' ? (
          <View>
            <Text style={styles.detailsTitle}>中心节点分析</Text>
            <Text style={styles.detailsDescription}>
              中心节点是知识图谱中连接最多的节点，它们在知识网络中起到枢纽作用。
            </Text>
            {analysis.central_nodes && analysis.central_nodes.length > 0 ? (
              analysis.central_nodes.map((item, index) => (
                <TouchableOpacity
                  key={`central-detail-${index}`}
                  style={styles.nodeItem}
                  onPress={() => onNodePress && onNodePress(item.node)}
                >
                  <View
                    style={[styles.nodeTypeIndicator, { backgroundColor: getNodeColorByType(item.node.type) }]}
                  />
                  <View style={styles.nodeItemContent}>
                    <Text style={styles.nodeItemTitle}>{item.node.title}</Text>
                    <Text style={styles.nodeItemType}>
                      {item.node.type === 'note' ? '笔记' :
                        item.node.type === 'tag' ? '标签' :
                          item.node.type === 'category' ? '分类' : '概念'}
                    </Text>
                  </View>
                  <View style={styles.degreeIndicator}>
                    <Text style={styles.degreeText}>{item.degree}</Text>
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              <Text style={styles.emptyListText}>暂无中心节点数据</Text>
            )}
          </View>
        ) : (
          <View>
            <Text style={styles.detailsTitle}>连通分量分析</Text>
            <Text style={styles.detailsDescription}>
              连通分量是知识图谱中相互连接的节点集合，不同连通分量之间没有连接。
            </Text>
            {analysis.components && analysis.components.length > 0 ? (
              analysis.components.map((component, index) => (
                <View key={`component-detail-${index}`} style={styles.componentItem}>
                  <View style={styles.componentHeader}>
                    <Text style={styles.componentTitle}>连通分量 {index + 1}</Text>
                    <Text style={styles.componentSize}>{component.size} 个节点</Text>
                  </View>
                  <View style={styles.componentNodes}>
                    {component.nodes.slice(0, 3).map((node, nodeIndex) => (
                      <TouchableOpacity
                        key={`component-node-${index}-${nodeIndex}`}
                        style={styles.componentNodeItem}
                        onPress={() => onNodePress && onNodePress(node)}
                      >
                        <View
                          style={[styles.nodeTypeIndicator, { backgroundColor: getNodeColorByType(node.type) }]}
                        />
                        <Text style={styles.componentNodeTitle}>{node.title}</Text>
                      </TouchableOpacity>
                    ))}
                    {component.nodes.length > 3 && (
                      <Text style={styles.moreNodesText}>还有 {component.nodes.length - 3} 个节点...</Text>
                    )}
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.emptyListText}>暂无连通分量数据</Text>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
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
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontSize: 14,
    color: colors.text,
  },
  activeTabText: {
    color: colors.primary,
    fontWeight: 'bold',
  },
  visualizationContainer: {
    height: 300,
    padding: 10,
    backgroundColor: colors.card,
  },
  emptyVisualization: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyVisualizationText: {
    fontSize: 14,
    color: colors.textLight,
    fontStyle: 'italic',
  },
  detailsContainer: {
    flex: 1,
    padding: 15,
  },
  detailsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 5,
  },
  detailsDescription: {
    fontSize: 14,
    color: colors.textLight,
    marginBottom: 15,
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
  degreeIndicator: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  degreeText: {
    color: colors.white,
    fontWeight: 'bold',
    fontSize: 14,
  },
  emptyListText: {
    fontSize: 14,
    color: colors.textLight,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 20,
  },
  componentItem: {
    padding: 12,
    backgroundColor: colors.card,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  componentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingBottom: 5,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  componentTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.text,
  },
  componentSize: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: 'bold',
  },
  componentNodes: {
    paddingLeft: 5,
  },
  componentNodeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  componentNodeTitle: {
    fontSize: 13,
    color: colors.text,
  },
  moreNodesText: {
    fontSize: 12,
    color: colors.textLight,
    fontStyle: 'italic',
    marginTop: 5,
  },
});

export default StructureAnalysis;