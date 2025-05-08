/**
 * 笔记列表屏幕
 */

import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { fetchNotes } from '../../redux/slices/notesSlice';
import { Button, Card, Loading } from '../../components/common';
import { COLORS as colors } from '../../utils/constants/colors';
// 直接导入 spacing 和 borderRadius
import { spacing, borderRadius } from '../../utils/constants/dimensions';
// 创建一个兼容的 dimensions 对象，确保它不会是 undefined
const dimensions = {
  spacing: spacing || {
    tiny: 4,
    small: 8,
    medium: 16,
    large: 24,
    extraLarge: 32,
    xxlarge: 48,
  },
  borderRadius: borderRadius || {
    small: 4,
    medium: 8,
    large: 16,
    xlarge: 24,
    round: 999,
  }
};
import Icon from 'react-native-vector-icons/MaterialIcons';

const NoteListScreen = ({ navigation }) => {
  const dispatch = useDispatch();
  const { entities, isLoading, error } = useSelector(state => state.notes);
  const [refreshing, setRefreshing] = useState(false);

  // 获取笔记列表
  useEffect(() => {
    loadNotes();
  }, []);

  // 加载笔记
  const loadNotes = () => {
    dispatch(fetchNotes());
  };

  // 下拉刷新
  const handleRefresh = () => {
    setRefreshing(true);
    dispatch(fetchNotes()).finally(() => setRefreshing(false));
  };

  // 创建新笔记
  const handleCreateNote = () => {
    navigation.navigate('NoteEdit', { isNew: true });
  };

  // 打开无限草稿
  const handleOpenInfiniteCanvas = () => {
    navigation.navigate('InfiniteCanvasList');
  };

  // 查看笔记详情
  const handleViewNote = (note) => {
    navigation.navigate('NoteDetail', { noteId: note.id });
  };

  // 渲染笔记项
  const renderNoteItem = ({ item }) => (
    <TouchableOpacity onPress={() => handleViewNote(item)}>
      <Card style={styles.noteCard}>
        <Text style={styles.noteTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.noteContent} numberOfLines={2}>{item.content}</Text>
        <View style={styles.noteFooter}>
          <Text style={styles.noteDate}>
            {new Date(item.updated_at).toLocaleDateString()}
          </Text>
          {item.category && (
            <View style={styles.categoryTag}>
              <Text style={styles.categoryText}>{item.category.name}</Text>
            </View>
          )}
        </View>
      </Card>
    </TouchableOpacity>
  );

  // 渲染空状态
  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>暂无笔记</Text>
      <Text style={styles.emptySubText}>点击下方按钮创建您的第一条笔记</Text>
      <Button
        title="创建笔记"
        onPress={handleCreateNote}
        style={styles.createButton}
      />
    </View>
  );

  if (isLoading && !refreshing && entities.length === 0) {
    return <Loading type="fullscreen" text="加载中..." />;
  }

  return (
    <View style={styles.container}>
      {error && <Text style={styles.errorText}>{error}</Text>}

      <FlatList
        data={entities}
        renderItem={renderNoteItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        ListEmptyComponent={renderEmptyList}
      />

      {/* 悬浮按钮 */}
      <View style={styles.fabContainer}>
        <TouchableOpacity
          style={[styles.fab, styles.secondaryFab, { backgroundColor: colors.secondary }]}
          onPress={handleOpenInfiniteCanvas}
        >
          <Icon name="brush" size={22} color={colors.white} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.fab}
          onPress={handleCreateNote}
        >
          <Icon name="add" size={24} color={colors.white} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listContent: {
    padding: dimensions.spacing.medium,
    flexGrow: 1,
  },
  noteCard: {
    marginBottom: dimensions.spacing.medium,
    padding: dimensions.spacing.medium,
  },
  noteTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: dimensions.spacing.small,
  },
  noteContent: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: dimensions.spacing.medium,
  },
  noteFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  noteDate: {
    fontSize: 12,
    color: colors.textLight,
  },
  categoryTag: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: dimensions.spacing.small,
    paddingVertical: 2,
    borderRadius: dimensions.borderRadius.small,
  },
  categoryText: {
    fontSize: 12,
    color: colors.primary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: dimensions.spacing.extraLarge,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textSecondary,
    marginBottom: dimensions.spacing.small,
  },
  emptySubText: {
    fontSize: 14,
    color: colors.textLight,
    textAlign: 'center',
    marginBottom: dimensions.spacing.large,
  },
  createButton: {
    marginTop: dimensions.spacing.medium,
  },
  fabContainer: {
    position: 'absolute',
    right: dimensions.spacing.large,
    bottom: dimensions.spacing.large,
    alignItems: 'center',
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  secondaryFab: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginBottom: dimensions.spacing.medium,
  },
  errorText: {
    color: colors.error,
    padding: dimensions.spacing.medium,
    textAlign: 'center',
  },
});

export default NoteListScreen;