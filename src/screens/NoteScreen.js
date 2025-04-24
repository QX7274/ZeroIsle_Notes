import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useDispatch, useSelector } from 'react-redux';
import { loadNotes, addNote, updateNote, deleteNote } from '../store/slices/noteSlice';
import { offlineStorageService } from '../services/offlineStorage';
import { analyticsService } from '../services/analytics';
import Icon from 'react-native-vector-icons/Ionicons';

const NoteScreen = () => {
  const { theme } = useTheme();
  const dispatch = useDispatch();
  const notes = useSelector(state => state.note.notes);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [noteContent, setNoteContent] = useState('');
  const [noteTitle, setNoteTitle] = useState('');

  useEffect(() => {
    init();
    return () => {
      // 清理工作
    };
  }, []);

  const init = async () => {
    try {
      setLoading(true);
      await offlineStorageService.init();
      await loadLocalNotes();
    } catch (error) {
      console.error('初始化失败:', error);
      analyticsService.trackError(error, { operation: 'init' });
    } finally {
      setLoading(false);
    }
  };

  const loadLocalNotes = async () => {
    try {
      const localNotes = await offlineStorageService.getNotes();
      dispatch(loadNotes(localNotes));
    } catch (error) {
      console.error('加载本地笔记失败:', error);
      analyticsService.trackError(error, { operation: 'load_local_notes' });
    }
  };

  const handleSaveNote = async () => {
    if (!noteTitle.trim()) {
      Alert.alert('错误', '请输入笔记标题');
      return;
    }

    try {
      setSyncing(true);
      const note = {
        id: editingNote?.id || Date.now().toString(),
        title: noteTitle,
        content: noteContent,
        createdAt: editingNote?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (editingNote) {
        await dispatch(updateNote(note)).unwrap();
      } else {
        await dispatch(addNote(note)).unwrap();
      }

      await offlineStorageService.saveNote(note);
      setEditingNote(null);
      setNoteTitle('');
      setNoteContent('');
      analyticsService.trackNoteAction(editingNote ? 'update' : 'create', note.id);
    } catch (error) {
      Alert.alert('错误', '保存笔记失败');
      analyticsService.trackError(error, { operation: 'save_note' });
    } finally {
      setSyncing(false);
    }
  };

  const handleDeleteNote = async (note) => {
    try {
      setSyncing(true);
      await dispatch(deleteNote(note.id)).unwrap();
      await offlineStorageService.deleteNote(note.id);
      analyticsService.trackNoteAction('delete', note.id);
    } catch (error) {
      Alert.alert('错误', '删除笔记失败');
      analyticsService.trackError(error, { operation: 'delete_note' });
    } finally {
      setSyncing(false);
    }
  };

  const handleEditNote = (note) => {
    setEditingNote(note);
    setNoteTitle(note.title);
    setNoteContent(note.content);
  };

  const renderNote = ({ item }) => (
    <View style={[styles.noteItem, { backgroundColor: theme.cardBackground }]}>
      <View style={styles.noteInfo}>
        <Text style={[styles.noteTitle, { color: theme.text }]}>{item.title}</Text>
        <Text style={[styles.noteDate, { color: theme.textSecondary }]}>
          {new Date(item.updatedAt).toLocaleString()}
        </Text>
      </View>
      <View style={styles.noteActions}>
        <TouchableOpacity
          onPress={() => handleEditNote(item)}
          style={[styles.editButton, { backgroundColor: theme.primary }]}
        >
          <Icon name="pencil" size={20} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => handleDeleteNote(item)}
          style={[styles.deleteButton, { backgroundColor: theme.error }]}
        >
          <Icon name="trash" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {syncing && (
        <View style={styles.syncIndicator}>
          <ActivityIndicator size="small" color={theme.primary} />
          <Text style={[styles.syncText, { color: theme.text }]}>同步中...</Text>
        </View>
      )}
      
      {editingNote ? (
        <ScrollView style={styles.editorContainer}>
          <TextInput
            style={[styles.titleInput, { color: theme.text }]}
            placeholder="输入标题"
            placeholderTextColor={theme.textSecondary}
            value={noteTitle}
            onChangeText={setNoteTitle}
          />
          <TextInput
            style={[styles.contentInput, { color: theme.text }]}
            placeholder="输入内容"
            placeholderTextColor={theme.textSecondary}
            value={noteContent}
            onChangeText={setNoteContent}
            multiline
          />
          <View style={styles.editorActions}>
            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: theme.primary }]}
              onPress={handleSaveNote}
            >
              <Text style={styles.buttonText}>保存</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.cancelButton, { backgroundColor: theme.error }]}
              onPress={() => {
                setEditingNote(null);
                setNoteTitle('');
                setNoteContent('');
              }}
            >
              <Text style={styles.buttonText}>取消</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      ) : (
        <>
          <FlatList
            data={notes}
            renderItem={renderNote}
            keyExtractor={item => item.id.toString()}
            contentContainerStyle={styles.listContainer}
          />
          <View style={styles.addButtonContainer}>
            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: theme.primary }]}
              onPress={() => setEditingNote({})}
            >
              <Icon name="add" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  syncIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  syncText: {
    marginLeft: 10,
    fontSize: 14,
  },
  listContainer: {
    padding: 16,
  },
  noteItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  noteInfo: {
    flex: 1,
  },
  noteTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  noteDate: {
    fontSize: 12,
  },
  noteActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editButton: {
    padding: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  deleteButton: {
    padding: 8,
    borderRadius: 4,
  },
  editorContainer: {
    flex: 1,
    padding: 16,
  },
  titleInput: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  contentInput: {
    fontSize: 16,
    minHeight: 200,
    textAlignVertical: 'top',
  },
  editorActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  saveButton: {
    padding: 12,
    borderRadius: 4,
    flex: 1,
    marginRight: 8,
  },
  cancelButton: {
    padding: 12,
    borderRadius: 4,
    flex: 1,
  },
  buttonText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  addButtonContainer: {
    position: 'absolute',
    bottom: 16,
    right: 16,
  },
  addButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
});

export default NoteScreen; 