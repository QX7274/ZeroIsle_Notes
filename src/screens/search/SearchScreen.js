import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Modal,
  Text,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../context/ThemeContext';
import { useDispatch, useSelector } from 'react-redux';
import {
  search,
  clearSearchResults,
  addToSearchHistory,
  selectSearchResults,
  selectIsLoading,
  selectError,
} from '../../redux/slices/searchSlice';
import {
  MultiModalSearch,
  SearchResults,
  SearchHistory,
  UnifiedSearchBar,
} from '../../components/search';

/**
 * 搜索屏幕
 * 集成多模态搜索和搜索结果展示
 */
const SearchScreen = ({ navigation, route }) => {
  const themeContext = useTheme();
  const colors = (themeContext && themeContext.colors) ? themeContext.colors : {
    primary: '#007AFF',
    text: '#000000',
    textSecondary: '#8E8E93',
    card: '#FFFFFF',
    background: '#F2F2F2',
    border: '#E5E5EA',
  };
  const theme = themeContext && themeContext.theme ? themeContext.theme : { colors };
  const dispatch = useDispatch();

  // Build styles after colors are available
  const styles = useMemo(() => getStyles(theme, colors), [colors]);


  // 从Redux获取状态
  const results = useSelector(selectSearchResults);
  const isLoading = useSelector(selectIsLoading);
  const error = useSelector(selectError);

  // 本地状态
  const initialQuery = route.params?.query || '';
  const [searchPerformed, setSearchPerformed] = useState(false);
  const [showHistory, setShowHistory] = useState(!initialQuery);
  const [showHelpModal, setShowHelpModal] = useState(false);

  // 清理搜索结果
  useEffect(() => {
    return () => {
      dispatch(clearSearchResults());
    };
  }, [dispatch]);

  // 处理搜索
  const handleSearch = (searchData) => {
    // 添加到搜索历史
    if (searchData.query) {
      dispatch(addToSearchHistory({
        query: searchData.query,
        mode: searchData.mode || 'text',
        timestamp: new Date().toISOString(),
      }));
    }

    // 执行搜索
    dispatch(search(searchData));
    setSearchPerformed(true);
    setShowHistory(false);
  };

  // 处理历史项点击
  const handleHistoryItemPress = (query, mode) => {
    // 执行搜索
    dispatch(search({ query, mode }));
    setSearchPerformed(true);
    setShowHistory(false);
  };

  // 处理取消
  const handleCancel = () => {
    navigation.goBack();
  };

  // 处理结果点击
  const handleResultPress = (result) => {
    switch (result.type) {
      case 'note':
        navigation.navigate('NoteDetail', { noteId: result.id });
        break;
      case 'tag':
        navigation.navigate('TagNotes', { tagId: result.id, tagName: result.title });
        break;
      case 'knowledge':
        navigation.navigate('NodeDetail', { nodeId: result.id });
        break;
      default:
        break;
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : null}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
      >
        <View style={styles.searchContainer}>
          <UnifiedSearchBar
            searchScope="home"
            resultScreenName="SearchResults"
            onSearch={handleSearch}
            onCancel={handleCancel}
            initialQuery={initialQuery}
          />
          <TouchableOpacity onPress={() => setShowHelpModal(true)} style={styles.helpButton}>
            <Icon name="help-outline" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {searchPerformed ? (
          <View style={styles.resultsContainer}>
            <SearchResults
              results={results}
              isLoading={isLoading}
              error={error}
              onResultPress={handleResultPress}
              navigation={navigation}
            />
          </View>
        ) : showHistory && (
          <View style={styles.historyContainer}>
            <SearchHistory
              onHistoryItemPress={handleHistoryItemPress}
              visible={true}
            />
          </View>
        )}

        <Modal
          visible={showHelpModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowHelpModal(false)}
        >
          <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowHelpModal(false)}>
            <View style={[styles.helpModalContainer, { backgroundColor: colors.card }]}>
              <Text style={styles.helpTitle}>Advanced Search</Text>
              <Text style={styles.helpText}>You can use the following operators to refine your search:</Text>
              <Text style={styles.helpExample}><Text style={styles.operator}>is:</Text>note, pdf, etc.</Text>
              <Text style={styles.helpExample}><Text style={styles.operator}>tag:</Text>#project-name</Text>
              <Text style={styles.helpExample}><Text style={styles.operator}>linked-to:</Text>[[Note Title]]</Text>
            </View>
          </TouchableOpacity>
        </Modal>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const getStyles = (theme, colors) => StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardAvoidingContainer: {
    flex: 1,
  },
  searchContainer: {
    padding: 16,
  },
  resultsContainer: {
    flex: 1,
  },
  historyContainer: {
    flex: 1,
  },
  helpButton: {
    marginLeft: 10,
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  helpModalContainer: {
    width: '80%',
    padding: 20,
    borderRadius: 10,
  },
  helpTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  helpText: {
    fontSize: 16,
    marginBottom: 10,
  },
  helpExample: {
    fontSize: 14,
    marginBottom: 5,
  },
  operator: {
    fontWeight: 'bold',
    color: colors.primary,
  },
});

export default SearchScreen;
