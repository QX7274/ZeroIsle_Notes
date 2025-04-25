import React, { useState, useEffect } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Text,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useDispatch, useSelector } from 'react-redux';
import { notesApi } from '../../services/api';
import { addNote, updateNote } from '../../store/actions/notesActions';
import Icon from 'react-native-vector-icons/Ionicons';
import { dateUtils } from '../../utils';

const NoteScreen = ({ route, navigation }) => {
  const { colors } = useTheme();
  const dispatch = useDispatch();
  const { note } = route.params;

  const [title, setTitle] = useState(note?.title || '');
  const [content, setContent] = useState(note?.content || '');
  const [isEditing, setIsEditing] = useState(!note);

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={handleEdit}
          style={styles.headerButton}
        >
          <Icon
            name={isEditing ? 'checkmark' : 'pencil'}
            size={24}
            color={colors.primary}
          />
        </TouchableOpacity>
      )
    });
  }, [isEditing]);

  const handleEdit = async () => {
    if (isEditing) {
      try {
        const noteData = {
          title,
          content,
          updatedAt: dateUtils.format(new Date())
        };

        if (note) {
          const updatedNote = await notesApi.update(note.id, noteData);
          dispatch(updateNote(updatedNote));
        } else {
          const newNote = await notesApi.create(noteData);
          dispatch(addNote(newNote));
        }
        navigation.goBack();
      } catch (error) {
        console.error('保存笔记失败:', error);
      }
    }
    setIsEditing(!isEditing);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {isEditing ? (
        <>
          <TextInput
            style={[styles.titleInput, { color: colors.text }]}
            placeholder="标题"
            placeholderTextColor={colors.text + '80'}
            value={title}
            onChangeText={setTitle}
          />
          <TextInput
            style={[styles.contentInput, { color: colors.text }]}
            placeholder="内容"
            placeholderTextColor={colors.text + '80'}
            value={content}
            onChangeText={setContent}
            multiline
            textAlignVertical="top"
          />
        </>
      ) : (
        <View style={styles.noteView}>
          <Text style={[styles.noteTitle, { color: colors.text }]}>
            {title}
          </Text>
          <Text style={[styles.noteContent, { color: colors.text }]}>
            {content}
          </Text>
        </View>
      )}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16
  },
  titleInput: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16
  },
  contentInput: {
    flex: 1,
    fontSize: 16,
    lineHeight: 24
  },
  noteView: {
    flex: 1
  },
  noteTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16
  },
  noteContent: {
    fontSize: 16,
    lineHeight: 24
  },
  headerButton: {
    marginRight: 16,
    padding: 4
  }
});

export default NoteScreen;