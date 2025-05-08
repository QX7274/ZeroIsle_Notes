/**
 * 思维导图屏幕
 * 用于显示和管理思维导图列表
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../context/ThemeContext';
import { Button, EmptyState, SearchBar } from '../../components/common';
import apiService from '../../services/api/apiService';
import analyticsService from '../../services/analytics/analyticsService';

const { width } = Dimensions.get('window');

const MindMapScreen = () => {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const styles = getStyles(colors);

  // 状态
  const [mindMaps, setMindMaps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newMindMapTitle, setNewMindMapTitle] = useState('');
  const [error, setError] = useState(null);

  // 加载思维导图列表
  const loadMindMaps = async () => {
    try {
      setLoading(true);
      setError(null);

      try {
        const response = await apiService.get('/mind-map/maps/', {
          params: { search: searchQuery }
        });

        setMindMaps(response.data.results);
        analyticsService.trackEvent('view_mind_maps', { count: response.data.results.length });
      } catch (apiErr) {
        console.error('API加载思维导图失败，使用示例数据:', apiErr);

        // 如果API请求失败，使用示例数据
        const exampleMindMaps = [
          {
            id: 'example1',
            title: '学习计划',
            description: '个人学习计划思维导图',
            updated_at: new Date().toISOString(),
            layout_type: 'tree',
            theme: 'default'
          },
          {
            id: 'example2',
            title: '项目规划',
            description: '项目开发规划思维导图',
            updated_at: new Date().toISOString(),
            layout_type: 'radial',
            theme: 'blue'
          },
          {
            id: 'example3',
            title: '知识体系',
            description: '个人知识体系思维导图',
            updated_at: new Date().toISOString(),
            layout_type: 'tree',
            theme: 'green'
          }
        ];

        setMindMaps(exampleMindMaps);
      }
    } catch (err) {
      console.error('加载思维导图失败:', err);
      setError('加载思维导图失败，请稍后重试');
      analyticsService.trackError(err, { action: 'load_mind_maps' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // 首次加载
  useEffect(() => {
    loadMindMaps();
  }, []);

  // 搜索变化时重新加载
  useEffect(() => {
    const delaySearch = setTimeout(() => {
      loadMindMaps();
    }, 500);

    return () => clearTimeout(delaySearch);
  }, [searchQuery]);

  // 刷新列表
  const handleRefresh = () => {
    setRefreshing(true);
    loadMindMaps();
  };

  // 创建新思维导图
  const handleCreateMindMap = async () => {
    if (!newMindMapTitle.trim()) {
      Alert.alert('提示', '请输入思维导图标题');
      return;
    }

    try {
      const response = await apiService.post('/mind-map/maps/', {
        title: newMindMapTitle.trim(),
        description: '',
        layout_type: 'tree',
        theme: 'default'
      });

      setShowCreateModal(false);
      setNewMindMapTitle('');
      analyticsService.trackEvent('create_mind_map', { title: newMindMapTitle });

      // 导航到编辑页面
      navigation.navigate('MindMapEdit', { mindMapId: response.data.id });
    } catch (err) {
      console.error('创建思维导图失败:', err);
      Alert.alert('错误', '创建思维导图失败，请稍后重试');
      analyticsService.trackError(err, { action: 'create_mind_map' });
    }
  };

  // 打开思维导图
  const handleOpenMindMap = (mindMap) => {
    analyticsService.trackEvent('open_mind_map', { id: mindMap.id });

    // 检查是否为示例思维导图
    if (mindMap.id.startsWith('example')) {
      // 对于示例思维导图，创建一些示例节点和边
      const exampleData = getExampleMindMapData(mindMap.id);
      navigation.navigate('MindMapEdit', {
        mindMapId: mindMap.id,
        title: mindMap.title,
        isExample: true,
        nodes: exampleData.nodes,
        edges: exampleData.edges,
        layoutType: mindMap.layout_type,
        theme: mindMap.theme
      });
    } else {
      // 正常导航到编辑页面
      navigation.navigate('MindMapEdit', { mindMapId: mindMap.id });
    }
  };

  // 获取示例思维导图数据
  const getExampleMindMapData = (exampleId) => {
    switch (exampleId) {
      case 'example1': // 学习计划
        return {
          nodes: [
            { id: '1', title: '学习计划', type: 'root', x: 400, y: 300 },
            { id: '2', title: '编程语言', type: 'topic', x: 200, y: 200 },
            { id: '3', title: '框架学习', type: 'topic', x: 600, y: 200 },
            { id: '4', title: '计算机基础', type: 'topic', x: 400, y: 450 },
            { id: '5', title: 'JavaScript', type: 'subtopic', x: 100, y: 150 },
            { id: '6', title: 'Python', type: 'subtopic', x: 150, y: 250 },
            { id: '7', title: 'React Native', type: 'subtopic', x: 550, y: 150 },
            { id: '8', title: 'Django', type: 'subtopic', x: 650, y: 250 },
            { id: '9', title: '数据结构', type: 'subtopic', x: 300, y: 500 },
            { id: '10', title: '算法', type: 'subtopic', x: 500, y: 500 },
          ],
          edges: [
            { id: 'e1', source: '1', target: '2' },
            { id: 'e2', source: '1', target: '3' },
            { id: 'e3', source: '1', target: '4' },
            { id: 'e4', source: '2', target: '5' },
            { id: 'e5', source: '2', target: '6' },
            { id: 'e6', source: '3', target: '7' },
            { id: 'e7', source: '3', target: '8' },
            { id: 'e8', source: '4', target: '9' },
            { id: 'e9', source: '4', target: '10' },
          ]
        };
      case 'example2': // 项目规划
        return {
          nodes: [
            { id: '1', title: '项目规划', type: 'root', x: 400, y: 300 },
            { id: '2', title: '需求分析', type: 'topic', x: 200, y: 200 },
            { id: '3', title: '设计阶段', type: 'topic', x: 600, y: 200 },
            { id: '4', title: '开发阶段', type: 'topic', x: 200, y: 400 },
            { id: '5', title: '测试阶段', type: 'topic', x: 600, y: 400 },
            { id: '6', title: '用户调研', type: 'subtopic', x: 100, y: 150 },
            { id: '7', title: '功能列表', type: 'subtopic', x: 150, y: 250 },
            { id: '8', title: 'UI设计', type: 'subtopic', x: 550, y: 150 },
            { id: '9', title: '架构设计', type: 'subtopic', x: 650, y: 250 },
            { id: '10', title: '前端开发', type: 'subtopic', x: 100, y: 400 },
            { id: '11', title: '后端开发', type: 'subtopic', x: 300, y: 400 },
            { id: '12', title: '单元测试', type: 'subtopic', x: 500, y: 400 },
            { id: '13', title: '集成测试', type: 'subtopic', x: 700, y: 400 },
          ],
          edges: [
            { id: 'e1', source: '1', target: '2' },
            { id: 'e2', source: '1', target: '3' },
            { id: 'e3', source: '1', target: '4' },
            { id: 'e4', source: '1', target: '5' },
            { id: 'e5', source: '2', target: '6' },
            { id: 'e6', source: '2', target: '7' },
            { id: 'e7', source: '3', target: '8' },
            { id: 'e8', source: '3', target: '9' },
            { id: 'e9', source: '4', target: '10' },
            { id: 'e10', source: '4', target: '11' },
            { id: 'e11', source: '5', target: '12' },
            { id: 'e12', source: '5', target: '13' },
          ]
        };
      case 'example3': // 知识体系
        return {
          nodes: [
            { id: '1', title: '知识体系', type: 'root', x: 400, y: 300 },
            { id: '2', title: '技术知识', type: 'topic', x: 200, y: 200 },
            { id: '3', title: '管理知识', type: 'topic', x: 600, y: 200 },
            { id: '4', title: '行业知识', type: 'topic', x: 200, y: 400 },
            { id: '5', title: '通用技能', type: 'topic', x: 600, y: 400 },
            { id: '6', title: '编程语言', type: 'subtopic', x: 100, y: 150 },
            { id: '7', title: '框架工具', type: 'subtopic', x: 300, y: 150 },
            { id: '8', title: '项目管理', type: 'subtopic', x: 500, y: 150 },
            { id: '9', title: '团队管理', type: 'subtopic', x: 700, y: 150 },
            { id: '10', title: '市场趋势', type: 'subtopic', x: 100, y: 450 },
            { id: '11', title: '竞品分析', type: 'subtopic', x: 300, y: 450 },
            { id: '12', title: '沟通能力', type: 'subtopic', x: 500, y: 450 },
            { id: '13', title: '学习能力', type: 'subtopic', x: 700, y: 450 },
          ],
          edges: [
            { id: 'e1', source: '1', target: '2' },
            { id: 'e2', source: '1', target: '3' },
            { id: 'e3', source: '1', target: '4' },
            { id: 'e4', source: '1', target: '5' },
            { id: 'e5', source: '2', target: '6' },
            { id: 'e6', source: '2', target: '7' },
            { id: 'e7', source: '3', target: '8' },
            { id: 'e8', source: '3', target: '9' },
            { id: 'e9', source: '4', target: '10' },
            { id: 'e10', source: '4', target: '11' },
            { id: 'e11', source: '5', target: '12' },
            { id: 'e12', source: '5', target: '13' },
          ]
        };
      default:
        return { nodes: [], edges: [] };
    }
  };

  // 删除思维导图
  const handleDeleteMindMap = (mindMap) => {
    Alert.alert(
      '确认删除',
      `确定要删除思维导图"${mindMap.title}"吗？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiService.delete(`/mind-map/maps/${mindMap.id}/`);
              analyticsService.trackEvent('delete_mind_map', { id: mindMap.id });
              loadMindMaps();
            } catch (err) {
              console.error('删除思维导图失败:', err);
              Alert.alert('错误', '删除思维导图失败，请稍后重试');
              analyticsService.trackError(err, { action: 'delete_mind_map' });
            }
          }
        }
      ]
    );
  };

  // 选择模板
  const handleSelectTemplate = () => {
    navigation.navigate('MindMapTemplate');
  };

  // 渲染思维导图项
  const renderMindMapItem = ({ item }) => (
    <TouchableOpacity
      style={styles.mindMapItem}
      onPress={() => handleOpenMindMap(item)}
    >
      <View style={styles.mindMapContent}>
        <Text style={styles.mindMapTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.mindMapDate}>
          {new Date(item.updated_at).toLocaleString()}
        </Text>
      </View>

      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => handleDeleteMindMap(item)}
      >
        <Icon name="delete" size={24} color={colors.error} />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  // 渲染空状态
  const renderEmptyState = () => {
    if (loading) return null;

    return (
      <EmptyState
        icon="bubble-chart"
        title="没有思维导图"
        message={searchQuery ? "没有找到匹配的思维导图" : "点击下方按钮创建您的第一个思维导图"}
      />
    );
  };

  return (
    <View style={styles.container}>
      {/* 头部 */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>思维导图</Text>
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="搜索思维导图..."
          style={styles.searchBar}
        />
      </View>

      {/* 思维导图列表 */}
      <FlatList
        data={mindMaps}
        renderItem={renderMindMapItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        ListEmptyComponent={renderEmptyState}
      />

      {/* 加载指示器 */}
      {loading && !refreshing && (
        <ActivityIndicator
          style={styles.loader}
          size="large"
          color={colors.primary}
        />
      )}

      {/* 错误提示 */}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <Button title="重试" onPress={loadMindMaps} />
        </View>
      )}

      {/* 底部操作栏 */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.createButton, { backgroundColor: colors.primary }]}
          onPress={() => setShowCreateModal(true)}
        >
          <Icon name="add" size={24} color="#fff" />
          <Text style={styles.createButtonText}>新建思维导图</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.templateButton, { backgroundColor: colors.secondary }]}
          onPress={handleSelectTemplate}
        >
          <Icon name="dashboard" size={24} color="#fff" />
          <Text style={styles.createButtonText}>使用模板</Text>
        </TouchableOpacity>
      </View>

      {/* 创建思维导图模态框 */}
      <Modal
        visible={showCreateModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              创建新思维导图
            </Text>

            <TextInput
              style={[styles.input, { borderColor: colors.border, color: colors.text }]}
              placeholder="输入思维导图标题"
              placeholderTextColor={colors.placeholder}
              value={newMindMapTitle}
              onChangeText={setNewMindMapTitle}
              autoFocus
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.background }]}
                onPress={() => setShowCreateModal(false)}
              >
                <Text style={[styles.modalButtonText, { color: colors.text }]}>
                  取消
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.primary }]}
                onPress={handleCreateMindMap}
              >
                <Text style={[styles.modalButtonText, { color: '#fff' }]}>
                  创建
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// 样式
const getStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 16,
  },
  searchBar: {
    marginBottom: 8,
  },
  listContent: {
    flexGrow: 1,
    padding: 16,
  },
  mindMapItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: colors.card,
    borderRadius: 8,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  mindMapContent: {
    flex: 1,
  },
  mindMapTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 4,
  },
  mindMapDate: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  deleteButton: {
    padding: 8,
  },
  loader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  errorContainer: {
    padding: 16,
    alignItems: 'center',
  },
  errorText: {
    color: colors.error,
    marginBottom: 16,
  },
  bottomBar: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  createButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    marginRight: 8,
  },
  templateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
  },
  createButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 8,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: width * 0.8,
    padding: 24,
    borderRadius: 8,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  modalButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginLeft: 8,
  },
  modalButtonText: {
    fontWeight: 'bold',
  },
});

export default MindMapScreen;
