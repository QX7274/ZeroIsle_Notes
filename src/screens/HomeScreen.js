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

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={notes}
        renderItem={renderNoteItem}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={styles.listContainer}
      />
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.aiButton, { backgroundColor: colors.primary }]}
          onPress={() => navigation.navigate('AIAssistant')}
        >
          <Icon name="chatbubble-ellipses" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: colors.primary }]}
          onPress={() => navigation.navigate('Note', { note: null })}
        >
          <Icon name="add" size={30} color="#FFFFFF" />
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
  aiButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    elevation: 4
  }
});

export default HomeScreen;