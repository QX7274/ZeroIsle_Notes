import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchNotes,
  fetchCategories,
  fetchTags,
  createNote,
  updateNote,
  deleteNote
} from '../store/slices/notesSlice';
import { NoteList, NoteEditor, NoteDetail } from '../components/notes';
import { Button } from '../components/common';
import { Text } from '../components/common/Typography';
import Icon from 'react-native-vector-icons/MaterialIcons';

const NoteScreen = ({ navigation, route }) => {
  const { theme } = useTheme();
  const { colors } = theme;
  const dispatch = useDispatch();

  // 从Redux获取状态
  const notes = useSelector(state => state.notes.notes);
  const categories = useSelector(state => state.notes.categories);
  const tags = useSelector(state => state.notes.tags);
  const currentNote = useSelector(state => state.notes.currentNote);
  const isLoading = useSelector(state => state.notes.isLoading);
  const error = useSelector(state => state.notes.error);

  // 本地状态
  const [view, setView] = useState('list'); // list, detail, edit
  const [refreshing, setRefreshing] = useState(false);
  const [selectedNote, setSelectedNote] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [layout, setLayout] = useState('list'); // list, grid

  // 初始化
  useEffect(() => {
    loadData();

    // 如果有路由参数，处理它们
    if (route.params) {
      if (route.params.noteId) {
        handleViewNote({ id: route.params.noteId });
      }
    }
  }, [dispatch, route.params]);

  // 加载数据
  const loadData = async () => {
    try {
      // 获取笔记列表
      dispatch(fetchNotes());

      // 获取分类和标签
      dispatch(fetchCategories());
      dispatch(fetchTags());
    } catch (error) {
      console.error('加载数据失败:', error);
    }
  };

  // 刷新数据
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // 查看笔记详情
  const handleViewNote = (note) => {
    setSelectedNote(note);
    setView('detail');

    // 更新导航标题
    navigation.setOptions({
      title: note.title || '笔记详情',
    });
  };

  // 编辑笔记
  const handleEditNote = (note) => {
    setSelectedNote(note);
    setView('edit');

    // 更新导航标题
    navigation.setOptions({
      title: note ? '编辑笔记' : '新建笔记',
    });
  };

  // 创建新笔记
  const handleCreateNote = () => {
    setSelectedNote(null);
    setView('edit');

    // 更新导航标题
    navigation.setOptions({
      title: '新建笔记',
    });
  };

  // 保存笔记
  const handleSaveNote = async (note) => {
    try {
      if (note.id) {
        // 更新笔记
        await dispatch(updateNote({
          id: note.id,
          noteData: note,
        })).unwrap();

        // 更新成功后返回详情页
        handleViewNote(note);
      } else {
        // 创建笔记
        const result = await dispatch(createNote(note)).unwrap();

        // 创建成功后返回详情页
        if (result) {
          handleViewNote(result);
        } else {
          // 返回列表页
          handleBackToList();
        }
      }
    } catch (error) {
      Alert.alert('错误', error.message || '保存笔记失败');
    }
  };

  // 删除笔记
  const handleDeleteNote = (note) => {
    Alert.alert(
      '确认删除',
      `确定要删除笔记"${note.title}"吗？此操作不可恢复。`,
      [
        {
          text: '取消',
          style: 'cancel',
        },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            try {
              await dispatch(deleteNote(note.id)).unwrap();

              // 删除成功后返回列表页
              handleBackToList();

              // 显示成功提示
              Alert.alert('提示', '笔记已删除');
            } catch (error) {
              Alert.alert('错误', error.message || '删除笔记失败');
            }
          },
        },
      ]
    );
  };

  // 返回列表页
  const handleBackToList = () => {
    setView('list');
    setSelectedNote(null);

    // 更新导航标题
    navigation.setOptions({
      title: '笔记',
    });
  };

  // 切换布局
  const toggleLayout = () => {
    setLayout(layout === 'list' ? 'grid' : 'list');
  };

  // 渲染加载状态
  if (isLoading && notes.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // 渲染错误状态
  if (error && notes.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.errorContainer}>
          <Icon name="error-outline" size={64} color={colors.error} />
          <Text
            variant="body"
            size="large"
            color="error"
            center
            style={styles.errorText}
          >
            {error}
          </Text>
          <Button
            title="重试"
            onPress={loadData}
            type="outline"
            style={styles.retryButton}
          />
        </View>
      </View>
    );
  }

  // 渲染笔记列表
  if (view === 'list') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <NoteList
          notes={notes}
          onNotePress={handleViewNote}
          onEditPress={handleEditNote}
          onDeletePress={handleDeleteNote}
          onRefresh={handleRefresh}
          refreshing={refreshing}
          loading={isLoading}
          layout={layout}
          emptyText="暂无笔记，点击右下角按钮创建"
        />

        {/* 浮动按钮 */}
        <View style={styles.fabContainer}>
          <Button
            title=""
            onPress={toggleLayout}
            style={[styles.layoutButton, { backgroundColor: colors.card }]}
            textStyle={{ color: colors.text }}
            size="small"
          >
            <Icon
              name={layout === 'list' ? 'grid-view' : 'view-list'}
              size={24}
              color={colors.text}
            />
          </Button>

          <Button
            title=""
            onPress={handleCreateNote}
            style={styles.addButton}
            size="large"
          >
            <Icon name="add" size={24} color={colors.card} />
          </Button>
        </View>
      </View>
    );
  }

  // 渲染笔记详情
  if (view === 'detail') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <NoteDetail
          note={selectedNote}
          onEdit={() => handleEditNote(selectedNote)}
          onDelete={() => handleDeleteNote(selectedNote)}
          onBack={handleBackToList}
          relatedNotes={[]} // 相关笔记，可以从API获取
          onRelatedNotePress={handleViewNote}
        />
      </View>
    );
  }

  // 渲染笔记编辑器
  if (view === 'edit') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <NoteEditor
          note={selectedNote}
          onSave={handleSaveNote}
          onCancel={handleBackToList}
          categories={categories}
          tags={tags}
          loading={isLoading}
        />
      </View>
    );
  }

  // 默认渲染
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    marginTop: 16,
    marginBottom: 24,
  },
  retryButton: {
    minWidth: 120,
  },
  fabContainer: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    flexDirection: 'column',
    alignItems: 'flex-end',
  },
  layoutButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  addButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default NoteScreen;