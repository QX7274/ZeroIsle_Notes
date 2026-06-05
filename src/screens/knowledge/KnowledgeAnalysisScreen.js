/**
 * 鐭ヨ瘑鍥捐氨鍒嗘瀽灞忓箷
 * 鐢ㄤ簬鍒嗘瀽鐭ヨ瘑鍥捐氨缁撴瀯銆佹煡鎵捐矾寰勫拰鐩稿叧姒傚康
 * 鎻愪緵鑷姩鍒嗙被銆佺煡璇嗗浘璋辨瀯寤哄拰鍒嗘瀽鍔熻兘
 */

import React, { useCallback, useState, useEffect } from 'react';
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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';

// 瀵煎叆Redux鐩稿叧
import {
  selectNodes,
  selectEdges,
  selectIsLoading,
  selectError,
  fetchKnowledgeGraph,
} from '../../redux/slices/knowledgeGraphSlice';

// 瀵煎叆API鏈嶅姟
import * as knowledgeGraphApi from '../../services/api/knowledgeGraphApi';
import autoClassificationApi from '../../services/api/autoClassificationApi';

// 瀵煎叆甯搁噺鍜屽伐鍏峰嚱鏁?
import { useTheme } from '../../context/ThemeContext';
import { SPACING, TYPOGRAPHY } from '../../styles/constants';

// 瀵煎叆缁勪欢
import { Button, Loading, Toast } from '../../components/common';
import ScreenHeaderBackButton from '../../components/common/ScreenHeaderBackButton';
import {
  PathVisualization,
  StructureAnalysis,
  RelatedConceptsView,
  AutoClassification,
  KnowledgeGraphBuilder,
} from '../../components/knowledge';

/**
 * 鐭ヨ瘑鍥捐氨鍒嗘瀽灞忓箷缁勪欢
 */
const KnowledgeAnalysisScreen = ({ navigation, route }) => {
  const dispatch = useDispatch();

  // 鑾峰彇涓婚棰滆壊
  const { colors } = useTheme();

  // 鑾峰彇鍔ㄦ€佹牱寮?
  const dynamicStyles = getStyles(colors);
  const insets = useSafeAreaInsets();

  // 浠嶳edux鑾峰彇鐘舵€?
  const nodes = useSelector(selectNodes);
  const edges = useSelector(selectEdges);
  const isLoading = useSelector(selectIsLoading);
  const error = useSelector(selectError);

  // 鏈湴鐘舵€?
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

  const openNodePicker = (type, title) => {
    setPickerType(type);
    setPickerTitle(title);
    setShowNodePicker(true);
  };

  const closeNodePicker = () => {
    setShowNodePicker(false);
  };

  const clearToastMessage = () => setToastMessage('');
  const isErrorToastMessage = (message) => message.includes('失败');

  const navigateToNoteEdit = () => {
    navigation.navigate('Notes', { screen: 'NoteEdit' });
  };

  const handleNodePickerItemPress = (node) => {
    handleNodeSelect(node, pickerType);
    closeNodePicker();
  };

  const setAutoClassificationTab = () => {
    handleTabChange('auto-classification');
  };

  const setGraphBuilderTab = () => {
    handleTabChange('graph-builder');
  };

  const setStructureTab = () => {
    handleTabChange('structure');
  };

  const setPathTab = () => {
    handleTabChange('path');
  };

  const setConceptsTab = () => {
    handleTabChange('concepts');
  };

  // 鑾峰彇璺敱鍙傛暟
  const noteId = route?.params?.noteId;

  // 鍔犺浇缁撴瀯鍒嗘瀽鏁版嵁
  const loadStructureAnalysis = useCallback(async () => {
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
  }, []);

  // 鍒濆鍖栧姞杞界煡璇嗗浘璋辨暟鎹?
  // 鍔犺浇鐭ヨ瘑鍥捐氨鏁版嵁
  const loadKnowledgeGraph = useCallback(async () => {
    try {
      await dispatch(fetchKnowledgeGraph()).unwrap();
      // 鍔犺浇缁撴瀯鍒嗘瀽鏁版嵁
      if (activeTab === 'structure') {
        loadStructureAnalysis();
      }
    } catch (err) {
      setToastMessage('加载知识图谱失败: ' + (err.message || '请稍后重试'));
    }
  }, [activeTab, dispatch, loadStructureAnalysis]);

  useEffect(() => {
    loadKnowledgeGraph();
  }, [loadKnowledgeGraph]);

  // 鏌ユ壘璺緞
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

  // 鏌ユ壘鐩稿叧姒傚康
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

  // 澶勭悊鑺傜偣閫夋嫨
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

  // 澶勭悊鑺傜偣鐐瑰嚮
  const handleNodePress = (node) => {
    navigation.navigate('NodeDetail', { nodeId: node.id });
  };
  const handleGoBack = () => navigation.goBack();

  // 鍒囨崲鏍囩椤?
  const handleTabChange = (tab) => {
    setActiveTab(tab);

    // 鍔犺浇瀵瑰簲鏍囩椤电殑鏁版嵁
    switch (tab) {
      case 'structure':
        if (!analysisData && !isAnalysisLoading) {
          loadStructureAnalysis();
        }
        break;
      case 'path':
        // 璺緞鏌ユ壘闇€瑕佺敤鎴烽€夋嫨鑺傜偣鍚庢墜鍔ㄨЕ鍙?
        break;
      case 'concepts':
        // 鐩稿叧姒傚康闇€瑕佺敤鎴烽€夋嫨鑺傜偣鍚庢墜鍔ㄨЕ鍙?
        break;
      case 'auto-classification':
        // 鑷姩鍒嗙被涓嶉渶瑕侀鍔犺浇鏁版嵁
        break;
      case 'graph-builder':
        // 鐭ヨ瘑鍥捐氨鏋勫缓涓嶉渶瑕侀鍔犺浇鏁版嵁
        break;
      default:
        break;
    }
  };

  // 澶勭悊鏍囩閫夋嫨
  const handleTagsSelected = (tags) => {
    // 瀵艰埅鍒扮瑪璁扮紪杈戦〉闈紝骞朵紶閫掗€変腑鐨勬爣绛?
    // 浣跨敤宓屽瀵艰埅锛岀‘淇濆鑸埌姝ｇ‘鐨勭瑪璁扮紪杈戝睆骞?
    navigation.navigate('Notes', {
      screen: 'NoteEdit',
      params: {
        noteId,
        selectedTags: tags,
      },
    });
  };

  // 澶勭悊鍒嗙被閫夋嫨
  const handleCategorySelected = (category) => {
    // 瀵艰埅鍒扮瑪璁扮紪杈戦〉闈紝骞朵紶閫掗€変腑鐨勫垎绫?
    // 浣跨敤宓屽瀵艰埅锛岀‘淇濆鑸埌姝ｇ‘鐨勭瑪璁扮紪杈戝睆骞?
    navigation.navigate('Notes', {
      screen: 'NoteEdit',
      params: {
        noteId,
        selectedCategory: category,
      },
    });
  };

  // 澶勭悊绗旇閫夋嫨
  const handleNoteSelected = (note) => {
    // 瀵艰埅鍒扮瑪璁拌鎯呴〉闈?
    // 浣跨敤宓屽瀵艰埅锛岀‘淇濆鑸埌姝ｇ‘鐨勭瑪璁拌鎯呭睆骞?
    navigation.navigate('Notes', {
      screen: 'NotesList',
      params: {
        initialNoteId: note.id,
        title: note.title,
      },
    });
  };

  // 娓叉煋鍔犺浇鐘舵€?
  if (isLoading && nodes.length === 0) {
    return <Loading text="加载知识图谱数据中..." />;
  }

  // 娓叉煋閿欒鐘舵€?
  if (error && nodes.length === 0) {
    return (
      <View style={dynamicStyles.errorContainer} testID="screen.knowledgeAnalysis">
        <Icon name="error-outline" size={50} color={colors.error} />
        <Text style={dynamicStyles.errorText}>加载失败: {error}</Text>
        <Button title="重试" onPress={loadKnowledgeGraph} />
      </View>
    );
  }

  // 娓叉煋绌虹姸鎬?
  if (nodes.length === 0) {
    return (
      <View style={dynamicStyles.emptyContainer} testID="screen.knowledgeAnalysis">
        <Icon name="bubble-chart" size={80} color={colors.textSecondary} />
        <Text style={dynamicStyles.emptyText}>暂无知识图谱数据</Text>
        <Text style={dynamicStyles.emptySubText}>创建更多笔记和连接，构建您的知识网络</Text>
        <Button
          title="创建笔记"
          onPress={navigateToNoteEdit}
          style={dynamicStyles.createButton}
        />
      </View>
    );
  }

  // 娓叉煋鑺傜偣閫夋嫨鍣?
  const renderNodeSelector = (type, selectedNode, placeholder) => (
    <TouchableOpacity
      style={dynamicStyles.nodeSelector}
      onPress={() => openNodePicker(type, placeholder)}
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

  // 鏍规嵁鑺傜偣绫诲瀷鑾峰彇棰滆壊
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
    <View style={[dynamicStyles.pageHeader, { paddingTop: Math.max(insets.top, 8) }]}>
      <View style={dynamicStyles.pageHeaderTopRow}>
        <ScreenHeaderBackButton
          onPress={handleGoBack}
          testID="action.knowledgeAnalysis.back"
          style={dynamicStyles.backButton}
        />
        <Text style={dynamicStyles.pageTitle}>知识图谱分析</Text>
        <View style={dynamicStyles.headerSpacer} />
      </View>
    </View>
  );

  return (
    <SafeAreaView style={dynamicStyles.container} testID="screen.knowledgeAnalysis">
      {renderTopChrome()}
      {/* 閫夐」鍗?*/}
      <View style={dynamicStyles.tabContainer}>
        {/* 鑷姩鍒嗙被鏍囩椤?*/}
        <TouchableOpacity
          style={[dynamicStyles.tab, activeTab === 'auto-classification' && dynamicStyles.activeTab]}
          onPress={setAutoClassificationTab}
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

        {/* 鐭ヨ瘑鍥捐氨鏋勫缓鏍囩椤?*/}
        <TouchableOpacity
          style={[dynamicStyles.tab, activeTab === 'graph-builder' && dynamicStyles.activeTab]}
          onPress={setGraphBuilderTab}
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

        {/* 缁撴瀯鍒嗘瀽鏍囩椤?*/}
        <TouchableOpacity
          style={[dynamicStyles.tab, activeTab === 'structure' && dynamicStyles.activeTab]}
          onPress={setStructureTab}
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

        {/* 璺緞鏌ユ壘鏍囩椤?*/}
        <TouchableOpacity
          style={[dynamicStyles.tab, activeTab === 'path' && dynamicStyles.activeTab]}
          onPress={setPathTab}
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

        {/* 鐩稿叧姒傚康鏍囩椤?*/}
        <TouchableOpacity
          style={[dynamicStyles.tab, activeTab === 'concepts' && dynamicStyles.activeTab]}
          onPress={setConceptsTab}
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

      {/* 鍐呭鍖哄煙 */}
      <View style={dynamicStyles.contentContainer}>
        {/* 鑷姩鍒嗙被 */}
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

        {/* 鐭ヨ瘑鍥捐氨鏋勫缓 */}
        {activeTab === 'graph-builder' && (
          <KnowledgeGraphBuilder
            noteId={noteId}
            onNodePress={handleNodePress}
          />
        )}

        {/* 缁撴瀯鍒嗘瀽 */}
        {activeTab === 'structure' && (
          <StructureAnalysis
            analysis={analysisData}
            onNodePress={handleNodePress}
            isLoading={isAnalysisLoading}
            error={analysisError}
          />
        )}

        {/* 璺緞鏌ユ壘 */}
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

        {/* 鐩稿叧姒傚康 */}
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
        onRequestClose={closeNodePicker}
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
                  onPress={() => handleNodePickerItemPress(item)}
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
              onPress={closeNodePicker}
            />
          </View>
        </View>
      </Modal>

      {/* Toast娑堟伅 */}
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

// 浣跨敤鍐呰仈鏍峰紡锛屽洜涓烘垜浠渶瑕佽闂姩鎬佺殑棰滆壊涓婚
const getStyles = (colors) => ({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  pageHeader: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pageHeaderTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    marginRight: 8,
  },
  pageTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  headerSpacer: {
    width: 40,
    height: 40,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.card + 'E8',
    borderBottomWidth: 1,
    borderBottomColor: colors.primary + '22',
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
    backgroundColor: colors.card + 'E8',
    borderBottomWidth: 1,
    borderBottomColor: colors.primary + '22',
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
    borderColor: colors.primary + '22',
    borderRadius: 4,
    backgroundColor: colors.card + 'F2',
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
    backgroundColor: colors.card + 'E8',
    borderBottomWidth: 1,
    borderBottomColor: colors.primary + '22',
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
    backgroundColor: `${colors.card}F2`,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: `${colors.primary}22`,
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

