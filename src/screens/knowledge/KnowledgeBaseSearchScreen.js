import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Clipboard,
  ActivityIndicator,
  ToastAndroid,
  Platform,
  Modal,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Text } from '../../components/common/Typography';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useSelector } from 'react-redux';
import { buildSimpleDocsFromNodes } from '../../services/kbLocalIndex';
import { getSnippets, toDoc } from '../../services/kbSnippetStore';
import { searchTopSnippets } from '../../services/kbLocalIndex';
import Highlighter from '../../components/common/Highlighter';
import noteService from '../../services/notes/noteService';

const KnowledgeBaseSearchScreen = ({ route, navigation }) => {
  const { kbId } = route.params;
  const { theme } = useTheme();
  const styles = getStyles(theme);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [docs, setDocs] = useState([]);
  const [activeFilter, setActiveFilter] = useState('all'); // 'all', 'pdf', 'node'
  const [isSearching, setIsSearching] = useState(false);
  const [inlineHint, setInlineHint] = useState('');
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [activeResult, setActiveResult] = useState(null);

  const notifyNonBlocking = (message) => {
    if (!message) {
      return;
    }
    setInlineHint(message);
    if (Platform.OS === 'android') {
      ToastAndroid.show(message, ToastAndroid.SHORT);
    }
  };

  const { nodes } = useSelector((state) => state.knowledgeBase);

  useEffect(() => {
    (async () => {
      try {
        const nodeDocs = buildSimpleDocsFromNodes(nodes || []);
        const snippetList = await getSnippets(kbId);
        const snippetDocs = (snippetList || []).map(toDoc);
        setDocs([...snippetDocs, ...nodeDocs]);
      } catch (e) {
        setDocs(buildSimpleDocsFromNodes(nodes || []));
      }
    })();
  }, [nodes, kbId]);

  useEffect(() => {
    const handler = setTimeout(() => {
      if (query.trim().length > 1) {
        setIsSearching(true);
        let searchResults = searchTopSnippets(docs, query, 50);
        if (activeFilter === 'pdf') {
          searchResults = searchResults.filter(item => item.source.type === 'pdf');
        } else if (activeFilter === 'node') {
          searchResults = searchResults.filter(item => item.source.type === 'node');
        }
        setResults(searchResults);
        setIsSearching(false);
      } else {
        setResults([]);
      }
    }, 300); // Debounce search input

    return () => {
      clearTimeout(handler);
    };
  }, [query, docs, activeFilter]);

  const goToSource = (item) => {
    if (item?.source?.type === 'pdf' && item.source.uri) {
      const pageMatch = item.source.anchor?.match(/#p(\d+)/);
      const targetPage = pageMatch ? parseInt(pageMatch[1], 10) : undefined;
      navigation.navigate('FileViewer', {
        uri: item.source.uri,
        name: item.source.title,
        type: 'pdf',
        kbId: kbId,
        targetPage: targetPage,
      });
    }
  };

  const createNoteFromSnippet = async (item) => {
    try {
      const noteTitle = `来自 ${item.source.title} 的笔记`;
      const noteContent = `> 来源: ${item.source.title} (${item.source.anchor || 'N/A'})\n\n${item.text}`;
      await noteService.createNote({
        title: noteTitle,
        content: noteContent,
        type: 'markdown',
      });
      notifyNonBlocking('已创建新的 Markdown 笔记');
    } catch (e) {
      notifyNonBlocking('创建笔记失败');
    }
  };

  const copyText = (item) => {
    Clipboard.setString(item.text);
    notifyNonBlocking('片段内容已复制到剪贴板');
  };

  const renderItem = ({ item }) => {
    const handleLongPress = () => {
      setActiveResult(item);
      setShowActionMenu(true);
    };

    return (
      <TouchableOpacity
        style={styles.resultItem}
        onPress={() => goToSource(item)}
        onLongPress={handleLongPress}
      >
        <Text variant="label" size="medium" style={styles.itemTitle}>{item.source.title}</Text>
        <Highlighter
          style={styles.itemText}
          highlightStyle={{ backgroundColor: theme.colors.primary + '40' }}
          searchWords={query.split(' ')}
          textToHighlight={item.text.substring(0, 150) + '...'}
        />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {inlineHint ? <Text style={styles.hintText}>{inlineHint}</Text> : null}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Icon name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <TextInput
          style={styles.searchInput}
          placeholder="在知识库中搜索..."
          placeholderTextColor={theme.colors.textSecondary}
          value={query}
          onChangeText={setQuery}
          autoFocus
        />
      </View>

      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterChip, activeFilter === 'all' && styles.activeFilterChip]}
          onPress={() => setActiveFilter('all')}
        >
          <Text style={[styles.filterText, activeFilter === 'all' && styles.activeFilterText]}>All</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterChip, activeFilter === 'pdf' && styles.activeFilterChip]}
          onPress={() => setActiveFilter('pdf')}
        >
          <Text style={[styles.filterText, activeFilter === 'pdf' && styles.activeFilterText]}>PDFs</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterChip, activeFilter === 'node' && styles.activeFilterChip]}
          onPress={() => setActiveFilter('node')}
        >
          <Text style={[styles.filterText, activeFilter === 'node' && styles.activeFilterText]}>Notes</Text>
        </TouchableOpacity>
      </View>

      {isSearching ? (
        <ActivityIndicator style={{ marginTop: 20 }} color={theme.colors.primary} />
      ) : (
        <FlatList
          data={results}
          renderItem={renderItem}
          keyExtractor={(item) => item._id}
          style={styles.resultsList}
          ListEmptyComponent={() => (
            <View style={styles.emptyContainer}>
              <Icon name={query.trim().length > 1 ? 'search-off' : 'search'} size={48} color={theme.colors.textSecondary} />
              <Text style={styles.emptyText}>
                {query.trim().length > 1 ? 'No results found.' : 'Search for notes and snippets.'}
              </Text>
            </View>
          )}
        />
      )}

      <Modal
        transparent
        animationType="fade"
        visible={showActionMenu}
        onRequestClose={() => setShowActionMenu(false)}
      >
        <TouchableOpacity
          style={styles.modalMask}
          activeOpacity={1}
          onPress={() => setShowActionMenu(false)}
        >
          <View style={styles.actionSheet}>
            <Text style={styles.actionSheetTitle}>{activeResult?.source?.title || '操作'}</Text>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={async () => {
                const item = activeResult;
                setShowActionMenu(false);
                if (item) {
                  await createNoteFromSnippet(item);
                }
              }}
            >
              <Text style={styles.actionButtonText}>创建笔记</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => {
                const item = activeResult;
                setShowActionMenu(false);
                if (item) {
                  copyText(item);
                }
              }}
            >
              <Text style={styles.actionButtonText}>复制内容</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => {
                const item = activeResult;
                setShowActionMenu(false);
                if (item) {
                  goToSource(item);
                }
              }}
            >
              <Text style={styles.actionButtonText}>跳转到源</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.actionCancel]}
              onPress={() => setShowActionMenu(false)}
            >
              <Text style={styles.actionButtonText}>取消</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const getStyles = (theme) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    hintText: {
        marginHorizontal: 12,
        marginTop: 8,
        color: theme.colors.warning || '#ff9800',
        fontSize: 13,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingTop: 10,
        paddingBottom: 5,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
    },
    backButton: {
        padding: 5,
    },
    searchInput: {
        flex: 1,
        height: 40,
        backgroundColor: theme.colors.card,
        borderRadius: 20,
        paddingHorizontal: 15,
        marginLeft: 10,
        color: theme.colors.text,
    },
    resultsList: {
        flex: 1,
    },
    resultItem: {
        padding: 15,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
    },
    itemHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 5,
    },
    itemTitle: {
        fontWeight: 'bold',
        flex: 1,
    },
    createNoteButton: {
        padding: 5,
    },
    itemText: {
        color: theme.colors.textSecondary,
    },
    filterContainer: {
        flexDirection: 'row',
        paddingHorizontal: 15,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
    },
    filterChip: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        backgroundColor: theme.colors.card,
        marginRight: 10,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    activeFilterChip: {
        backgroundColor: theme.colors.primary,
        borderColor: theme.colors.primary,
    },
    filterText: {
        color: theme.colors.textSecondary,
    },
    activeFilterText: {
        color: theme.colors.onPrimary,
        fontWeight: 'bold',
    },
    modalMask: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.35)',
        justifyContent: 'flex-end',
    },
    actionSheet: {
        backgroundColor: theme.colors.card,
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        padding: 16,
        borderTopWidth: 1,
        borderColor: theme.colors.border,
    },
    actionSheetTitle: {
        fontSize: 14,
        color: theme.colors.textSecondary,
        marginBottom: 8,
    },
    actionButton: {
        paddingVertical: 12,
    },
    actionButtonText: {
        fontSize: 15,
        color: theme.colors.text,
        textAlign: 'center',
    },
    actionCancel: {
        borderTopWidth: 1,
        borderTopColor: theme.colors.border,
        marginTop: 4,
    },
});

export default KnowledgeBaseSearchScreen;

