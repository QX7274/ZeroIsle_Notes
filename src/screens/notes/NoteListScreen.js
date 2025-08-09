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
    // 使用_id或id作为noteId
    const noteId = note._id || note.id;
    console.log('打开笔记详情，笔记ID:', noteId, '笔记数据:', note);

    // 检查是否是PDF或Word文件
    const isPdf =
      note.type === 'pdf' ||
      note.file_type === 'pdf' ||
      (note.file_name && note.file_name.toLowerCase().endsWith('.pdf')) ||
      (note.file_uri && note.file_uri.toLowerCase().endsWith('.pdf'));

    const isWord =
      note.type === 'doc' ||
      note.type === 'docx' ||
      note.file_type === 'doc' ||
      note.file_type === 'docx' ||
      (note.file_name && (note.file_name.toLowerCase().endsWith('.doc') || note.file_name.toLowerCase().endsWith('.docx'))) ||
      (note.file_uri && (note.file_uri.toLowerCase().endsWith('.doc') || note.file_uri.toLowerCase().endsWith('.docx')));

    // 检查是否有文件URI
    if (isPdf || isWord) {
      console.log(`检测到${isPdf ? 'PDF' : 'Word'}文件，导航到文件查看器`);

      // 尝试获取文件URI
      const possibleUris = [
        note.file_uri,
        note.uri,
        note.path,
        note.file_path,
        note.url
      ].filter(Boolean);

      if (possibleUris.length > 0) {
        console.log('找到文件URI:', possibleUris[0]);

        // 导航到FileViewer
        navigation.navigate('FileViewer', {
          uri: possibleUris[0],
          name: note.title || (isPdf ? '未命名PDF' : '未命名Word文档'),
          type: isPdf ? 'pdf' : 'doc',
          noteId: noteId
        });
      } else {
        console.warn('文件没有有效的URI，导航到普通笔记详情');

        // 导航到普通笔记详情
        navigation.navigate('NoteDetail', {
          noteId: noteId,
          title: note.title
        });
      }
    } else {
      // 导航到普通笔记详情
      navigation.navigate('NoteDetail', {
        noteId: noteId,
        title: note.title
      });
    }
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