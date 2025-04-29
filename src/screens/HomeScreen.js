import React, { useEffect } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Text
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useDispatch, useSelector } from 'react-redux';
import { notesApi } from '../services/api';
import { addNote, updateNote, deleteNote } from '../redux/slices/notesSlice';
import Icon from 'react-native-vector-icons/Ionicons';

const HomeScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const dispatch = useDispatch();
  const notes = useSelector(state => state.notes.notes);

  useEffect(() => {
    loadNotes();
  }, []);

  const loadNotes = async () => {
    try {
      const response = await notesApi.getAll();
      dispatch(updateNote(response));
    } catch (error) {
      console.error('加载笔记失败:', error);
    }
  };

  const renderNoteItem = ({ item }) => (
    <TouchableOpacity
      style={[styles.noteItem, { backgroundColor: colors.card }]}
      onPress={() => navigation.navigate('Note', { note: item })}
    >
      <Text style={[styles.noteTitle, { color: colors.text }]}>
        {item.title}
      </Text>
      <Text style={[styles.noteContent, { color: colors.text }]}>
        {item.content}
      </Text>
      <View style={styles.noteFooter}>
        <Text style={[styles.noteDate, { color: colors.text }]}>
          {item.updatedAt}
        </Text>
        <TouchableOpacity
          onPress={() => handleDeleteNote(item.id)}
          style={styles.deleteButton}
        >
          <Icon name="trash-outline" size={20} color={colors.notification} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const handleDeleteNote = async (id) => {
    try {
      await notesApi.delete(id);
      dispatch(deleteNote(id));
    } catch (error) {
      console.error('删除笔记失败:', error);
    }
  };

  // 渲染空状态的欢迎界面
  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Icon name="document-text-outline" size={80} color={colors.primary} />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>欢迎使零屿u笔记</Text>
      <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
        您还没有创建任何笔记，点击右下角的按钮开始创建吧！
      </Text>

      <View style={[styles.aiAssistantCard, { backgroundColor: colors.primaryContainer }]}>
        <View style={styles.aiAssistantHeader}>
          <Icon name="bulb-outline" size={24} color={colors.primary} />
          <Text style={[styles.aiAssistantTitle, { color: colors.text }]}>AI助手</Text>
        </View>
        <Text style={[styles.aiAssistantDesc, { color: colors.textSecondary }]}>
          使用我们的AI助手帮助您更高效地记录和整理笔记，提供智能建议和内容分析。
        </Text>
        <TouchableOpacity
          style={[styles.aiAssistantButton, { backgroundColor: colors.primary }]}
          onPress={() => navigation.navigate('AIAssistant')}
        >
          <Text style={[styles.aiAssistantButtonText, { color: colors.onPrimary }]}>立即体验</Text>
          <Icon name="arrow-forward-outline" size={18} color={colors.onPrimary} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {notes && notes.length > 0 ? (
        <FlatList
          data={notes}
          renderItem={renderNoteItem}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={styles.listContainer}
        />
      ) : (
        renderEmptyState()
      )}

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: colors.primary }]}
          onPress={() => navigation.navigate('Note', { note: null })}
        >
          <Icon name="add" size={30} color={colors.onPrimary} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  listContainer: {
    padding: 16
  },
  noteItem: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    elevation: 2
  },
  noteTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8
  },
  noteContent: {
    fontSize: 14,
    marginBottom: 8
  },
  noteFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  noteDate: {
    fontSize: 12
  },
  deleteButton: {
    padding: 4
  },
  buttonContainer: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    flexDirection: 'column',
  },
  addButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4
  },
  // 空状态样式
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  // AI助手卡片样式
  aiAssistantCard: {
    width: '100%',
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
    elevation: 2,
  },
  aiAssistantHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  aiAssistantTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  aiAssistantDesc: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  aiAssistantButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  aiAssistantButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    marginRight: 4,
  }
});

export default HomeScreen;