/**
 * 知识图谱分析屏幕
 * 用于分析知识图谱结构、查找路径和相关概念
 * 提供自动分类、知识图谱构建和分析功能
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  FlatList,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import Icon from 'react-native-vector-icons/MaterialIcons';

// 导入Redux相关
import {
  selectNodes,
  selectEdges,
  selectIsLoading,
  selectError,
  fetchKnowledgeGraph,
} from '../../redux/slices/knowledgeGraphSlice';

// 导入API服务
import * as knowledgeGraphApi from '../../services/api/knowledgeGraphApi';
import autoClassificationApi from '../../services/api/autoClassificationApi';

// 导入常量和工具函数
import { useTheme } from '../../context/ThemeContext';
import { SPACING, TYPOGRAPHY } from '../../styles/constants';

// 导入组件
import { Button, Loading, Toast } from '../../components/common';
import {
  PathVisualization,
  StructureAnalysis,
  RelatedConceptsView,
  AutoClassification,
  KnowledgeGraphBuilder,
} from '../../components/knowledge';

/**
 * 知识图谱分析屏幕组件
 */
const KnowledgeAnalysisScreen = ({ navigation }) => {
  const dispatch = useDispatch();

  // 获取主题颜色
  const { colors } = useTheme();

  // 获取动态样式
  const dynamicStyles = getStyles(colors);

  // 从Redux获取状态
  const nodes = useSelector(selectNodes);
  const edges = useSelector(selectEdges);
  const isLoading = useSelector(selectIsLoading);
  const error = useSelector(selectError);

  // 本地状态
  const [activeTab, setActiveTab] = useState('auto-classification'); // 'auto-classification', 'graph-builder', 'structure', 'path', 'concepts'
  const [toastMessage, setToastMessage] = useState('');
  const [analysisData, setAnalysisData] = useState(null);
  const [pathData, setPathData] = useState(null);
  const [conceptsData, setConceptsData] = useState(null);
  const [selectedSourceNode, setSelectedSourceNode] = useState(null);
  const [selectedTargetNode, setSelectedTargetNode] = useState(null);
  const [selectedConceptNode, setSelectedConceptNode] = useState(null);
  const [showNodePicker, setShowNodePicker] = useState(false);
  const [pickerType, setPickerType] = useState('source');
  const [pickerTitle, setPickerTitle] = useState('选择节点');
  const [isAnalysisLoading, setIsAnalysisLoading] = useState(false);
  const [isPathLoading, setIsPathLoading] = useState(false);
  const [isConceptsLoading, setIsConceptsLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState(null);
  const [pathError, setPathError] = useState(null);
  const [conceptsError, setConceptsError] = useState(null);

  // 获取路由参数
  const noteId = route?.params?.noteId;
  const noteTitle = route?.params?.noteTitle;

  // 初始化加载知识图谱数据
  useEffect(() => {
    loadKnowledgeGraph();
  }, []);

  // 加载知识图谱数据
  const loadKnowledgeGraph = async () => {
    try {
      await dispatch(fetchKnowledgeGraph()).unwrap();
      // 加载结构分析数据
      if (activeTab === 'structure') {
        loadStructureAnalysis();
      }
    } catch (err) {
      setToastMessage('加载知识图谱失败: ' + (err.message || '请稍后重试'));
    }
  };

  // 加载结构分析数据
  const loadStructureAnalysis = async () => {
    setIsAnalysisLoading(true);
    setAnalysisError(null);

    try {
      const response = await knowledgeGraphApi.analyzeStructure();
      setAnalysisData(response);
    } catch (err) {
      setAnalysisError('加载分析数据失败: ' + (err.message || '请稍后重试'));
    } finally {
      setIsAnalysisLoading(false);
    }
  };

  // 查找路径
  const findPath = async () => {
    if (!selectedSourceNode || !selectedTargetNode) {
      setPathError('请选择源节点和目标节点');
      return;
    }

    setIsPathLoading(true);
    setPathError(null);

    try {
      const response = await knowledgeGraphApi.findPath(selectedSourceNode.id, selectedTargetNode.id);
      setPathData(response.path);
    } catch (err) {
      setPathError('查找路径失败: ' + (err.message || '请稍后重试'));
    } finally {
      setIsPathLoading(false);
    }
  };

  // 查找相关概念
  const findRelatedConcepts = async () => {
    if (!selectedConceptNode) {
      setConceptsError('请选择一个知识点');
      return;
    }

    setIsConceptsLoading(true);
    setConceptsError(null);

    try {
      const response = await knowledgeGraphApi.getRelatedConcepts(selectedConceptNode.id);
      setConceptsData({
        concepts: response,
        centerNode: selectedConceptNode,
      });
    } catch (err) {
      setConceptsError('查找相关概念失败: ' + (err.message || '请稍后重试'));
    } finally {
      setIsConceptsLoading(false);
    }
  };

  // 处理节点选择
  const handleNodeSelect = (node, type) => {
    switch (type) {
      case 'source':
        setSelectedSourceNode(node);
        break;
      case 'target':
        setSelectedTargetNode(node);
        break;
      case 'concept':
        setSelectedConceptNode(node);
        break;
      default:
        break;
    }
  };

  // 处理节点点击
  const handleNodePress = (node) => {
    navigation.navigate('NodeDetail', { nodeId: node.id });
  };

  // 切换标签页
  const handleTabChange = (tab) => {
    setActiveTab(tab);

    // 加载对应标签页的数据
    switch (tab) {
      case 'structure':
        if (!analysisData && !isAnalysisLoading) {
          loadStructureAnalysis();
        }
        break;
      case 'path':
        // 路径查找需要用户选择节点后手动触发
        break;
      case 'concepts':
        // 相关概念需要用户选择节点后手动触发
        break;
      case 'auto-classification':
        // 自动分类不需要预加载数据
        break;
      case 'graph-builder':
        // 知识图谱构建不需要预加载数据
        break;
      default:
        break;
    }
  };

  // 处理标签选择
  const handleTagsSelected = (tags) => {
    // 导航到笔记编辑页面，并传递选中的标签
    // 使用嵌套导航，确保导航到正确的笔记编辑屏幕
    navigation.navigate('Notes', {
      screen: 'NoteEdit',
      params: {
        noteId,
        selectedTags: tags,
      },
    });
  };

  // 处理分类选择
  const handleCategorySelected = (category) => {
    // 导航到笔记编辑页面，并传递选中的分类
    // 使用嵌套导航，确保导航到正确的笔记编辑屏幕
    navigation.navigate('Notes', {
      screen: 'NoteEdit',
      params: {
        noteId,
        selectedCategory: category,
      },
    });
  };

  // 处理笔记选择
  const handleNoteSelected = (note) => {
    // 导航到笔记详情页面
    // 使用嵌套导航，确保导航到正确的笔记详情屏幕
    navigation.navigate('Notes', {
      screen: 'NotesList',
      params: {
        initialNoteId: note.id,
        title: note.title,
      },
    });
  };

  // 渲染加载状态
  if (isLoading && nodes.length === 0) {
    return <Loading text="加载知识图谱数据中..." />;
  }

  // 渲染错误状态
  if (error && nodes.length === 0) {
    return (
      <View style={dynamicStyles.errorContainer}>
        <Icon name="error-outline" size={50} color={colors.error} />
        <Text style={dynamicStyles.errorText}>加载失败: {error}</Text>
        <Button title="重试" onPress={loadKnowledgeGraph} />
      </View>
    );
  }

  // 渲染空状态
  if (nodes.length === 0) {
    return (
      <View style={dynamicStyles.emptyContainer}>
        <Icon name="bubble-chart" size={80} color={colors.textSecondary} />
        <Text style={dynamicStyles.emptyText}>暂无知识图谱数据</Text>
        <Text style={dynamicStyles.emptySubText}>创建更多笔记和连接，构建您的知识网络</Text>
        <Button
          title="创建笔记"
          onPress={() => navigation.navigate('Notes', { screen: 'NoteEdit' })}
          style={dynamicStyles.createButton}
        />
      </View>
    );
  }

  // 渲染节点选择器
  const renderNodeSelector = (type, selectedNode, placeholder) => (
    <TouchableOpacity
      style={dynamicStyles.nodeSelector}
      onPress={() => {
        setPickerType(type);
        setPickerTitle(placeholder);
        setShowNodePicker(true);
      }}
    >
      {selectedNode ? (
        <View style={dynamicStyles.selectedNodeContainer}>
          <View
            style={[dynamicStyles.nodeTypeIndicator, { backgroundColor: getNodeColorByType(selectedNode.type) }]}
          />
          <Text style={dynamicStyles.selectedNodeText}>{selectedNode.title}</Text>
        </View>
      ) : (
        <Text style={dynamicStyles.placeholderText}>{placeholder}</Text>
      )}
      <Icon name="arrow-drop-down" size={24} color={colors.text} />
    </TouchableOpacity>
  );

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

  return (
    <View style={dynamicStyles.container}>
      {/* 选项卡 */}
      <View style={dynamicStyles.tabContainer}>
        {/* 自动分类标签页 */}
        <TouchableOpacity
          style={[dynamicStyles.tab, activeTab === 'auto-classification' && dynamicStyles.activeTab]}
          onPress={() => handleTabChange('auto-classification')}
        >
          <Icon
            name="category"
            size={24}
            color={activeTab === 'auto-classification' ? colors.primary : colors.text}
          />
          <Text style={[dynamicStyles.tabText, activeTab === 'auto-classification' && dynamicStyles.activeTabText]}>
            自动分类
          </Text>
        </TouchableOpacity>

        {/* 知识图谱构建标签页 */}
        <TouchableOpacity
          style={[dynamicStyles.tab, activeTab === 'graph-builder' && dynamicStyles.activeTab]}
          onPress={() => handleTabChange('graph-builder')}
        >
          <Icon
            name="account-tree"
            size={24}
            color={activeTab === 'graph-builder' ? colors.primary : colors.text}
          />
          <Text style={[dynamicStyles.tabText, activeTab === 'graph-builder' && dynamicStyles.activeTabText]}>
            图谱构建
          </Text>
        </TouchableOpacity>

        {/* 结构分析标签页 */}
        <TouchableOpacity
          style={[dynamicStyles.tab, activeTab === 'structure' && dynamicStyles.activeTab]}
          onPress={() => handleTabChange('structure')}
        >
          <Icon
            name="bubble-chart"
            size={24}
            color={activeTab === 'structure' ? colors.primary : colors.text}
          />
          <Text style={[dynamicStyles.tabText, activeTab === 'structure' && dynamicStyles.activeTabText]}>
            结构分析
          </Text>
        </TouchableOpacity>

        {/* 路径查找标签页 */}
        <TouchableOpacity
          style={[dynamicStyles.tab, activeTab === 'path' && dynamicStyles.activeTab]}
          onPress={() => handleTabChange('path')}
        >
          <Icon
            name="timeline"
            size={24}
            color={activeTab === 'path' ? colors.primary : colors.text}
          />
          <Text style={[dynamicStyles.tabText, activeTab === 'path' && dynamicStyles.activeTabText]}>
            路径查找
          </Text>
        </TouchableOpacity>

        {/* 相关概念标签页 */}
        <TouchableOpacity
          style={[dynamicStyles.tab, activeTab === 'concepts' && dynamicStyles.activeTab]}
          onPress={() => handleTabChange('concepts')}
        >
          <Icon
            name="share"
            size={24}
            color={activeTab === 'concepts' ? colors.primary : colors.text}
          />
          <Text style={[dynamicStyles.tabText, activeTab === 'concepts' && dynamicStyles.activeTabText]}>
            相关概念
          </Text>
        </TouchableOpacity>
      </View>

      {/* 内容区域 */}
      <View style={dynamicStyles.contentContainer}>
        {/* 自动分类 */}
        {activeTab === 'auto-classification' && (
          <AutoClassification
            noteId={noteId}
            currentTags={[]}
            currentCategory={null}
            onTagsSelected={handleTagsSelected}
            onCategorySelected={handleCategorySelected}
            onNoteSelected={handleNoteSelected}
          />
        )}

        {/* 知识图谱构建 */}
        {activeTab === 'graph-builder' && (
          <KnowledgeGraphBuilder
            noteId={noteId}
            onNodePress={handleNodePress}
          />
        )}

        {/* 结构分析 */}
        {activeTab === 'structure' && (
          <StructureAnalysis
            analysis={analysisData}
            onNodePress={handleNodePress}
            isLoading={isAnalysisLoading}
            error={analysisError}
          />
        )}

        {/* 路径查找 */}
        {activeTab === 'path' && (
          <View style={dynamicStyles.pathContainer}>
            <View style={dynamicStyles.pathControls}>
              <Text style={dynamicStyles.pathTitle}>知识路径查找</Text>
              <Text style={dynamicStyles.pathDescription}>
                选择两个知识点，查找它们之间的最短连接路径
              </Text>

              <View style={dynamicStyles.nodeSelectors}>
                {renderNodeSelector('source', selectedSourceNode, '选择源节点')}
                <Icon name="arrow-forward" size={24} color={colors.text} style={dynamicStyles.arrowIcon} />
                {renderNodeSelector('target', selectedTargetNode, '选择目标节点')}
              </View>

              <Button
                title="查找路径"
                onPress={findPath}
                disabled={!selectedSourceNode || !selectedTargetNode}
                style={dynamicStyles.findButton}
              />
            </View>

            <View style={dynamicStyles.pathVisualizationContainer}>
              <PathVisualization
                path={pathData}
                onNodePress={handleNodePress}
                isLoading={isPathLoading}
                error={pathError}
              />
            </View>
          </View>
        )}

        {/* 相关概念 */}
        {activeTab === 'concepts' && (
          <View style={dynamicStyles.conceptsContainer}>
            <View style={dynamicStyles.conceptsControls}>
              <Text style={dynamicStyles.conceptsTitle}>相关概念查找</Text>
              <Text style={dynamicStyles.conceptsDescription}>
                选择一个知识点，查找与之相关的概念网络
              </Text>

              <View style={dynamicStyles.conceptNodeSelector}>
                {renderNodeSelector('concept', selectedConceptNode, '选择知识点')}
              </View>

              <Button
                title="查找相关概念"
                onPress={findRelatedConcepts}
                disabled={!selectedConceptNode}
                style={dynamicStyles.findButton}
              />
            </View>

            <View style={dynamicStyles.conceptsVisualizationContainer}>
              <RelatedConceptsView
                concepts={conceptsData?.concepts || []}
                centerNode={conceptsData?.centerNode}
                onNodePress={handleNodePress}
                isLoading={isConceptsLoading}
                error={conceptsError}
              />
            </View>
          </View>
        )}
      </View>

      <Modal
        visible={showNodePicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowNodePicker(false)}
      >
        <View style={dynamicStyles.pickerOverlay}>
          <View style={dynamicStyles.pickerContent}>
            <Text style={dynamicStyles.pickerTitle}>{pickerTitle}</Text>
            <FlatList
              data={nodes}
              keyExtractor={(item) => item.id}
              style={dynamicStyles.pickerList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={dynamicStyles.pickerItem}
                  onPress={() => {
                    handleNodeSelect(item, pickerType);
                    setShowNodePicker(false);
                  }}
                >
                  <View
                    style={[
                      dynamicStyles.nodeTypeIndicator,
                      { backgroundColor: getNodeColorByType(item.type), marginRight: 8 },
                    ]}
                  />
                  <Text style={dynamicStyles.pickerItemText}>{item.title}</Text>
                </TouchableOpacity>
              )}
            />
            <Button
              title="取消"
              type="outline"
              onPress={() => setShowNodePicker(false)}
            />
          </View>
        </View>
      </Modal>

      {/* Toast消息 */}
      {toastMessage ? (
        <Toast
          message={toastMessage}
          onDismiss={() => setToastMessage('')}
          type={toastMessage.includes('失败') ? 'error' : 'success'}
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
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontSize: 12,
    marginTop: 4,
    color: colors.text,
  },
  activeTabText: {
    color: colors.primary,
    fontWeight: 'bold',
  },
  contentContainer: {
    flex: 1,
  },
  pathContainer: {
    flex: 1,
  },
  pathControls: {
    padding: 15,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pathTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 5,
  },
  pathDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 15,
  },
  nodeSelectors: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  nodeSelector: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    backgroundColor: colors.card,
  },
  selectedNodeContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  nodeTypeIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  selectedNodeText: {
    fontSize: 14,
    color: colors.text,
  },
  placeholderText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  arrowIcon: {
    marginHorizontal: 10,
  },
  findButton: {
    marginTop: 5,
  },
  pathVisualizationContainer: {
    flex: 1,
  },
  conceptsContainer: {
    flex: 1,
  },
  conceptsControls: {
    padding: 15,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  conceptsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 5,
  },
  conceptsDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 15,
  },
  conceptNodeSelector: {
    marginBottom: 15,
  },
  conceptsVisualizationContainer: {
    flex: 1,
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
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  pickerContent: {
    width: '100%',
    maxWidth: 380,
    maxHeight: '70%',
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 12,
  },
  pickerList: {
    marginBottom: 12,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pickerItemText: {
    fontSize: 14,
    color: colors.text,
    flex: 1,
  },
});

export default KnowledgeAnalysisScreen;
