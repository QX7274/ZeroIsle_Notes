/**
 * 知识图谱构建组件
 * 提供知识图谱构建和可视化功能
 */
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import autoClassificationApi from '../../services/api/autoClassificationApi';
import GraphVisualization from './GraphVisualization';
import { SPACING, TYPOGRAPHY } from '../../styles/constants';

/**
 * 知识图谱构建组件
 * @param {string} noteId - 笔记ID
 * @param {function} onNodePress - 节点点击回调
 */
const KnowledgeGraphBuilder = ({ noteId, onNodePress }) => {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [graphData, setGraphData] = useState(null);
  const [connections, setConnections] = useState(null);
  const [relatedContent, setRelatedContent] = useState(null);
  const [activeTab, setActiveTab] = useState('graph');

  // 构建知识图谱
  const buildGraph = async () => {
    if (!noteId) {return;}

    setLoading(true);
    setError(null);

    try {
      // 构建知识图谱
      const response = await autoClassificationApi.buildKnowledgeGraph(noteId, true);
      if (response.success) {
        setGraphData(response.data);

        // 分析笔记关联
        const connectionsResponse = await autoClassificationApi.analyzeNoteConnections(noteId);
        if (connectionsResponse.success) {
          setConnections(connectionsResponse.data);
        }

        // 推荐相关内容
        const relatedResponse = await autoClassificationApi.suggestRelatedContent(noteId);
        if (relatedResponse.success) {
          setRelatedContent(relatedResponse.data);
        }
      } else {
        setError(response.message || '构建知识图谱失败');
      }
    } catch (err) {
      setError('构建知识图谱失败，请稍后重试');
      console.error('构建知识图谱失败:', err);
    } finally {
      setLoading(false);
    }
  };

  // 初始加载
  useEffect(() => {
    if (noteId) {
      buildGraph();
    }
  }, [noteId]);

  // 准备图谱数据
  const prepareGraphData = () => {
    if (!graphData) {return { nodes: [], edges: [] };}

    // 收集所有节点
    const nodes = [];
    const edges = [];

    // 添加笔记节点
    if (graphData.note_node) {
      nodes.push({
        id: graphData.note_node.id,
        label: graphData.note_node.title,
        type: 'note',
        color: '#4361EE',
        size: 30,
      });
    }

    // 添加标签节点
    if (graphData.tag_nodes) {
      graphData.tag_nodes.forEach(tag => {
        nodes.push({
          id: tag.id,
          label: tag.name,
          type: 'tag',
          color: '#3A86FF',
          size: 20,
        });

        // 添加笔记-标签边
        edges.push({
          id: `${graphData.note_node.id}-${tag.id}`,
          source: graphData.note_node.id,
          target: tag.id,
          label: '有标签',
          color: '#CCCCCC',
        });
      });
    }

    // 添加分类节点
    if (graphData.category_node) {
      nodes.push({
        id: graphData.category_node.id,
        label: graphData.category_node.name,
        type: 'category',
        color: '#4CC9F0',
        size: 25,
      });

      // 添加笔记-分类边
      edges.push({
        id: `${graphData.note_node.id}-${graphData.category_node.id}`,
        source: graphData.note_node.id,
        target: graphData.category_node.id,
        label: '属于',
        color: '#CCCCCC',
      });
    }

    // 添加概念节点
    if (graphData.concept_nodes) {
      graphData.concept_nodes.forEach(concept => {
        nodes.push({
          id: concept.id,
          label: concept.name,
          type: 'concept',
          color: '#F72585',
          size: 22,
        });

        // 添加笔记-概念边
        edges.push({
          id: `${graphData.note_node.id}-${concept.id}`,
          source: graphData.note_node.id,
          target: concept.id,
          label: '提及',
          color: '#CCCCCC',
        });
      });
    }

    // 添加相关笔记节点
    if (graphData.related_note_nodes) {
      graphData.related_note_nodes.forEach(note => {
        nodes.push({
          id: note.id,
          label: note.title,
          type: 'note',
          color: '#4361EE',
          size: 25,
        });

        // 添加笔记-相关笔记边
        edges.push({
          id: `${graphData.note_node.id}-${note.id}`,
          source: graphData.note_node.id,
          target: note.id,
          label: '相关',
          color: '#CCCCCC',
        });
      });
    }

    return { nodes, edges };
  };

  // 渲染标签列表
  const renderTags = () => {
    if (!connections || !connections.tags || connections.tags.length === 0) {
      return (
        <Text style={[styles.emptyText, { color: colors.text }]}>
          没有关联的标签
        </Text>
      );
    }

    return (
      <View style={styles.listContainer}>
        {connections.tags.map(tag => (
          <View key={tag.id} style={[styles.listItem, { borderColor: colors.border }]}>
            <Icon name="local-offer" size={20} color="#3A86FF" />
            <Text style={[styles.listItemText, { color: colors.text }]}>
              {tag.name}
            </Text>
          </View>
        ))}
      </View>
    );
  };

  // 渲染分类列表
  const renderCategories = () => {
    if (!connections || !connections.categories || connections.categories.length === 0) {
      return (
        <Text style={[styles.emptyText, { color: colors.text }]}>
          没有关联的分类
        </Text>
      );
    }

    return (
      <View style={styles.listContainer}>
        {connections.categories.map(category => (
          <View key={category.id} style={[styles.listItem, { borderColor: colors.border }]}>
            <Icon name="folder" size={20} color="#4CC9F0" />
            <Text style={[styles.listItemText, { color: colors.text }]}>
              {category.name}
            </Text>
          </View>
        ))}
      </View>
    );
  };

  // 渲染概念列表
  const renderConcepts = () => {
    if (!connections || !connections.concepts || connections.concepts.length === 0) {
      return (
        <Text style={[styles.emptyText, { color: colors.text }]}>
          没有关联的概念
        </Text>
      );
    }

    return (
      <View style={styles.listContainer}>
        {connections.concepts.map(concept => (
          <View key={concept.id} style={[styles.listItem, { borderColor: colors.border }]}>
            <Icon name="lightbulb" size={20} color="#F72585" />
            <View style={styles.conceptContent}>
              <Text style={[styles.listItemText, { color: colors.text }]}>
                {concept.name}
              </Text>
              {concept.description && (
                <Text style={[styles.conceptDescription, { color: colors.text }]}>
                  {concept.description}
                </Text>
              )}
            </View>
          </View>
        ))}
      </View>
    );
  };

  // 渲染相关笔记列表
  const renderRelatedNotes = () => {
    if (!connections || !connections.related_notes || connections.related_notes.length === 0) {
      return (
        <Text style={[styles.emptyText, { color: colors.text }]}>
          没有相关笔记
        </Text>
      );
    }

    return (
      <View style={styles.listContainer}>
        {connections.related_notes.map(note => (
          <TouchableOpacity
            key={note.id}
            style={[styles.listItem, { borderColor: colors.border }]}
            onPress={() => onNodePress && onNodePress(note.id, 'note')}
          >
            <Icon name="description" size={20} color="#4361EE" />
            <View style={styles.noteContent}>
              <Text style={[styles.listItemText, { color: colors.text }]}>
                {note.title}
              </Text>
              <Text style={[styles.noteSimilarity, { color: colors.text }]}>
                {Math.round(note.similarity * 100)}% 相似
              </Text>
            </View>
            <Icon name="chevron-right" size={20} color={colors.text} />
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  // 渲染推荐内容
  const renderRecommendedContent = () => {
    if (!relatedContent) {
      return (
        <Text style={[styles.emptyText, { color: colors.text }]}>
          没有推荐内容
        </Text>
      );
    }

    return (
      <View style={styles.recommendedContainer}>
        {/* 推荐笔记 */}
        <View style={styles.recommendedSection}>
          <Text style={[styles.recommendedTitle, { color: colors.text }]}>
            推荐笔记
          </Text>
          {relatedContent.recommended_notes && relatedContent.recommended_notes.length > 0 ? (
            <View style={styles.listContainer}>
              {relatedContent.recommended_notes.map(note => (
                <TouchableOpacity
                  key={note.id}
                  style={[styles.listItem, { borderColor: colors.border }]}
                  onPress={() => onNodePress && onNodePress(note.id, 'note')}
                >
                  <Icon name="description" size={20} color="#4361EE" />
                  <Text style={[styles.listItemText, { color: colors.text }]}>
                    {note.title}
                  </Text>
                  <Icon name="chevron-right" size={20} color={colors.text} />
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <Text style={[styles.emptyText, { color: colors.text }]}>
              没有推荐笔记
            </Text>
          )}
        </View>

        {/* 推荐标签 */}
        <View style={styles.recommendedSection}>
          <Text style={[styles.recommendedTitle, { color: colors.text }]}>
            推荐标签
          </Text>
          {relatedContent.recommended_tags && relatedContent.recommended_tags.length > 0 ? (
            <View style={styles.tagsContainer}>
              {relatedContent.recommended_tags.map(tag => (
                <View
                  key={tag}
                  style={[
                    styles.tagItem,
                    { backgroundColor: colors.card, borderColor: colors.border },
                  ]}
                >
                  <Text style={[styles.tagText, { color: colors.text }]}>
                    {tag}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={[styles.emptyText, { color: colors.text }]}>
              没有推荐标签
            </Text>
          )}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.text }]}>
          正在构建知识图谱...
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Icon name="error" size={40} color={colors.error} />
        <Text style={[styles.errorText, { color: colors.error }]}>
          {error}
        </Text>
        <TouchableOpacity
          style={[styles.retryButton, { backgroundColor: colors.primary }]}
          onPress={buildGraph}
        >
          <Text style={[styles.retryButtonText, { color: colors.white }]}>
            重试
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!graphData) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.emptyText, { color: colors.text }]}>
          没有知识图谱数据
        </Text>
        <TouchableOpacity
          style={[styles.buildButton, { backgroundColor: colors.primary }]}
          onPress={buildGraph}
        >
          <Text style={[styles.buildButtonText, { color: colors.white }]}>
            构建知识图谱
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { nodes, edges } = prepareGraphData();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* 标签页切换 */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'graph' && [
              styles.activeTabButton,
              { borderColor: colors.primary },
            ],
          ]}
          onPress={() => setActiveTab('graph')}
        >
          <Text
            style={[
              styles.tabButtonText,
              { color: activeTab === 'graph' ? colors.primary : colors.text },
            ]}
          >
            图谱
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'connections' && [
              styles.activeTabButton,
              { borderColor: colors.primary },
            ],
          ]}
          onPress={() => setActiveTab('connections')}
        >
          <Text
            style={[
              styles.tabButtonText,
              {
                color:
                  activeTab === 'connections' ? colors.primary : colors.text,
              },
            ]}
          >
            关联
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'recommendations' && [
              styles.activeTabButton,
              { borderColor: colors.primary },
            ],
          ]}
          onPress={() => setActiveTab('recommendations')}
        >
          <Text
            style={[
              styles.tabButtonText,
              {
                color:
                  activeTab === 'recommendations'
                    ? colors.primary
                    : colors.text,
              },
            ]}
          >
            推荐
          </Text>
        </TouchableOpacity>
      </View>

      {/* 内容区域 */}
      <View style={styles.contentContainer}>
        {activeTab === 'graph' && (
          <View style={styles.graphContainer}>
            {nodes.length > 0 ? (
              <GraphVisualization
                nodes={nodes}
                edges={edges}
                onNodePress={onNodePress}
              />
            ) : (
              <Text style={[styles.emptyText, { color: colors.text }]}>
                没有图谱数据
              </Text>
            )}
          </View>
        )}

        {activeTab === 'connections' && (
          <ScrollView style={styles.connectionsContainer}>
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                标签
              </Text>
              {renderTags()}
            </View>

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                分类
              </Text>
              {renderCategories()}
            </View>

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                概念
              </Text>
              {renderConcepts()}
            </View>

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                相关笔记
              </Text>
              {renderRelatedNotes()}
            </View>
          </ScrollView>
        )}

        {activeTab === 'recommendations' && (
          <ScrollView style={styles.recommendationsContainer}>
            {renderRecommendedContent()}
          </ScrollView>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingText: {
    marginTop: SPACING.MEDIUM,
    fontSize: TYPOGRAPHY.FONT_SIZE_MEDIUM,
    textAlign: 'center',
  },
  errorText: {
    marginTop: SPACING.MEDIUM,
    fontSize: TYPOGRAPHY.FONT_SIZE_MEDIUM,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: SPACING.MEDIUM,
    paddingVertical: SPACING.SMALL,
    paddingHorizontal: SPACING.MEDIUM,
    borderRadius: 4,
  },
  retryButtonText: {
    fontSize: TYPOGRAPHY.FONT_SIZE_MEDIUM,
    fontWeight: 'bold',
  },
  emptyText: {
    fontSize: TYPOGRAPHY.FONT_SIZE_MEDIUM,
    textAlign: 'center',
    marginTop: SPACING.LARGE,
  },
  buildButton: {
    marginTop: SPACING.MEDIUM,
    paddingVertical: SPACING.SMALL,
    paddingHorizontal: SPACING.MEDIUM,
    borderRadius: 4,
  },
  buildButtonText: {
    fontSize: TYPOGRAPHY.FONT_SIZE_MEDIUM,
    fontWeight: 'bold',
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#CCCCCC',
  },
  tabButton: {
    flex: 1,
    paddingVertical: SPACING.SMALL,
    alignItems: 'center',
  },
  activeTabButton: {
    borderBottomWidth: 2,
  },
  tabButtonText: {
    fontSize: TYPOGRAPHY.FONT_SIZE_MEDIUM,
    fontWeight: 'bold',
  },
  contentContainer: {
    flex: 1,
  },
  graphContainer: {
    flex: 1,
  },
  connectionsContainer: {
    flex: 1,
    padding: SPACING.MEDIUM,
  },
  recommendationsContainer: {
    flex: 1,
    padding: SPACING.MEDIUM,
  },
  section: {
    marginBottom: SPACING.MEDIUM,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.FONT_SIZE_MEDIUM,
    fontWeight: 'bold',
    marginBottom: SPACING.SMALL,
  },
  listContainer: {
    marginTop: SPACING.SMALL,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.SMALL,
    paddingHorizontal: SPACING.SMALL,
    borderBottomWidth: 1,
  },
  listItemText: {
    fontSize: TYPOGRAPHY.FONT_SIZE_MEDIUM,
    marginLeft: SPACING.SMALL,
    flex: 1,
  },
  conceptContent: {
    flex: 1,
    marginLeft: SPACING.SMALL,
  },
  conceptDescription: {
    fontSize: TYPOGRAPHY.FONT_SIZE_SMALL,
    marginTop: 2,
  },
  noteContent: {
    flex: 1,
    marginLeft: SPACING.SMALL,
  },
  noteSimilarity: {
    fontSize: TYPOGRAPHY.FONT_SIZE_SMALL,
  },
  recommendedContainer: {
    flex: 1,
  },
  recommendedSection: {
    marginBottom: SPACING.MEDIUM,
  },
  recommendedTitle: {
    fontSize: TYPOGRAPHY.FONT_SIZE_MEDIUM,
    fontWeight: 'bold',
    marginBottom: SPACING.SMALL,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tagItem: {
    paddingHorizontal: SPACING.SMALL,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: SPACING.SMALL,
    marginBottom: SPACING.SMALL,
    borderWidth: 1,
  },
  tagText: {
    fontSize: TYPOGRAPHY.FONT_SIZE_SMALL,
  },
});

export default KnowledgeGraphBuilder;
