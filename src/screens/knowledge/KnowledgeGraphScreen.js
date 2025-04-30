/**
 * 知识图谱屏幕
 * 用于可视化笔记之间的关系和知识连接
 */

import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Dimensions,
  Alert,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Svg, G, Line, Circle, Text as SvgText } from 'react-native-svg';
import { PanGestureHandler, PinchGestureHandler, State } from 'react-native-gesture-handler';
import Animated, { useAnimatedGestureHandler, useSharedValue, useAnimatedStyle } from 'react-native-reanimated';

// 导入知识图谱组件
import { GraphVisualization } from '../../components/knowledge';

// 导入Redux相关
import {
  fetchKnowledgeGraph,
  selectNodes,
  selectEdges,
  selectIsLoading,
  selectError,
  selectLayout,
  selectFilters,
  selectVisualization,
  setLayout,
  setFilters,
  setVisualization,
  setCurrentNode,
} from '../../redux/slices/knowledgeGraphSlice';

// 导入常量和工具函数
import { dimensions } from '../../utils/constants/dimensions';
import { useTheme } from '../../context/ThemeContext';

// 导入组件
import { Button, Loading, Toast } from '../../components/common';

// 屏幕尺寸
const { width, height } = Dimensions.get('window');

/**
 * 知识图谱屏幕组件
 */
const KnowledgeGraphScreen = ({ navigation }) => {
  const dispatch = useDispatch();

  // 获取主题颜色
  const { colors } = useTheme();

  // 获取动态样式
  const styles = getStyles(colors);

  // 从Redux获取状态
  const nodes = useSelector(selectNodes);
  const edges = useSelector(selectEdges);
  const isLoading = useSelector(selectIsLoading);
  const error = useSelector(selectError);
  const layout = useSelector(selectLayout);
  const filters = useSelector(selectFilters);
  const visualization = useSelector(selectVisualization);

  // 本地状态
  const [showFilters, setShowFilters] = useState(false);
  const [showLayoutOptions, setShowLayoutOptions] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [selectedNode, setSelectedNode] = useState(null);

  // 本地状态 - 不再需要手势状态，由GraphVisualization组件处理

  // 初始化加载知识图谱数据
  useEffect(() => {
    loadKnowledgeGraph();
  }, []);

  // 加载知识图谱数据
  const loadKnowledgeGraph = async () => {
    try {
      await dispatch(fetchKnowledgeGraph()).unwrap();
    } catch (err) {
      console.error('加载知识图谱失败:', err);
      setToastMessage('加载知识图谱失败: ' + (err.message || '请稍后重试'));

      // 如果API加载失败，使用模拟数据
      const mockNodes = [
        {
          id: '1',
          label: '笔记方法',
          type: 'concept',
          x: 100,
          y: 100,
          size: 30,
          description: '高效记笔记的方法和技巧'
        },
        {
          id: '2',
          label: '康奈尔笔记法',
          type: 'note',
          noteId: '101',
          x: 200,
          y: 50,
          size: 25,
          description: '一种将笔记分为笔记、线索和总结三个部分的方法'
        },
        {
          id: '3',
          label: '思维导图',
          type: 'note',
          noteId: '102',
          x: 200,
          y: 150,
          size: 25,
          description: '一种图形化的思考和组织信息的方法'
        },
        {
          id: '4',
          label: '学习效率',
          type: 'tag',
          x: 300,
          y: 100,
          size: 20,
          description: '提高学习效率的方法和技巧'
        },
        {
          id: '5',
          label: '知识管理',
          type: 'category',
          x: 50,
          y: 200,
          size: 25,
          description: '管理和组织知识的方法和工具'
        }
      ];

      const mockEdges = [
        {
          id: 'e1',
          source: '1',
          target: '2',
          label: '包含',
          type: 'contains'
        },
        {
          id: 'e2',
          source: '1',
          target: '3',
          label: '包含',
          type: 'contains'
        },
        {
          id: 'e3',
          source: '2',
          target: '4',
          label: '标记',
          type: 'tagged'
        },
        {
          id: 'e4',
          source: '3',
          target: '4',
          label: '标记',
          type: 'tagged'
        },
        {
          id: 'e5',
          source: '5',
          target: '1',
          label: '分类',
          type: 'categorized'
        }
      ];

      dispatch({
        type: 'knowledgeGraph/fetchKnowledgeGraphSuccess',
        payload: {
          nodes: mockNodes,
          edges: mockEdges
        }
      });
    }
  };

  // 处理节点点击
  const handleNodePress = (node) => {
    setSelectedNode(node);
    dispatch(setCurrentNode(node));
    // 高亮相关节点和边
    const relatedEdges = edges.filter(
      (edge) => edge.source === node.id || edge.target === node.id
    );
    const relatedNodeIds = new Set();
    relatedEdges.forEach((edge) => {
      relatedNodeIds.add(edge.source);
      relatedNodeIds.add(edge.target);
    });

    dispatch(setVisualization({
      highlightedNodes: Array.from(relatedNodeIds),
      highlightedEdges: relatedEdges.map(edge => edge.id),
      centerNode: node.id,
    }));
  };

  // 处理节点双击 - 导航到笔记详情
  const handleNodeDoubleTap = (node) => {
    if (node.type === 'note' && node.noteId) {
      navigation.navigate('NoteDetail', { noteId: node.noteId });
    }
  };

  // 切换布局
  const changeLayout = (newLayout) => {
    dispatch(setLayout(newLayout));
    setShowLayoutOptions(false);
  };

  // 应用过滤器
  const applyFilters = (newFilters) => {
    dispatch(setFilters(newFilters));
    setShowFilters(false);
  };

  // 重置视图
  const resetView = () => {
    dispatch(setVisualization({
      zoomLevel: 1,
      centerNode: null,
      highlightedNodes: [],
      highlightedEdges: [],
    }));
    setSelectedNode(null);
  };

  // 根据节点类型获取颜色
  const getNodeColorByType = (type) => {
    switch (type) {
      case 'note':
        return colors.primary;
      case 'tag':
        return colors.secondary;
      case 'category':
        return colors.success;
      case 'concept':
        return colors.warning;
      default:
        return colors.textSecondary;
    }
  };

  // 渲染加载状态
  if (isLoading && nodes.length === 0) {
    return <Loading text="加载知识图谱中..." />;
  }

  // 渲染错误状态
  if (error && nodes.length === 0) {
    return (
      <View style={styles.errorContainer}>
        <Icon name="error-outline" size={50} color={colors.error} />
        <Text style={styles.errorText}>加载失败: {error}</Text>
        <Button title="重试" onPress={loadKnowledgeGraph} />
      </View>
    );
  }

  // 渲染空状态
  if (nodes.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Icon name="bubble-chart" size={80} color={colors.textSecondary} />
        <Text style={styles.emptyText}>暂无知识图谱数据</Text>
        <Text style={styles.emptySubText}>创建更多笔记和连接，构建您的知识网络</Text>
        <Button
          title="创建笔记"
          onPress={() => navigation.navigate('NoteEdit')}
          style={styles.createButton}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 顶部工具栏 */}
      <View style={styles.toolbar}>
        <TouchableOpacity
          style={styles.toolbarButton}
          onPress={() => setShowLayoutOptions(!showLayoutOptions)}
        >
          <Icon name="bubble-chart" size={24} color={colors.text} />
          <Text style={styles.toolbarButtonText}>布局</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.toolbarButton}
          onPress={() => setShowFilters(!showFilters)}
        >
          <Icon name="filter-list" size={24} color={colors.text} />
          <Text style={styles.toolbarButtonText}>筛选</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.toolbarButton}
          onPress={resetView}
        >
          <Icon name="refresh" size={24} color={colors.text} />
          <Text style={styles.toolbarButtonText}>重置</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.toolbarButton}
          onPress={() => navigation.navigate('KnowledgeAnalysis')}
        >
          <Icon name="analytics" size={24} color={colors.text} />
          <Text style={styles.toolbarButtonText}>分析</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.toolbarButton}
          onPress={() => navigation.navigate('NodeDetail', { nodeId: selectedNode?.id })}
          disabled={!selectedNode}
        >
          <Icon
            name="info-outline"
            size={24}
            color={selectedNode ? colors.text : colors.textSecondary}
          />
          <Text
            style={[styles.toolbarButtonText, !selectedNode && styles.disabledText]}
          >
            详情
          </Text>
        </TouchableOpacity>
      </View>

      {/* 布局选项 */}
      {showLayoutOptions && (
        <View style={styles.optionsContainer}>
          <TouchableOpacity
            style={[styles.optionButton, layout === 'force' && styles.activeOption]}
            onPress={() => changeLayout('force')}
          >
            <Text style={styles.optionText}>力导向</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.optionButton, layout === 'hierarchical' && styles.activeOption]}
            onPress={() => changeLayout('hierarchical')}
          >
            <Text style={styles.optionText}>层级</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.optionButton, layout === 'circular' && styles.activeOption]}
            onPress={() => changeLayout('circular')}
          >
            <Text style={styles.optionText}>环形</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 过滤选项 */}
      {showFilters && (
        <View style={styles.filtersContainer}>
          <Text style={styles.filterTitle}>节点类型</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {['note', 'tag', 'category', 'concept'].map(type => (
              <TouchableOpacity
                key={type}
                style={[styles.filterChip, filters.nodeTypes.includes(type) && styles.activeFilterChip]}
                onPress={() => {
                  const newNodeTypes = filters.nodeTypes.includes(type)
                    ? filters.nodeTypes.filter(t => t !== type)
                    : [...filters.nodeTypes, type];
                  applyFilters({ ...filters, nodeTypes: newNodeTypes });
                }}
              >
                <Text style={styles.filterChipText}>
                  {type === 'note' ? '笔记' :
                   type === 'tag' ? '标签' :
                   type === 'category' ? '分类' : '概念'}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* 知识图谱可视化区域 */}
      <GraphVisualization
        nodes={nodes}
        edges={edges}
        visualization={visualization}
        onNodePress={handleNodePress}
        onNodeLongPress={handleNodeDoubleTap}
      />

      {/* 底部信息栏 - 显示选中节点信息 */}
      {selectedNode && (
        <View style={styles.nodeInfoContainer}>
          <View style={styles.nodeInfoHeader}>
            <View
              style={[styles.nodeTypeIndicator, { backgroundColor: getNodeColorByType(selectedNode.type) }]}
            />
            <Text style={styles.nodeTitle}>{selectedNode.label || selectedNode.title}</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setSelectedNode(null)}
            >
              <Icon name="close" size={20} color={colors.text} />
            </TouchableOpacity>
          </View>

          <Text style={styles.nodeDescription}>
            {selectedNode.description || '暂无描述'}
          </Text>

          <View style={styles.nodeActions}>
            <TouchableOpacity
              style={styles.nodeActionButton}
              onPress={() => navigation.navigate('NodeDetail', { nodeId: selectedNode.id })}
            >
              <Icon name="info-outline" size={20} color={colors.primary} />
              <Text style={styles.nodeActionText}>详情</Text>
            </TouchableOpacity>

            {selectedNode.type === 'note' && selectedNode.noteId && (
              <TouchableOpacity
                style={styles.nodeActionButton}
                onPress={() => navigation.navigate('NoteDetail', { noteId: selectedNode.noteId })}
              >
                <Icon name="description" size={20} color={colors.primary} />
                <Text style={styles.nodeActionText}>查看笔记</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Toast消息 */}
      {toastMessage ? (
        <Toast
          message={toastMessage}
          onDismiss={() => setToastMessage('')}
          type="error"
        />
      ) : null}
    </View>
  );
};

// 使用内联样式，因为我们需要访问动态的颜色主题
const getStyles = (colors) => ({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    padding: 10,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  toolbarButton: {
    alignItems: 'center',
    padding: 8,
  },
  toolbarButtonText: {
    fontSize: 12,
    marginTop: 4,
    color: colors.text,
  },
  disabledText: {
    color: colors.textSecondary,
  },
  optionsContainer: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  optionButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 10,
    borderRadius: 16,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  activeOption: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  optionText: {
    color: colors.text,
    fontSize: 14,
  },
  filtersContainer: {
    padding: 10,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filterTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
    color: colors.text,
  },
  filterChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 10,
    borderRadius: 16,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  activeFilterChip: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    color: colors.text,
    fontSize: 14,
  },
  graphContainer: {
    flex: 1,
    overflow: 'hidden',
  },
  graphWrapper: {
    width: width * 2,
    height: height * 2,
  },
  nodeInfoContainer: {
    padding: 15,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  nodeInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  nodeTypeIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  nodeTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
  },
  closeButton: {
    padding: 4,
  },
  nodeDescription: {
    fontSize: 14,
    color: colors.text,
    marginBottom: 10,
  },
  nodeActions: {
    flexDirection: 'row',
  },
  nodeActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    padding: 6,
  },
  nodeActionText: {
    marginLeft: 4,
    fontSize: 14,
    color: colors.primary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: colors.error,
    textAlign: 'center',
    marginVertical: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 20,
  },
  emptySubText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 30,
  },
  createButton: {
    width: 200,
  },
});

// 创建一个空的StyleSheet，实际样式将在组件内部动态生成
const styles = StyleSheet.create({
  container: {},
  toolbar: {},
  toolbarButton: {},
  toolbarButtonText: {},
  disabledText: {},
  optionsContainer: {},
  optionButton: {},
  activeOption: {},
  optionText: {},
  filtersContainer: {},
  filterTitle: {},
  filterChip: {},
  activeFilterChip: {},
  filterChipText: {},
  graphContainer: {},
  graphWrapper: {},
  nodeInfoContainer: {},
  nodeInfoHeader: {},
  nodeTypeIndicator: {},
  nodeTitle: {},
  closeButton: {},
  nodeDescription: {},
  nodeActions: {},
  nodeActionButton: {},
  nodeActionText: {},
  errorContainer: {},
  errorText: {},
  emptyContainer: {},
  emptyText: {},
  emptySubText: {},
  createButton: {},
});

export default KnowledgeGraphScreen;