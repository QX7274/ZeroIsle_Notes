import React, { useEffect, useState } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Text,
  Alert,
  ActivityIndicator,
  ToastAndroid,
  Platform
} from 'react-native';
import { pick, types } from '@react-native-documents/picker';
import { useTheme } from '../context/ThemeContext';
import { useDispatch, useSelector } from 'react-redux';
import { notesApi } from '../services/api';
import { addNote, updateNote, deleteNote } from '../redux/slices/notesSlice';
import Icon from 'react-native-vector-icons/Ionicons';

const HomeScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const dispatch = useDispatch();
  const notes = useSelector(state => state.notes.notes);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadNotes();
  }, []);

  const loadNotes = async () => {
    try {
      setIsLoading(true);
      const response = await notesApi.getAll();
      dispatch(updateNote(response));
    } catch (error) {
      console.error('加载笔记失败:', error);
      Alert.alert('错误', '加载笔记失败，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  // 导入PDF文件
  const importPDF = async () => {
    try {
      const results = await pick({
        type: [types.pdf],
        allowMultiSelection: false,
      });

      if (results && results.length > 0) {
        const file = results[0];
        setIsLoading(true);

        // 调用导入API
        const formData = new FormData();
        formData.append('file', {
          uri: file.uri,
          type: file.type,
          name: file.name,
        });

        // 这里应该调用实际的导入API
        // const response = await notesApi.importPDF(formData);

        // 模拟导入成功
        setTimeout(() => {
          setIsLoading(false);
          Alert.alert('成功', '导入PDF成功');
          loadNotes(); // 重新加载笔记列表
        }, 1500);
      }
    } catch (error) {
      setIsLoading(false);
      if (error.code !== 'DOCUMENT_PICKER_CANCELED') {
        console.error('导入PDF失败:', error);
        Alert.alert('错误', '导入PDF失败，请稍后重试');
      }
    }
  };

  // 导入Word文件
  const importWord = async () => {
    try {
      const results = await pick({
        type: [types.docx, types.doc],
        allowMultiSelection: false,
      });

      if (results && results.length > 0) {
        const file = results[0];
        setIsLoading(true);

        // 调用导入API
        const formData = new FormData();
        formData.append('file', {
          uri: file.uri,
          type: file.type,
          name: file.name,
        });

        // 这里应该调用实际的导入API
        // const response = await notesApi.importWord(formData);

        // 模拟导入成功
        setTimeout(() => {
          setIsLoading(false);
          Alert.alert('成功', '导入Word文档成功');
          loadNotes(); // 重新加载笔记列表
        }, 1500);
      }
    } catch (error) {
      setIsLoading(false);
      if (error.code !== 'DOCUMENT_PICKER_CANCELED') {
        console.error('导入Word失败:', error);
        Alert.alert('错误', '导入Word文档失败，请稍后重试');
      }
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
      <Text style={[styles.emptyTitle, { color: colors.text }]}>欢迎使用零屿笔记</Text>
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

  // 渲染加载指示器
  const renderLoader = () => {
    if (isLoading) {
      return (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      );
    }
    return null;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {renderLoader()}
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
          onPress={() => {
            // 显示创建选项
            Alert.alert(
              '创建笔记',
              '请选择创建方式',
              [
                {
                  text: '新建笔记',
                  onPress: () => navigation.navigate('Note', { note: null }),
                },
                {
                  text: '导入PDF',
                  onPress: () => importPDF(),
                },
                {
                  text: '导入Word',
                  onPress: () => importWord(),
                },
                {
                  text: '无限画布',
                  onPress: () => Alert.alert('提示', '无限画布功能正在开发中'),
                },
                {
                  text: '取消',
                  style: 'cancel',
                },
              ]
            );
          }}
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
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.27,
    shadowRadius: 4.65,
  },
  // 加载指示器样式
  loaderContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    zIndex: 999,
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