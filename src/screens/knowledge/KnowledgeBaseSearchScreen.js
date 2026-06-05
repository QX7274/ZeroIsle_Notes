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
import { BlurView } from '@react-native-community/blur';
import { useTheme } from '../../context/ThemeContext';
import { Text } from '../../components/common/Typography';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useSelector } from 'react-redux';
import { buildSimpleDocsFromNodes } from '../../services/kbLocalIndex';
import { getSnippets, toDoc } from '../../services/kbSnippetStore';
import { searchTopSnippets } from '../../services/kbLocalIndex';
import Highlighter from '../../components/common/Highlighter';
import ScreenHeaderBackButton from '../../components/common/ScreenHeaderBackButton';
import noteService from '../../services/notes/noteService';

const SEARCHING_INDICATOR_STYLE = { marginTop: 20 };

const KnowledgeBaseSearchScreen = ({ route, navigation }) => {
  const { kbId } = route.params || {};
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
  const trimmedQuery = useMemo(() => query.trim(), [query]);
  const shouldSearch = useMemo(() => trimmedQuery.length > 1, [trimmedQuery]);

  const closeActionMenu = () => {
    setShowActionMenu(false);
    setActiveResult(null);
  };

  const openActionMenu = (item) => {
    setActiveResult(item);
    setShowActionMenu(true);
  };

  const handleGoBack = () => {
    navigation.goBack();
  };

  const handleQueryChange = (text) => {
    setQuery(text);
    if (showActionMenu) {
      closeActionMenu();
    }
    if (inlineHint) {
      setInlineHint('');
    }
  };

  const setFilter = (filter) => {
    if (activeFilter === filter) {
      return;
    }
    if (showActionMenu) {
      closeActionMenu();
    }
    setActiveFilter(filter);
    setInlineHint('');
  };

  const handleResultLongPress = (item) => {
    openActionMenu(item);
  };

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
    let isMounted = true;
    (async () => {
      try {
        const nodeDocs = buildSimpleDocsFromNodes(nodes || []);
        const snippetList = await getSnippets(kbId);
        const snippetDocs = (snippetList || []).map(toDoc);
        if (isMounted) {
          setDocs([...snippetDocs, ...nodeDocs]);
        }
      } catch (e) {
        if (isMounted) {
          setDocs(buildSimpleDocsFromNodes(nodes || []));
        }
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [nodes, kbId]);

  useEffect(() => {
    const handler = setTimeout(() => {
      if (shouldSearch) {
        setIsSearching(true);
        let searchResults = searchTopSnippets(docs, trimmedQuery, 50);
        if (activeFilter === 'pdf') {
          searchResults = searchResults.filter(item => item.source.type === 'pdf');
        } else if (activeFilter === 'node') {
          searchResults = searchResults.filter(item => item.source.type === 'node');
        }
        setResults(searchResults);
        setIsSearching(false);
      } else {
        setResults([]);
        setIsSearching(false);
      }
    }, 300); // Debounce search input

    return () => {
      clearTimeout(handler);
    };
  }, [trimmedQuery, shouldSearch, docs, activeFilter]);

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

  const handleCreateNoteFromActive = async () => {
    const item = activeResult;
    closeActionMenu();
    if (item) {
      await createNoteFromSnippet(item);
    }
  };

  const handleCopyActiveText = () => {
    const item = activeResult;
    closeActionMenu();
    if (item) {
      copyText(item);
    }
  };

  const handleGoToActiveSource = () => {
    const item = activeResult;
    closeActionMenu();
    if (item) {
      goToSource(item);
    }
  };

  const searchWords = useMemo(() => trimmedQuery.split(' ').filter(Boolean), [trimmedQuery]);
  const renderListEmpty = () => (
    <View style={styles.emptyContainer}>
      <Icon name={shouldSearch ? 'search-off' : 'search'} size={48} color={theme.colors.textSecondary} />
      <Text style={styles.emptyText}>
        {shouldSearch ? '未找到匹配结果。' : '搜索笔记和片段内容。'}
      </Text>
    </View>
  );

  const renderItem = ({ item }) => {
    return (
      <TouchableOpacity
        style={styles.resultItem}
        onPress={() => goToSource(item)}
        onLongPress={() => handleResultLongPress(item)}
      >
        <Text variant="label" size="medium" style={styles.itemTitle}>{item.source.title}</Text>
        <Highlighter
          style={styles.itemText}
          highlightStyle={{ backgroundColor: theme.colors.primary + '40' }}
          searchWords={searchWords}
          textToHighlight={item.text.substring(0, 150) + '...'}
        />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {inlineHint ? <Text style={styles.hintText}>{inlineHint}</Text> : null}
      <View style={styles.header}>
        <ScreenHeaderBackButton
          onPress={handleGoBack}
          testID="action.kbSearch.goBack"
          style={styles.backButton}
        />
        <TextInput
          style={styles.searchInput}
          placeholder="在知识库中搜索..."
          placeholderTextColor={theme.colors.textSecondary}
          value={query}
          onChangeText={handleQueryChange}
          autoFocus
          testID="input.kbSearch.query"
          accessibilityLabel="知识库搜索输入框"
          accessibilityHint="输入关键词以搜索知识库片段和笔记"
          returnKeyType="search"
          submitBehavior="submit"
        />
      </View>

      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterChip, activeFilter === 'all' && styles.activeFilterChip]}
          onPress={() => setFilter('all')}
          testID="filter.kbSearch.all"
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          pressRetentionOffset={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="筛选全部结果"
          accessibilityHint="切换为显示全部类型的搜索结果"
          accessibilityState={{ selected: activeFilter === 'all', disabled: activeFilter === 'all' }}
        >
          <Text style={[styles.filterText, activeFilter === 'all' && styles.activeFilterText]}>全部</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterChip, activeFilter === 'pdf' && styles.activeFilterChip]}
          onPress={() => setFilter('pdf')}
          testID="filter.kbSearch.pdf"
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          pressRetentionOffset={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="筛选PDF结果"
          accessibilityHint="切换为仅显示PDF类型的搜索结果"
          accessibilityState={{ selected: activeFilter === 'pdf', disabled: activeFilter === 'pdf' }}
        >
          <Text style={[styles.filterText, activeFilter === 'pdf' && styles.activeFilterText]}>PDF</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterChip, activeFilter === 'node' && styles.activeFilterChip]}
          onPress={() => setFilter('node')}
          testID="filter.kbSearch.node"
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          pressRetentionOffset={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="筛选笔记结果"
          accessibilityHint="切换为仅显示笔记类型的搜索结果"
          accessibilityState={{ selected: activeFilter === 'node', disabled: activeFilter === 'node' }}
        >
          <Text style={[styles.filterText, activeFilter === 'node' && styles.activeFilterText]}>笔记</Text>
        </TouchableOpacity>
      </View>

      {isSearching ? (
        <ActivityIndicator style={SEARCHING_INDICATOR_STYLE} color={theme.colors.primary} />
      ) : (
        <FlatList
          data={results}
          renderItem={renderItem}
          keyExtractor={(item, index) => item._id || `${item.source?.type || 'src'}:${item.source?.id || item.source?.uri || item.source?.title || 'unknown'}:${index}`}
          style={styles.resultsList}
          ListEmptyComponent={renderListEmpty}
        />
      )}

      <Modal
        transparent
        animationType="fade"
        visible={showActionMenu}
        onRequestClose={closeActionMenu}
        testID="modal.kbSearch.actionMenu"
        accessibilityViewIsModal
      >
        <TouchableOpacity
          style={styles.modalMask}
          activeOpacity={1}
          onPress={closeActionMenu}
          testID="overlay.kbSearch.actionMenuMask"
          accessibilityRole="button"
          accessibilityLabel="关闭搜索结果操作菜单遮罩"
        >
          {Platform.OS === 'ios' ? (
            <BlurView
              style={styles.actionSheet}
              blurType="light"
              blurAmount={18}
              reducedTransparencyFallbackColor={theme.colors.card}
              testID="panel.kbSearch.actionMenu"
              accessibilityRole="menu"
              accessibilityLabel="搜索结果操作菜单"
              accessibilityHint="可选择创建笔记、复制内容或跳转到源"
            >
              <Text
                style={styles.actionSheetTitle}
                numberOfLines={1}
                ellipsizeMode="tail"
                testID="text.kbSearch.actionMenuTitle"
                accessibilityRole="header"
                accessibilityLabel={`搜索结果操作菜单标题：${activeResult?.source?.title || '操作'}`}
              >
                {activeResult?.source?.title || '操作'}
              </Text>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleCreateNoteFromActive}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="创建笔记"
                accessibilityHint="根据当前片段创建一条新的笔记"
                testID="action.kbSearch.createNote"
              >
                <Icon name="note-add" size={18} color={theme.colors.text} style={styles.actionButtonIcon} />
                <Text style={styles.actionButtonText}>创建笔记</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleCopyActiveText}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="复制内容"
                accessibilityHint="复制当前片段文本到剪贴板"
                testID="action.kbSearch.copyContent"
              >
                <Icon name="content-copy" size={18} color={theme.colors.text} style={styles.actionButtonIcon} />
                <Text style={styles.actionButtonText}>复制内容</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleGoToActiveSource}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="跳转到源"
                accessibilityHint="打开当前片段对应的来源位置"
                testID="action.kbSearch.goToSource"
              >
                <Icon name="open-in-new" size={18} color={theme.colors.text} style={styles.actionButtonIcon} />
                <Text style={styles.actionButtonText}>跳转到源</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.actionCancel]}
                onPress={closeActionMenu}
                activeOpacity={0.9}
                accessibilityRole="button"
                accessibilityLabel="取消"
                accessibilityHint="关闭操作菜单并返回搜索结果"
                testID="action.kbSearch.cancelActionMenu"
              >
                <Text style={styles.actionButtonText}>取消</Text>
              </TouchableOpacity>
            </BlurView>
          ) : (
            <View style={styles.actionSheet}>
              <View
                testID="panel.kbSearch.actionMenu"
                accessibilityRole="menu"
                accessibilityLabel="搜索结果操作菜单"
                accessibilityHint="可选择创建笔记、复制内容或跳转到源"
              >
              <Text
                style={styles.actionSheetTitle}
                numberOfLines={1}
                ellipsizeMode="tail"
                testID="text.kbSearch.actionMenuTitle"
                accessibilityRole="header"
                accessibilityLabel={`搜索结果操作菜单标题：${activeResult?.source?.title || '操作'}`}
              >
                {activeResult?.source?.title || '操作'}
              </Text>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleCreateNoteFromActive}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="创建笔记"
                accessibilityHint="根据当前片段创建一条新的笔记"
                testID="action.kbSearch.createNote"
              >
                <Icon name="note-add" size={18} color={theme.colors.text} style={styles.actionButtonIcon} />
                <Text style={styles.actionButtonText}>创建笔记</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleCopyActiveText}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="复制内容"
                accessibilityHint="复制当前片段文本到剪贴板"
                testID="action.kbSearch.copyContent"
              >
                <Icon name="content-copy" size={18} color={theme.colors.text} style={styles.actionButtonIcon} />
                <Text style={styles.actionButtonText}>复制内容</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleGoToActiveSource}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="跳转到源"
                accessibilityHint="打开当前片段对应的来源位置"
                testID="action.kbSearch.goToSource"
              >
                <Icon name="open-in-new" size={18} color={theme.colors.text} style={styles.actionButtonIcon} />
                <Text style={styles.actionButtonText}>跳转到源</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.actionCancel]}
                onPress={closeActionMenu}
                activeOpacity={0.9}
                accessibilityRole="button"
                accessibilityLabel="取消"
                accessibilityHint="关闭操作菜单并返回搜索结果"
                testID="action.kbSearch.cancelActionMenu"
              >
                <Text style={styles.actionButtonText}>取消</Text>
              </TouchableOpacity>
              </View>
            </View>
          )}
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
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
    },
    backButton: {
        flexShrink: 0,
    },
    searchInput: {
        flex: 1,
        height: 40,
        backgroundColor: theme.colors.card,
        borderRadius: 20,
        paddingHorizontal: 15,
        marginLeft: 8,
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
        borderBottomColor: theme.colors.primary + '22',
        backgroundColor: theme.colors.card + 'E8',
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
        backgroundColor: theme.colors.primary + 'E8',
        borderColor: theme.colors.primary + 'CC',
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
        backgroundColor: 'rgba(8,28,56,0.28)',
        justifyContent: 'flex-end',
    },
    actionSheet: {
        backgroundColor: theme.colors.card + 'F2',
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        padding: 16,
        borderTopWidth: 1,
        borderColor: theme.colors.primary + '36',
        shadowColor: '#0B3A75',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.16,
        shadowRadius: 14,
        elevation: 14,
    },
    actionSheetTitle: {
        fontSize: 14,
        color: theme.colors.primary,
        marginBottom: 10,
        fontWeight: '600',
        textAlign: 'center',
    },
    actionButton: {
        paddingVertical: 12,
        paddingHorizontal: 14,
        minHeight: 44,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 12,
        backgroundColor: theme.colors.background + '66',
        marginBottom: 8,
        borderWidth: 1,
        borderColor: theme.colors.primary + '18',
    },
    actionButtonIcon: {
        marginRight: 8,
    },
    actionButtonText: {
        fontSize: 15,
        color: theme.colors.text,
        textAlign: 'center',
        fontWeight: '600',
    },
    actionCancel: {
        borderTopWidth: 1,
        borderTopColor: theme.colors.primary + '22',
        marginTop: 6,
        marginBottom: 0,
        backgroundColor: theme.colors.card + 'CC',
    },
});

export default KnowledgeBaseSearchScreen;


