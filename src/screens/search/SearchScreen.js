import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
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
  SearchHistory
} from '../../components/search';

/**
 * 搜索屏幕
 * 集成多模态搜索和搜索结果展示
 */
const SearchScreen = ({ navigation, route }) => {
  const { theme } = useTheme();
  const { colors } = theme;
  const dispatch = useDispatch();

  // 从Redux获取状态
  const results = useSelector(selectSearchResults);
  const isLoading = useSelector(selectIsLoading);
  const error = useSelector(selectError);

  // 本地状态
  const initialQuery = route.params?.query || '';
  const [searchPerformed, setSearchPerformed] = useState(false);
  const [showHistory, setShowHistory] = useState(!initialQuery);

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
          <MultiModalSearch
            onSearch={handleSearch}
            onCancel={handleCancel}
            initialQuery={initialQuery}
          />
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
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
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
});

export default SearchScreen;
