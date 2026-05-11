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
import { buildGraphFromNotes } from '../../services/noteGraphService';
import websocketService from '../../services/websocket/websocket';

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
  selectAuthRequired, // <-- Import new selector
  selectAuthMessage,  // <-- Import new selector
  selectNetworkFallbackMessage,
  setLayout,
  setFilters,
  setVisualization,
  setCurrentNode,
} from '../../redux/slices/knowledgeGraphSlice';

// 导入常量和工具函数
import { dimensions } from '../../utils/constants/dimensions';
import { useTheme } from '../../context/ThemeContext';

import networkErrorService from '../../services/networkErrorService';

// 导入组件
import { Button, Loading, Toast } from '../../components/common';

// 后端图与候选边适配器
import { suggestEdges, acceptSuggestions, ignoreSuggestions, getGraphNodes } from '../../adapters/knowledgeGraphAdapter';
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
  // 从 Redux 中获取知识图谱数据与加载状态
  const nodes = useSelector(selectNodes);
  const edges = useSelector(selectEdges);
  const isLoading = useSelector(selectIsLoading);
  const error = useSelector(selectError);
  const networkFallbackMessage = useSelector(selectNetworkFallbackMessage);

  // Redux state for UI controls
  const layout = useSelector(selectLayout);
  const filters = useSelector(selectFilters);
  const visualization = useSelector(selectVisualization);

// 性能保护：避免大图谱导致渲染/内存崩溃
  const MAX_RENDER_NODES = 800;
  const MAX_RENDER_EDGES = 1200;

  const renderNodes = React.useMemo(() => {
    if (!Array.isArray(nodes)) return [];
    return nodes.length > MAX_RENDER_NODES ? nodes.slice(0, MAX_RENDER_NODES) : nodes;
  }, [nodes]);

  const renderNodeIdSet = React.useMemo(() => {
    return new Set((renderNodes || []).map(n => String(n.id || n._id)));
  }, [renderNodes]);

  const renderEdges = React.useMemo(() => {
    if (!Array.isArray(edges)) return [];

    // 仅保留两端节点都在渲染子集中的边
    let filtered = edges.filter(e => {
      const s = String(e.source || e.source_id);
      const t = String(e.target || e.target_id);
      return renderNodeIdSet.has(s) && renderNodeIdSet.has(t);
    });

    if (filtered.length > MAX_RENDER_EDGES) {
      filtered = filtered.slice(0, MAX_RENDER_EDGES);
    }
    return filtered;
  }, [edges, renderNodeIdSet]);
  // 本地状态
  const [showFilters, setShowFilters] = useState(false);
  const [showLayoutOptions, setShowLayoutOptions] = useState(false);
  // 候选边建议
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);

  const [toastMessage, setToastMessage] = useState('');
  const [selectedNode, setSelectedNode] = useState(null);

  // 本地状态 - 不再需要手势状态，由GraphVisualization组件处理

  // 加载知识图谱数据（从后端/Realm 同步）
  const loadKnowledgeGraph = async () => {
    try {
      await dispatch(fetchKnowledgeGraph(filters));
    } catch (e) {
      // createAsyncThunk 内部已处理错误，这里不阻塞 UI
    }
  };

  useEffect(() => {
    loadKnowledgeGraph();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 处理节点点击
  const handleNodePress = (node) => {
    setSelectedNode(node);
    dispatch(setCurrentNode(node));
    // --- 1st and 2nd Degree Highlighting ---
    const firstDegreeEdges = edges.filter(
      (edge) => edge.source === node.id || edge.target === node.id
    );
    const firstDegreeNodeIds = new Set([node.id]);
    firstDegreeEdges.forEach((edge) => {
      firstDegreeNodeIds.add(edge.source);
      firstDegreeNodeIds.add(edge.target);
    });

    const secondDegreeNodeIds = new Set();
    firstDegreeNodeIds.forEach(firstDegreeNodeId => {
      if (firstDegreeNodeId !== node.id) {
        const secondDegreeEdges = edges.filter(
          (edge) => (edge.source === firstDegreeNodeId || edge.target === firstDegreeNodeId)
        );
        secondDegreeEdges.forEach(edge => {
          const neighborId = edge.source === firstDegreeNodeId ? edge.target : edge.source;
          if (!firstDegreeNodeIds.has(neighborId)) {
            secondDegreeNodeIds.add(neighborId);
          }
        });
      }
    });

    dispatch(setVisualization({
      highlightedNodes: Array.from(firstDegreeNodeIds),
      secondDegreeHighlightedNodes: Array.from(secondDegreeNodeIds),
      highlightedEdges: firstDegreeEdges.map(edge => edge.id),
      centerNode: node.id,
    }));
  };

  // 处理节点双击 - 导航到笔记详情
  const handleNodeDoubleTap = (node) => {
    if (node.type === 'note' && node.id) {
      navigation.navigate('NoteEditor', { noteId: node.id });
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


  if (isLoading && (!nodes || nodes.length === 0)) {
    return <Loading text="加载知识图谱中..." />;
  }

  // 渲染错误状态（仅非网络错误展示阻断失败页）
  if (error && (!nodes || nodes.length === 0)) {
    return (
      <View style={styles.errorContainer}>
        <Icon name="error-outline" size={50} color={colors.error} />
        <Text style={styles.errorText}>加载失败: {error}</Text>
        <Button title="重试" onPress={loadKnowledgeGraph} />
      </View>
    );
  }

  // 渲染空状态（包含弱网离线空图提示）
  if (!nodes || nodes.length === 0) {
    return (
      <View style={styles.emptyContainer} testID="screen.knowledgeGraph">
        <Icon name="bubble-chart" size={80} color={colors.textSecondary} />
        <Text style={styles.emptyText}>暂无知识图谱数据</Text>
        <Text style={styles.emptySubText}>创建更多笔记和连接，构建您的知识网络</Text>
        {networkFallbackMessage ? (
          <Text style={styles.networkHintText}>{networkFallbackMessage}</Text>
        ) : null}
        <Button
          title="创建笔记"
          onPress={() => navigation.navigate('NoteEdit')}
          style={styles.createButton}
        />
      </View>
    );
  }

  return (
    <View style={styles.container} testID="screen.knowledgeGraph">
      {/* 顶部导航栏（统一返回按钮样式） */}
      <View style={styles.headerBar}>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: colors.primary + '15' }]}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Icon name="arrow-back" size={22} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>知识图谱</Text>
        <View style={styles.headerRight} />
      </View>

      {/* 顶部工具栏 */}
      <View style={styles.toolbar}>
        <TouchableOpacity
          style={styles.toolbarButton}
          onPress={() => setShowLayoutOptions(!showLayoutOptions)}
          testID="action.knowledgeGraph.layout"
        >
          <Icon name="bubble-chart" size={24} color={colors.text} />
          <Text style={styles.toolbarButtonText}>布局</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.toolbarButton}
          onPress={() => setShowFilters(!showFilters)}
          testID="action.knowledgeGraph.filter"
        >
          <Icon name="filter-list" size={24} color={colors.text} />
          <Text style={styles.toolbarButtonText}>筛选</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.toolbarButton}
          onPress={resetView}
          testID="action.knowledgeGraph.reset"
        >
          <Icon name="refresh" size={24} color={colors.text} />
          <Text style={styles.toolbarButtonText}>重置</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.toolbarButton}
          onPress={() => navigation.navigate('KnowledgeAnalysis')}
          testID="action.knowledgeGraph.analysis"
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

      {/* 知识图谱可视化区域（使用裁剪后的 renderNodes/renderEdges 以保护性能） */}
      <GraphVisualization
        nodes={renderNodes}
        edges={renderEdges}
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
              onPress={() => navigation.navigate('NoteEditor', { noteId: selectedNode.id })}
            >
              <Icon name="edit" size={20} color={colors.primary} />
              <Text style={styles.nodeActionText}>编辑</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.nodeActionButton}
              onPress={async () => {
                try {
                  setSuggestLoading(true);
                  const list = await suggestEdges(selectedNode.id, 10);
                  setSuggestions(list);
                  setShowSuggestions(true);
                } catch (e) {
                  setToastMessage(`获取候选边失败: ${e.message}`);
                } finally {
                  setSuggestLoading(false);
                }
              }}
            >
              <Icon name="lightbulb-outline" size={20} color={colors.primary} />
              <Text style={styles.nodeActionText}>建议</Text>
            </TouchableOpacity>

            {showSuggestions && suggestions.length > 0 && (
              <>
                <TouchableOpacity
                  style={styles.nodeActionButton}
                  onPress={async () => {
                    try {
                      setSuggestLoading(true);
                      const res = await acceptSuggestions(suggestions.map(s => ({
                        source: s.source, target: s.target, type: s.type,
                        confidence: s.confidence, evidence: s.evidence || [],
                      })));
                      setToastMessage(`采纳成功 ${res.accepted} 条`);
                      setSuggestions([]);
                      setShowSuggestions(false);
                    } catch (e) {
                      setToastMessage(`采纳失败: ${e.message}`);
                    } finally {
                      setSuggestLoading(false);
                    }
                  }}
                >
                  <Icon name="check-circle" size={20} color={colors.primary} />
                  <Text style={styles.nodeActionText}>采纳全部</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.nodeActionButton}
                  onPress={async () => {
                    try {
                      setSuggestLoading(true);
                      const res = await ignoreSuggestions(suggestions.map(s => ({
                        source: s.source, target: s.target, type: s.type,
                      })));
                      setToastMessage(`忽略成功 ${res.ignored} 条`);
                      setSuggestions([]);
                      setShowSuggestions(false);
                    } catch (e) {
                      setToastMessage(`忽略失败: ${e.message}`);
                    } finally {
                      setSuggestLoading(false);
                    }
                  }}
                >
                  <Icon name="block" size={20} color={colors.error} />
                  <Text style={[styles.nodeActionText, { color: colors.error }]}>忽略全部</Text>
                </TouchableOpacity>
              </>
            )}

          </View>

          {showSuggestions && (
            <View style={{ marginTop: 10 }}>
              <Text style={{ color: colors.text, fontWeight: '600', marginBottom: 6 }}>
                候选边（{suggestions.length}）{suggestLoading ? ' · 加载中...' : ''}
              </Text>
              <ScrollView style={{ maxHeight: 200 }}>
                {suggestions.map((s, idx) => (
                  <View key={`${s.source}-${s.target}-${idx}`} style={{ paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                    <Text style={{ color: colors.text, fontSize: 12 }}>类型: {s.type || 'related'}</Text>
                    <Text style={{ color: colors.text, fontSize: 12 }}>源: {s.source}</Text>
                    <Text style={{ color: colors.text, fontSize: 12 }}>目标: {s.target}</Text>
                    <Text style={{ color: colors.text, fontSize: 12 }}>置信度: {(s.confidence * 100).toFixed(1)}%</Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 12 }}>证据: {(s.evidence || []).length} 条</Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}
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
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 24,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: -4,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 18,
    color: colors.text,
  },
  headerRight: {
    width: 40,
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
    marginBottom: 12,
  },
  networkHintText: {
    fontSize: 13,
    color: colors.warning || colors.textSecondary,
    textAlign: 'center',
    marginBottom: 18,
  },
  createButton: {
    width: 200,
  },
});

export default KnowledgeGraphScreen;
