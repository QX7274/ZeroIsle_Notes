import React, { useState, useEffect } from 'react';
import { View, Modal, TextInput, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Text } from './Typography';
import realmService from '../../services/database/realmService';

const BlockReferenceModal = ({ visible, onClose, onSelectBlock }) => {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);

  useEffect(() => {
    if (query.length > 2) {
      const searchBlocks = async () => {
        const realm = await realmService.getRealm();
        const allNotes = realm.objects('Note');
        const searchResults = [];

        allNotes.forEach(note => {
          if (note.content) {
            const lines = note.content.split('\n');
            lines.forEach(line => {
              const blockIdMatch = line.match(/\^([a-zA-Z0-9]+)$/);
              if (blockIdMatch && line.toLowerCase().includes(query.toLowerCase())) {
                const blockId = blockIdMatch[1];
                const content = line.replace(/\s\^([a-zA-Z0-9]+)$/, '').trim();
                searchResults.push({ id: blockId, content, noteTitle: note.title });
              }
            });
          }
        });
        setResults(searchResults);
      };
      searchBlocks();
    } else {
      setResults([]);
    }
  }, [query]);

  const renderItem = ({ item }) => (
    <TouchableOpacity style={styles.resultItem} onPress={() => onSelectBlock(item.id)}>
      <Text style={styles.resultContent}>{item.content}</Text>
      <Text style={styles.resultNoteTitle}>in: {item.noteTitle}</Text>
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} transparent={true} animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search for a block..."
            placeholderTextColor={theme.colors.textSecondary}
            value={query}
            onChangeText={setQuery}
            autoFocus
          />
          <FlatList
            data={results}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            ListEmptyComponent={<Text style={styles.emptyText}>No blocks found.</Text>}
          />
        </View>
      </View>
    </Modal>
  );
};

const getStyles = (theme) => StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    height: '50%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  searchInput: {
    fontSize: 18,
    color: theme.colors.text,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    marginBottom: 15,
    paddingBottom: 10,
  },
  resultItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  resultContent: {
    fontSize: 16,
    color: theme.colors.text,
  },
  resultNoteTitle: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 20,
    color: theme.colors.textSecondary,
  },
});

export default BlockReferenceModal;

