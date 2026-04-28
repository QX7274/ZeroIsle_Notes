/**
 * 思维导图列表屏幕
 */

import React, { useCallback, useState } from 'react';
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
  Platform,
  ToastAndroid,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../context/ThemeContext';
import { Button, EmptyState } from '../../components/common';
import { UnifiedSearchBar } from '../../components/search';
import analyticsService from '../../services/analytics/analyticsService';
import mindMapApi from '../../services/api/mindMapApi';

const { width } = Dimensions.get('window');

const MindMapScreen = () => {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const styles = getStyles(colors);

  const [mindMaps, setMindMaps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newMindMapTitle, setNewMindMapTitle] = useState('');
  const [error, setError] = useState(null);

  const notifyNonBlocking = (message) => {
    setError(message);
    if (Platform.OS === 'android') {
      ToastAndroid.show(message, ToastAndroid.SHORT);
    }
  };

  const loadMindMaps = useCallback(async (query = searchQuery) => {
    try {
      setLoading(true);
      setError(null);

      const response = await mindMapApi.getMindMaps({ search: query });
      const results = Array.isArray(response?.data?.results) ? response.data.results : [];

      setMindMaps(results);
      analyticsService.trackEvent('view_mind_maps', { count: results.length, local_first: true });
    } catch (err) {
      console.error('加载思维导图失败:', err);
      setMindMaps([]);
      setError(err?.message || '加载思维导图失败，请稍后重试');
      analyticsService.trackError(err, { action: 'load_mind_maps' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [searchQuery]);

  useFocusEffect(
    React.useCallback(() => {
      loadMindMaps(searchQuery);
    }, [searchQuery, loadMindMaps])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadMindMaps(searchQuery);
  };

  const handleCreateMindMap = async () => {
    const trimmedTitle = newMindMapTitle.trim();

    if (!trimmedTitle) {
      notifyNonBlocking('请输入思维导图标题');
      return;
    }

    try {
      const response = await mindMapApi.createMindMap({
        title: trimmedTitle,
        description: '',
        layout_type: 'tree',
        theme: 'default',
      });

      if (!response.success || !response.data?.id) {
        throw new Error('创建思维导图失败');
      }

      analyticsService.trackEvent('create_mind_map', { id: response.data.id, local_first: true });
      setShowCreateModal(false);
      setNewMindMapTitle('');
      await loadMindMaps(searchQuery);
      navigation.navigate('MindMapEdit', { mindMapId: response.data.id });
    } catch (err) {
      console.error('创建思维导图失败:', err);
      notifyNonBlocking(err?.message || '创建思维导图失败，请稍后重试');
      analyticsService.trackError(err, { action: 'create_mind_map' });
    }
  };

  const handleDeleteMindMap = (mindMap) => {
    Alert.alert(
      '确认删除',
      `确定要删除思维导图“${mindMap.title}”吗？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await mindMapApi.deleteMindMap(mindMap.id);
              if (!response.success) {
                throw new Error('删除思维导图失败');
              }

              setMindMaps((current) => current.filter((item) => item.id !== mindMap.id));
              analyticsService.trackEvent('delete_mind_map', { id: mindMap.id, local_first: true });
            } catch (err) {
              console.error('删除思维导图失败:', err);
              notifyNonBlocking(err?.message || '删除思维导图失败，请稍后重试');
              analyticsService.trackError(err, { action: 'delete_mind_map' });
            }
          },
        },
      ]
    );
  };

  const renderMindMapItem = ({ item }) => (
    <TouchableOpacity
      style={styles.mindMapItem}
      onPress={() => navigation.navigate('MindMapEdit', { mindMapId: item.id })}
      activeOpacity={0.85}
    >
      <View style={styles.mindMapContent}>
        <Text style={styles.mindMapTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.mindMapMeta}>{item.node_count || 0} 个节点</Text>
        <Text style={styles.mindMapDate}>{new Date(item.updated_at).toLocaleString()}</Text>
      </View>

      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => handleDeleteMindMap(item)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Icon name="delete-outline" size={22} color={colors.error} />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: `${colors.primary}15` }]}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-back" size={22} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerBarTitle}>思维导图</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.header}>
        <UnifiedSearchBar
          searchScope="mind_map"
          placeholder="搜索本地思维导图..."
          style={styles.searchBar}
          initialQuery={searchQuery}
          onSearch={(_, query) => {
            const normalizedQuery = query || '';
            setSearchQuery(normalizedQuery);
            loadMindMaps(normalizedQuery);
          }}
          onCancel={() => loadMindMaps(searchQuery)}
        />
      </View>

      <FlatList
        data={mindMaps}
        renderItem={renderMindMapItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        ListEmptyComponent={loading ? null : (
          <EmptyState
            icon="bubble-chart"
            title="还没有思维导图"
            message={searchQuery ? '没有找到匹配结果，请尝试其他关键词' : '点击下方按钮创建第一张本地思维导图'}
          />
        )}
      />

      {loading && !refreshing ? (
        <ActivityIndicator style={styles.loader} size="large" color={colors.primary} />
      ) : null}

      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <Button title="重试" onPress={() => loadMindMaps(searchQuery)} />
        </View>
      ) : null}

      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.createButton, { backgroundColor: colors.primary }]}
          onPress={() => setShowCreateModal(true)}
        >
          <Icon name="add" size={22} color="#fff" />
          <Text style={styles.bottomButtonText}>新建思维导图</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.templateButton, { backgroundColor: colors.secondary }]}
          onPress={() => navigation.navigate('MindMapTemplate')}
        >
          <Icon name="dashboard" size={22} color="#fff" />
          <Text style={styles.bottomButtonText}>内置模板</Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={showCreateModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>创建新思维导图</Text>

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
                onPress={() => {
                  setShowCreateModal(false);
                  setNewMindMapTitle('');
                }}
              >
                <Text style={[styles.modalButtonText, { color: colors.text }]}>取消</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.primary }]}
                onPress={handleCreateMindMap}
              >
                <Text style={styles.modalButtonTextInverse}>创建</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const getStyles = (colors) => StyleSheet.create({
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
  },
  headerBarTitle: {
    flex: 1,
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 18,
    color: colors.text,
  },
  headerSpacer: {
    width: 36,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchBar: {
    marginBottom: 0,
  },
  listContent: {
    flexGrow: 1,
    padding: 16,
    paddingBottom: 100,
  },
  mindMapItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: colors.card,
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  mindMapContent: {
    flex: 1,
  },
  mindMapTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 6,
  },
  mindMapMeta: {
    fontSize: 12,
    color: colors.primary,
    marginBottom: 4,
  },
  mindMapDate: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  deleteButton: {
    padding: 8,
    marginLeft: 8,
  },
  loader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
  },
  errorContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    alignItems: 'center',
  },
  errorText: {
    color: colors.error,
    marginBottom: 12,
    textAlign: 'center',
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  createButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    marginRight: 8,
  },
  templateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
  },
  bottomButtonText: {
    color: '#fff',
    fontWeight: '700',
    marginLeft: 8,
    fontSize: 13,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  modalContent: {
    width: width * 0.82,
    padding: 24,
    borderRadius: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  modalButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginLeft: 8,
  },
  modalButtonText: {
    fontWeight: '700',
  },
  modalButtonTextInverse: {
    fontWeight: '700',
    color: '#fff',
  },
});

export default MindMapScreen;
