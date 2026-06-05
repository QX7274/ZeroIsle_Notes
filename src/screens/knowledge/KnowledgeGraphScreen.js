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
import { useFocusEffect } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Svg, G, Line, Circle, Text as SvgText } from 'react-native-svg';
import { PanGestureHandler, PinchGestureHandler, State } from 'react-native-gesture-handler';
import Animated, { useAnimatedGestureHandler, useSharedValue, useAnimatedStyle } from 'react-native-reanimated';

// 导入知识图谱组件
import { GraphVisualization } from '../../components/knowledge';
import { buildGraphFromNotes } from '../../services/noteGraphService';
import websocketService from '../../services/websocket/websocket';
import ScreenHeaderBackButton from '../../components/common/ScreenHeaderBackButton';

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
import { navigationRef, navigateHomeStackScreen } from '../../navigation/navigationRef';

// 导入组件
import { Button, Loading, Toast } from '../../components/common';

// 后端图与候选边适配器
import { suggestEdges, acceptSuggestions, ignoreSuggestions, getGraphNodes } from '../../adapters/knowledgeGraphAdapter';
// 屏幕尺寸
const { width, height } = Dimensions.get('window');

/**
 * 知识图谱屏幕组件
 */
const KnowledgeGraphScreen = ({ navigation, route, kbId: propKbId, embedded: propEmbedded = false }) => {
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();

  // 获取主题颜色
  const { colors } = useTheme();

  // 获取动态样式
  const styles = getStyles(colors);
  const effectiveKbId = propKbId || route?.params?.kbId;
  const isEmbedded = propEmbedded || Boolean(route?.params?.embedded);

  // 从Redux获取状态
  // 从 Redux 中获取知识图谱数据与加载状态
  const nodes = useSelector(selectNodes);
  const edges = useSelector(selectEdges);
  const isLoading = useSelector(selectIsLoading);
  const error = useSelector(selectError);
  const authRequired = useSelector(selectAuthRequired);
  const authMessage = useSelector(selectAuthMessage);
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
  const [isSyncingAfterSuggestion, setIsSyncingAfterSuggestion] = useState(false);
  const [suggestionSyncError, setSuggestionSyncError] = useState('');
  const [suggestionSyncRecovered, setSuggestionSyncRecovered] = useState(false);
  const [suggestionStageTrace, setSuggestionStageTrace] = useState([]);
  const [suggestionActionSource, setSuggestionActionSource] = useState('');
  const [suggestionStatus, setSuggestionStatus] = useState({ tone: '', text: '' });
  const suggestionStatusTimerRef = useRef(null);
  const suggestionActionSourceTimerRef = useRef(null);
  const suggestionRecoveredTimerRef = useRef(null);

  const [toastMessage, setToastMessage] = useState('');
  const [selectedNode, setSelectedNode] = useState(null);

  // 本地状态 - 不再需要手势状态，由GraphVisualization组件处理

  // 加载知识图谱数据（从后端/Realm 同步）
  const loadKnowledgeGraph = async () => {
    try {
      const requestFilters = effectiveKbId
        ? { ...filters, kbId: effectiveKbId }
        : filters;
      await dispatch(fetchKnowledgeGraph(requestFilters));
    } catch (e) {
      // createAsyncThunk 内部已处理错误，这里不阻塞 UI
    }
  };

  useEffect(() => {
    loadKnowledgeGraph();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, effectiveKbId]);

  useEffect(() => () => {
    if (suggestionStatusTimerRef.current) {
      clearTimeout(suggestionStatusTimerRef.current);
      suggestionStatusTimerRef.current = null;
    }
    if (suggestionActionSourceTimerRef.current) {
      clearTimeout(suggestionActionSourceTimerRef.current);
      suggestionActionSourceTimerRef.current = null;
    }
    if (suggestionRecoveredTimerRef.current) {
      clearTimeout(suggestionRecoveredTimerRef.current);
      suggestionRecoveredTimerRef.current = null;
    }
  }, []);

  const pushSuggestionStatus = (tone, text) => {
    if (suggestionStatusTimerRef.current) {
      clearTimeout(suggestionStatusTimerRef.current);
      suggestionStatusTimerRef.current = null;
    }
    setSuggestionStatus({ tone, text });
    suggestionStatusTimerRef.current = setTimeout(() => {
      setSuggestionStatus({ tone: '', text: '' });
      suggestionStatusTimerRef.current = null;
    }, 2400);
  };

  const pushSuggestionStageTrace = (stage) => {
    setSuggestionStageTrace((prev) => [stage, ...prev].slice(0, 6));
  };

  const suggestionBusyLabel = React.useMemo(() => {
    if (suggestLoading) {return '候选边加载中…';}
    if (isSyncingAfterSuggestion) {return '图谱同步中…';}
    if (isLoading) {return '图谱主加载中…';}
    return '';
  }, [isLoading, isSyncingAfterSuggestion, suggestLoading]);

  const suggestionActionSourceLabel = React.useMemo(() => {
    const map = {
      openSuggestions: '来源：打开建议',
      acceptAll: '来源：采纳全部',
      ignoreAll: '来源：忽略全部',
      retrySync: '来源：重试同步',
    };
    return map[suggestionActionSource] || '';
  }, [suggestionActionSource]);

  const layoutLabel = React.useMemo(() => {
    const map = {
      force: '力导向',
      hierarchical: '层级',
      circular: '环形',
    };
    return map[layout] || '未知布局';
  }, [layout]);

  const filterSummaryLabel = React.useMemo(() => {
    const nodeTypes = filters?.nodeTypes || [];
    if (nodeTypes.length === 0) {return '当前筛选：无';}
    const map = {
      note: '笔记',
      tag: '标签',
      category: '分类',
      concept: '概念',
    };
    return `当前筛选：${nodeTypes.map(t => map[t] || t).join('、')}`;
  }, [filters]);

  const clearSuggestionSyncFlags = () => {
    setSuggestionSyncError('');
    setSuggestionSyncRecovered(false);
  };

  const markSuggestionActionSource = React.useCallback((source, ttl = 2200) => {
    if (suggestionActionSourceTimerRef.current) {
      clearTimeout(suggestionActionSourceTimerRef.current);
      suggestionActionSourceTimerRef.current = null;
    }
    setSuggestionActionSource(source);
    if (ttl > 0) {
      suggestionActionSourceTimerRef.current = setTimeout(() => {
        setSuggestionActionSource('');
        suggestionActionSourceTimerRef.current = null;
      }, ttl);
    }
  }, []);

  const resetSuggestionFlowState = React.useCallback(() => {
    setShowSuggestions(false);
    setSuggestions([]);
    setSuggestLoading(false);
    setIsSyncingAfterSuggestion(false);
    setSuggestionStageTrace([]);
    setSuggestionStatus({ tone: '', text: '' });
    setSuggestionSyncError('');
    setSuggestionSyncRecovered(false);
    if (suggestionActionSourceTimerRef.current) {
      clearTimeout(suggestionActionSourceTimerRef.current);
      suggestionActionSourceTimerRef.current = null;
    }
    if (suggestionRecoveredTimerRef.current) {
      clearTimeout(suggestionRecoveredTimerRef.current);
      suggestionRecoveredTimerRef.current = null;
    }
    setSuggestionActionSource('');
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      return () => {
        if (suggestionStatusTimerRef.current) {
          clearTimeout(suggestionStatusTimerRef.current);
          suggestionStatusTimerRef.current = null;
        }
        setShowFilters(false);
        setShowLayoutOptions(false);
        setSelectedNode(null);
        dispatch(setCurrentNode(null));
        dispatch(setVisualization({
          zoomLevel: 1,
          centerNode: null,
          highlightedNodes: [],
          secondDegreeHighlightedNodes: [],
          highlightedEdges: [],
        }));
        resetSuggestionFlowState();
        setToastMessage('');
      };
    }, [dispatch, resetSuggestionFlowState])
  );

  // 处理节点点击
  const handleNodePress = (node) => {
    setSelectedNode(node);
    resetSuggestionFlowState();
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
      navigateToRoot('CardNote', { noteId: node.id, title: node.title || '卡片笔记' });
    }
  };

  // 切换布局
  const changeLayout = (newLayout) => {
    if (isLoading) {return;}
    dispatch(setLayout(newLayout));
    setShowLayoutOptions(false);
  };

  // 应用过滤器
  const applyFilters = (newFilters) => {
    if (isLoading) {return;}
    dispatch(setFilters(newFilters));
    setShowFilters(false);
  };

  // 重置视图
  const resetView = () => {
    if (isLoading) {return;}
    dispatch(setVisualization({
      zoomLevel: 1,
      centerNode: null,
      highlightedNodes: [],
      secondDegreeHighlightedNodes: [],
      highlightedEdges: [],
    }));
    setSelectedNode(null);
    resetSuggestionFlowState();
  };

  const toggleLayoutOptions = () => {
    if (isLoading) {return;}
    setShowLayoutOptions(prev => !prev);
    setShowFilters(false);
  };

  const toggleFiltersPanel = () => {
    if (isLoading) {return;}
    setShowFilters(prev => !prev);
    setShowLayoutOptions(false);
  };

  const setForceLayout = () => {
    changeLayout('force');
  };

  const setHierarchicalLayout = () => {
    changeLayout('hierarchical');
  };

  const setCircularLayout = () => {
    changeLayout('circular');
  };

  const clearToastMessage = () => setToastMessage('');
  const isErrorToastMessage = (message) => message.includes('失败');

  const toggleNodeTypeFilter = (type) => {
    if (isLoading) {return;}
    const newNodeTypes = filters.nodeTypes.includes(type)
      ? filters.nodeTypes.filter(t => t !== type)
      : [...filters.nodeTypes, type];
    applyFilters({ ...filters, nodeTypes: newNodeTypes });
  };

  const openKnowledgeAnalysis = () => {
    if (isLoading) {return;}
    navigateToRoot('KnowledgeAnalysis');
  };

  const openNodeDetail = () => {
    if (isLoading || !selectedNode) {return;}
    navigateToRoot('NodeDetail', { nodeId: selectedNode?.id });
  };

  const handleGoBack = () => {
    if (isLoading) {return;}
    navigation.goBack();
  };

  const openProfile = () => {
    navigateToRoot('Profile');
  };

  const openNoteEdit = () => {
    navigateHomeStackScreen('CardNote', {
      createNew: true,
      title: '新建笔记',
      content: '',
    });
  };

  const openKnowledgeAnalysisFromEmpty = () => {
    navigateToRoot('KnowledgeAnalysis');
  };

  const clearSelectedNode = () => {
    if (isLoading) {return;}
    setSelectedNode(null);
    resetSuggestionFlowState();
  };

  const openSelectedNoteEditor = () => {
    if (!selectedNode || !selectedNode.id || selectedNode.type !== 'note') {
      setToastMessage('当前节点不支持直接编辑');
      return;
    }
    navigateHomeStackScreen('CardNote', { noteId: selectedNode.id, title: selectedNode.title || '卡片笔记' });
  };

  const navigateToRoot = (routeName, params) => {
    if (navigationRef.current?.navigate) {
      navigationRef.current.navigate(routeName, params);
      return;
    }
    navigation.navigate(routeName, params);
  };

  const openEdgeSuggestions = async () => {
    if (!selectedNode || suggestLoading || isSyncingAfterSuggestion || isLoading) {return;}
    try {
      resetSuggestionFlowState();
      markSuggestionActionSource('openSuggestions');
      setSuggestLoading(true);
      pushSuggestionStageTrace('loading');
      const list = await suggestEdges(selectedNode.id, 10);
      setSuggestions(Array.isArray(list) ? list : []);
      setShowSuggestions(true);
    } catch (e) {
      pushSuggestionStatus('error', '获取候选边失败');
      setToastMessage(`获取候选边失败: ${e.message}`);
    } finally {
      setSuggestLoading(false);
    }
  };

  const acceptAllSuggestions = async () => {
    if (suggestLoading || isSyncingAfterSuggestion || isLoading || !Array.isArray(suggestions) || suggestions.length === 0) {
      return;
    }
    try {
      setSuggestLoading(true);
      markSuggestionActionSource('acceptAll');
      clearSuggestionSyncFlags();
      const res = await acceptSuggestions(suggestions.map(s => ({
        source: s.source, target: s.target, type: s.type,
        confidence: s.confidence, evidence: s.evidence || [],
      })));
      pushSuggestionStatus('success', `已采纳 ${res.accepted} 条候选边`);
      setToastMessage(`采纳成功 ${res.accepted} 条`);
      setSuggestions([]);
      setShowSuggestions(false);
      setIsSyncingAfterSuggestion(true);
      const refreshResult = await dispatch(fetchKnowledgeGraph(effectiveKbId ? { ...filters, kbId: effectiveKbId } : filters));
      if (fetchKnowledgeGraph.rejected.match(refreshResult)) {
        pushSuggestionStageTrace('syncError');
        setSuggestionSyncError('建议已提交，但图谱同步失败，请手动重试。');
        pushSuggestionStatus('error', '图谱同步失败');
      } else {
        pushSuggestionStageTrace('ready');
        clearSuggestionSyncFlags();
      }
    } catch (e) {
      pushSuggestionStatus('error', '采纳候选边失败');
      setToastMessage(`采纳失败: ${e.message}`);
    } finally {
      setIsSyncingAfterSuggestion(false);
      setSuggestLoading(false);
    }
  };

  const ignoreAllSuggestions = async () => {
    if (suggestLoading || isSyncingAfterSuggestion || isLoading || !Array.isArray(suggestions) || suggestions.length === 0) {
      return;
    }
    try {
      setSuggestLoading(true);
      markSuggestionActionSource('ignoreAll');
      clearSuggestionSyncFlags();
      const res = await ignoreSuggestions(suggestions.map(s => ({
        source: s.source, target: s.target, type: s.type,
      })));
      pushSuggestionStatus('success', `已忽略 ${res.ignored} 条候选边`);
      setToastMessage(`忽略成功 ${res.ignored} 条`);
      setSuggestions([]);
      setShowSuggestions(false);
      setIsSyncingAfterSuggestion(true);
      const refreshResult = await dispatch(fetchKnowledgeGraph(effectiveKbId ? { ...filters, kbId: effectiveKbId } : filters));
      if (fetchKnowledgeGraph.rejected.match(refreshResult)) {
        pushSuggestionStageTrace('syncError');
        setSuggestionSyncError('建议已提交，但图谱同步失败，请手动重试。');
        pushSuggestionStatus('error', '图谱同步失败');
      } else {
        pushSuggestionStageTrace('ready');
        clearSuggestionSyncFlags();
      }
    } catch (e) {
      pushSuggestionStatus('error', '忽略候选边失败');
      setToastMessage(`忽略失败: ${e.message}`);
    } finally {
      setIsSyncingAfterSuggestion(false);
      setSuggestLoading(false);
    }
  };

  const retryKnowledgeGraphSync = async () => {
    if (isSyncingAfterSuggestion || suggestLoading || isLoading) {
      return;
    }
    try {
      setIsSyncingAfterSuggestion(true);
      markSuggestionActionSource('retrySync');
      clearSuggestionSyncFlags();
      const refreshResult = await dispatch(fetchKnowledgeGraph(effectiveKbId ? { ...filters, kbId: effectiveKbId } : filters));
      if (fetchKnowledgeGraph.rejected.match(refreshResult)) {
        pushSuggestionStageTrace('syncError');
        setSuggestionSyncError('图谱同步仍失败，请稍后再试。');
        pushSuggestionStatus('error', '图谱同步失败');
      } else {
        pushSuggestionStageTrace('recovered');
        setSuggestionSyncRecovered(true);
        pushSuggestionStatus('success', '图谱同步成功');
        if (suggestionRecoveredTimerRef.current) {
          clearTimeout(suggestionRecoveredTimerRef.current);
          suggestionRecoveredTimerRef.current = null;
        }
        suggestionRecoveredTimerRef.current = setTimeout(() => {
          setSuggestionSyncRecovered(false);
          suggestionRecoveredTimerRef.current = null;
        }, 2200);
      }
    } finally {
      setIsSyncingAfterSuggestion(false);
    }
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

  const renderTopChrome = () => (
    <>
      {!isEmbedded && (
        <View style={[styles.headerBar, { paddingTop: Math.max(insets.top, 8) }]}>
          <ScreenHeaderBackButton
            onPress={handleGoBack}
            testID="action.knowledgeGraph.back"
            style={styles.backButton}
          />
          <Text style={styles.headerTitle}>知识图谱</Text>
          <View style={styles.headerRight} />
        </View>
      )}

      <View style={styles.toolbar}>
        {showLayoutOptions ? (
          <View testID="state.knowledgeGraph.layoutPanel.open" />
        ) : (
          <View testID="state.knowledgeGraph.layoutPanel.closed" />
        )}
        {showFilters ? (
          <View testID="state.knowledgeGraph.filtersPanel.open" />
        ) : (
          <View testID="state.knowledgeGraph.filtersPanel.closed" />
        )}
        <TouchableOpacity
          style={[styles.toolbarButton, isLoading ? styles.actionDisabled : null]}
          onPress={toggleLayoutOptions}
          disabled={isLoading}
          testID="action.knowledgeGraph.layout"
        >
          <Icon name="bubble-chart" size={24} color={colors.text} />
          <Text style={styles.toolbarButtonText}>布局</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.toolbarButton, isLoading ? styles.actionDisabled : null]}
          onPress={toggleFiltersPanel}
          disabled={isLoading}
          testID="action.knowledgeGraph.filter"
        >
          <Icon name="filter-list" size={24} color={colors.text} />
          <Text style={styles.toolbarButtonText}>筛选</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.toolbarButton, isLoading ? styles.actionDisabled : null]}
          onPress={resetView}
          disabled={isLoading}
          testID="action.knowledgeGraph.reset"
        >
          <Icon name="refresh" size={24} color={colors.text} />
          <Text style={styles.toolbarButtonText}>重置</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.toolbarButton, isLoading ? styles.actionDisabled : null]}
          onPress={openKnowledgeAnalysis}
          disabled={isLoading}
          testID="action.knowledgeGraph.analysis"
        >
          <Icon name="analytics" size={24} color={colors.text} />
          <Text style={styles.toolbarButtonText}>分析</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.toolbarButton, (isLoading || !selectedNode) ? styles.actionDisabled : null]}
          onPress={openNodeDetail}
          disabled={isLoading || !selectedNode}
          testID="action.knowledgeGraph.detail"
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

      <View testID={`state.knowledgeGraph.layout.current.${layout || 'unknown'}`} />
      <View style={styles.layoutStateBanner} testID="state.knowledgeGraph.layout.currentText">
        <Icon name="view-module" size={13} color="#1D4ED8" />
        <Text style={styles.layoutStateBannerText}>当前布局：{layoutLabel}</Text>
      </View>

      {showLayoutOptions && (
        <View style={styles.optionsContainer} testID="panel.knowledgeGraph.layoutOptions">
          <TouchableOpacity
            style={[styles.optionButton, layout === 'force' && styles.activeOption]}
            onPress={setForceLayout}
            testID="action.knowledgeGraph.layout.force"
          >
            <Text style={styles.optionText}>力导向</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.optionButton, layout === 'hierarchical' && styles.activeOption]}
            onPress={setHierarchicalLayout}
            testID="action.knowledgeGraph.layout.hierarchical"
          >
            <Text style={styles.optionText}>层级</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.optionButton, layout === 'circular' && styles.activeOption]}
            onPress={setCircularLayout}
            testID="action.knowledgeGraph.layout.circular"
          >
            <Text style={styles.optionText}>环形</Text>
          </TouchableOpacity>
        </View>
      )}

      {showFilters && (
        <View style={styles.filtersContainer} testID="panel.knowledgeGraph.filters">
          <Text style={styles.filterTitle}>节点类型</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {['note', 'tag', 'category', 'concept'].map(type => (
              <TouchableOpacity
                key={type}
                style={[styles.filterChip, filters.nodeTypes.includes(type) && styles.activeFilterChip]}
                onPress={() => toggleNodeTypeFilter(type)}
                disabled={isLoading}
                testID={`filter.knowledgeGraph.nodeType.${type}`}
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
    </>
  );

  // 渲染加载状态


  if (isLoading && (!nodes || nodes.length === 0)) {
    return (
      <SafeAreaView style={styles.container} testID="screen.knowledgeGraph">
        {renderTopChrome()}
        <View style={styles.errorContainer}>
          <Loading text="加载知识图谱中..." />
        </View>
      </SafeAreaView>
    );
  }

  // 渲染错误状态（仅非网络错误展示阻断失败页）
  if (error && (!nodes || nodes.length === 0)) {
    return (
      <SafeAreaView style={styles.container} testID="screen.knowledgeGraph">
        {renderTopChrome()}
        <View style={styles.errorContainer} testID="state.knowledgeGraph.error">
          <Icon name="error-outline" size={50} color={colors.error} />
          <Text style={styles.errorText}>加载失败: {error}</Text>
          <Button title="重试" onPress={loadKnowledgeGraph} testID="action.knowledgeGraph.retry" />
        </View>
      </SafeAreaView>
    );
  }

  if (authRequired && (!nodes || nodes.length === 0)) {
    return (
      <SafeAreaView style={styles.container} testID="screen.knowledgeGraph">
        {renderTopChrome()}
        <View style={styles.emptyContainer} testID="state.knowledgeGraph.authRequired">
          <Icon name="lock-outline" size={80} color={colors.warning} />
          <Text style={styles.emptyText}>登录状态已失效</Text>
          <Text style={styles.emptySubText}>{authMessage || '请重新登录后再查看知识图谱'}</Text>
          <Button
            title="前往我的"
            onPress={openProfile}
            style={styles.createButton}
            testID="action.knowledgeGraph.goProfile"
            disabled={isLoading}
          />
        </View>
      </SafeAreaView>
    );
  }

  // 渲染空状态（包含弱网离线空图提示）
  if (!nodes || nodes.length === 0) {
    return (
      <SafeAreaView style={styles.container} testID="screen.knowledgeGraph">
        {renderTopChrome()}
        <View style={styles.emptyContainer} testID="state.knowledgeGraph.empty">
          <Icon name="bubble-chart" size={80} color={colors.textSecondary} />
          <Text style={styles.emptyText}>暂无知识图谱数据</Text>
          <Text style={styles.emptySubText}>创建更多笔记和连接，构建您的知识网络</Text>
          {networkFallbackMessage ? (
            <Text style={styles.networkHintText} testID="state.knowledgeGraph.networkFallback">{networkFallbackMessage}</Text>
          ) : null}
          <Button
            title="创建笔记"
            onPress={openNoteEdit}
            style={styles.createButton}
            testID="action.knowledgeGraph.createNote"
            disabled={isLoading}
          />
          <Button
            title="分析"
            onPress={openKnowledgeAnalysisFromEmpty}
            style={styles.createButton}
            testID="action.knowledgeGraph.analysis"
            disabled={isLoading}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} testID="screen.knowledgeGraph">
      {renderTopChrome()}

      <GraphVisualization
        nodes={renderNodes}
        edges={renderEdges}
        visualization={visualization}
        onNodePress={handleNodePress}
        onNodeLongPress={handleNodeDoubleTap}
      />

      {selectedNode && (
        <View style={styles.nodeInfoContainer} testID="panel.knowledgeGraph.nodeInfo">
          <View testID={`state.knowledgeGraph.selectedNode.type.${selectedNode.type || 'unknown'}`} />
          <View testID={`state.knowledgeGraph.selectedNode.id.${selectedNode.id || 'none'}`} />
          <View style={styles.nodeInfoHeader}>
            <View
              style={[styles.nodeTypeIndicator, { backgroundColor: getNodeColorByType(selectedNode.type) }]}
            />
            <Text style={styles.nodeTitle}>{selectedNode.label || selectedNode.title}</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={clearSelectedNode}
              disabled={isLoading}
              testID="action.knowledgeGraph.closeNodeInfo"
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
              onPress={openSelectedNoteEditor}
              testID="action.knowledgeGraph.editNode"
            >
              <Icon name="edit" size={20} color={colors.primary} />
              <Text style={styles.nodeActionText}>编辑</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.nodeActionButton}
              onPress={openEdgeSuggestions}
              disabled={suggestLoading || isLoading}
              testID="action.knowledgeGraph.openSuggestions"
            >
              <Icon name="lightbulb-outline" size={20} color={colors.primary} />
              <Text style={styles.nodeActionText}>建议</Text>
            </TouchableOpacity>

            {showSuggestions && suggestions.length > 0 && (
              <>
                <TouchableOpacity
                  style={styles.nodeActionButton}
                  onPress={acceptAllSuggestions}
                  disabled={suggestLoading || isLoading}
                  testID="action.knowledgeGraph.acceptAllSuggestions"
                >
                  <Icon name="check-circle" size={20} color={colors.primary} />
                  <Text style={styles.nodeActionText}>采纳全部</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.nodeActionButton}
                  onPress={ignoreAllSuggestions}
                  disabled={suggestLoading || isLoading}
                  testID="action.knowledgeGraph.ignoreAllSuggestions"
                >
                  <Icon name="block" size={20} color={colors.error} />
                  <Text style={[styles.nodeActionText, { color: colors.error }]}>忽略全部</Text>
                </TouchableOpacity>
              </>
            )}

          </View>

          {showSuggestions && (
            <View style={styles.suggestionsPanel} testID="panel.knowledgeGraph.suggestions">
              <View
                style={styles.suggestionStageChip}
                testID={`state.knowledgeGraph.suggestionsStage.${
                  suggestLoading
                    ? 'loading'
                    : isSyncingAfterSuggestion
                      ? 'syncing'
                      : suggestionSyncError
                        ? 'syncError'
                        : suggestionSyncRecovered
                          ? 'recovered'
                          : suggestions.length > 0
                            ? 'ready'
                            : 'empty'
                }`}
              >
                <Text style={styles.suggestionStageChipText} testID="state.knowledgeGraph.suggestionsStageText">
                  {suggestLoading
                    ? '阶段：加载候选中'
                    : isSyncingAfterSuggestion
                      ? '阶段：同步图谱中'
                      : suggestionSyncError
                        ? '阶段：同步失败'
                        : suggestionSyncRecovered
                          ? '阶段：同步已恢复'
                          : suggestions.length > 0
                            ? '阶段：候选已就绪'
                            : '阶段：无候选'}
                </Text>
              </View>
              {suggestionStageTrace.length > 0 ? (
                <View style={styles.suggestionStageTrace} testID="state.knowledgeGraph.suggestionsStageTrace">
                  <Text style={styles.suggestionStageTraceText}>
                    最近阶段：{suggestionStageTrace.join(' -> ')}
                  </Text>
                </View>
              ) : null}
              {suggestionStatus.text ? (
                <View
                  style={[
                    styles.suggestionStatusBanner,
                    suggestionStatus.tone === 'error' ? styles.suggestionStatusBannerError : styles.suggestionStatusBannerSuccess,
                  ]}
                  testID={`state.knowledgeGraph.suggestions.${suggestionStatus.tone || 'info'}`}
                >
                  <Icon
                    name={suggestionStatus.tone === 'error' ? 'error-outline' : 'check-circle-outline'}
                    size={14}
                    color={suggestionStatus.tone === 'error' ? '#B91C1C' : '#166534'}
                  />
                  <Text style={styles.suggestionStatusText}>{suggestionStatus.text}</Text>
                </View>
              ) : null}
              {suggestionActionSource ? (
                <>
                  <View testID={`state.knowledgeGraph.suggestionActionSource.${suggestionActionSource}`} />
                  {suggestionActionSourceLabel ? (
                    <View style={styles.suggestionSourceBanner} testID="state.knowledgeGraph.suggestionActionSourceText">
                      <Icon name="info-outline" size={13} color="#1D4ED8" />
                      <Text style={styles.suggestionSourceBannerText}>{suggestionActionSourceLabel}</Text>
                    </View>
                  ) : null}
                </>
              ) : null}
              <View testID={`state.knowledgeGraph.suggestionActionSource.visibility.${suggestionActionSourceLabel ? 'visible' : 'hidden'}`} />
              <Text style={{ color: colors.text, fontWeight: '600', marginBottom: 6 }}>
                候选边（{suggestions.length}）{suggestLoading ? ' · 加载中...' : ''}
              </Text>
              <View style={styles.suggestionCountBanner} testID={`state.knowledgeGraph.suggestions.count.${suggestions.length}`}>
                <Icon name="tag" size={13} color="#1D4ED8" />
                <Text style={styles.suggestionCountBannerText}>
                  候选数量：{suggestions.length}
                </Text>
              </View>
              <View testID={`state.knowledgeGraph.suggestions.count.visibility.${showSuggestions ? 'visible' : 'hidden'}`} />
              {suggestLoading ? (
                <View style={styles.suggestionsLoading} testID="state.knowledgeGraph.suggestionsLoading">
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={{ color: colors.textSecondary, marginLeft: 8, fontSize: 12 }}>正在获取候选边...</Text>
                </View>
              ) : null}
              {!suggestLoading && suggestions.length === 0 ? (
                <View style={styles.suggestionsEmpty} testID="state.knowledgeGraph.suggestionsEmpty">
                  <Text style={{ color: colors.textSecondary, fontSize: 12 }}>暂无候选边，请稍后重试。</Text>
                </View>
              ) : null}
              {suggestLoading ? (
                <View style={styles.suggestionsBusyHint} testID="state.knowledgeGraph.suggestionsBusy">
                  <Text style={{ color: colors.textSecondary, fontSize: 12 }}>建议处理中，请勿重复点击。</Text>
                </View>
              ) : null}
              {isSyncingAfterSuggestion ? (
                <View style={styles.suggestionsBusyHint} testID="state.knowledgeGraph.suggestionsSyncing">
                  <Text style={{ color: colors.textSecondary, fontSize: 12 }}>已提交建议，正在同步图谱...</Text>
                </View>
              ) : null}
              {suggestionSyncError ? (
                <View style={styles.suggestionsSyncError} testID="state.knowledgeGraph.suggestionsSyncError">
                  <Icon name="error-outline" size={14} color="#B91C1C" />
                  <Text style={styles.suggestionsSyncErrorText}>{suggestionSyncError}</Text>
                  <TouchableOpacity
                    onPress={retryKnowledgeGraphSync}
                    disabled={isSyncingAfterSuggestion || suggestLoading || isLoading}
                    testID="action.knowledgeGraph.retrySuggestionSync"
                  >
                    <Text style={[
                      styles.suggestionsSyncRetryText,
                      (isSyncingAfterSuggestion || suggestLoading || isLoading) ? styles.suggestionsSyncRetryTextDisabled : null,
                    ]}
                    >
                      {isSyncingAfterSuggestion ? '重试中...' : '重试同步'}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : null}
              {suggestionSyncError && !isSyncingAfterSuggestion && !suggestLoading && !isLoading ? (
                <View style={styles.suggestionsBusyHint} testID="state.knowledgeGraph.suggestionsSyncRetryReady">
                  <Text style={{ color: colors.textSecondary, fontSize: 12 }}>可再次点击“重试同步”继续恢复图谱。</Text>
                </View>
              ) : null}
              {suggestionSyncError && isSyncingAfterSuggestion ? (
                <View style={styles.suggestionsBusyHint} testID="state.knowledgeGraph.suggestionsSyncRetrying">
                  <Text style={{ color: colors.textSecondary, fontSize: 12 }}>正在重试同步图谱，请稍候...</Text>
                </View>
              ) : null}
              {suggestionSyncRecovered ? (
                <View style={styles.suggestionsSyncRecovered} testID="state.knowledgeGraph.suggestionsSyncRecovered">
                  <Icon name="check-circle-outline" size={14} color="#166534" />
                  <Text style={styles.suggestionsSyncRecoveredText}>图谱同步已恢复</Text>
                </View>
              ) : null}
              {suggestionBusyLabel ? (
                <View style={styles.suggestionBusyBanner} testID="state.knowledgeGraph.suggestionsBusyText">
                  <Icon name="schedule" size={13} color="#1D4ED8" />
                  <Text style={styles.suggestionBusyBannerText}>{suggestionBusyLabel}</Text>
                </View>
              ) : null}
              <View testID={`state.knowledgeGraph.suggestionsBusyText.visibility.${suggestionBusyLabel ? 'visible' : 'hidden'}`} />
              {showSuggestions
                && !suggestLoading
                && !isSyncingAfterSuggestion
                && !suggestionSyncError
                && !suggestionSyncRecovered
                && suggestions.length > 0 ? (
                  <View style={styles.suggestionsBusyHint} testID="state.knowledgeGraph.suggestionsReady">
                    <Text style={{ color: colors.textSecondary, fontSize: 12 }}>候选边已就绪，可执行采纳或忽略操作。</Text>
                  </View>
                ) : null}
              <ScrollView style={{ maxHeight: 200 }}>
                {suggestions.map((s, idx) => (
                  <View
                    key={`${s.source}-${s.target}-${idx}`}
                    style={styles.suggestionRow}
                    testID={`item.knowledgeGraph.suggestion.${idx}`}
                  >
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

      {toastMessage ? (
        <Toast
          message={toastMessage}
          onDismiss={clearToastMessage}
          type={isErrorToastMessage(toastMessage) ? 'error' : 'success'}
        />
      ) : null}
    </SafeAreaView>
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
    paddingVertical: 10,
    paddingTop: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
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
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.90)',
    borderBottomWidth: 1,
    borderBottomColor: colors.primary + '30',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 3,
  },
  toolbarButton: {
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.75)',
    borderWidth: 1,
    borderColor: colors.primary + '24',
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
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderBottomWidth: 1,
    borderBottomColor: colors.primary + '2A',
  },
  optionButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 10,
    borderRadius: 16,
    backgroundColor: colors.card + 'F2',
    borderWidth: 1,
    borderColor: colors.primary + '26',
  },
  activeOption: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  optionText: {
    color: colors.text,
    fontSize: 14,
  },
  layoutStateBanner: {
    marginHorizontal: 12,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(29,78,216,0.22)',
    backgroundColor: 'rgba(255,255,255,0.84)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  layoutStateBannerText: {
    color: '#1E3A8A',
    fontSize: 12,
    fontWeight: '600',
  },
  filtersContainer: {
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderBottomWidth: 1,
    borderBottomColor: colors.primary + '2A',
  },
  filterStateBanner: {
    marginHorizontal: 12,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(29,78,216,0.22)',
    backgroundColor: 'rgba(255,255,255,0.84)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  filterStateBannerText: {
    color: '#1E3A8A',
    fontSize: 12,
    fontWeight: '600',
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
    backgroundColor: colors.card + 'F2',
    borderWidth: 1,
    borderColor: colors.primary + '26',
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
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderTopWidth: 1,
    borderTopColor: colors.primary + '30',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 3,
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
    backgroundColor: colors.card + 'E8',
    borderWidth: 1,
    borderColor: colors.primary + '20',
    margin: 14,
    borderRadius: 20,
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
  suggestionsPanel: {
    marginTop: 10,
    backgroundColor: 'rgba(255,255,255,0.86)',
    borderWidth: 1,
    borderColor: colors.primary + '30',
    borderRadius: 16,
    padding: 12,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 3,
  },
  suggestionsLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  suggestionsEmpty: {
    paddingVertical: 10,
  },
  suggestionsBusyHint: {
    paddingVertical: 6,
  },
  suggestionsSyncError: {
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  suggestionsSyncErrorText: {
    color: '#B91C1C',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  suggestionsSyncRetryText: {
    color: '#1D4ED8',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 8,
  },
  suggestionsSyncRetryTextDisabled: {
    opacity: 0.6,
  },
  suggestionsSyncRecovered: {
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    backgroundColor: '#F0FDF4',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  suggestionsSyncRecoveredText: {
    color: '#166534',
    fontSize: 12,
    fontWeight: '600',
  },
  suggestionRow: {
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  suggestionStatusBanner: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  suggestionStatusBannerSuccess: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  suggestionStatusBannerError: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  suggestionStatusText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  suggestionStageChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.primary + '30',
    backgroundColor: colors.card + 'EE',
    marginBottom: 8,
  },
  suggestionStageChipText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  suggestionStageTrace: {
    marginBottom: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary + '20',
    backgroundColor: colors.card + 'F2',
  },
  suggestionStageTraceText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '500',
  },
  suggestionBusyBanner: {
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(29,78,216,0.22)',
    backgroundColor: 'rgba(255,255,255,0.84)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  suggestionBusyBannerText: {
    color: '#1E3A8A',
    fontSize: 12,
    fontWeight: '600',
  },
  suggestionSourceBanner: {
    marginBottom: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(29,78,216,0.22)',
    backgroundColor: 'rgba(255,255,255,0.84)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  suggestionSourceBannerText: {
    color: '#1E3A8A',
    fontSize: 12,
    fontWeight: '600',
  },
  suggestionCountBanner: {
    marginBottom: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(29,78,216,0.22)',
    backgroundColor: 'rgba(255,255,255,0.84)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  suggestionCountBannerText: {
    color: '#1E3A8A',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default KnowledgeGraphScreen;
