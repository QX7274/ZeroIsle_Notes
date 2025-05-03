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
      
      const response = await apiService.get('/mind-map/maps/', {
        params: { search: searchQuery }
      });
      
      setMindMaps(response.data.results);
      analyticsService.trackEvent('view_mind_maps', { count: response.data.results.length });
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
    navigation.navigate('MindMapEdit', { mindMapId: mindMap.id });
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
